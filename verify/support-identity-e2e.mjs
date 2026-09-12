/**
 * 真实 HTTP + 真实 MySQL 的**登录身份**验收：账号 A 用完登出、账号 B 在同一台设备登录。
 *
 * 和 support-e2e.mjs 分开，是因为这一段需要真实的登录会话：脚本自己签一枚与服务端同密钥的
 * session JWT（走的就是 `sdk.verifySession` → `db.getUserByOpenId` 那条真实路径），
 * 并在测试库里插两个用户行。**不碰生产库、不碰真实用户、不发任何外部请求。**
 *
 * 用法：
 *   node verify/support-identity-e2e.mjs
 * 需要环境变量：
 *   SUPPORT_E2E_BASE   默认 http://127.0.0.1:3400
 *   DATABASE_URL       测试库（会往 users 表插两行测试用户）
 *   JWT_SECRET         与服务端一致（会话 JWT 的签名密钥，见 server/_core/env.ts）
 */

import mysql from "mysql2/promise";
import { SignJWT } from "jose";

const BASE = (process.env.SUPPORT_E2E_BASE || "http://127.0.0.1:3400").replace(/\/+$/, "");
const TRPC = `${BASE}/api/trpc`;
const DATABASE_URL = process.env.DATABASE_URL;
// 注意：服务端的会话密钥取的是 JWT_SECRET（server/_core/env.ts 的 cookieSecret 映射到它），
// 不是 COOKIE_SECRET。这里跟着源码走，别想当然。
const SESSION_SECRET = (process.env.JWT_SECRET || "").trim();

if (!DATABASE_URL || !SESSION_SECRET) {
  console.error("[identity-e2e] 需要 DATABASE_URL 与 JWT_SECRET");
  process.exit(1);
}

const stamp = Date.now().toString(36);
let failures = 0;
const fails = [];

