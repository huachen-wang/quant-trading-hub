/**
 * 站内咨询的真实 HTTP + 真实 MySQL 端到端验收。
 *
 * 跑的是**跑起来的服务**（express + tRPC + 真 MySQL 连接池），不是内存 mock，也不是直接调函数。
 * 覆盖独立复核点名的场景：多连接并发、失败重试、账号 A 登出后 B 登录、运营回路、
 * 以及「错误响应里不许出现 SQL 和客户正文」。
 *
 * 用法：
 *   node verify/support-e2e.mjs            # 默认打 http://127.0.0.1:3400
 *   SUPPORT_E2E_BASE=http://127.0.0.1:3400 node verify/support-e2e.mjs
 *
 * 前置：服务已经带着真实 DATABASE_URL 起来（见 verify/README.md）。
 * 本脚本只读写 support_* 四张表对应的业务接口，不碰任何生产数据、不发真实 Telegram。
 */

const BASE = (process.env.SUPPORT_E2E_BASE || "http://127.0.0.1:3400").replace(/\/+$/, "");
const TRPC = `${BASE}/api/trpc`;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@eaxau.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

const stamp = Date.now().toString(36);
const token = (label) => `e2e-${label}-${stamp}-${"x".repeat(12)}`;

let failures = 0;
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
}

async function rawQuery(path, input, headers = {}) {
  const url =
    input === undefined
      ? `${TRPC}/${path}`
      : `${TRPC}/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const response = await fetch(url, { headers });
  return { status: response.status, body: await response.json() };
}

async function rawMutate(path, input, headers = {}) {
  // 服务端要求身份绑定（缺绑定 = 拒绝并要求刷新）。这支脚本全程匿名，统一补 guest；
  // 身份竞态本身在 verify/support-identity-e2e.mjs 里测。
  const payload = input ?? {};
  const withIdentity =
    (path === "support.send" || path === "support.claim") &&
    payload &&
    typeof payload === "object" &&
    payload.expectedIdentity === undefined
      ? { ...payload, expectedIdentity: "guest" }
      : payload;
  const response = await fetch(`${TRPC}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ json: withIdentity }),
  });
  return { status: response.status, body: await response.json() };
}

function unwrap(result, label) {
  if (result.body?.error) {
    const message = result.body.error?.json?.message ?? JSON.stringify(result.body.error);
    throw new Error(`${label} -> HTTP ${result.status}: ${message}`);
  }
  const data = result.body?.result?.data;
  return data?.json !== undefined ? data.json : data;
}

const q = async (path, input, headers) => unwrap(await rawQuery(path, input, headers), path);
const m = async (path, input, headers) => unwrap(await rawMutate(path, input, headers), path);

