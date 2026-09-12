# EAXAU 发布候选 · codex/eaxau-support-release-20260913

- 整合执行：Claude Opus 5，2026-09-13
- 仓库：`~/cc/eaxau-support-release-20260913`（**新建的隔离副本**，从 `~/cc/eaxau-conversion-20260913` clone，再把 `~/cc/eaxau-support-20260913` 当第二个 remote 取对象）
- **未 push、未部署、未连生产库、未生成/轮换任何生产密码、未改两个 source 仓库、未碰主 dirty 检出。**

---

## 一、基线与 source tree（合并前后都记下来）

| 位置 | commit | tree |
|---|---|---|
| 生产 main（Railway 正在跑的） | `818780e67d3042fc0d0b0a84e2bb4967ececd796` | `05fb09c48f0158f01ed2750fe517848698cc0551` |
| conversion source HEAD | `04a45666fcb80d4e935169ac3b288a8293efccc9` | `2d96b4b05864252f1860c67b2086968b2e174eea` |
| support source HEAD | `fa48ac877abd3b2297571f6ea5e4c840df46cb16` | `4334e9f7d2f10f634a18d50867fe1bea46372131` |
| 合并结果（两次 merge 后） | `626459f2476bf3b662520205f15f8e02b79bdca1` | `6f5c235a63d4aaac94c453c65853233cb3b926b7` |
| 本分支 HEAD（含本轮修复） | `33ab258` | 见 `git rev-parse HEAD^{tree}` |

两个 source 仓库在整合前后都是 `git status --porcelain` 空，HEAD 未动。

分支结构（从生产 main 起，两个 no-ff merge + 一个修复 commit）：

```
33ab258 fix(support): 身份绑定改成必填，草稿按打字时的身份盖章
626459f merge(support): integrate eaxau-support-20260913 @fa48ac8
49d6bb3 merge(conversion): integrate eaxau-conversion-20260913 @04a4566 onto production main 818780e
818780e Make the EA marketplace the eaxau.com homepage (#4)   ← 线上现状
```

两次 merge 都**零冲突**自动合上。原因记下来备查：`818780e` 是 PR #4 对 `52876b4` 的 squash，
两支 source 的共同祖先是 `ee508bf`，squash 内容与 `52876b4` 基本同形，三方合并没有真冲突。
`package.json` / `pnpm-lock.yaml` / `package-lock.json` 相对 `818780e` **零改动**——
本次发布不引入任何依赖变更（DDX 那种「本地 npm 绿、云端 pnpm 红」的双锁风险这次不存在，
但仓库里两个 lock 都在，Railway 用的是 pnpm 那个）。

## 二、Railway 构建验证（按 railway.json 的真实管线，干净隔离副本）

```
$ pnpm install --frozen-lockfile      → INSTALL_EXIT=0   (pnpm 11.19.0, Node v22.23.0)
$ pnpm build:web                      → BUILD_EXIT=0
    esbuild → dist/index.mjs 703.6kb
    expo export --platform web → web-build (entry JS 4.28 MB, 2 CSS, index.html)
    [inject-web-bootstrap] OK   [verify-web-build] OK: 3 required asset(s), 1 JS, 2 CSS
$ NODE_ENV=production node dist/index.mjs   → /api/health 200 {"ok":true,...}
```

启动命令跑的就是 `railway.json` 里那一条，健康检查路径也是 `/api/health`，与线上一致。
（跑在本机隔离 MySQL `127.0.0.1:3399` 的一次性库上，**没有连生产**。）

## 三、本轮关键修复：身份绑定从「可选」改成「必填」

独立复核 95 那版 `expectedIdentity` 是 optional，作者的口径是「旧客户端不传行为不变」。
这条正是缺口——**旧 tab 就是旧客户端**，它不传，于是原来的写错路径原样保留。

### 3.1 缺口是真的，有真实路由证据（修前）

用**修复前**那份 `dist/index.mjs` 跑真 HTTP + 真 MySQL（`verify/support-identity-e2e.mjs`）：

```
FAIL  旧客户端不带身份绑定 → 拒绝写入并要求刷新 :: code=undefined msg=undefined
FAIL  旧客户端那段文字一个字都没落库 :: rows=1
FAIL  也没有在 B 名下新建任何会话 :: B 名下会话数=2
```