function check(name, ok, detail) {
  if (!ok) {
    failures++;
    fails.push(`${name} :: ${detail}`);
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
}

async function session(openId, name) {
  return new SignJWT({ openId, appId: process.env.VITE_APP_ID || "", name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SESSION_SECRET));
}

/**
 * 服务端现在**要求**身份绑定（缺绑定 = 拒绝并要求刷新，见 assertExpectedIdentity）。
 * 这支脚本大部分场景测的是别的性质，所以按「这次用的是谁的令牌」自动补上绑定；
 * 竞态 / 旧客户端那几条用例在调用处显式给值（或显式不给），不会被这里覆盖。
 */
const identityByToken = new Map();

async function call(method, path, input, token) {
  if (
    (path === "support.send" || path === "support.claim") &&
    input &&
    typeof input === "object" &&
    !("expectedIdentity" in input)
  ) {
    input = { ...input, expectedIdentity: token ? identityByToken.get(token) ?? "guest" : "guest" };
  }
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const url =
    method === "GET"
      ? `${TRPC}/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
      : `${TRPC}/${path}`;
  const response = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify({ json: input ?? {} }),
  });
  const body = await response.json();
  return { status: response.status, body };
}

// tRPC over HTTP 回的是 JSON-RPC 数字码；真正的语义码在 error.data.code。
function data(result, label) {
  if (result.body?.error) {
    const err = result.body.error?.json ?? result.body.error;
    return {
      error: err.message ?? JSON.stringify(err),
      code: err.data?.code ?? err.code,
      rpcCode: err.code,
    };
  }
  const payload = result.body?.result?.data;
  return payload?.json !== undefined ? payload.json : payload;
}

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  // users 表可能还没建（测试库是空库）：只建这一张，用于验证登录身份链路。
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`openId\` varchar(64) NOT NULL,
      \`name\` text,
      \`email\` varchar(320),
      \`passwordHash\` varchar(255),
      \`avatar\` text,
      \`bio\` text,
      \`loginMethod\` varchar(64),
      \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
      \`phone\` varchar(20),
      \`phoneVerified\` boolean NOT NULL DEFAULT false,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      \`lastSignedIn\` timestamp NULL,
      CONSTRAINT \`users_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`users_openId_unique\` UNIQUE(\`openId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const openIdA = `e2e-user-a-${stamp}`;
  const openIdB = `e2e-user-b-${stamp}`;
  await connection.query(
    "INSERT INTO users (openId, name, email, loginMethod, role) VALUES (?,?,?,?,?), (?,?,?,?,?)",
    [
      openIdA,
      "E2E 用户A",
      `${openIdA}@example.invalid`,
      "e2e",
      "user",
      openIdB,
      "E2E 用户B",
      `${openIdB}@example.invalid`,
      "e2e",
      "user",
    ],
  );
  const [rows] = await connection.query("SELECT id, openId FROM users WHERE openId IN (?,?)", [
    openIdA,
    openIdB,
  ]);
  const userA = rows.find((r) => r.openId === openIdA);
  const userB = rows.find((r) => r.openId === openIdB);
  const tokenA = await session(openIdA, "E2E 用户A");
  const tokenB = await session(openIdB, "E2E 用户B");
  identityByToken.set(tokenA, `user:${userA.id}`);
  identityByToken.set(tokenB, `user:${userB.id}`);

  const me = data(await call("GET", "auth.me", undefined, tokenA));
  check("会话 JWT 被服务端接受（真实登录链路）", me?.openId === openIdA, JSON.stringify(me)?.slice(0, 80));

  // ── 场景一：访客先说话，随后 A 在同一台设备登录 —— 不许自动继承
  const sharedVisitor = `e2e-shared-${stamp}-${"x".repeat(12)}`;
  const guestSend = data(
    await call("POST", "support.send", {
      visitorToken: sharedVisitor,
      clientMsgId: `${stamp}-guest-1`,
      body: "访客甲：我的手机号是 138xxxx，帮我看下账户",
      strategyId: 1,
      pageUrl: null,
      locale: "zh",
    }),
  );
  check("访客建会话成功", Boolean(guestSend?.conversation?.publicNo), guestSend?.conversation?.publicNo);

  const aPeek = data(
    await call(
      "GET",
      "support.thread",
      { visitorToken: sharedVisitor, strategyId: 1, afterId: 0 },
      tokenA,
    ),
  );
  check(
    "A 登录后读不到访客留下的内容，只拿到 claimable 信号（复核 H1 泄露方向）",
    aPeek?.identity === "claimable" && (aPeek?.messages?.length ?? 0) === 0,
    `identity=${aPeek?.identity} messages=${aPeek?.messages?.length}`,
  );

  const aWrite = data(
    await call(
      "POST",
      "support.send",
      {
        visitorToken: sharedVisitor,
        clientMsgId: `${stamp}-a-1`,
        body: "A 想直接写进去",
        strategyId: 1,
        pageUrl: null,
        locale: "zh",
      },
      tokenA,
    ),
  );
  check(
    "A 也不能直接往匿名会话里写（服务端判 CONFLICT）",
    aWrite?.code === "CONFLICT",
    `code=${aWrite?.code} rpc=${aWrite?.rpcCode} msg=${aWrite?.error}`,
  );
  check(
    "CONFLICT 的错误文案里没有客户正文、没有 SQL",
    !String(aWrite?.error ?? "").includes("A 想直接写进去") &&
      !/insert into|Failed query/i.test(String(aWrite?.error ?? "")),
    String(aWrite?.error ?? "").slice(0, 60),
  );

  // ── 场景二：A 显式认领 —— 换新令牌后记录归到 A 名下
  const tokenAVisitor = `e2e-a-visitor-${stamp}-${"x".repeat(12)}`;
  const claimed = data(
    await call(
      "POST",
      "support.claim",
      {
        previousVisitorToken: sharedVisitor,
        visitorToken: tokenAVisitor,
        strategyId: 1,
      },
      tokenA,
    ),
  );
  check("A 显式认领成功", claimed?.claimed === true, JSON.stringify(claimed)?.slice(0, 100));
  check(
    "认领后会话编号不变（是同一条线，不是新开一条）",
    claimed?.conversation?.publicNo === guestSend?.conversation?.publicNo,
    `${claimed?.conversation?.publicNo} vs ${guestSend?.conversation?.publicNo}`,
  );

  const aRead = data(
    await call(
      "GET",
      "support.thread",
      { visitorToken: tokenAVisitor, strategyId: 1, afterId: 0 },
      tokenA,
    ),
  );
  check(
    "A 用新令牌读得到自己认领的记录",
    aRead?.identity === "ok" && aRead.messages.some((m) => m.body.includes("138xxxx")),
    `identity=${aRead?.identity}`,
  );

  // ── 场景三：A 登出（同一台设备、令牌还在本机）
  const afterLogout = data(
    await call("GET", "support.thread", { visitorToken: tokenAVisitor, strategyId: 1, afterId: 0 }),
  );
  check(
    "A 登出后读不到自己账号下的会话，但拿到的是 rotate 而不是永久 FORBIDDEN（复核 H1 死锁方向）",
    afterLogout?.identity === "rotate" && afterLogout?.conversation === null,
    `identity=${afterLogout?.identity} error=${afterLogout?.error ?? "none"}`,
  );

  // ── 场景四：B 在同一台设备登录，拿着 A 留下的令牌
  const bPeek = data(
    await call(
      "GET",
      "support.thread",
      { visitorToken: tokenAVisitor, strategyId: 1, afterId: 0 },
      tokenB,
    ),
  );
  check(
    "B 登录后读不到 A 的任何内容",
    bPeek?.identity === "rotate" && (bPeek?.messages?.length ?? 0) === 0,
    `identity=${bPeek?.identity}`,
  );

  const bSteal = data(
    await call(
      "POST",
      "support.claim",
      {
        previousVisitorToken: tokenAVisitor,
        visitorToken: `e2e-b-visitor-${stamp}-${"x".repeat(12)}`,
        strategyId: 1,
      },
      tokenB,
    ),
  );
  check(
    "B 认领不了 A 已经归属的会话",
    bSteal?.claimed === false && bSteal?.reason === "already_owned",
    JSON.stringify(bSteal)?.slice(0, 100),
  );

  // ── 场景五：B 换一枚新令牌，立刻能正常咨询（不是死路）
  const bVisitor = `e2e-b-fresh-${stamp}-${"x".repeat(12)}`;
  const bSend = data(
    await call(
      "POST",
      "support.send",
      {
        visitorToken: bVisitor,
        clientMsgId: `${stamp}-b-1`,
        body: "B 自己的问题：MT5 怎么装",
        strategyId: 1,
        pageUrl: null,
        locale: "zh",
      },
      tokenB,
    ),
  );
  check(
    "B 换令牌后能正常开自己的会话",
    bSend?.conversation?.customerMessageCount === 1 &&
      bSend?.conversation?.publicNo !== guestSend?.conversation?.publicNo,
    bSend?.conversation?.publicNo,
  );

  const bRead = data(
    await call("GET", "support.thread", { visitorToken: bVisitor, strategyId: 1, afterId: 0 }, tokenB),
  );
  check(
    "B 的会话里没有 A / 访客的任何内容",
    !JSON.stringify(bRead.messages).includes("138xxxx"),
    `messages=${bRead.messages.length}`,
  );

  // ── 场景六：A 重新登录，自己的记录还在
  const aBack = data(
    await call(
      "GET",
      "support.thread",
      { visitorToken: tokenAVisitor, strategyId: 1, afterId: 0 },
      tokenA,
    ),
  );
  check(
    "A 重新登录后自己的记录原样还在",
    aBack?.identity === "ok" && aBack.messages.some((m) => m.body.includes("138xxxx")),
    `identity=${aBack?.identity} messages=${aBack?.messages?.length}`,
  );

  // ── 场景七：身份切换竞态（真 HTTP）——A 的文字不能写进 B 的账号
  const raceVisitor = `e2e-race-${stamp}-${"x".repeat(12)}`;
  const raceBody = "匿名时打好的草稿，绝不能记到别人账号名下";
  const raced = data(
    await call(
      "POST",
      "support.send",
      {
        visitorToken: raceVisitor,
        clientMsgId: `${stamp}-race-1`,
        body: raceBody,
        strategyId: 1,
        pageUrl: null,
        locale: "zh",
        // 客户自报「我现在是访客」，但请求带着 B 的登录凭据到达
        expectedIdentity: "guest",
      },
      tokenB,
    ),
  );
  check(
    "自报 guest 但实际已登录 → 服务端拒绝写入（身份切换竞态）",
    raced?.code === "CONFLICT",
    `code=${raced?.code} msg=${raced?.error}`,
  );
  const [racedRows] = await connection.query(
    "SELECT COUNT(*) AS n FROM support_messages WHERE body = ?",
    [raceBody],
  );
  check("被拒的那段文字一个字都没落库", Number(racedRows[0].n) === 0, `rows=${racedRows[0].n}`);

  // ── 场景七b：旧客户端（根本不带绑定字段）在身份变化期间发送 → 必须拒绝并要求刷新
  const legacyBody = "旧 tab 里匿名打的草稿，登录后点了发送";
  // B 在前面的场景里本来就有自己的会话，所以先取个基线，只看这次调用有没有新增。
  const [beforeRows] = await connection.query(
    "SELECT COUNT(*) AS n FROM support_conversations WHERE userId = ?",
    [userB.id],
  );
  const legacyBaseline = Number(beforeRows[0].n);
  const legacy = data(
    await call(
      "POST",
      "support.send",
      {
        visitorToken: `e2e-legacy-${stamp}-${"x".repeat(12)}`,
        clientMsgId: `${stamp}-legacy-1`,
        body: legacyBody,
        strategyId: 1,
        pageUrl: null,
        locale: "zh",
        // 注意：这里**故意不带** expectedIdentity，模拟部署前就加载好的旧页面。
        // 下面这个 key 存在但值是 undefined，`"expectedIdentity" in input` 为真，
        // 所以上面的自动补全不会插手；JSON.stringify 会把它整个丢掉，线上就是「没这个字段」。
        expectedIdentity: undefined,
      },
      tokenB,
    ),
  );
  check(
    "旧客户端不带身份绑定 → 拒绝写入并要求刷新",
    legacy?.code === "BAD_REQUEST" && String(legacy?.error ?? "").includes("刷新"),
    `code=${legacy?.code} msg=${legacy?.error}`,
  );
  const [legacyRows] = await connection.query(
    "SELECT COUNT(*) AS n FROM support_messages WHERE body = ?",
    [legacyBody],
  );
  check("旧客户端那段文字一个字都没落库", Number(legacyRows[0].n) === 0, `rows=${legacyRows[0].n}`);
  const [legacyOwned] = await connection.query(
    "SELECT COUNT(*) AS n FROM support_conversations WHERE userId = ?",
    [userB.id],
  );
  check(
    "也没有在 B 名下新建任何会话",
    Number(legacyOwned[0].n) === legacyBaseline,
    `B 名下会话数 ${legacyBaseline} → ${legacyOwned[0].n}`,
  );

  const racedOk = data(
    await call(
      "POST",
      "support.send",
      {
        visitorToken: raceVisitor,
        clientMsgId: `${stamp}-race-2`,
        body: "身份对得上，正常发出",
        strategyId: 1,
        pageUrl: null,
        locale: "zh",
        expectedIdentity: `user:${userB.id}`,
      },
      tokenB,
    ),
  );
  check(
    "自报身份与实际一致 → 正常放行",
    racedOk?.duplicate === false,
    racedOk?.conversation?.publicNo ?? JSON.stringify(racedOk)?.slice(0, 80),
  );

  // ── 场景八：三语（真 HTTP）——英语/阿语客户不该收到整段中文
  for (const [locale, mustContain] of [
    ["en", "bot reply, not a human"],
    ["ar", "رد آلي"],
  ]) {
    const localized = data(
      await call(
        "POST",
        "support.send",
        {
          visitorToken: `e2e-i18n-${locale}-${stamp}-${"x".repeat(12)}`,
          clientMsgId: `${stamp}-i18n-${locale}`,
          body: locale === "en" ? "how much does it cost" : "كم سعر هذا",
          strategyId: 1,
          pageUrl: null,
          locale,
        },
      ),
    );
    const autoReply = localized?.messages?.find((m) => m.role === "auto")?.body ?? "";
    check(
      `locale=${locale} 的机器人回复自报是机器人且不是中文`,
      autoReply.includes(mustContain) && !/[\u4e00-\u9fa5]/.test(autoReply),
      autoReply.slice(0, 70),
    );
  }

  const entryEn = data(
    await call("GET", "support.entry", { locale: "en" }),
  );
  check(
    "entry 按语言返回身份声明",
    String(entryEn?.autoDisclosure ?? "").includes("bot reply, not a human"),
    String(entryEn?.autoDisclosure ?? ""),
  );

  await connection.end();
  console.log("");
  if (failures) {
    console.log(`[identity-e2e] ${failures} FAILURES:`);
    for (const f of fails) console.log(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log("[identity-e2e] all passed");
  }
}

main().catch((error) => {
  console.error("[identity-e2e] fatal:", error);
  process.exitCode = 1;
});
