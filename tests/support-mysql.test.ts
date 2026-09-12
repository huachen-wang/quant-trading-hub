/**
 * 站内咨询的**存储契约测试 —— 打真实 MySQL**。
 *
 * 为什么必须有这一层：独立复核在 MySQL 8.4 上打出的阻断级缺陷（重复键被 drizzle 包成
 * `DrizzleQueryError`，`code`/`errno` 只在 `.cause` 上，撞键判定永远为 false → 幂等和并发全部 500）
 * 在内存适配器上**根本复现不出来**——内存实现不会抛重复键错误。所以并发、幂等、事务、
 * 限流这些断言只有打真库才算数。
 *
 * 跑法（用复核留下的隔离实例，不重新下载）：
 *   bash <review>/verify/start-mysql.sh
 *   SUPPORT_TEST_DATABASE_URL='mysql://review:review-local-throwaway@127.0.0.1:3399/eaxau_fix' \
 *     npx vitest run tests/support-mysql.test.ts
 *
 * 没配 `SUPPORT_TEST_DATABASE_URL` 时整个套件跳过，并在输出里明说「未验证」，
 * 不制造「全绿=已验收」的假象。
 */

import mysql from "mysql2/promise";
import { getTableColumns } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";
import { ensureSupportChatSchema } from "../server/migrate";
import {
  createMysqlSupportStore,
  findDuplicateKeyName,
  hashVisitorToken,
  UNIQUE_INDEX,
  type SupportStore,
} from "../server/support/store";
import {
  claimAnonymousConversation,
  fetchVisitorThread,
  listAdminConversations,
  replyAsOperator,
  sendCustomerMessage,
} from "../server/support/service";
import { buildDedupeKey, processDueSupportNotifications } from "../server/support/notify";

const CONNECTION_URI = process.env.SUPPORT_TEST_DATABASE_URL?.trim();
const describeIfDb = CONNECTION_URI ? describe : describe.skip;

if (!CONNECTION_URI) {
  console.warn(
    "[support-mysql] SUPPORT_TEST_DATABASE_URL 未设置 —— 存储契约测试全部跳过。" +
      "并发 / 幂等 / 事务 / 限流本次【未验证】，不要按「测试全绿」验收。",
  );
}

const TOKEN_A = "mysql-visitor-token-aaaaaaaaaaaa";
const TOKEN_B = "mysql-visitor-token-bbbbbbbbbbbb";
const TOKEN_C = "mysql-visitor-token-cccccccccccc";

function noopDrain() {}