即：匿名时打的那段草稿，在旧客户端上确实落进了 B 的账号（`support_conversations.userId = B`）。
路径是 `ensureConversation` 拿**服务端当时解析出来的** userId 建会话——访客令牌还没有会话时不设防。

### 3.2 两处修法

1. **服务端 `server/support/service.ts`**：缺绑定不再放行，抛 `BAD_REQUEST`
   「页面版本过旧，这条没有发出去，请刷新页面后重发」。选 `BAD_REQUEST` 是因为它在
   旧客户端的错误文案白名单（`SAFE_SERVER_MESSAGE_CODES`）里是**原样展示**的那一档，
   旧 tab 直接看到「请刷新」，而不是一句看不懂的通用错误。
   这个字段仍然**只能让请求被拒绝**：会话归属一律取 `ctx.user` 解析出来的 `userId`，
   客户端指定不了任何人，服务端 auth 仍是唯一授权源。闸门排在限流之前，被拒不吃配额。

2. **客户端 `components/support-chat.tsx`**：草稿自带作者身份 `draftIdentity`。
   原来的清理挂在身份变更 effect 的 `ensureVisitorToken().then()` 里，是异步的；
   在「身份已经变成 B、令牌还没换回来」那段窗口点发送，旧代码 `const expectedIdentity = identity`
   会拿 **B 的身份给 A 的草稿盖章**，服务端一比对「自报=实际」就放行——闸门是被骗着盖章的，拦不住。
   现在送出去的是**打字时**那个身份（`onChangeText` 每次钉住），发送时先比对：
   不一致就地 `wipeIdentityBoundState()` 清干净并三语提示，这条一个字都不发。

### 3.3 修后证据（真实状态 / 真实路由，不是源码断言）

`NODE_ENV=production node dist/index.mjs` + 真 MySQL，`verify/support-identity-e2e.mjs` **23/23 PASS**：

```
PASS  自报 guest 但实际已登录 → 服务端拒绝写入（身份切换竞态） :: code=CONFLICT
PASS  旧客户端不带身份绑定 → 拒绝写入并要求刷新 :: code=BAD_REQUEST msg=页面版本过旧…请刷新页面后重发
PASS  旧客户端那段文字一个字都没落库 :: rows=0
PASS  也没有在 B 名下新建任何会话 :: B 名下会话数 1 → 1
PASS  自报身份与实际一致 → 正常放行 :: EAX-7MJ8WMX
```

真 MySQL 单测（`tests/support-mysql.test.ts`，33 passed）新增用例直接查库断言：
旧客户端那条 `SELECT COUNT(*) FROM support_messages WHERE body = ?` = 0，
`SELECT COUNT(*) FROM support_conversations WHERE userId = 888` = 0。

### 3.4 这个改动的代价（必须知道）

**所有不带绑定字段的旧客户端从部署那一刻起发不出消息**，会看到「请刷新页面后重发」。
这是刻意的：宁可要求刷新，也不把 A 的字写进 B 的库。影响面：
- Web 旧 tab：刷新即可，草稿在旧客户端上是保留的（错误分支不清草稿）。
- 原生 App（iOS/Android）若已分发旧包，需要先更新才能用站内咨询——**本仓库的原生端此前未发布、未跑过**，按现状无实际存量客户，但发布前请确认这一点。
- 仓库内所有调用点（测试、`verify/*.mjs|mts`）已同步改成必填口径。

## 四、英语 / 阿语合规（独立抽查）

- 机器人自报身份三语都成立，真 HTTP 实测：
  `PASS locale=en :: 【Automated assistant (bot reply, not a human)】`
  `PASS locale=ar :: 【مساعد آلي (رد آلي، ليس شخصًا)】`
- 收益口径：`lib/support-faq.ts` 的 `performance` 规则三语同义——
  en「we make no return promises here, and we will not say an account 'cannot blow up'」、
  ar「لا نقدّم أي وعود بالأرباح… ولن نقول إن الحساب «لا يمكن أن يُصفّى»」，与中文一致，
  没有承诺盈利、没有「不会爆仓」。
