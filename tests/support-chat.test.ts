/**
 * 站内咨询的行为测试。
 *
 * 覆盖的都是另外两批复盘里真实出过事的点，不是happy path 走一遍：
 *   - 打开面板不建会话，首条真实消息才建；
 *   - clientMsgId 幂等（双击 / 重试 / 双标签页）；
 *   - 并发发送不丢消息、不分叉成两条会话；
 *   - 限流并发不可绕过；
 *   - 会话跨人不串线；
 *   - 通知只有摘要、没有正文；
 *   - 外发箱失败要重投、崩在 sending 的租约要能回收；
 *   - 自动回复必须自报是机器人。
 *
 * 存储用内存适配器（与 MySQL 版同一套唯一约束语义）。**没有连过真实 MySQL**，
 * 生产 DDL 与真并发隔离级别未在本轮验证。
 */

import { describe, expect, it, vi } from "vitest";
import {
  SUPPORT_AUTO_DISCLOSURE,
  SUPPORT_MESSAGE_MAX_LENGTH,
} from "../shared/support/contracts";
import { buildAutoReply, matchSupportFaq } from "../lib/support-faq";
import {
  createMemorySupportStore,
  hashVisitorToken,
  type SupportStore,
} from "../server/support/store";
import {
  SUPPORT_RATE_LIMITS,
  SupportError,
  fetchVisitorThread,
  getAdminThread,
  listAdminConversations,
  replyAsOperator,
  sendCustomerMessage,
  setConversationStatus,
} from "../server/support/service";
import {
  buildDedupeKey,
  buildNotificationSummary,
  processDueSupportNotifications,
  resolveTelegramConfig,
} from "../server/support/notify";

const TOKEN_A = "visitor-token-aaaaaaaaaaaaaaaa";
const TOKEN_B = "visitor-token-bbbbbbbbbbbbbbbb";

function noopDrain() {}

function send(store: SupportStore, overrides: Record<string, any> = {}) {
  return sendCustomerMessage({
    visitorToken: TOKEN_A,
    userId: null,
    ip: "203.0.113.7",
    body: "这个 EA 多少钱？",
    clientMsgId: `msg-${Math.random().toString(36).slice(2, 12)}`,
    strategyId: null,
    pageUrl: "https://www.eaxau.com/strategy/30",
    locale: "zh",
    store,
    scheduleDrain: noopDrain,
    ...overrides,
  } as any);
}

describe("自动值守 FAQ", () => {
  it("每条自动回复都自报是机器人，不冒充真人", () => {
    const samples = ["多少钱", "怎么安装", "能退款吗", "随便说点什么没有关键词"];
    for (const sample of samples) {
      const reply = buildAutoReply(sample, { strategyTitle: "金戈铁马", strategyId: 30 });
      expect(reply.body.startsWith(`【${SUPPORT_AUTO_DISCLOSURE.zh}】`)).toBe(true);
    }
  });

  it("命中价格规则时不编造具体价格", () => {
    const match = matchSupportFaq("这个多少钱", { strategyTitle: "金戈铁马", strategyId: 30 });
    expect(match?.key).toBe("price");
    expect(match?.body).not.toMatch(/\d+\s*元/);
    expect(match?.body).toContain("金戈铁马");
  });

  it("问收益时明确拒绝收益承诺", () => {
    const match = matchSupportFaq("年化收益多少，会爆仓吗");
    expect(match?.key).toBe("performance");
    expect(match?.body).toContain("不做任何收益承诺");
  });

  it("答不上来就说答不上来，并交给真人", () => {
    const reply = buildAutoReply("请帮我预测下周金价走势", {});
    expect(reply.ruleKey).toBe("fallback");
    expect(reply.body).toContain("我答不了");
    expect(reply.body).toContain("真人顾问");
  });

  it("配置了 QQ 就把 QQ 入口带出来", () => {
    const reply = buildAutoReply("怎么安装", { qq: "1226426670" });
    expect(reply.body).toContain("1226426670");
  });

  it("付款规则不在自动回复里发收款账号", () => {
    const match = matchSupportFaq("怎么付款");
    expect(match?.key).toBe("payment");
    expect(match?.body).toContain("不在这里发收款账号");
  });
});

