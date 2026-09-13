/**
 * EAXAU 商品 → 注册 → 订单 → 支付确认 → 授权 → 文件交付 → 售后 闭环的隔离验收。
 *
 * 打的是**真实应用入口**：真 HTTP、真 tRPC 过程、真 MySQL（隔离库）、真 ZPay 回调路由
 * （签名由本地一次性 sandbox 商户密钥自签，网关主机从头到尾没有被访问过）。
 * 没有一处业务判定是靠 mock 函数替身完成的。
 *
 * 明确不做的事：不连生产库、不建真实收款、不碰真实交易账户、不发邮件/消息、
 * 不伪造生产已付款订单，交付文件是带标识的合成附件。
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

// ─────────────────────────── 断言框架 ───────────────────────────
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
async function expectThrows(name, fn, matcher) {
  try {
    await fn();
    check(name, false, "没有报错（预期被拒绝）");
  } catch (err) {
    const msg = String(err?.message || err);
    check(name, matcher ? matcher.test(msg) : true, msg.slice(0, 120));
  }
}

// ─────────────────────────── tRPC 客户端 ───────────────────────────
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
async function trpcQuery(path, input, session = newSession()) {
  const qs = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await fetch(`${API}/api/trpc/${path}${qs}`, {
    headers: { cookie: cookieHeader(session) },
  });
  absorbCookies(session, res);
  return unwrap(await res.json(), path);
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

// ─────────────────────────── ZPay 模拟回调 ───────────────────────────
// 这里复刻的是网关侧的签名动作（我们没有真实商户），服务端的验签、金额校验、
// 幂等与落库全部走 server/_core/payment-callback.ts 的生产代码。
function zpaySign(params) {
  const qs = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type")
    .filter((k) => params[k] !== "" && params[k] !== null && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("md5").update(qs + ZPAY_KEY, "utf8").digest("hex");
}
function buildCallback({ orderNo, amount, tradeNo, type = "alipay", tradeStatus = "TRADE_SUCCESS", pid = ZPAY_PID }) {
  const params = {
    pid,
    trade_no: tradeNo,
    out_trade_no: orderNo,
    type,
    name: "隔离验收合成商品",
    money: Number(amount).toFixed(2),
    trade_status: tradeStatus,
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

// ─────────────────────────── 主流程 ───────────────────────────
const conn = await mysql.createConnection(DB_URL);
const stamp = Date.now().toString(36);

async function seedSyntheticProduct(fileUrl) {
  const title = `【隔离验收】合成 EA 包 ${stamp}`;
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
  const email = `iso-${tag}-${stamp}@eaxau.invalid`;
  const session = newSession();
  // sendEmailCode 会先把验证码落库再尝试发信；隔离环境**故意不配** RESEND_API_KEY，
  // 所以发信这一步必然失败（不外发任何邮件），验证码从隔离库里读。
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
    { email, code: rows[0].code, name: `iso-${tag}`, password: crypto.randomBytes(12).toString("hex") },
    session,
  );
  return { session, email, user: out.user };
}

async function orderRow(orderNo) {
  const [rows] = await conn.query("SELECT * FROM orders WHERE orderNo=?", [orderNo]);
  return rows[0];
}
async function paymentRows(orderId) {
  const [rows] = await conn.query("SELECT * FROM payments WHERE orderId=? ORDER BY id", [orderId]);
  return rows;
}

async function download(base, token) {
  const res = await fetch(`${base}/api/download/secure?token=${encodeURIComponent(token)}`);
  return { status: res.status, headers: res.headers, body: await res.text() };
}

try {
  // ── 0. 前置：合成发包源在线 ──
  group("0. 环境自检");
  const originProbe = await fetch(`${ORIGIN}/v1.ex5`);
  check("合成发包源可用", originProbe.ok && (await originProbe.text()).includes(MARKER_V1));
  const methods = await trpcQuery("payments.listMethods", undefined);
  check(
    "支付方式由网关注册表产出",
    Array.isArray(methods) && methods.some((m) => m.method === "alipay" && m.gateway === "zpay"),
    JSON.stringify(methods?.map?.((m) => `${m.gateway}/${m.method}`)),
  );

  // ── 1. 商品 ──
  group("1. 商品");
  const product = await seedSyntheticProduct(`${ORIGIN}/v1.ex5`);
  const publicDetail = await trpcQuery("strategies.detail", { id: product.id });
  check("商品可从真实应用入口读到", publicDetail?.id === product.id, publicDetail?.title);
  check("商品为直购模式且有价格", publicDetail?.saleMode === "direct" && Number(publicDetail?.price) > 0,
    `saleMode=${publicDetail?.saleMode} price=${publicDetail?.price}`);
  check("公开商品详情不泄露发包地址", !("downloadUrl" in (publicDetail || {})) || !publicDetail.downloadUrl,
    `downloadUrl=${publicDetail?.downloadUrl ?? "(absent)"}`);

  // ── 2. 注册/登录 ──
  group("2. 注册 / 登录");
  const alice = await registerUser("alice");
  const bob = await registerUser("bob");
  check("用户 A 注册成功并拿到会话", !!alice.user?.id, `uid=${alice.user?.id}`);
  check("用户 B 注册成功并拿到会话", !!bob.user?.id, `uid=${bob.user?.id}`);
  const me = await trpcQuery("auth.me", undefined, alice.session);
  check("会话 cookie 可被真实 context 认出", me?.id === alice.user.id);

  // ── 3. 未登录不能下单 ──
  group("3. 下单授权");
  await expectThrows("未登录下单被拒绝", () => trpcMutate("orders.create", { productKind: "strategy", productId: product.id }));

  const created = await trpcMutate("orders.create", { productKind: "strategy", productId: product.id }, alice.session);
  const orderNo = created.orderNo;
  const persisted = await orderRow(orderNo);
  check("订单真实落库", !!persisted, `orderNo=${orderNo} status=${persisted?.status} amount=${persisted?.amount}`);
  check("订单归属下单用户", persisted?.userId === alice.user.id);
  check("下单金额取自商品价格", String(persisted?.amount) === "1.00", String(persisted?.amount));

  // ── 4. 没付款不能提前拿下载 ──
  group("4. 没付款不能提前拿交付");
  const pendingDetail = await trpcQuery("orders.detail", { orderNo }, alice.session);
  check("待支付订单不下发下载授权", pendingDetail?.downloadUrl === null, `downloadUrl=${pendingDetail?.downloadUrl}`);
  const noToken = await download(API, "");
  check("裸访问下载入口被拒", noToken.status === 400, `HTTP ${noToken.status}`);
  const junkToken = await download(API, Buffer.from(`${alice.user.id}.strategy.${product.id}.${Date.now() + 600000}.${"0".repeat(64)}`).toString("base64url"));
  check("自造 token（签名错）被拒", junkToken.status === 403, `HTTP ${junkToken.status}`);

  // ── 5. 其他人不能取走订单 ──
  group("5. 订单归属");
  await expectThrows("B 读不到 A 的订单", () => trpcQuery("orders.detail", { orderNo }, bob.session), /无权/);
  await expectThrows("B 不能对 A 的订单发起支付", () => trpcMutate("payments.initiate", { orderNo, method: "alipay" }, bob.session), /无权/);
  await expectThrows("B 不能取消 A 的订单", () => trpcMutate("orders.cancel", { orderNo }, bob.session), /无权/);
  const bobList = await trpcQuery("orders.myList", { limit: 50 }, bob.session);
  check("B 的订单列表里没有 A 的订单", !bobList?.some((o) => o.orderNo === orderNo), `${bobList?.length ?? 0} 条`);

  // ── 6. 发起支付 ──
  group("6. 发起支付（模拟渠道）");
  const initiated = await trpcMutate("payments.initiate", { orderNo, method: "alipay" }, alice.session);
  check("生成支付跳转 URL", typeof initiated?.payUrl === "string" && initiated.payUrl.includes(`out_trade_no=${orderNo}`),
    initiated?.payUrl?.slice(0, 80));
  const afterInitiate = await paymentRows(persisted.id);
  check("支付意图落库为 pending", afterInitiate.length === 1 && afterInitiate[0].status === "pending",
    `${afterInitiate.length} 行 status=${afterInitiate[0]?.status}`);

  // ── 7. 回调校验 ──
  group("7. 支付回调校验");
  const badSign = { ...buildCallback({ orderNo, amount: 1, tradeNo: "SIM-BAD-SIGN" }), sign: "0".repeat(32) };
  const badSignRes = await postCallback(badSign);
  check("签名错误的回调被拒", badSignRes.status === 400, `HTTP ${badSignRes.status} ${badSignRes.body}`);
  check("签名错误后订单仍未支付", (await orderRow(orderNo)).status === "pending");

  const wrongAmount = buildCallback({ orderNo, amount: 0.01, tradeNo: "SIM-WRONG-AMOUNT" });
  const wrongAmountRes = await postCallback(wrongAmount);
  check("金额不符的回调被拒", wrongAmountRes.status === 400, `HTTP ${wrongAmountRes.status} ${wrongAmountRes.body}`);
  check("金额不符后订单仍未支付", (await orderRow(orderNo)).status === "pending");

  const foreignPid = buildCallback({ orderNo, amount: 1, tradeNo: "SIM-FOREIGN-PID", pid: "9999-not-ours" });
  const foreignPidRes = await postCallback(foreignPid);
  check("他人商户号的回调被拒", foreignPidRes.status === 400, `HTTP ${foreignPidRes.status}`);

  const unknownOrder = buildCallback({ orderNo: "EX20260101DEADBEEF", amount: 1, tradeNo: "SIM-NO-ORDER" });
  const unknownOrderRes = await postCallback(unknownOrder);
  check("未知订单号的回调被拒", unknownOrderRes.status === 404, `HTTP ${unknownOrderRes.status}`);

  // ── 8. 支付成功 ──
  group("8. 支付成功");
  const good = buildCallback({ orderNo, amount: 1, tradeNo: `SIM-${stamp}-OK` });
  const goodRes = await postCallback(good);
  check("正确回调返回 success", goodRes.status === 200 && goodRes.body.trim() === "success", `HTTP ${goodRes.status} ${goodRes.body}`);
  const paid = await orderRow(orderNo);
  check("订单落库为已支付", paid.status === "paid" && !!paid.paidAt, `status=${paid.status} paidAt=${paid.paidAt}`);
  const paidPayments = await paymentRows(paid.id);
  check("支付流水落库为 success 且已验签", paidPayments.length === 1 && paidPayments[0].status === "success" && !!paidPayments[0].callbackVerified,
    `${paidPayments.length} 行`);

  // ── 9. 同回调重复 ──
  group("9. 同一回调重复 / 并发");
  const firstPaidAt = new Date(paid.paidAt).getTime();
  const repeat = await postCallback(good);
  check("重复回调仍返回 success（不让网关无限重推）", repeat.status === 200 && repeat.body.trim() === "success", `HTTP ${repeat.status}`);
  const afterRepeat = await orderRow(orderNo);
  check("重复回调不改写支付时间", new Date(afterRepeat.paidAt).getTime() === firstPaidAt,
    `${afterRepeat.paidAt}`);
  check("重复回调不新增支付流水", (await paymentRows(paid.id)).length === 1, `${(await paymentRows(paid.id)).length} 行`);

  const burst = await Promise.all(Array.from({ length: 6 }, () => postCallback(good)));
  check("并发 6 次重复回调全部 200", burst.every((r) => r.status === 200), burst.map((r) => r.status).join(","));
  const afterBurst = await paymentRows(paid.id);
  check("并发重复回调后支付流水仍为 1 行", afterBurst.length === 1, `${afterBurst.length} 行`);
  const afterBurstOrder = await orderRow(orderNo);
  check("并发重复回调后支付时间未被改写", new Date(afterBurstOrder.paidAt).getTime() === firstPaidAt, `${afterBurstOrder.paidAt}`);

  // ── 10. 授权与交付入口 ──
  group("10. 授权与交付入口");
  const paidDetail = await trpcQuery("orders.detail", { orderNo }, alice.session);
  check("已支付订单下发下载授权", typeof paidDetail?.downloadUrl === "string" && paidDetail.downloadUrl.startsWith("/api/download/secure?token="),
    paidDetail?.downloadUrl?.slice(0, 40));
  const token = new URL(paidDetail.downloadUrl, "http://x").searchParams.get("token");

  const aliceOrders = await trpcQuery("orders.myList", { limit: 50 }, alice.session);
  check("「我的订单」能重新找回这笔已支付订单", aliceOrders?.some((o) => o.orderNo === orderNo && o.status === "paid"));
  const reEntry = await trpcQuery("orders.detail", { orderNo }, alice.session);
  check("从订单再次进入可再拿一次下载授权（不是一次性页面）", !!reEntry?.downloadUrl);

  // 生产真实路由的鉴权行为（隔离环境没有公网出口，取包这一段会被 SSRF 策略正确拦住）
  const prodRoute = await download(API, token);
  check("生产路由 /api/download/secure 接受合法 token（未返回 4xx 鉴权错）", prodRoute.status !== 400 && prodRoute.status !== 403,
    `HTTP ${prodRoute.status}`);
  check("生产 SSRF 策略拒绝私有地址发包源", prodRoute.status === 502, `HTTP ${prodRoute.status} ${prodRoute.body.slice(0, 60)}`);

  // ── 11. 文件交付 ──
  group("11. 文件交付（真实 HTTP + 生产下载处理函数）");
  const delivered = await download(DELIVERY, token);
  check("已购用户取到文件", delivered.status === 200, `HTTP ${delivered.status}`);
  check("交付内容是本次购买的合成包 v1", delivered.body.includes(MARKER_V1), delivered.body.slice(0, 48));
  check("响应不缓存且强制下载", delivered.headers.get("cache-control")?.includes("no-store") &&
    (delivered.headers.get("content-disposition") || "").startsWith("attachment;"),
    `${delivered.headers.get("content-disposition")}`);
  check("发包源地址不出现在响应里", !delivered.headers.get("content-disposition")?.includes("127.0.0.1"));
  // recordDownload 在响应体写完之后才落库，客户端读到 body 时可能还差几毫秒。
  let dlRows = [];
  for (let i = 0; i < 40 && dlRows.length === 0; i++) {
    [dlRows] = await conn.query("SELECT * FROM downloads WHERE userId=? AND strategyId=?", [alice.user.id, product.id]);
    if (!dlRows.length) await new Promise((r) => setTimeout(r, 50));
  }
  check("下载记录落库", dlRows.length === 1, `${dlRows.length} 行`);

  const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
  const tamperedRes = await download(DELIVERY, tampered);
  check("篡改 token 被拒", tamperedRes.status === 403, `HTTP ${tamperedRes.status}`);

  // B 未购买同一商品：即便知道商品 id，也拿不到授权
  const bobOrder = await trpcMutate("orders.create", { productKind: "strategy", productId: product.id }, bob.session);
  const bobDetail = await trpcQuery("orders.detail", { orderNo: bobOrder.orderNo }, bob.session);
  check("B 未付款拿不到同商品的下载授权", bobDetail?.downloadUrl === null, `downloadUrl=${bobDetail?.downloadUrl}`);

  // ── 12. 付款商品与发包版本一致性 ──
  // 注意口径：这一组验的是**发包地址**跟着订单走。地址锁不住字节——同一个地址的内容
  // 可以被就地换掉。按内容摘要校验、退款订单越权、同商品多笔订单各发各的版本，
  // 在 verify/purchase/delivery-binding-e2e.mjs 里单独验。
  group("12. 付款商品与发包地址一致性");
  await conn.query("UPDATE strategies SET downloadUrl=? WHERE id=?", [`${ORIGIN}/v2.ex5`, product.id]);
  const afterBump = await download(DELIVERY, token);
  check(
    "商品换包后，已付订单仍交付下单时锁定的版本",
    afterBump.status === 200 && afterBump.body.includes(MARKER_V1),
    afterBump.status === 200
      ? (afterBump.body.includes(MARKER_V2) ? "交付到了 v2（与付款时的商品版本不一致）" : afterBump.body.slice(0, 48))
      : `HTTP ${afterBump.status}`,
  );
  await conn.query("UPDATE strategies SET downloadUrl=? WHERE id=?", [`${ORIGIN}/v1.ex5`, product.id]);

  // 交付响应要如实报出这一笔订单锁到了什么程度，不能让「地址锁定」被当成「版本锁定」。
  const integrityMarked = await download(DELIVERY, token);
  check(
    "交付响应如实标注版本身份锁定程度",
    ["pinned", "unpinned"].includes(integrityMarked.headers.get("x-delivery-integrity")),
    `x-delivery-integrity=${integrityMarked.headers.get("x-delivery-integrity")}`,
  );
  const integrityDetail = await trpcQuery("orders.detail", { orderNo }, alice.session);
  check(
    "订单详情如实报出交付锁定程度",
    ["pinned", "url-only", "none"].includes(integrityDetail?.deliveryIntegrity),
    `deliveryIntegrity=${integrityDetail?.deliveryIntegrity}`,
  );

  // 修复之前建的老订单没有快照列，必须回落到商品当前地址而不是 404。
  await conn.query("UPDATE orders SET deliveryUrl=NULL WHERE orderNo=?", [orderNo]);
  const legacy = await download(DELIVERY, token);
  check("没有快照的老订单回落到商品当前发包地址", legacy.status === 200 && legacy.body.includes(MARKER_V1),
    `HTTP ${legacy.status}`);
  const legacyDetail = await trpcQuery("orders.detail", { orderNo }, alice.session);
  check("没有快照的老订单仍有交付入口", !!legacyDetail?.downloadUrl);
  await conn.query("UPDATE orders SET deliveryUrl=? WHERE orderNo=?", [`${ORIGIN}/v1.ex5`, orderNo]);

  // 商品清空发包地址后，已成交订单靠快照仍然可交付
  await conn.query("UPDATE strategies SET downloadUrl=NULL WHERE id=?", [product.id]);
  const orphanDetail = await trpcQuery("orders.detail", { orderNo }, alice.session);
  check("商品下架发包地址后已购用户仍有交付入口", !!orphanDetail?.downloadUrl);
  const orphan = await download(DELIVERY, new URL(orphanDetail.downloadUrl, "http://x").searchParams.get("token"));
  check("商品下架发包地址后仍能取到已购版本", orphan.status === 200 && orphan.body.includes(MARKER_V1), `HTTP ${orphan.status}`);
  await conn.query("UPDATE strategies SET downloadUrl=? WHERE id=?", [`${ORIGIN}/v1.ex5`, product.id]);

  // ── 13. 售后 ──
  group("13. 售后（退款后收回授权）");
  await conn.query("UPDATE orders SET status='refunded' WHERE orderNo=?", [orderNo]);
  const refundedDetail = await trpcQuery("orders.detail", { orderNo }, alice.session);
  check("退款后订单详情不再下发下载授权", refundedDetail?.downloadUrl === null, `downloadUrl=${refundedDetail?.downloadUrl}`);
  const afterRefund = await download(DELIVERY, token);
  check("退款后旧 token 立即失效", afterRefund.status === 403, `HTTP ${afterRefund.status}`);
  await conn.query("UPDATE orders SET status='paid' WHERE orderNo=?", [orderNo]);

  // ── 14. 过期订单 ──
  group("14. 过期订单");
  const stale = await trpcMutate("orders.create", { productKind: "strategy", productId: product.id }, bob.session);
  await conn.query("UPDATE orders SET expiresAt=DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE orderNo=?", [stale.orderNo]);
  const staleDetail = await trpcQuery("orders.detail", { orderNo: stale.orderNo }, bob.session);
  check("超时未付订单被判为失效", staleDetail?.status !== "pending", `status=${staleDetail?.status}`);
  const staleCallback = buildCallback({ orderNo: stale.orderNo, amount: 1, tradeNo: `SIM-${stamp}-STALE` });
  const staleRes = await postCallback(staleCallback);
  const staleRow = await orderRow(stale.orderNo);
  // 钱确实收到了：失效订单的晚到付款要认款并恢复交付，而不是吞掉款项又不发货。
  check("失效订单的晚到付款被认下来", staleRes.status === 200 && staleRow.status === "paid",
    `HTTP ${staleRes.status} order=${staleRow.status}`);
  const staleDelivery = await trpcQuery("orders.detail", { orderNo: stale.orderNo }, bob.session);
  check("认款后立刻有交付入口", !!staleDelivery?.downloadUrl, `downloadUrl=${staleDelivery?.downloadUrl?.slice(0, 32)}`);
} finally {
  // ── 汇总 ──
  const failed = results.filter((r) => !r.ok);
  console.log(`\n════ 合计 ${results.length} 项：通过 ${results.length - failed.length}，失败 ${failed.length} ════`);
  for (const f of failed) console.log(`  FAIL  [${f.group}] ${f.name} — ${f.detail}`);
  await conn.end();
  process.exitCode = failed.length ? 1 : 0;
}
