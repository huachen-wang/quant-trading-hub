/**
 * 交付「订单绑定 + 版本字节校验」的隔离验收。
 *
 * 覆盖 purchase-delivery-e2e.mjs 没有覆盖的两条：
 *   A. 同一用户同一商品**两笔**已付订单，各自只能取到自己下单时锁定的那一份包；
 *      其中一笔退款后，退款订单的 token 立刻失效，不能借另一笔 paid 订单越权。
 *   B. 发包地址不变、**字节被就地替换**时，交付必须识别出来并给可解释的待补发，
 *      不能静默把客户没买过的字节当成已购版本发出去。
 *
 * 打的是真 HTTP、真 tRPC 过程、真 MySQL（隔离库）、真 ZPay 回调路由（本地一次性
 * sandbox 密钥自签），交付走 server/_core/secure-download.ts 里生产同一个处理函数。
 * 不连生产库、不建真实收款、不发邮件/消息、不伪造生产已付款订单。
 *
 * 用法见 verify/purchase/README.md
 */
import crypto from "node:crypto";
import mysql from "mysql2/promise";

const API = process.env.E2E_API_BASE || "http://127.0.0.1:3410";
const DELIVERY = process.env.E2E_DELIVERY_BASE || "http://127.0.0.1:3411";
const ORIGIN = process.env.E2E_ORIGIN_BASE || "http://127.0.0.1:3498";
const DB_URL = process.env.DATABASE_URL;
const ZPAY_PID = process.env.ZPAY_PID;
const ZPAY_KEY = process.env.ZPAY_KEY;

for (const [k, v] of Object.entries({ DATABASE_URL: DB_URL, ZPAY_PID, ZPAY_KEY })) {
  if (!v) {
    console.error(`[e2e] 缺少环境变量 ${k}`);
    process.exit(2);
  }
}

const MARKER_V1 = "EAXAU-SYNTHETIC-TEST-ARTIFACT|version=v1";
const MARKER_V2 = "EAXAU-SYNTHETIC-TEST-ARTIFACT|version=v2";