describe("会话创建时机", () => {
  it("只读线程不会创建任何会话（弹窗打开 ≠ 一条线索）", async () => {
    const store = createMemorySupportStore();
    const thread = await fetchVisitorThread({
      visitorToken: TOKEN_A,
      userId: null,
      strategyId: 1,
      afterId: 0,
      store,
    });
    expect(thread.conversation).toBeNull();
    expect(await store.countConversations("all")).toBe(0);
  });

  it("首条真实消息才建会话，并立刻带出自动回复", async () => {
    const store = createMemorySupportStore();
    const result = await send(store, { strategyId: 1 });
    expect(await store.countConversations("all")).toBe(1);
    expect(result.conversation.customerMessageCount).toBe(1);
    expect(result.messages.map((m) => m.role)).toEqual(["customer", "auto"]);
    expect(result.messages[1].body).toContain(SUPPORT_AUTO_DISCLOSURE.zh);
  });

  it("空白消息不建会话", async () => {
    const store = createMemorySupportStore();
    await expect(send(store, { body: "   " })).rejects.toBeInstanceOf(SupportError);
    expect(await store.countConversations("all")).toBe(0);
  });

  it("超长消息被拒，不落库", async () => {
    const store = createMemorySupportStore();
    await expect(
      send(store, { body: "x".repeat(SUPPORT_MESSAGE_MAX_LENGTH + 1) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await store.countConversations("all")).toBe(0);
  });

  it("同一访客同一商品永远只有一条会话线", async () => {
    const store = createMemorySupportStore();
    const first = await send(store, { strategyId: 1, body: "价格" });
    const second = await send(store, { strategyId: 1, body: "怎么安装" });
    expect(second.conversation.publicNo).toBe(first.conversation.publicNo);
    expect(await store.countConversations("all")).toBe(1);
  });

  it("不同商品分开建线，互不串", async () => {
    const store = createMemorySupportStore();
    await send(store, { strategyId: 1, body: "价格" });
    await send(store, { strategyId: 2, body: "价格" });
    expect(await store.countConversations("all")).toBe(2);
  });
});

describe("幂等与并发", () => {
  it("同一个 clientMsgId 重复提交只落一条，且不重复触发自动回复", async () => {
    const store = createMemorySupportStore();
    const first = await send(store, { clientMsgId: "dup-client-msg-1" });
    const second = await send(store, { clientMsgId: "dup-client-msg-1" });
    expect(second.duplicate).toBe(true);
    expect(second.messages.length).toBe(first.messages.length);
    expect(second.conversation.customerMessageCount).toBe(1);
    expect(second.messages.filter((m) => m.role === "auto")).toHaveLength(1);
  });

  it("并发发三条不同消息：三条都在，一条都不丢，会话只有一条", async () => {
    const store = createMemorySupportStore();
    const results = await Promise.all([
      send(store, { clientMsgId: "concurrent-msg-1", body: "价格是多少" }),
      send(store, { clientMsgId: "concurrent-msg-2", body: "怎么安装" }),
      send(store, { clientMsgId: "concurrent-msg-3", body: "能退款吗" }),
    ]);
    expect(results.every((r) => r.duplicate === false)).toBe(true);
    expect(await store.countConversations("all")).toBe(1);
    const thread = await fetchVisitorThread({
      visitorToken: TOKEN_A,
      userId: null,
      strategyId: null,
      afterId: 0,
      store,
    });
    const customerMessages = thread.messages.filter((m) => m.role === "customer");
    expect(customerMessages).toHaveLength(3);
    // 每条客户消息都配了一条自动回复，一条都没被并发吞掉
    expect(thread.messages.filter((m) => m.role === "auto")).toHaveLength(3);
    // id 严格递增，没有重号
    const ids = thread.messages.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("并发重复提交同一 clientMsgId 也只落一条", async () => {
    const store = createMemorySupportStore();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => send(store, { clientMsgId: "race-same-id" })),
    );
    const created = results.filter((r) => r.duplicate === false);
    expect(created).toHaveLength(1);
    const conversation = await store.findConversationByVisitor(hashVisitorToken(TOKEN_A), 0);
    expect(conversation?.customerMessageCount).toBe(1);
  });
});

describe("限流", () => {
  it("并发打满也挡得住：超出访客每分钟上限的请求全部被拒", async () => {
    const store = createMemorySupportStore();
    const limit = SUPPORT_RATE_LIMITS.visitorPerMinute.limit;
    const attempts = limit + 6;
    const outcomes = await Promise.allSettled(
      Array.from({ length: attempts }, (_, i) =>
        send(store, { clientMsgId: `burst-msg-${i}`, body: `问题 ${i}` }),
      ),
    );
    const ok = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter(
      (o) => o.status === "rejected" && (o.reason as SupportError).code === "TOO_MANY_REQUESTS",
    );
    expect(ok.length).toBeLessThanOrEqual(limit);
    expect(rejected.length).toBeGreaterThanOrEqual(attempts - limit);
  });

  it("被限流的请求不会留下半条会话", async () => {
    const store = createMemorySupportStore();
    const limit = SUPPORT_RATE_LIMITS.visitorPerMinute.limit;
    for (let i = 0; i < limit; i++) {
      await send(store, { clientMsgId: `fill-${i}`, body: `问题 ${i}` });
    }
    await expect(send(store, { clientMsgId: "over-limit" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    const conversation = await store.findConversationByVisitor(hashVisitorToken(TOKEN_A), 0);
    expect(conversation?.customerMessageCount).toBe(limit);
  });
});

describe("会话归属与隔离", () => {
  it("换一个访客令牌读不到别人的会话", async () => {
    const store = createMemorySupportStore();
    await send(store, { strategyId: 1 });
    const other = await fetchVisitorThread({
      visitorToken: TOKEN_B,
      userId: null,
      strategyId: 1,
      afterId: 0,
      store,
    });
    expect(other.conversation).toBeNull();
  });

  it("聊到一半登录：收归账号，不另起一条新会话", async () => {
    const store = createMemorySupportStore();
    const guest = await send(store, { strategyId: 1, body: "价格" });
    const member = await send(store, { strategyId: 1, body: "我登录了", userId: 42 });
    expect(member.conversation.publicNo).toBe(guest.conversation.publicNo);
    expect(await store.countConversations("all")).toBe(1);
    const conversation = await store.findConversationByVisitor(hashVisitorToken(TOKEN_A), 1);
    expect(conversation?.userId).toBe(42);
  });

  it("会话绑定账号后，同一浏览器换人（或登出）拿残留令牌读不回去", async () => {
    const store = createMemorySupportStore();
    await send(store, { strategyId: 1, userId: 42, body: "价格" });

    await expect(
      fetchVisitorThread({
        visitorToken: TOKEN_A,
        userId: null,
        strategyId: 1,
        afterId: 0,
        store,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      fetchVisitorThread({
        visitorToken: TOKEN_A,
        userId: 99,
        strategyId: 1,
        afterId: 0,
        store,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("令牌太短直接拒绝，不给人拿短串去撞别人的会话", async () => {
    const store = createMemorySupportStore();
    await expect(send(store, { visitorToken: "abc" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("用户可见的增量轮询", () => {
  it("运营回复后，客户按游标轮询能拿到新消息", async () => {
    const store = createMemorySupportStore();
    const sent = await send(store, { strategyId: 1 });
    const lastId = sent.messages[sent.messages.length - 1].id;

    await replyAsOperator({
      publicNo: sent.conversation.publicNo,
      body: "你好，这款按 3 个账户授权报价，我把清单发你。",
      operatorId: 7,
      store,
    });

    const incremental = await fetchVisitorThread({
      visitorToken: TOKEN_A,
      userId: null,
      strategyId: 1,
      afterId: lastId,
      store,
    });
    const operatorMessages = incremental.messages.filter((m) => m.role === "operator");
    expect(operatorMessages).toHaveLength(1);
    expect(operatorMessages[0].body).toContain("3 个账户");
    expect(incremental.conversation?.status).toBe("answered");
  });

  it("增量查询带安全重叠窗口，刚落库的消息不会因为游标跳号而丢失", async () => {
    const store = createMemorySupportStore();
    const sent = await send(store, { strategyId: 1 });
    const lastId = sent.messages[sent.messages.length - 1].id;
    await replyAsOperator({
      publicNo: sent.conversation.publicNo,
      body: "刚刚回复",
      operatorId: 7,
      store,
    });
    // 客户端游标比真实 id 还大（模拟 id 分配与可见顺序不一致）
    const thread = await fetchVisitorThread({
      visitorToken: TOKEN_A,
      userId: null,
      strategyId: 1,
      afterId: lastId + 50,
      store,
    });
    expect(thread.messages.some((m) => m.body === "刚刚回复")).toBe(true);
  });
});

describe("管理员看与回复", () => {
  it("后台能列出会话、看到全部历史并回复", async () => {
    const store = createMemorySupportStore();
    const sent = await send(store, { strategyId: 1, body: "这个能绑几个账户" });

    const list = await listAdminConversations({ store });
    expect(list.total).toBe(1);
    expect(list.items[0].publicNo).toBe(sent.conversation.publicNo);
    expect(list.items[0].identity).toBe("guest");

    const thread = await getAdminThread({ publicNo: sent.conversation.publicNo, store });
    expect(thread.messages.map((m) => m.role)).toEqual(["customer", "auto"]);

    const replied = await replyAsOperator({
      publicNo: sent.conversation.publicNo,
      body: "默认 3 个账户，可加购。",
      operatorId: 7,
      store,
    });
    expect(replied.conversation.status).toBe("answered");
    expect(replied.messages[replied.messages.length - 1].role).toBe("operator");
  });

  it("客户再次发言会把已回复的会话重新置为待处理", async () => {
    const store = createMemorySupportStore();
    const sent = await send(store, { strategyId: 1, body: "价格" });
    await replyAsOperator({
      publicNo: sent.conversation.publicNo,
      body: "报价发你了",
      operatorId: 7,
      store,
    });
    const again = await send(store, { strategyId: 1, body: "还有别的版本吗", clientMsgId: "follow-up-1" });
    expect(again.conversation.status).toBe("open");
  });

  it("关闭的会话不会被新消息自动重开，但消息照样收得到", async () => {
    const store = createMemorySupportStore();
    const sent = await send(store, { strategyId: 1, body: "价格" });
    await setConversationStatus({ publicNo: sent.conversation.publicNo, status: "closed", store });
    const after = await send(store, { strategyId: 1, body: "补充一句", clientMsgId: "after-close-1" });
    expect(after.conversation.status).toBe("closed");
    expect(after.conversation.customerMessageCount).toBe(2);
  });

  it("找不到的会话编号报 NOT_FOUND，不泄露是否存在别人的会话内容", async () => {
    const store = createMemorySupportStore();
    await expect(getAdminThread({ publicNo: "EAX-NOPE", store })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("Telegram 提醒", () => {
  it("摘要里只有编号、商品、条数和后台链接，没有正文", () => {
    const summary = buildNotificationSummary(
      {
        publicNo: "EAX-ABC1234",
        strategyTitle: "金戈铁马 V5.2",
        strategyId: 30,
        customerMessageCount: 2,
        status: "open",
        identity: "guest",
      },
      { PUBLIC_SITE_URL: "https://www.eaxau.com" } as any,
    );
    expect(summary).toContain("EAX-ABC1234");
    expect(summary).toContain("金戈铁马 V5.2");
    expect(summary).toContain("https://www.eaxau.com/admin/support?no=EAX-ABC1234");
    expect(summary).toContain("正文不进 Telegram");
  });

  it("商品名里的换行/控制字符被压平，防止往通知里注入内容", () => {
    const summary = buildNotificationSummary(
      {
        publicNo: "EAX-ABC1234",
        strategyTitle: "正常名\n伪造行：请汇款到 123456",
        strategyId: 30,
        customerMessageCount: 1,
        status: "open",
        identity: "guest",
      },
      {} as any,
    );
    const productLine = summary.split("\n").find((line) => line.startsWith("商品"))!;
    expect(productLine).toContain("伪造行");
    expect(summary.split("\n")).toHaveLength(6);
  });

  it("客户消息正文不会出现在排入外发箱的摘要里", async () => {
    const store = createMemorySupportStore();
    const secret = "我的QQ是1234567890请加我微信abcdefg";
    const sent = await send(store, { strategyId: 1, body: secret });
    const conversation = await store.findConversationByPublicNo(sent.conversation.publicNo);
    const notifications = await store.listNotifications(conversation!.id);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].summary).not.toContain(secret);
    expect(notifications[0].summary).not.toContain("1234567890");
    expect(notifications[0].summary).not.toContain("abcdefg");
  });

  it("同一会话在节流窗口内只排一条通知", async () => {
    const store = createMemorySupportStore();
    const now = new Date("2026-09-13T02:00:00Z");
    const sent = await send(store, { strategyId: 1, body: "价格", clientMsgId: "t-1", now });
    await send(store, { strategyId: 1, body: "怎么装", clientMsgId: "t-2", now });
    const conversation = await store.findConversationByPublicNo(sent.conversation.publicNo);
    const notifications = await store.listNotifications(conversation!.id);
    expect(notifications).toHaveLength(1);
  });

  it("默认不发：没有 live 开关和凭据时记为 held，不谎称已发送", async () => {
    const store = createMemorySupportStore();
    await send(store, { strategyId: 1 });
    const result = await processDueSupportNotifications({
      store,
      env: {} as any,
      sender: async () => {
        throw new Error("不应该调用真实发送");
      },
    });
    expect(result.mode).toBe("dry_run");
    expect(result.held).toBe(1);
    expect(result.sent).toBe(0);
    const notifications = await store.listNotifications(1);
    expect(notifications[0].status).toBe("held");
    expect(notifications[0].sentAt).toBeNull();
  });

  it("凭据齐全且 live 时才真发", async () => {
    const store = createMemorySupportStore();
    await send(store, { strategyId: 1 });
    const sender = vi.fn(async () => ({ ok: true, retryable: false }));
    const result = await processDueSupportNotifications({
      store,
      env: {
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_CHAT_ID: "-100123",
        SUPPORT_TELEGRAM_NOTIFY_MODE: "live",
      } as any,
      sender,
    });
    expect(result.mode).toBe("live");
    expect(result.sent).toBe(1);
    expect(sender).toHaveBeenCalledTimes(1);
    const notifications = await store.listNotifications(1);
    expect(notifications[0].status).toBe("sent");
    expect(notifications[0].sentAt).not.toBeNull();
  });

  it("凭据缺一半就不算 live，绝不半开着往外发", () => {
    expect(
      resolveTelegramConfig({
        SUPPORT_TELEGRAM_NOTIFY_MODE: "live",
        TELEGRAM_BOT_TOKEN: "token",
      } as any).mode,
    ).toBe("dry_run");
    expect(
      resolveTelegramConfig({
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_CHAT_ID: "-100123",
      } as any).mode,
    ).toBe("dry_run");
  });

  it("可重试失败会退避后重投，不是一次失败就静默丢掉", async () => {
    const store = createMemorySupportStore();
    await send(store, { strategyId: 1 });
    const env = {
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_CHAT_ID: "-100123",
      SUPPORT_TELEGRAM_NOTIFY_MODE: "live",
    } as any;

    const first = await processDueSupportNotifications({
      store,
      env,
      now: new Date("2026-09-13T02:00:00Z"),
      sender: async () => ({ ok: false, retryable: true, error: "http_502" }),
    });
    expect(first.retried).toBe(1);
    let notifications = await store.listNotifications(1);
    expect(notifications[0].status).toBe("pending");
    expect(notifications[0].attempts).toBe(1);
    expect(notifications[0].lastError).toBe("http_502");

    // 退避没到点：这一轮不该重投
    const tooSoon = await processDueSupportNotifications({
      store,
      env,
      now: new Date("2026-09-13T02:00:05Z"),
      sender: async () => ({ ok: true, retryable: false }),
    });
    expect(tooSoon.claimed).toBe(0);

    const later = await processDueSupportNotifications({
      store,
      env,
      now: new Date("2026-09-13T02:05:00Z"),
      sender: async () => ({ ok: true, retryable: false }),
    });
    expect(later.sent).toBe(1);
    notifications = await store.listNotifications(1);
    expect(notifications[0].status).toBe("sent");
  });

  it("不可重试的失败直接记 failed，留下原因，不无限重投", async () => {
    const store = createMemorySupportStore();
    await send(store, { strategyId: 1 });
    const result = await processDueSupportNotifications({
      store,
      env: {
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_CHAT_ID: "-100123",
        SUPPORT_TELEGRAM_NOTIFY_MODE: "live",
      } as any,
      sender: async () => ({ ok: false, retryable: false, error: "http_403" }),
    });
    expect(result.failed).toBe(1);
    const notifications = await store.listNotifications(1);
    expect(notifications[0].status).toBe("failed");
    expect(notifications[0].lastError).toBe("http_403");
  });

  it("进程崩在 sending 上的行，租约超时后能被下一轮回收", async () => {
    const store = createMemorySupportStore();
    await send(store, { strategyId: 1 });
    const claimed = await store.claimDueNotifications({
      now: new Date("2026-09-13T02:00:00Z"),
      limit: 10,
      leaseTimeoutMs: 5 * 60_000,
    });
    expect(claimed).toHaveLength(1);
    // 这里模拟 worker 崩溃：认领了但从不调用 finishNotification

    const stuck = await store.listNotifications(1);
    expect(stuck[0].status).toBe("sending");

    const recovered = await processDueSupportNotifications({
      store,
      now: new Date("2026-09-13T02:30:00Z"),
      env: {
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_CHAT_ID: "-100123",
        SUPPORT_TELEGRAM_NOTIFY_MODE: "live",
      } as any,
      sender: async () => ({ ok: true, retryable: false }),
    });
    expect(recovered.claimed).toBe(1);
    expect(recovered.sent).toBe(1);
  });

  it("同一行不会被两个 worker 同时认领", async () => {
    const store = createMemorySupportStore();
    await send(store, { strategyId: 1 });
    const now = new Date("2026-09-13T02:00:00Z");
    const [a, b] = await Promise.all([
      store.claimDueNotifications({ now, limit: 10, leaseTimeoutMs: 5 * 60_000 }),
      store.claimDueNotifications({ now, limit: 10, leaseTimeoutMs: 5 * 60_000 }),
    ]);
    expect(a.length + b.length).toBe(1);
  });

  it("节流键按会话 + 时间窗划分，不同会话不会互相覆盖", () => {
    const now = new Date("2026-09-13T02:00:00Z");
    expect(buildDedupeKey(1, now)).not.toBe(buildDedupeKey(2, now));
    expect(buildDedupeKey(1, now)).toBe(buildDedupeKey(1, new Date("2026-09-13T02:04:00Z")));
    expect(buildDedupeKey(1, now)).not.toBe(buildDedupeKey(1, new Date("2026-09-13T02:06:00Z")));
  });
});