- 未见英语/阿语回复里混中文（e2e 有扫描断言，本轮全过）。
- **不签收**：母语流畅度、阿语 RTL 版式（`dir="rtl"` 会设，但没人眼看过排版）。
  另外 `SupportError` 服务端文案仍是中文，客户端有本地白名单覆盖；本轮新增的
  「请刷新页面后重发」这一条走的正是**原样展示中文**那一档 —— 非中文客户会看到中文。
  这是为了让旧客户端看懂而做的取舍，新客户端不会触发（永远带绑定），但记在这里。

## 五、测试与检查（本机实跑）

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | exit 0，零输出 |
| `npx vitest run`（`SUPPORT_TEST_DATABASE_URL` 指向隔离 MySQL） | **381 passed / 1 failed** (63 files) |
| `tests/support-mysql.test.ts`（真 MySQL 8.4.10） | 33 passed |
| `verify/support-e2e.mjs`（真 HTTP，生产启动命令） | **25/25 passed** |
| `verify/support-identity-e2e.mjs`（真 HTTP + 真库 + 真会话 JWT） | **23/23 passed** |
| `npx tsx verify/support-upgrade-e2e.mts`（旧 DDL → 升级路径） | all passed |
| `pnpm install --frozen-lockfile && pnpm build:web` | exit 0 |

**唯一一条失败：`tests/backtest-data.test.ts > should have backtest data for all strategies`
（`expected 0 to be greater than 0`）。** 它读 `server/db` 的策略/回测数据，隔离库里没有回测行；
本次 diff 的 8 个文件都不在它的依赖里。判定为数据依赖的既有失败，**但我没有在生产数据上验证过它**。

## 六、上线所需 env / 迁移清单（未执行，交给 root）

**必需 env（缺 `JWT_SECRET` 进程直接退出）：**
- `JWT_SECRET`、`DATABASE_URL`、`ADMIN_EMAIL`、`ADMIN_PASSWORD`
- `OAUTH_SERVER_URL`、`VITE_APP_ID`、`OWNER_OPEN_ID`（登录链路；本轮日志里 OAuth 未配会打 ERROR）

**站内咨询新增（可选，不配就是留言模式）：**
- `SUPPORT_TELEGRAM_BOT_TOKEN` / `SUPPORT_TELEGRAM_CHAT_ID` / `SUPPORT_TELEGRAM_NOTIFY_MODE`
  （回落到 `TELEGRAM_*`）。**`NOTIFY_MODE` 不是 `live` 时，前端和机器人只说「留言」，
  不说「有人在看」** —— 这条产品硬要求靠 env 生效，别配错。

**迁移：** 启动时 `runMigrations()` 自动跑，不需要手动 migrate：
1. `ensureSupportChatSchema()` — 建 4 张 support 表；对**已有旧版表**的库按
   `SUPPORT_ADDED_COLUMNS` 登记表补列（`support_conversations.notifyGeneration`、
   `support_notifications.generation`），幂等，重复执行 0 语句。升级路径在隔离库用
   `cdbaefb` 的真 DDL 验过。
2. 商品内容迁移 v4（键 `2026-08-06-strategy-content-placeholders-v4`，未改）
3. `syncUnevidencedTitleClaims()` — 独立键 `2026-09-13-unevidenced-title-claims-v5`，
   只 `UPDATE strategies.title`，不碰 `saleMode` / `coverImage`，`dataStatus='verified'` 的不动。

**生产数据 / META 本轮一个字没动，也没有连过生产库。**

## 七、未通过 / 未做（发布前请当成阻塞项自己判）

1. **生产库参数未知**：版本 / 隔离级别 / 时区 / `sql_mode` 全程按本机 8.4.10 · UTC · RR 验证。
2. **生产迁移没跑过**；support 表在生产上是全新建，升级路径只在隔离库上验过。
3. **生产 `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `JWT_SECRET` 由 root 配**；本轮用的是单条命令里
   现生成的一次性随机值，没落盘、没进任何文件，**不构成生产配置就绪的证据**。
4. **Telegram 全程 `dry_run`**，真实投递一次都没发生。
5. **浏览器人工点击验收没做**；阿语 RTL 版式没人看过；原生端没跑；多实例部署没验。
6. `tests/backtest-data.test.ts` 一条失败（见第五节）。
7. **旧客户端从部署起必须刷新**才能发消息（第 3.4 节），这是本次发布的行为变更，要提前知道。
8. 未 push、未部署。**本文件不构成上线，线上仍是 `818780e`。**
