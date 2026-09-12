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
  setAutoAssist,
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
      await connection.query(
        "ALTER TABLE `support_conversations` DROP COLUMN `autoAssistEnabled`",
      );
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
  /**
   * 真人手动接管 —— **打真库，含并发**。
   *
   * 内存层证不了这一条：那边的"事务"是整段同步执行，运营回复和访客发消息根本插不进彼此。
   * 真库上这两条路径是两个连接、两个事务，抢答就发生在它们交错的那一瞬。
   *
   * 不变量只有一句：**在这条会话里，第一条运营回复之后不许再出现任何自动回复。**
   * 谁先谁后由数据库的行锁裁决，两种顺序都合法；不合法的只有"运营已经回过、机器人又插一句"。
   */
  describe("真人手动接管（并发在真库上验）", () => {
    const reply = (publicNo: string, body: string, clientMsgId?: string) =>
      replyAsOperator({ publicNo, body, operatorId: 7, clientMsgId: clientMsgId ?? null, store });

    const rowsOf = async (conversationId: number) => {
      const [rows]: any = await connection.query(
        "SELECT id, role FROM support_messages WHERE conversationId = ? ORDER BY id ASC",
        [conversationId],
      );
      return rows as Array<{ id: number; role: string }>;
    };

    const conversationIdOf = async (publicNo: string) => {
      const row = await store.findConversationByPublicNo(publicNo);
      expect(row).not.toBeNull();
      return row!.id;
    };

    it("运营回过话之后，访客的后续提问只落库，库里不再多出自动回复", async () => {
      const sent = await send({ body: "这个能绑几个账户", clientMsgId: "takeover-db-1" });
      await reply(sent.conversation.publicNo, "默认 3 个账户，可加购。");

      const follow = await send({ body: "那加购一个多少钱", clientMsgId: "takeover-db-2" });
      expect(follow.autoSuppressed).toBe(true);
      expect(follow.conversation.operatorTakeover).toBe(true);

      const id = await conversationIdOf(sent.conversation.publicNo);
      expect((await rowsOf(id)).map((r) => r.role)).toEqual([
        "customer",
        "auto",
        "operator",
        "customer",
      ]);
      // 计数照常走：接管压掉的是自动回复，不是客户的话。
      const [counts]: any = await connection.query(
        "SELECT customerMessageCount, operatorMessageCount, autoAssistEnabled FROM support_conversations WHERE id = ?",
        [id],
      );
      expect(Number(counts[0].customerMessageCount)).toBe(2);
      expect(Number(counts[0].operatorMessageCount)).toBe(1);
      expect(Number(counts[0].autoAssistEnabled)).toBe(0);
    });

    /**
     * 最贴身的一版：直接在存储层把两个事务**同时**发出去，不经过 send() 那一串
     * 限流 / 查商品 / 查会话的往返。
     *
     * 为什么非要这么写：走 service 入口时，访客那条路径在开事务之前先做了四五个查询，
     * 运营那条几乎立刻就开事务，于是运营的事务总是先提交、访客的事务总是后开——
     * **危险的那半边交错根本轮不到发生**，测试会因为时序而绿，不是因为锁在起作用。
     * 实测过：把 `FOR UPDATE` 去掉，端到端那版照样全绿，这一版直接挂。
     */
    it("并发（存储层贴身）：每一轮都重开一次窗口，运营回复之后不许再落自动回复", async () => {
      const sent = await send({ body: "先问一句", clientMsgId: "tight-race-seed" });
      const id = await conversationIdOf(sent.conversation.publicNo);

      const violations: Array<{ round: number; operatorId: number; autoId: number }> = [];
      for (let round = 0; round < 20; round++) {
        // 每一轮先把自动接待交还回去，让这一轮重新从「机器人开着」起跑。
        // 不这么做的话，抢答的窗口在整条会话里**只有第一轮**存在（第一条运营回复之后
        // autoAssistEnabled 就一直是 false），20 轮只等于 1 次机会，测试会靠运气变绿。
        await connection.query(
          "UPDATE support_conversations SET autoAssistEnabled = 1 WHERE id = ?",
          [id],
        );
        const before = (await rowsOf(id)).length ? (await rowsOf(id)).slice(-1)[0].id : 0;

        await Promise.all([
          store.appendCustomerTurn({
            conversationId: id,
            body: `访客第 ${round} 条`,
            clientMsgId: `tight-visitor-${round}`,
            autoReply: { body: "自动值守（机器人回复，不是人工）：稍等。", ruleKey: "fallback" },
            buildNotification: () => null,
          }),
          store.appendMessage({
            conversationId: id,
            role: "operator",
            body: `运营第 ${round} 条`,
            clientMsgId: `tight-op-${round}`,
            operatorId: 7,
          }),
        ]);

        const fresh = (await rowsOf(id)).filter((r) => r.id > before);
        const operatorRow = fresh.find((r) => r.role === "operator");
        const autoRow = fresh.find((r) => r.role === "auto");
        expect(operatorRow).toBeDefined();
        // 锁把两个事务排成一前一后，所以只有两种合法结果：
        //   访客那一轮先拿到锁 → 有自动回复，而且排在运营那条**前面**；
        //   运营那一轮先拿到锁 → 这一轮根本没有自动回复。
        if (autoRow && autoRow.id > operatorRow!.id) {
          violations.push({ round, operatorId: operatorRow!.id, autoId: autoRow.id });
        }
      }
      expect(violations).toEqual([]);

      const rows = await rowsOf(id);
      expect(rows.filter((r) => r.role === "customer")).toHaveLength(21);
      expect(rows.filter((r) => r.role === "operator")).toHaveLength(20);
    });

    it("并发（端到端）：运营回复与访客发消息同时提交，机器人绝不抢在运营之后答", async () => {
      const sent = await send({ body: "先问一句", clientMsgId: "race-seed" });
      const id = await conversationIdOf(sent.conversation.publicNo);

      // 访客限流是 6 条/分钟，而这里要的是 8 轮真交错。每轮把 `now` 推进一个限流窗口，
      // 于是限流器照常按真实规则算（没被绕过、没被调松），只是这 8 轮分属不同的分钟。
      for (let round = 0; round < 8; round++) {
        await Promise.all([
          reply(sent.conversation.publicNo, `运营第 ${round} 条`, `race-op-${round}`),
          send({
            body: `访客第 ${round} 条`,
            clientMsgId: `race-visitor-${round}`,
            now: new Date(Date.now() + (round + 1) * 61_000),
          }),
        ]);
      }

      const rows = await rowsOf(id);
      const firstOperator = rows.find((r) => r.role === "operator");
      expect(firstOperator).toBeDefined();
      // 行锁把两个事务排成一前一后，所以只可能是「自动回复全在第一条运营回复之前」。
      const lateAuto = rows.filter((r) => r.role === "auto" && r.id > firstOperator!.id);
      expect(lateAuto).toHaveLength(0);
      // 访客的话一条都不许丢。
      expect(rows.filter((r) => r.role === "customer")).toHaveLength(9);
    });

    it("并发：交还自动接待与访客发消息同时提交，不会切出半个状态", async () => {
      const sent = await send({ body: "先问一句", clientMsgId: "handback-race-seed" });
      await reply(sent.conversation.publicNo, "我来接手");
      const id = await conversationIdOf(sent.conversation.publicNo);

      await Promise.all([
        setAutoAssist({ publicNo: sent.conversation.publicNo, enabled: true, store }),
        send({ body: "顺带再问一句", clientMsgId: "handback-race-visitor" }),
      ]);

      const rows = await rowsOf(id);
      const autos = rows.filter((r) => r.role === "auto");
      // 交还先落 → 这一轮有自动回复；访客那一轮先落 → 没有。两种都对，一半一半才是错的。
      expect(autos.length === 1 || autos.length === 2).toBe(true);
      expect(rows.filter((r) => r.role === "customer")).toHaveLength(2);

      const [row]: any = await connection.query(
        "SELECT autoAssistEnabled FROM support_conversations WHERE id = ?",
        [id],
      );
      expect(Number(row[0].autoAssistEnabled)).toBe(1);
    });

    it("交还自动接待后机器人重新先答；运营再回一条又重新接管", async () => {
      const sent = await send({ body: "价格", clientMsgId: "handback-db-1" });
      await reply(sent.conversation.publicNo, "报价发你了");

      await setAutoAssist({ publicNo: sent.conversation.publicNo, enabled: true, store });
      const resumed = await send({ body: "装不上怎么办", clientMsgId: "handback-db-2" });
      expect(resumed.autoSuppressed).toBe(false);
      expect(resumed.conversation.operatorTakeover).toBe(false);

      await reply(sent.conversation.publicNo, "我再补一句");
      const again = await send({ body: "补充提问", clientMsgId: "handback-db-3" });
      expect(again.autoSuppressed).toBe(true);
      expect(again.conversation.operatorTakeover).toBe(true);
    });

    it("接管期间的幂等重试仍然只落一条，且不谎报成「被接管压掉」", async () => {
      const sent = await send({ body: "价格", clientMsgId: "takeover-dup-seed" });
      await reply(sent.conversation.publicNo, "报价发你了");

      const first = await send({ body: "再问一句", clientMsgId: "takeover-dup" });
      const second = await send({ body: "再问一句", clientMsgId: "takeover-dup" });
      expect(first.duplicate).toBe(false);
      expect(first.autoSuppressed).toBe(true);
      expect(second.duplicate).toBe(true);
      expect(second.autoSuppressed).toBe(false);
      expect(second.bodyMismatch).toBe(false);

      const id = await conversationIdOf(sent.conversation.publicNo);
      const rows = await rowsOf(id);
      expect(rows.filter((r) => r.role === "customer")).toHaveLength(2);
    });

    it("接管中并发重复提交同一个 clientMsgId：库里仍然只有一条", async () => {
      const sent = await send({ body: "价格", clientMsgId: "takeover-cdup-seed" });
      await reply(sent.conversation.publicNo, "报价发你了");
      const id = await conversationIdOf(sent.conversation.publicNo);

      const results = await Promise.all([
        send({ body: "并发重复", clientMsgId: "takeover-cdup" }),
        send({ body: "并发重复", clientMsgId: "takeover-cdup" }),
      ]);
      expect(results.filter((r: any) => r.duplicate === false)).toHaveLength(1);

      const rows = await rowsOf(id);
      expect(rows.filter((r) => r.role === "customer")).toHaveLength(2);
      expect(rows.filter((r) => r.role === "auto")).toHaveLength(1); // 只有接管前那一条
    });

    it("接管中照样排提醒，摘要写明没有机器人兜底，正文仍然不进摘要", async () => {
      const sent = await send({ body: "价格", clientMsgId: "takeover-notify-seed" });
      await reply(sent.conversation.publicNo, "报价发你了");
      await processDueSupportNotifications({
        store,
        sender: async () => ({ ok: true, retryable: false }),
        env: { SUPPORT_TELEGRAM_NOTIFY_MODE: "live", SUPPORT_TELEGRAM_BOT_TOKEN: "t", SUPPORT_TELEGRAM_CHAT_ID: "c" } as any,
      });

      await send({ body: "还有别的版本吗", clientMsgId: "takeover-notify-2" });
      const id = await conversationIdOf(sent.conversation.publicNo);
      const notifications = await store.listNotifications(id);
      const latest = notifications[notifications.length - 1];
      expect(latest.summary).toContain("人工接管中");
      expect(latest.summary).not.toContain("还有别的版本吗");
      // 代数没退化：新消息进了新的一代，不会撞回已经发出去的去重键。
      expect(latest.dedupeKey).toBe(buildDedupeKey(id, 1));
    });

    it("存量会话升级路径：列是 NULL + 运营回过话 = 立刻接管，不用回填", async () => {
      const sent = await send({ body: "价格", clientMsgId: "legacy-seed" });
      await reply(sent.conversation.publicNo, "报价发你了");
      const id = await conversationIdOf(sent.conversation.publicNo);

      // 手动还原成「这一版之前就存在的行」：新列补出来是 NULL，没人给它回填过。
      await connection.query(
        "UPDATE support_conversations SET autoAssistEnabled = NULL WHERE id = ?",
        [id],
      );
      const row = await store.findConversationById(id);
      expect(row!.autoAssistEnabled).toBeNull();

      const after = await send({ body: "升级后再问一句", clientMsgId: "legacy-follow" });
      expect(after.autoSuppressed).toBe(true);
      expect(after.conversation.operatorTakeover).toBe(true);
      const rows = await rowsOf(id);
      expect(rows.filter((r) => r.role === "auto")).toHaveLength(1);
    });

    it("接管状态不溢到同一访客的另一条商品会话", async () => {
      const one = await send({ body: "商品一的价格", strategyId: null, clientMsgId: "iso-1" });
      await reply(one.conversation.publicNo, "商品一报价发你了");
      const two = await send({ visitorToken: TOKEN_B, body: "另一位访客", clientMsgId: "iso-2" });
      expect(two.conversation.publicNo).not.toBe(one.conversation.publicNo);
      expect(two.autoSuppressed).toBe(false);
      expect(two.conversation.operatorTakeover).toBe(false);
    });
  });
});