async function main() {
  console.log(`[e2e] target ${BASE}`);

  // ── 0. 服务在跑，且用的是真库
  const health = await rawQuery("support.entry");
  check("服务可达 support.entry", health.status === 200, `HTTP ${health.status}`);
  const entry = unwrap(health, "support.entry");
  check(
    "机器人身份声明在响应里",
    String(entry.autoDisclosure).includes("机器人"),
    entry.autoDisclosure,
  );
  check(
    "提醒通道关闭时不说「有人在看」",
    entry.attended === false && !String(entry.attendanceNote).includes("消息不会丢"),
    `attended=${entry.attended}`,
  );

  // ── 1. 打开面板不建会话
  const visitorA = token("visitorA");
  const before = await q("support.thread", { visitorToken: visitorA, strategyId: 1, afterId: 0 });
  check(
    "打开面板不建会话",
    before.conversation === null && before.identity === "ok",
    JSON.stringify(before),
  );

  // ── 2. 首条消息建会话 + 机器人回复
  const first = await m("support.send", {
    visitorToken: visitorA,
    clientMsgId: `${stamp}-first`,
    body: "这个 EA 多少钱？能绑几个账户？",
    strategyId: 1,
    pageUrl: "https://www.eaxau.com/strategy/1",
    locale: "zh",
  });
  check(
    "首条消息建会话并带出机器人回复",
    first.duplicate === false && first.messages.map((x) => x.role).join(",").endsWith("customer,auto"),
    first.conversation.publicNo,
  );

  // ── 3. B1/B3：重试同一 clientMsgId —— 必须 200 + duplicate，不是 500
  const retry = await rawMutate("support.send", {
    visitorToken: visitorA,
    clientMsgId: `${stamp}-first`,
    body: "这个 EA 多少钱？能绑几个账户？",
    strategyId: 1,
    pageUrl: null,
    locale: "zh",
  });
  const retryBody = unwrap(retry, "retry");
  check(
    "重试同一 clientMsgId：200 且识别为重复（复核 B1）",
    retry.status === 200 && retryBody.duplicate === true,
    `HTTP ${retry.status} duplicate=${retryBody.duplicate}`,
  );
  check(
    "重试不重复计数",
    retryBody.conversation.customerMessageCount === 1,
    `count=${retryBody.conversation.customerMessageCount}`,
  );

  // ── 4. B1：多连接并发首条消息（新访客，4 个并发）
  const raceToken = token("race");
  const raceResults = await Promise.all(
    [1, 2, 3, 4].map((i) =>
      rawMutate("support.send", {
        visitorToken: raceToken,
        clientMsgId: `${stamp}-race-${i}`,
        body: `并发第 ${i} 条`,
        strategyId: 1,
        pageUrl: null,
        locale: "zh",
      }),
    ),
  );
  const raceStatuses = raceResults.map((r) => r.status);
  check(
    "并发首条消息全部 200，没有 500（复核 B1）",
    raceStatuses.every((s) => s === 200),
    `statuses=${raceStatuses.join(",")}`,
  );
  const raceThread = await q("support.thread", {
    visitorToken: raceToken,
    strategyId: 1,
    afterId: 0,
  });
  const raceCustomer = raceThread.messages.filter((x) => x.role === "customer");
  check(
    "并发 4 条一条都不丢，只有一条会话",
    raceCustomer.length === 4 && raceThread.conversation.customerMessageCount === 4,
    `customer=${raceCustomer.length} count=${raceThread.conversation.customerMessageCount}`,
  );
  check(
    "每条客户消息都配了机器人回复",
    raceThread.messages.filter((x) => x.role === "auto").length === 4,
    `auto=${raceThread.messages.filter((x) => x.role === "auto").length}`,
  );

  // ── 5. B2：错误响应不许带 SQL / 客户正文
  const tooLong = await rawMutate("support.send", {
    visitorToken: token("longmsg"),
    clientMsgId: `${stamp}-long`,
    body: "机密内容不该出现在错误里".repeat(200),
    strategyId: 1,
    pageUrl: null,
    locale: "zh",
  });
  const longText = JSON.stringify(tooLong.body);
  check(
    "超长消息的错误响应里没有 SQL 也没有客户正文（复核 B2）",
    !/insert into|Failed query|params:/i.test(longText) && !longText.includes("机密内容不该出现在错误里"),
    longText.slice(0, 120),
  );

  // ── 6. 限流：顺序连发，超出部分被拒且文案固定
  const burstToken = token("burst");
  const burst = [];
  for (let i = 0; i < 9; i++) {
    burst.push(
      await rawMutate("support.send", {
        visitorToken: burstToken,
        clientMsgId: `${stamp}-burst-${i}`,
        body: `压测 ${i}`,
        strategyId: 1,
        pageUrl: null,
        locale: "zh",
      }),
    );
  }
  const accepted = burst.filter((r) => r.status === 200).length;
  const throttled = burst.filter((r) => r.body?.error?.json?.code === -32029 || r.status === 429);
  check("顺序连发 9 条正好放行 6 条", accepted === 6, `accepted=${accepted}`);
  check("超限的被挡下", throttled.length === 3, `throttled=${throttled.length}`);

  // ── 7. H1：账号 A 用完登出、B 登录 —— 不串号、不锁死
  //    HTTP 层用「同一枚令牌 + 不同身份」模拟：服务端只认 tRPC 上下文里的登录用户。
  //    这里没有真实用户会话，所以用匿名 + 已绑定会话的组合覆盖「读不到 + 不报死」这一半，
  //    另一半（真实登录用户）在 tests/support-mysql.test.ts 里用真库覆盖。
  const sharedToken = token("shared");
  await m("support.send", {
    visitorToken: sharedToken,
    clientMsgId: `${stamp}-shared-1`,
    body: "前一位访客说的话，含手机号 138xxxx",
    strategyId: 1,
    pageUrl: null,
    locale: "zh",
  });
  const nextPerson = await q("support.thread", {
    visitorToken: sharedToken,
    strategyId: 1,
    afterId: 0,
  });
  check(
    "同一令牌匿名读得到自己的会话（基线）",
    nextPerson.identity === "ok" && nextPerson.messages.length > 0,
    `identity=${nextPerson.identity}`,
  );
  const rotated = await q("support.thread", {
    visitorToken: token("rotated"),
    strategyId: 1,
    afterId: 0,
  });
  check(
    "换一枚新令牌 = 干净的新会话，读不到上一位的内容（复核 H1）",
    rotated.conversation === null && rotated.messages.length === 0,
    JSON.stringify(rotated).slice(0, 80),
  );
  const rotatedSend = await rawMutate("support.send", {
    visitorToken: token("rotated"),
    clientMsgId: `${stamp}-rotated-1`,
    body: "下一位访客的问题",
    strategyId: 1,
    pageUrl: null,
    locale: "zh",
  });
  check(
    "换令牌后立刻能发消息，不是死路",
    rotatedSend.status === 200,
    `HTTP ${rotatedSend.status}`,
  );

  // ── 8. 管理员登录 + 运营回路
  const login = await m("adminAuth.login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  check("管理员登录", Boolean(login.token), login.token ? "ok" : JSON.stringify(login));
  const adminHeaders = { "X-Admin-Token": login.token };

  const unauth = await rawQuery("supportAdmin.list", { status: "open" });
  check(
    "未鉴权访问后台被拒",
    Boolean(unauth.body?.error),
    unauth.body?.error?.json?.code ?? "none",
  );

  const list = await q("supportAdmin.list", { status: "open", limit: 50 }, adminHeaders);
  const target = list.items.find((x) => x.publicNo === first.conversation.publicNo);
  check("后台看得到这条会话", Boolean(target), first.conversation.publicNo);
  check(
    "后台显示提醒投递状态（不静默）",
    Boolean(target?.notifyStatus),
    `notifyStatus=${target?.notifyStatus}`,
  );

  const replyId = `${stamp}-operator-reply`;
  const replied = await m(
    "supportAdmin.reply",
    {
      publicNo: first.conversation.publicNo,
      body: "你好，这款按 3 个账户授权报价，清单我发你。",
      clientMsgId: replyId,
    },
    adminHeaders,
  );
  check("真人回复后状态转 answered", replied.conversation.status === "answered", replied.conversation.status);

  const replyRetry = await rawMutate(
    "supportAdmin.reply",
    {
      publicNo: first.conversation.publicNo,
      body: "你好，这款按 3 个账户授权报价，清单我发你。",
      clientMsgId: replyId,
    },
    adminHeaders,
  );
  const replyRetryBody = unwrap(replyRetry, "reply-retry");
  check(
    "运营重试同一条回复不会重复发给客户",
    replyRetry.status === 200 && replyRetryBody.conversation.operatorMessageCount === 1,
    `count=${replyRetryBody.conversation.operatorMessageCount}`,
  );

  // ── 9. 客户轮询读到真人回复
  const lastId = first.messages[first.messages.length - 1].id;
  const poll = await q("support.thread", {
    visitorToken: visitorA,
    strategyId: 1,
    afterId: lastId,
  });
  const operatorMessages = poll.messages.filter((x) => x.role === "operator");
  check(
    "客户按游标轮询读到真人回复",
    operatorMessages.length === 1 && operatorMessages[0].body.includes("3 个账户"),
    `operator=${operatorMessages.length}`,
  );

  // ── 10. M2：提醒发出之后的后续消息仍然会排新的提醒
  const drainBefore = await m("supportAdmin.drain", {}, adminHeaders);
  check(
    "外发箱 drain 报告真实模式",
    drainBefore.mode === "dry_run" && drainBefore.configured === false,
    JSON.stringify(drainBefore),
  );

  await m("support.send", {
    visitorToken: visitorA,
    clientMsgId: `${stamp}-followup`,
    body: "再追问一句：MT5 能用吗",
    strategyId: 1,
    pageUrl: null,
    locale: "zh",
  });
  const afterFollowup = await q(
    "supportAdmin.list",
    { status: "all", limit: 50 },
    adminHeaders,
  );
  const followTarget = afterFollowup.items.find(
    (x) => x.publicNo === first.conversation.publicNo,
  );
  check(
    "追问后会话回到待回复且计数正确（复核 M2 相关）",
    followTarget?.status === "open" && followTarget?.customerMessageCount === 2,
    `status=${followTarget?.status} count=${followTarget?.customerMessageCount}`,
  );

  console.log("");
  console.log(`[e2e] ${results.length - failures}/${results.length} passed`);
  if (failures) {
    console.log("[e2e] FAILURES:");
    for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.name} :: ${r.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[e2e] fatal:", error);
  process.exitCode = 1;
});