describeIfDb("站内咨询 · 真实 MySQL 存储契约", () => {
  let connection: mysql.Connection;
  let store: SupportStore;
  let close: () => Promise<void>;

  // 服务端现在**要求**身份绑定（缺绑定 = 拒绝并要求刷新），所以 helper 按 userId 补一个默认值；
  // 竞态用例在自己的 it 里显式覆盖 expectedIdentity。
  const send = (overrides: Record<string, any> = {}) =>
    sendCustomerMessage({
      expectedIdentity: overrides.userId ? `user:${overrides.userId}` : "guest",
      visitorToken: TOKEN_A,
      userId: null,
      ip: "203.0.113.9",
      body: "这个 EA 多少钱？",
      clientMsgId: `mysql-${Math.random().toString(36).slice(2, 12)}`,
      strategyId: null,
      pageUrl: null,
      locale: "zh",
      store,
      scheduleDrain: noopDrain,
      ...overrides,
    } as any);

  beforeAll(async () => {
    connection = await mysql.createConnection(CONNECTION_URI!);
    // 跑的就是 server/migrate.ts 里那段生产 DDL 本身，不是另抄一份。
    await ensureSupportChatSchema(connection);
    const created = createMysqlSupportStore(CONNECTION_URI!);
    store = created.store;
    close = created.close;
  });

  afterAll(async () => {
    await close?.();
    await connection?.end();
  });

  beforeEach(async () => {
    // 只清本测试自己的四张表，不碰库里别的东西。
    await connection.query("DELETE FROM support_notifications");
    await connection.query("DELETE FROM support_messages");
    await connection.query("DELETE FROM support_conversations");
    await connection.query("DELETE FROM support_rate_limits");
  });

  it("用的是 MySQL 适配器，不是内存实现", () => {
    expect(store.kind).toBe("mysql");
  });

  describe("P1 升级路径：库里已经有旧版表", () => {
    /**
     * 复核回合 2 的 P1：`CREATE TABLE IF NOT EXISTS` 对已存在的表是 no-op，
     * 所以这一版新加的 `notifyGeneration` / `generation` 在**升级**的库上永远补不上，
     * 升完每一次咨询请求都 `Unknown column`。而上一轮所有测试库都是全新建的，
     * 全新安装路径把升级路径完全掩盖了。
     *
     * 这里用「建新表再把新列 DROP 掉」精确模拟上一版的库——不依赖 git 历史，
     * 任何环境都能跑。真·上一版 DDL 的验证在 `verify/support-upgrade-e2e.mts`
     * （从 `git show cdbaefb:server/migrate.ts` 原样取）。
     */
    const downgradeToPreviousSchema = async () => {
      await connection.query(
        "ALTER TABLE `support_conversations` DROP COLUMN `notifyGeneration`",
      );
      await connection.query("ALTER TABLE `support_notifications` DROP COLUMN `generation`");
    };

    const columnsOf = async (table: string) => {
      const [rows]: any = await connection.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        [table],
      );
      return new Set(rows.map((r: any) => String(r.COLUMN_NAME)));
    };

    it("旧 schema → 跑迁移 → 新列补上，客户能正常发消息", async () => {
      await downgradeToPreviousSchema();
      expect(await columnsOf("support_conversations")).not.toContain("notifyGeneration");
      expect(await columnsOf("support_notifications")).not.toContain("generation");

      const statements = await ensureSupportChatSchema(connection);
      expect(statements).toBeGreaterThanOrEqual(2); // 至少两条 ADD COLUMN

      expect(await columnsOf("support_conversations")).toContain("notifyGeneration");
      expect(await columnsOf("support_notifications")).toContain("generation");

      // 光有列不算数：走一遍真实业务入口，确认升级后的库真的能用
      const sent = await send({ clientMsgId: "upgrade-1", body: "升级后第一条消息" });
      expect(sent.duplicate).toBe(false);
      expect(sent.conversation.publicNo).toMatch(/^EAX-/);
      const [rows]: any = await connection.query(
        "SELECT notifyGeneration FROM support_conversations WHERE publicNo = ?",
        [sent.conversation.publicNo],
      );
      expect(Number(rows[0].notifyGeneration)).toBe(0);
      const [notifications]: any = await connection.query(
        "SELECT generation FROM support_notifications",
      );
      expect(Number(notifications[0].generation)).toBe(0);
    });

    it("已经是最新的库再跑一遍：一句 SQL 都不跑，也不报错（幂等）", async () => {
      await ensureSupportChatSchema(connection); // 先确保是最新态，不依赖用例顺序
      const first = await ensureSupportChatSchema(connection);
      const second = await ensureSupportChatSchema(connection);
      expect(first).toBe(0);
      expect(second).toBe(0);
    });

    it("漂移守卫：schema.ts 声明的每一列，升级后的库里都得有", async () => {
      // 忘了往 SUPPORT_ADDED_COLUMNS 登记新列的话，这条会直接挂。
      await downgradeToPreviousSchema();
      await ensureSupportChatSchema(connection);

      const declared: Array<[string, string[]]> = [
        [
          "support_conversations",
          Object.values(getTableColumns(schema.supportConversations)).map((c: any) => c.name),
        ],
        [
          "support_messages",
          Object.values(getTableColumns(schema.supportMessages)).map((c: any) => c.name),
        ],
        [
          "support_notifications",
          Object.values(getTableColumns(schema.supportNotifications)).map((c: any) => c.name),
        ],
        [
          "support_rate_limits",
          Object.values(getTableColumns(schema.supportRateLimits)).map((c: any) => c.name),
        ],
      ];
      for (const [table, columns] of declared) {
        const actual = await columnsOf(table);
        const missing = columns.filter((name) => !actual.has(name));
        expect(missing, `${table} 少了这些列（去 SUPPORT_ADDED_COLUMNS 登记）`).toEqual([]);
      }
    });
  });

  describe("B1 重复键识别", () => {
    it("drizzle 把 ER_DUP_ENTRY 包进 cause，仍然认得出来并给出索引名", async () => {
      const conversation = await store.ensureConversation({
        visitorTokenHash: hashVisitorToken(TOKEN_A),
        userId: null,
        strategyId: null,
        strategyTitle: null,
        pageUrl: null,
        locale: "zh",
      });
      await store.appendMessage({
        conversationId: conversation.id,
        role: "customer",
        body: "第一条",
        clientMsgId: "dup-probe-1",
      });

      // 直接打库制造一次真实撞键，检查错误对象的实际形状
      let raw: unknown = null;
      try {
        await connection.query(
          "INSERT INTO support_messages (conversationId, role, body, clientMsgId) VALUES (?,?,?,?)",
          [conversation.id, "customer", "第二条", "dup-probe-1"],
        );
      } catch (error) {
        raw = error;
      }
      expect(raw).not.toBeNull();
      expect(findDuplicateKeyName(raw)).toBe(UNIQUE_INDEX.messageClientMsgId);

      // 包一层再包一层，cause 链照样解得开（drizzle 就是这么包的）
      const wrapped = new Error("Failed query", { cause: raw as Error });
      const doubleWrapped = new Error("outer", { cause: wrapped });
      expect(findDuplicateKeyName(doubleWrapped)).toBe(UNIQUE_INDEX.messageClientMsgId);

      // 不是重复键的错误不能误判
      expect(findDuplicateKeyName(new Error("boom"))).toBeNull();
      expect(findDuplicateKeyName(null)).toBeNull();
    });

    it("cause 链成环也不会死循环", () => {
      const a: any = new Error("a");
      const b: any = new Error("b");
      a.cause = b;
      b.cause = a;
      expect(findDuplicateKeyName(a)).toBeNull();
    });

    it("客户重试同一条消息：不报错、不重复入库、不重复触发机器人", async () => {
      const first = await send({ clientMsgId: "retry-same-1", body: "重试探针" });
      expect(first.duplicate).toBe(false);

      const second = await send({ clientMsgId: "retry-same-1", body: "重试探针" });
      expect(second.duplicate).toBe(true);
      expect(second.conversation.customerMessageCount).toBe(1);

      const [rows]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_messages WHERE clientMsgId = ?",
        ["retry-same-1"],
      );
      expect(Number(rows[0].n)).toBe(1);
      const [autos]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_messages WHERE role = 'auto'",
      );
      expect(Number(autos[0].n)).toBe(1);
    });

    it("同一访客多连接并发发第一条：只建一条会话，一条都不 500，一条都不丢", async () => {
      const results = await Promise.allSettled([
        send({ clientMsgId: "race-a", body: "并发甲" }),
        send({ clientMsgId: "race-b", body: "并发乙" }),
        send({ clientMsgId: "race-c", body: "并发丙" }),
        send({ clientMsgId: "race-d", body: "并发丁" }),
      ]);
      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected.map((r: any) => String(r.reason?.message))).toEqual([]);

      const [conversations]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_conversations",
      );
      expect(Number(conversations[0].n)).toBe(1);
      const [customer]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_messages WHERE role = 'customer'",
      );
      expect(Number(customer[0].n)).toBe(4);
      const [counted]: any = await connection.query(
        "SELECT customerMessageCount FROM support_conversations LIMIT 1",
      );
      expect(Number(counted[0].customerMessageCount)).toBe(4);
    });

    it("并发重复提交同一 clientMsgId：只落一条，其余认成重试", async () => {
      const results = await Promise.all(
        Array.from({ length: 4 }, () => send({ clientMsgId: "race-same-id", body: "同一条" })),
      );
      expect(results.filter((r) => r.duplicate === false)).toHaveLength(1);
      const [rows]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_messages WHERE clientMsgId = ?",
        ["race-same-id"],
      );
      expect(Number(rows[0].n)).toBe(1);
    });
  });

  describe("P2 旧幂等键 + 新正文：新内容不能被静默吞掉", () => {
    it("同键同正文 = 重试，报 duplicate 但不报 bodyMismatch", async () => {
      await send({ clientMsgId: "same-body-1", body: "第一版：这个多少钱" });
      const again = await send({ clientMsgId: "same-body-1", body: "第一版：这个多少钱" });
      expect(again.duplicate).toBe(true);
      expect(again.bodyMismatch).toBe(false);
    });

    it("同键不同正文 = 新内容没落库，服务端明确报 bodyMismatch", async () => {
      await send({ clientMsgId: "edited-1", body: "第一版：这个多少钱" });
      const edited = await send({
        clientMsgId: "edited-1",
        body: "第二版：这个多少钱？另外能装 VPS 吗",
      });
      expect(edited.duplicate).toBe(true);
      // 关键：不能让调用方以为发成功了
      expect(edited.bodyMismatch).toBe(true);

      const [rows]: any = await connection.query(
        "SELECT body FROM support_messages WHERE clientMsgId = ?",
        ["edited-1"],
      );
      expect(rows).toHaveLength(1);
      expect(String(rows[0].body)).toBe("第一版：这个多少钱");
    });

    it("换新键才真的把改后的内容发出去", async () => {
      await send({ clientMsgId: "edited-2", body: "第一版：这个多少钱" });
      const fresh = await send({
        clientMsgId: "edited-2-new",
        body: "第二版：这个多少钱？另外能装 VPS 吗",
      });
      expect(fresh.duplicate).toBe(false);
      expect(fresh.bodyMismatch).toBe(false);
      expect(fresh.conversation.customerMessageCount).toBe(2);
      const bodies = fresh.messages.filter((m) => m.role === "customer").map((m) => m.body);
      expect(bodies).toEqual(["第一版：这个多少钱", "第二版：这个多少钱？另外能装 VPS 吗"]);
    });

    it("客户自己的 clientMsgId 会回传，客户端才能核对「刚才那条到底到没到」", async () => {
      const sent = await send({ clientMsgId: "echo-key-1", body: "核对用" });
      const mine = sent.messages.find((m) => m.role === "customer");
      expect(mine?.clientMsgId).toBe("echo-key-1");
      // 机器人 / 运营的消息不回传这个字段
      expect(sent.messages.find((m) => m.role === "auto")?.clientMsgId).toBeNull();
    });
  });

  describe("H2 回读自己刚写的那一行", () => {
    it("并发 append 各自拿回自己的消息，不串行拿到同一行", async () => {
      const conversation = await store.ensureConversation({
        visitorTokenHash: hashVisitorToken(TOKEN_A),
        userId: null,
        strategyId: null,
        strategyTitle: null,
        pageUrl: null,
        locale: "zh",
      });
      const [a, b] = await Promise.all([
        store.appendMessage({
          conversationId: conversation.id,
          role: "operator",
          body: "AAA",
          operatorId: 1,
        }),
        store.appendMessage({
          conversationId: conversation.id,
          role: "operator",
          body: "BBB",
          operatorId: 2,
        }),
      ]);
      expect(a.message.body).toBe("AAA");
      expect(b.message.body).toBe("BBB");
      expect(a.message.id).not.toBe(b.message.id);
    });
  });

  describe("H3 一轮对话是一个事务", () => {
    it("提醒排队失败会整轮回滚：消息不落库、计数不虚增、不留半条机器人回复", async () => {
      const conversation = await store.ensureConversation({
        visitorTokenHash: hashVisitorToken(TOKEN_A),
        userId: null,
        strategyId: null,
        strategyTitle: null,
        pageUrl: null,
        locale: "zh",
      });

      await expect(
        store.appendCustomerTurn({
          conversationId: conversation.id,
          body: "这一轮应该整体失败",
          clientMsgId: "txn-rollback-1",
          autoReply: { body: "机器人回复", ruleKey: "price" },
          buildNotification: () => {
            throw new Error("模拟提醒排队失败");
          },
        }),
      ).rejects.toThrow("模拟提醒排队失败");

      const [messages]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_messages WHERE conversationId = ?",
        [conversation.id],
      );
      expect(Number(messages[0].n)).toBe(0);
      const [conv]: any = await connection.query(
        "SELECT customerMessageCount FROM support_conversations WHERE id = ?",
        [conversation.id],
      );
      expect(Number(conv[0].customerMessageCount)).toBe(0);

      // 回滚之后客户重试同一条：走的是完整流程，机器人回复也在
      const retry = await store.appendCustomerTurn({
        conversationId: conversation.id,
        body: "这一轮应该整体失败",
        clientMsgId: "txn-rollback-1",
        autoReply: { body: "机器人回复", ruleKey: "price" },
        buildNotification: (fresh) => ({
          dedupeKey: buildDedupeKey(fresh.id, fresh.notifyGeneration),
          summary: "摘要",
        }),
      });
      expect(retry.created).toBe(true);
      expect(retry.autoMessage?.body).toBe("机器人回复");
      expect(retry.conversation.customerMessageCount).toBe(1);
    });

    it("客户消息、机器人回复、提醒三样一起落库", async () => {
      await send({ clientMsgId: "txn-ok-1", body: "多少钱" });
      const [rows]: any = await connection.query(
        "SELECT role, COUNT(*) AS n FROM support_messages GROUP BY role",
      );
      const byRole = Object.fromEntries(rows.map((r: any) => [r.role, Number(r.n)]));
      expect(byRole.customer).toBe(1);
      expect(byRole.auto).toBe(1);
      const [notifications]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_notifications",
      );
      expect(Number(notifications[0].n)).toBe(1);
    });
  });

  describe("M1 限流在并发下的判定", () => {
    it("并发打 10 次、上限 6：正好放行 6 次", async () => {
      const now = new Date();
      const hits = await Promise.all(
        Array.from({ length: 10 }, () =>
          store.hitRateLimit({ bucketKey: "concurrent-probe", windowSeconds: 60, now }),
        ),
      );
      const sorted = [...hits].sort((a, b) => a - b);
      // 每个请求必须拿到互不相同的名次 1..10，才能保证「前 6 个放行」是准确的
      expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(hits.filter((n) => n <= 6)).toHaveLength(6);
    });

    it("顺序调用也正确递增", async () => {
      const now = new Date();
      const out: number[] = [];
      for (let i = 0; i < 4; i++) {
        out.push(await store.hitRateLimit({ bucketKey: "serial-probe", windowSeconds: 60, now }));
      }
      expect(out).toEqual([1, 2, 3, 4]);
    });
  });

  describe("M2 后续消息的提醒不能丢", () => {
    const liveEnv = {
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_CHAT_ID: "-100123",
      SUPPORT_TELEGRAM_NOTIFY_MODE: "live",
    } as any;

    it("提醒发出后客户再追问，排的是新的一条提醒", async () => {
      await send({ clientMsgId: "notify-1", body: "第一条" });
      const first = await processDueSupportNotifications({
        store,
        env: liveEnv,
        sender: async () => ({ ok: true, retryable: false }),
      });
      expect(first.sent).toBe(1);

      await send({ clientMsgId: "notify-2", body: "第二条追问" });
      const [rows]: any = await connection.query(
        "SELECT status, summary, generation FROM support_notifications ORDER BY id",
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].status).toBe("sent");
      expect(rows[1].status).toBe("pending");
      expect(rows[1].generation).toBe(1);
      expect(String(rows[1].summary)).toContain("客户消息 2 条");

      const second = await processDueSupportNotifications({
        store,
        env: liveEnv,
        sender: async () => ({ ok: true, retryable: false }),
      });
      expect(second.sent).toBe(1);
    });

    it("提醒还没发出去时，追问只更新摘要不新增行", async () => {
      await send({ clientMsgId: "coalesce-1", body: "第一条" });
      await send({ clientMsgId: "coalesce-2", body: "第二条" });
      const [rows]: any = await connection.query(
        "SELECT status, summary FROM support_notifications ORDER BY id",
      );
      expect(rows).toHaveLength(1);
      expect(String(rows[0].summary)).toContain("客户消息 2 条");
    });

    it("默认 dry_run：记 held，不谎称已发送；摘要里没有客户正文", async () => {
      const secret = "我的QQ是1234567890请加我";
      await send({ clientMsgId: "dry-1", body: secret });
      const result = await processDueSupportNotifications({
        store,
        env: {} as any,
        sender: async () => {
          throw new Error("dry_run 下不该调用真实发送");
        },
      });
      expect(result.mode).toBe("dry_run");
      expect(result.held).toBe(1);
      const [rows]: any = await connection.query(
        "SELECT status, sentAt, lastError, summary FROM support_notifications",
      );
      expect(rows[0].status).toBe("held");
      expect(rows[0].sentAt).toBeNull();
      expect(String(rows[0].summary)).not.toContain("1234567890");
    });

    it("dry_run 反复扫描不会让 attempts 一直涨", async () => {
      await send({ clientMsgId: "attempts-1", body: "attempts 探针" });
      for (let round = 0; round < 4; round++) {
        const result = await processDueSupportNotifications({
          store,
          env: {} as any,
          // 每轮都把时间推过 6 小时重扫间隔
          now: new Date(Date.now() + round * 7 * 60 * 60_000),
          sender: async () => {
            throw new Error("dry_run 下不该调用真实发送");
          },
        });
        expect(result.held).toBe(1);
      }
      const [rows]: any = await connection.query(
        "SELECT attempts, status FROM support_notifications",
      );
      expect(rows[0].status).toBe("held");
      // 一次都没真的投递过，attempts 就该是 0
      expect(Number(rows[0].attempts)).toBe(0);
    });

    it("崩在 sending 上的租约超时后能被回收，双 worker 不重复认领", async () => {
      await send({ clientMsgId: "lease-1", body: "租约探针" });
      const now = new Date();
      const [w1, w2] = await Promise.all([
        store.claimDueNotifications({ now, limit: 5, leaseTimeoutMs: 5 * 60_000 }),
        store.claimDueNotifications({ now, limit: 5, leaseTimeoutMs: 5 * 60_000 }),
      ]);
      expect(w1.length + w2.length).toBe(1);

      const [stuck]: any = await connection.query("SELECT status FROM support_notifications");
      expect(stuck[0].status).toBe("sending");

      const recovered = await processDueSupportNotifications({
        store,
        now: new Date(now.getTime() + 30 * 60_000),
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
  });

  describe("H1 身份：不串号、不锁死、要显式认领", () => {
    it("匿名记录不会被后来登录的人自动读走", async () => {
      await send({ body: "访客甲：我的手机号是 138xxxx", clientMsgId: "ident-1" });

      const peek = await fetchVisitorThread({
        visitorToken: TOKEN_A,
        userId: 777,
        strategyId: null,
        afterId: 0,
        store,
      });
      expect(peek.identity).toBe("claimable");
      expect(peek.messages).toHaveLength(0);

      await expect(
        send({ userId: 777, body: "乙说的话", clientMsgId: "ident-2" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      const [rows]: any = await connection.query("SELECT userId FROM support_conversations");
      expect(rows[0].userId).toBeNull();
    });

    it("换令牌后能立刻开新会话，不会卡在 FORBIDDEN", async () => {
      await send({ userId: 777, body: "甲登录后问的", clientMsgId: "ident-3" });

      const afterLogout = await fetchVisitorThread({
        visitorToken: TOKEN_A,
        userId: null,
        strategyId: null,
        afterId: 0,
        store,
      });
      expect(afterLogout.identity).toBe("rotate");

      const fresh = await send({
        visitorToken: TOKEN_B,
        userId: null,
        body: "下一位访客的问题",
        clientMsgId: "ident-4",
      });
      expect(fresh.conversation.customerMessageCount).toBe(1);
      const [rows]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_conversations",
      );
      expect(Number(rows[0].n)).toBe(2);
    });

    it("本人显式认领：记录并入账号并迁到新令牌；别人认领不了", async () => {
      const guest = await send({ body: "我先匿名问一句", clientMsgId: "ident-5" });

      const stolen = await claimAnonymousConversation({
      expectedIdentity: `user:888`,
        previousVisitorToken: TOKEN_A,
        visitorToken: TOKEN_C,
        userId: 888,
        strategyId: null,
        store,
      });
      expect(stolen.claimed).toBe(true); // 第一个认领的人拿到（服务端按「未归属」判定）

      // 已经有主之后，别人再认领必然失败
      const second = await claimAnonymousConversation({
      expectedIdentity: `user:999`,
        previousVisitorToken: TOKEN_C,
        visitorToken: TOKEN_B,
        userId: 999,
        strategyId: null,
        store,
      });
      expect(second.claimed).toBe(false);

      const [rows]: any = await connection.query(
        "SELECT userId, visitorTokenHash, publicNo FROM support_conversations",
      );
      expect(Number(rows[0].userId)).toBe(888);
      expect(rows[0].visitorTokenHash).toBe(hashVisitorToken(TOKEN_C));
      expect(rows[0].publicNo).toBe(guest.conversation.publicNo);
    });
  });

  describe("身份切换竞态：A 的文字不能写进 B 的账号", () => {
    it("自报身份与服务端解析出来的身份对不上 → 拒绝写入，库里一个字都没有", async () => {
      // 客户在匿名状态下打好草稿，期间登录成了 777：请求带着 guest 的自报身份到达。
      await expect(
        send({
          expectedIdentity: "guest",
          userId: 777,
          body: "匿名时打的草稿，不该落到 777 名下",
          clientMsgId: "race-identity-1",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      const [messages]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_messages",
      );
      expect(Number(messages[0].n)).toBe(0);
      const [conversations]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_conversations",
      );
      expect(Number(conversations[0].n)).toBe(0);
    });

    it("反方向也拦：自报已登录、实际是匿名", async () => {
      await expect(
        send({ expectedIdentity: "user:777", userId: null, clientMsgId: "race-identity-2" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const [rows]: any = await connection.query("SELECT COUNT(*) AS n FROM support_messages");
      expect(Number(rows[0].n)).toBe(0);
    });

    it("换了账号也拦：自报 user:777、实际 user:888", async () => {
      await expect(
        send({ expectedIdentity: "user:777", userId: 888, clientMsgId: "race-identity-3" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const [rows]: any = await connection.query("SELECT COUNT(*) AS n FROM support_messages");
      expect(Number(rows[0].n)).toBe(0);
    });

    it("对得上就正常放行", async () => {
      const matched = await send({
        expectedIdentity: "user:777",
        userId: 777,
        clientMsgId: "race-identity-4",
        body: "身份对得上",
      });
      expect(matched.duplicate).toBe(false);
    });

    it("旧客户端不带绑定 → 拒绝并要求刷新，库里一个字都没有", async () => {
      // 回合 5：可选字段 = 旧 tab 仍然能在身份变化期间把 A 的草稿写进 B。
      // 现在缺绑定就不写，客户看到的是「请刷新页面后重发」。
      const legacyBody = "旧客户端在身份变化期间发出的草稿";
      await expect(
        send({
          expectedIdentity: undefined,
          visitorToken: TOKEN_B,
          userId: 888,
          clientMsgId: "race-identity-5",
          body: legacyBody,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      const [rows]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_messages WHERE body = ?",
        [legacyBody],
      );
      expect(Number(rows[0].n)).toBe(0);
      const [owned]: any = await connection.query(
        "SELECT COUNT(*) AS n FROM support_conversations WHERE userId = 888",
      );
      expect(Number(owned[0].n)).toBe(0);
    });

    it("竞态请求被拒时不吃发送配额（闸门排在限流之前）", async () => {
      for (let i = 0; i < 5; i++) {
        await expect(
          send({ expectedIdentity: "guest", userId: 777, clientMsgId: `race-quota-${i}` }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
      }
      // 访客每分钟上限 6 条：上面 5 次全被拒，配额应该还没动过
      const ok = await send({ clientMsgId: "race-quota-ok", body: "配额还在" });
      expect(ok.duplicate).toBe(false);
    });
  });

  describe("运营回路", () => {
    it("客户发问 → 后台看到 → 真人回复 → 客户轮询读到", async () => {
      const sent = await send({ body: "这个能绑几个账户", clientMsgId: "loop-1" });

      const list = await listAdminConversations({ store, status: "open" });
      expect(list.items.map((i) => i.publicNo)).toContain(sent.conversation.publicNo);
      expect(list.items[0].notifyStatus).toBeTruthy();

      const replied = await replyAsOperator({
        publicNo: sent.conversation.publicNo,
        body: "默认 3 个账户，可加购。",
        operatorId: 7,
        clientMsgId: "operator-reply-1",
        store,
      });
      expect(replied.conversation.status).toBe("answered");

      // 运营重试同一条回复不会重复发给客户
      const retried = await replyAsOperator({
        publicNo: sent.conversation.publicNo,
        body: "默认 3 个账户，可加购。",
        operatorId: 7,
        clientMsgId: "operator-reply-1",
        store,
      });
      expect(retried.conversation.operatorMessageCount).toBe(1);

      const lastId = sent.messages[sent.messages.length - 1].id;
      const poll = await fetchVisitorThread({
        visitorToken: TOKEN_A,
        userId: null,
        strategyId: null,
        afterId: lastId,
        store,
      });
      expect(poll.messages.filter((m) => m.role === "operator")).toHaveLength(1);
    });
  });
});