const results = [];
let currentGroup = "";
function group(name) {
  currentGroup = name;
  console.log(`\n── ${name} ──`);
}
function check(name, ok, detail = "") {
  results.push({ group: currentGroup, name, ok: !!ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function newSession() {
  return { cookies: new Map() };
}
function cookieHeader(session) {
  return [...session.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function absorbCookies(session, res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) session.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
function unwrap(body, path) {
  if (body?.error) {
    const message = body.error?.json?.message ?? body.error?.message ?? JSON.stringify(body.error);
    throw new Error(`${path}: ${message}`);
  }
  return body?.result?.data?.json;
}
async function trpcQueryRaw(path, input, session = newSession()) {
  const qs = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await fetch(`${API}/api/trpc/${path}${qs}`, { headers: { cookie: cookieHeader(session) } });
  absorbCookies(session, res);
  const body = await res.json();
  return { raw: JSON.stringify(body), data: unwrap(body, path) };
}
async function trpcQuery(path, input, session = newSession()) {
  return (await trpcQueryRaw(path, input, session)).data;
}
async function trpcMutate(path, input, session = newSession()) {
  const res = await fetch(`${API}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader(session) },
    body: JSON.stringify({ json: input }),
  });
  absorbCookies(session, res);
  return unwrap(await res.json(), path);
}

function zpaySign(params) {
  const qs = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type")
    .filter((k) => params[k] !== "" && params[k] !== null && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("md5").update(qs + ZPAY_KEY, "utf8").digest("hex");
}
function buildCallback({ orderNo, amount, tradeNo }) {
  const params = {
    pid: ZPAY_PID,
    trade_no: tradeNo,
    out_trade_no: orderNo,
    type: "alipay",
    name: "隔离验收合成商品",
    money: Number(amount).toFixed(2),
    trade_status: "TRADE_SUCCESS",
  };
  return { ...params, sign: zpaySign(params), sign_type: "MD5" };
}
async function postCallback(payload) {
  const res = await fetch(`${API}/api/payment/zpay/notify`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  });
  return { status: res.status, body: await res.text() };
}

const conn = await mysql.createConnection(DB_URL);
const stamp = Date.now().toString(36);

async function seedProduct(tag, fileUrl) {
  const title = `【隔离验收】${tag} ${stamp}`;
  const [r] = await conn.query(
    `INSERT INTO strategies
      (title, description, platform, pairs, downloadUrl, price, originalPrice, isFree,
       saleMode, status, productType, dataStatus)
     VALUES (?, '隔离验收用合成商品，不是真实 EA，不对外销售。', 'MT5', 'XAUUSD', ?, '1.00', '2.00', 0,
             'direct', 'published', 'ea', 'estimated')`,
    [title, fileUrl],
  );
  return { id: r.insertId, title };
}

async function registerUser(tag) {
  const email = `bind-${tag}-${stamp}@eaxau.invalid`;
  const session = newSession();
  try {
    await trpcMutate("auth.sendEmailCode", { email, purpose: "register" }, session);
  } catch (err) {
    if (!/邮件发送失败|Email service not configured/.test(String(err.message))) throw err;
  }
  const [rows] = await conn.query(
    "SELECT code FROM verification_codes WHERE target=? AND purpose='register' ORDER BY id DESC LIMIT 1",
    [email],
  );
  if (!rows.length) throw new Error(`验证码未落库：${email}`);
  const out = await trpcMutate(
    "auth.registerWithCode",
    { email, code: rows[0].code, name: `bind-${tag}`, password: crypto.randomBytes(12).toString("hex") },
    session,
  );
  return { session, email, user: out.user };
}

async function orderRow(orderNo) {
  const [rows] = await conn.query("SELECT * FROM orders WHERE orderNo=?", [orderNo]);
  return rows[0];
}

/** 下单 → 发起支付 → 回调认款，返回 { orderNo, token } */
async function buyAndPay(session, productId, tradeSuffix) {
  const created = await trpcMutate("orders.create", { productKind: "strategy", productId }, session);
  const orderNo = created.orderNo;
  await trpcMutate("payments.initiate", { orderNo, method: "alipay" }, session);
  const cb = buildCallback({ orderNo, amount: 1, tradeNo: `SIM-${stamp}-${tradeSuffix}` });
  const res = await postCallback(cb);
  if (res.status !== 200) throw new Error(`回调未认款 ${orderNo}: HTTP ${res.status} ${res.body}`);
  const detail = await trpcQuery("orders.detail", { orderNo }, session);
  const token = detail?.downloadUrl
    ? new URL(detail.downloadUrl, "http://x").searchParams.get("token")
    : null;
  return { orderNo, detail, token, callback: cb };
}

async function download(token) {
  const res = await fetch(`${DELIVERY}/api/download/secure?token=${encodeURIComponent(token)}`);
  let body = "";
  let truncated = false;
  try {
    body = await res.text();
  } catch (err) {
    // 校验失败时服务端会在发出最后一块之前掐断连接：客户端拿到的是残缺传输，
    // 而不是一份看起来完整、其实不是所购版本的文件。
    truncated = true;
    body = `<aborted: ${String(err?.cause?.message || err?.message || err)}>`;
  }
  return { status: res.status, headers: res.headers, body, truncated };
}

async function setMutable(variant) {
  const res = await fetch(`${ORIGIN}/__control/mutable?variant=${variant}`, { method: "POST" });
  if (!res.ok) throw new Error(`切换合成包变体失败: HTTP ${res.status}`);
  return res.text();
}

try {
  group("0. 环境自检");
  const probe = await fetch(`${ORIGIN}/v1.ex5`);
  check("合成发包源可用", probe.ok && (await probe.text()).includes(MARKER_V1));
  await setMutable("a");
  const mutableProbe = await fetch(`${ORIGIN}/mutable.ex5`);
  check("可替换字节的合成包可用", mutableProbe.ok && (await mutableProbe.text()).includes("mutable=a"));

  // ═══════════════ A. 交付令牌 / 授权绑定到具体订单 ═══════════════
  group("A. 同一用户同一商品的两笔已付订单");
  const productA = await seedProduct("两笔订单商品", `${ORIGIN}/v1.ex5`);
  const alice = await registerUser("alice");

  const first = await buyAndPay(alice.session, productA.id, "A1");
  check("第一笔订单已付并下发交付入口", !!first.token, `orderNo=${first.orderNo}`);
  const firstRow = await orderRow(first.orderNo);
  check("第一笔订单锁定的是 v1 发包地址", String(firstRow?.deliveryUrl || "").endsWith("/v1.ex5"), String(firstRow?.deliveryUrl));

  // 商品换包：客户随后又买了一次，这一次买到的是 v2。
  await conn.query("UPDATE strategies SET downloadUrl=? WHERE id=?", [`${ORIGIN}/v2.ex5`, productA.id]);
  const second = await buyAndPay(alice.session, productA.id, "A2");
  check("第二笔订单已付并下发交付入口", !!second.token, `orderNo=${second.orderNo}`);
  const secondRow = await orderRow(second.orderNo);
  check("第二笔订单锁定的是 v2 发包地址", String(secondRow?.deliveryUrl || "").endsWith("/v2.ex5"), String(secondRow?.deliveryUrl));
  check("两笔是不同订单", firstRow?.id !== secondRow?.id, `${firstRow?.id} vs ${secondRow?.id}`);

  const fromFirst = await download(first.token);
  check(
    "从第一笔订单入口下载拿到 v1（不是最近那笔订单的 v2）",
    fromFirst.status === 200 && fromFirst.body.includes(MARKER_V1),
    fromFirst.status === 200
      ? (fromFirst.body.includes(MARKER_V2) ? "交付到了 v2（被导向了最近一笔订单）" : fromFirst.body.slice(0, 48))
      : `HTTP ${fromFirst.status}`,
  );
  const fromSecond = await download(second.token);
  check(
    "从第二笔订单入口下载拿到 v2",
    fromSecond.status === 200 && fromSecond.body.includes(MARKER_V2),
    fromSecond.status === 200 ? fromSecond.body.slice(0, 48) : `HTTP ${fromSecond.status}`,
  );

  group("A2. 退款订单不能借另一笔 paid 订单越权");
  await conn.query("UPDATE orders SET status='refunded' WHERE orderNo=?", [second.orderNo]);
  const refundedTokenUse = await download(second.token);
  check("已退款订单的 token 被拒", refundedTokenUse.status === 403, `HTTP ${refundedTokenUse.status}`);
  const stillPaid = await download(first.token);
  check("同商品另一笔仍 paid 的订单不受影响，仍发它自己的 v1",
    stillPaid.status === 200 && stillPaid.body.includes(MARKER_V1), `HTTP ${stillPaid.status}`);
  const refundedDetail = await trpcQuery("orders.detail", { orderNo: second.orderNo }, alice.session);
  check("已退款订单详情不再下发交付入口", refundedDetail?.downloadUrl === null, `downloadUrl=${refundedDetail?.downloadUrl}`);

  // 反过来：退第一笔、恢复第二笔
  await conn.query("UPDATE orders SET status='paid' WHERE orderNo=?", [second.orderNo]);
  await conn.query("UPDATE orders SET status='refunded' WHERE orderNo=?", [first.orderNo]);
  check("退款方向对调后，第一笔的 token 被拒", (await download(first.token)).status === 403);
  const secondAgain = await download(second.token);
  check("退款方向对调后，第二笔仍发它自己的 v2",
    secondAgain.status === 200 && secondAgain.body.includes(MARKER_V2), `HTTP ${secondAgain.status}`);
  await conn.query("UPDATE orders SET status='paid' WHERE orderNo=?", [first.orderNo]);

  group("A-leak. 订单接口不泄露私有发包地址");
  // 交付走后端代理的全部意义，就是私有存储地址不进浏览器。订单详情把整行订单
  // 摊平返回，快照列会跟着一起被带出去——买一份最便宜的商品就能拿到直链。
  const leakDetail = await trpcQueryRaw("orders.detail", { orderNo: first.orderNo }, alice.session);
  check("orders.detail 不回传私有发包地址", !leakDetail.raw.includes("/v1.ex5") && !leakDetail.raw.includes("/v2.ex5"),
    `deliveryUrl=${leakDetail.data?.deliveryUrl}`);
  check("orders.detail 不回传内容摘要等交付内部字段",
    !("deliveryUrl" in (leakDetail.data || {})) &&
      !("deliverySha256" in (leakDetail.data || {})) &&
      !("deliveryBytes" in (leakDetail.data || {})),
    Object.keys(leakDetail.data || {}).filter((k) => k.startsWith("delivery")).join(","));
  const leakList = await trpcQueryRaw("orders.myList", { limit: 50 }, alice.session);
  check("orders.myList 不回传私有发包地址", !leakList.raw.includes("/v1.ex5") && !leakList.raw.includes("/v2.ex5"),
    leakList.raw.includes("/v1.ex5") ? "列表里出现了直链" : "");

  group("A3. 历史订单 / 历史 token 兼容");
  // 修复之前建的老订单：既没有发包地址快照，也没有内容摘要。
  await conn.query(
    "UPDATE orders SET deliveryUrl=NULL, deliverySha256=NULL, deliveryBytes=NULL WHERE orderNo=?",
    [first.orderNo],
  );
  await conn.query("UPDATE strategies SET downloadUrl=? WHERE id=?", [`${ORIGIN}/v1.ex5`, productA.id]);
  const legacyOrder = await download(first.token);
  check("没有发包快照的历史订单回落到商品当前地址",
    legacyOrder.status === 200 && legacyOrder.body.includes(MARKER_V1), `HTTP ${legacyOrder.status}`);
  // 历史订单本来就没有版本约定，不能给它钉上「第一次下到的那份字节」——
  // 否则商品正常换包时，老客户会被 409 挡在外面。
  await conn.query("UPDATE strategies SET downloadUrl=? WHERE id=?", [`${ORIGIN}/v2.ex5`, productA.id]);
  const legacyAfterBump = await download(first.token);
  check("历史订单在商品换包后仍跟着商品当前地址走（不被钉死成 409）",
    legacyAfterBump.status === 200 && legacyAfterBump.body.includes(MARKER_V2), `HTTP ${legacyAfterBump.status}`);
  const [legacyRow] = await conn.query("SELECT deliverySha256 FROM orders WHERE orderNo=?", [first.orderNo]);
  check("历史订单不会被自动钉上内容摘要", !legacyRow[0]?.deliverySha256,
    `deliverySha256=${legacyRow[0]?.deliverySha256}`);
  await conn.query("UPDATE strategies SET downloadUrl=? WHERE id=?", [`${ORIGIN}/v1.ex5`, productA.id]);
  await conn.query("UPDATE orders SET deliveryUrl=? WHERE orderNo=?", [`${ORIGIN}/v1.ex5`, first.orderNo]);

  // 旧格式 token（不带订单号）：本次修复之前签发的 token，30 分钟内仍可用，按旧口径回落。
  const legacyPayload = `${alice.user.id}.strategy.${productA.id}.${Date.now() + 10 * 60 * 1000}`;
  const legacySig = crypto
    .createHmac("sha256", process.env.DOWNLOAD_SIGNING_SECRET)
    .update(legacyPayload)
    .digest("hex");
  const legacyToken = Buffer.from(`${legacyPayload}.${legacySig}`, "utf8").toString("base64url");
  const legacyTokenUse = await download(legacyToken);
  check("修复前签发的旧格式 token 在 TTL 内仍能交付（不打断在途客户）",
    legacyTokenUse.status === 200, `HTTP ${legacyTokenUse.status}`);

  // ═══════════════ B. 同 URL、字节被替换 ═══════════════
  group("B. 发包地址不变但字节被替换");
  await setMutable("a");
  const productB = await seedProduct("可替换字节商品", `${ORIGIN}/mutable.ex5`);
  const bob = await registerUser("bob");
  const mutableOrder = await buyAndPay(bob.session, productB.id, "B1");
  check("可替换字节商品已付并下发交付入口", !!mutableOrder.token, `orderNo=${mutableOrder.orderNo}`);

  const firstPull = await download(mutableOrder.token);
  check("首次下载拿到下单时那一份字节",
    firstPull.status === 200 && firstPull.body.includes("mutable=a"), `HTTP ${firstPull.status} ${firstPull.body.slice(0, 40)}`);
  // 第一次交付时这笔订单还没有内容身份：必须如实标 unpinned，不能对外宣称版本已锁定。
  check("首次下载如实标明版本身份尚未锁定",
    firstPull.headers.get("x-delivery-integrity") === "unpinned",
    `x-delivery-integrity=${firstPull.headers.get("x-delivery-integrity")}`);

  // 等摘要落库（recordDownload / 摘要学习都在响应体写完之后）
  let pinned = null;
  for (let i = 0; i < 60 && !pinned; i++) {
    const row = await orderRow(mutableOrder.orderNo);
    if (row?.deliverySha256) pinned = row;
    else await new Promise((r) => setTimeout(r, 50));
  }
  check("订单上记下了这一份包的内容摘要", !!pinned?.deliverySha256, `sha256=${String(pinned?.deliverySha256).slice(0, 16)}…`);

  // B1：同 URL，长度也变了
  await setMutable("bigger");
  const biggerPull = await download(mutableOrder.token);
  check("同 URL 换成长度不同的字节：不发错包",
    biggerPull.status !== 200 || !biggerPull.body.includes("mutable=d"),
    `HTTP ${biggerPull.status} ${biggerPull.body.slice(0, 48)}`);
  check("长度不同时给出可解释的待补发（409 + 可读原因）",
    biggerPull.status === 409 && /补发|DELIVERY_PACKAGE_MISMATCH/.test(biggerPull.body),
    `HTTP ${biggerPull.status} ${biggerPull.body.slice(0, 80)}`);

  // B2：同 URL，长度完全一样、字节不一样 —— content-length 分辨不了，只有摘要能分辨
  await setMutable("same-size");
  const sameSizePull = await download(mutableOrder.token);
  check("同 URL 换成等长不同字节：不静默错发",
    sameSizePull.status !== 200 || sameSizePull.truncated || !sameSizePull.body.includes("mutable=c"),
    `HTTP ${sameSizePull.status} truncated=${sameSizePull.truncated} ${sameSizePull.body.slice(0, 48)}`);
  check("等长不同字节被内容摘要识别出来",
    sameSizePull.status === 409 || sameSizePull.truncated,
    `HTTP ${sameSizePull.status} truncated=${sameSizePull.truncated}`);

  // B3：换回原字节 —— 正常交付恢复，不是一锁死就永远发不出去
  await setMutable("a");
  const restored = await download(mutableOrder.token);
  check("字节换回下单版本后恢复正常交付",
    restored.status === 200 && restored.body.includes("mutable=a"), `HTTP ${restored.status}`);
  check("恢复后的这一次是按内容身份校验过的",
    restored.headers.get("x-delivery-integrity") === "pinned",
    `x-delivery-integrity=${restored.headers.get("x-delivery-integrity")}`);
  const restoredDetail = await trpcQuery("orders.detail", { orderNo: mutableOrder.orderNo }, bob.session);
  check("订单详情如实报出交付锁定程度", restoredDetail?.deliveryIntegrity === "pinned",
    `deliveryIntegrity=${restoredDetail?.deliveryIntegrity}`);

  // B4：新订单从第一次下载起就是被校验的（商品级摘要已学到）
  const carol = await registerUser("carol");
  const freshOrder = await buyAndPay(carol.session, productB.id, "B2");
  const freshRow = await orderRow(freshOrder.orderNo);
  check("商品摘要学到之后，新订单下单当时就带上了内容摘要",
    !!freshRow?.deliverySha256, `sha256=${String(freshRow?.deliverySha256).slice(0, 16)}…`);
  await setMutable("bigger");
  const freshMismatch = await download(freshOrder.token);
  check("新订单首次下载就能挡住被替换的字节",
    freshMismatch.status === 409, `HTTP ${freshMismatch.status} ${freshMismatch.body.slice(0, 60)}`);
  await setMutable("a");

  group("C. 重复回调仍只认一次");
  const repeat = await postCallback(mutableOrder.callback);
  check("重复回调仍返回 success", repeat.status === 200 && repeat.body.trim() === "success", `HTTP ${repeat.status}`);
  const mutableRow = await orderRow(mutableOrder.orderNo);
  const [payRows] = await conn.query("SELECT * FROM payments WHERE orderId=?", [mutableRow.id]);
  check("重复回调不新增支付流水", payRows.length === 1, `${payRows.length} 行`);
  const burst = await Promise.all(Array.from({ length: 6 }, () => postCallback(mutableOrder.callback)));
  check("并发 6 次重复回调全部 200", burst.every((r) => r.status === 200), burst.map((r) => r.status).join(","));
  const [payRows2] = await conn.query("SELECT * FROM payments WHERE orderId=?", [mutableRow.id]);
  check("并发重复回调后支付流水仍为 1 行", payRows2.length === 1, `${payRows2.length} 行`);
} catch (err) {
  check("脚本跑完", false, String(err?.stack || err).slice(0, 400));
} finally {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n════ 合计 ${results.length} 项：通过 ${results.length - failed.length}，失败 ${failed.length} ════`);
  for (const f of failed) console.log(`  FAIL  [${f.group}] ${f.name} — ${f.detail}`);
  await conn.end();
  process.exitCode = failed.length ? 1 : 0;
}
