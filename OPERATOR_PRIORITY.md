# EAXAU 站内客服 · 真人手动接管（与线上 main 的差异）

- 执行：Claude Opus 5，2026-09-13
- 基线：生产 `main` = `973f013dd018fce917fbeacc552d8df4ef8d6532`（合并 PR #7，已真实上线）
- 隔离检出：`~/cc/eaxau-operator-priority-20260913`，分支 `codex-eaxau-operator-priority-20260913`
  （远端已有一条名为 `codex` 的分支，`codex/` 前缀会撞 ref，所以用连字符）
- **未 push、未部署、未连生产库、未改任何商品/交易/凭据数据、未删任何分支。**

---

## 一、改之前是什么样

线上 `server/support/store.ts` 的 `appendCustomerTurn` 写完访客那条消息之后，**无条件**再追加一条
`role='auto'` 的机器人回复。运营在后台回过话之后，客户再问一句，机器人照样抢在前面答一段 FAQ ——
真人和机器人在同一条会话里打架。线上那条 `EAX-XRY3JF4` 就是这个状态。

同一语义在 DDXAU（`assistantEnabled` + takeover/release）和 MQL0 上已经修好，EAXAU 这条是补齐。

## 二、改之后的口径

**运营一开口，这条会话就归人管。** 之后访客发的每一条只做两件事：落库、提醒运营；
一个字都不自动答，直到后台显式把自动接待交还回去。

状态机（只有一个可空列 `support_conversations.autoAssistEnabled`）：

| 列值 | 含义 | 怎么来的 |
|---|---|---|
| `NULL` | 没人表过态，按 `operatorMessageCount` 推导 | 建表默认值，**也是全部存量行的值** |
| `0` | 人工接管中 | 运营发回复时在同一条 UPDATE 里写；或后台点「人工接管」 |
| `1` | 自动接待 | 后台点「交还自动接待」 |

判定只有一份实现：`shared/support/contracts.ts` 的 `isAutoAssistEnabled` / `isOperatorTakeover`，
前端 / 后端 / 内存 store / MySQL store 全都调它，杜绝两处漂移。

**为什么可空、不给默认 `true`**：存量行补出来是 `NULL` → 走推导 → 运营已经回过话的会话
（线上 `EAX-XRY3JF4`）升级完**立刻**停掉自动抢答，一行数据都不用回填，也不需要停机。

**为什么运营回复要显式写 `0` 而不是留 `NULL` 靠计数推**：「先交还了自动接待、运营又回了一条」
这种情况列里是 `1`，光看 `operatorMessageCount` 推不回来，机器人会继续抢答。

## 三、并发怎么保证

抢答的窗口就在「运营正在点发送」和「访客正在点发送」这两个事务的交错处。所以：

- `appendCustomerTurn`（访客说话）、`appendMessage`（运营回复）、`setAutoAssist`（切开关）
  三条路径在**各自事务的第一步**都 `SELECT ... FOR UPDATE` 锁住同一行会话（`lockConversationOn`）。
- 加锁顺序一致（先会话行、后消息行），不引入新的死锁环；真撞上了 `withDeadlockRetry` 重试整个事务。
- 接管判定在**持锁之后、写消息之前**取值，不由调用方先查一次再把结论传进来。

内存 store 走同一套取值位置（整段同步执行，读到的就是没人能改的），语义与 MySQL 版一致。

## 四、界面上的身份说法

- 客户侧气泡标签：`EAXAU 顾问（真人）` → **`运营回复（后台发出）`**（三语同改）。
  站里没有「顾问」这个岗位，后台那条回复可能是经营者本人打的字，也可能是他借工具起草后发出的；
  逐条盖一个「这是某位真人顾问」的章，等于替对面认领一个系统证不出来的身份。
  现在只说**这条是从后台发出来的**，说得准。
- 后台标签：`我方真人回复` → `我方运营回复`；输入框提示改成「以站点运营身份回复；不要自称某位具体的顾问本人」。
- 机器人那一侧**一个字没松**：`自动值守 · 机器人` 角标 + 正文首行声明，三语照旧。
- 接管中客户面板顶部换成状态条「运营回复中：这条会话已由后台接手，自动接待已停……」
  （`SUPPORT_OPERATOR_TAKEOVER_NOTE`），只说状态，不说对面是谁。
- Telegram 提醒摘要在接管时多一行「人工接管中：自动接待已停，这条不回就没人回了」——
  接管之后没有机器人兜底，运营漏看一条客户那边就是彻底没人理。正文仍然一个字不进摘要。

## 五、QQ 展示（顺手规范，不改号码）

线上 `site_settings.contact_qq` 填的是 `QQ1226426670 QQ3832001817`，而每个展示位自己还要拼一次
`QQ `，客户看到 `QQ QQ1226426670 QQ3832001817`。新增 `normalizeQqContacts`（`lib/support-faq.ts`）：

- 只有当每一段都是纯号码或「QQ+号码」时才规范化，输出 `号码 / 号码`；
- 出现任何别的写法（群名、说明、链接）就**原样返回，一个字不改**；
- 号码本身从不改写，**数据库里的值也没动**，只是展示时收掉重复前缀。

作用于 `resolveQq()`（咨询面板 entry、机器人回复里的 QQ 行）与联系方式弹窗。

## 六、改了哪些文件

| 文件 | 改动 |
|---|---|
| `shared/support/contracts.ts` | `isAutoAssistEnabled` / `isOperatorTakeover` 判定、接管文案、视图加 `operatorTakeover` |
| `drizzle/schema.ts` | `support_conversations.autoAssistEnabled`（可空 boolean） |
| `server/migrate.ts` | 新列登记进 `SUPPORT_ADDED_COLUMNS` + 建表 DDL（升级/全新两条路径同一段代码） |
| `server/support/store.ts` | `lockConversationOn` 行锁；接管判定进事务；运营回复写 `autoAssistEnabled=false`；`setAutoAssist`；内存版同语义 |
| `server/support/service.ts` | `operatorTakeover` 下发、`autoSuppressed` 回传、`setAutoAssist`、`resolveQq` 规范化 |
| `server/support/notify.ts` | 摘要加接管提示行 |
| `server/routers/support.ts` | `supportAdmin.setAutoAssist`（adminProcedure） |
| `app/admin/support.tsx` | 接管状态显示 + 「交还自动接待 / 人工接管」按钮 + 标签措辞 |
| `components/support-chat.tsx` | 接管状态条、角色标签去掉「顾问（真人）」 |
| `components/contact-modal.tsx` | QQ 展示规范化 |
| `lib/support-faq.ts` | `normalizeQqContacts` |
| `tests/support-chat.test.ts` | +14 条（接管语义、幂等、关闭态、会话隔离、QQ 规范化） |
| `tests/support-mysql.test.ts` | +9 条真库用例（含两条并发）+ 降级脚本补 DROP 新列 |

**没碰**：商品、交易、支付、凭据、任何生产数据；已有的号码和联系方式一个字没改。

## 七、测过什么，结果是什么

真实 MySQL 8.4.10，本机隔离实例 `127.0.0.1:3399`（复核留下的一次性实例，不连生产）：

```
# 存储契约 + 并发（连跑 3 次，均全绿）
SUPPORT_TEST_DATABASE_URL='mysql://review:***@127.0.0.1:3399/eaxau_operator' \
  npx vitest run tests/support-mysql.test.ts        → 43 passed
# 全量
SUPPORT_TEST_DATABASE_URL=... npx vitest run        → 405 passed / 1 failed
npx tsc --noEmit                                    → 0 error
npx expo lint                                       → 0 error, 54 warning（与基线逐条一致，没新增）
```

**那 1 条失败是基线就挂的**：`tests/admin-auth.test.ts` 要求 `ADMIN_EMAIL` / `ADMIN_PASSWORD` /
`JWT_SECRET` 三个环境变量存在，本机没设。已在**未改动的基线**上单独跑过同一条，同样失败——
不是本轮引入的。

### 并发用例是真的在测锁，不是靠时序碰巧绿

把 `lockConversationOn` 的 `FOR UPDATE` 去掉（临时改坏再改回）实测：

- 端到端那版并发用例**照样全绿** —— 因为访客路径在开事务前先做了四五个查询，运营的事务总是
  先提交，危险的那半边交错根本轮不到发生；
- 存储层贴身那版（每轮先把自动接待交还回去重开窗口，20 轮）**20 轮里 19 轮报违例**。

所以留下的是后者，注释里写明了为什么不能只留端到端那版。锁恢复后连跑 3 次全绿。

### 走真实 HTTP + 真实 MySQL 的接管冒烟

本机起 `server/_core/index.ts`（`PORT=8791`，`DATABASE_URL` 指向一次性库 `eaxau_smoke`，
管理员口令是当场编的一次性值），脚本 `/tmp/eaxau-op-smoke.mjs` 走 tRPC 真接口，**21 项全过**：

QQ 规范化（`entry.qq = 1226426670 / 3832001817`，无 `QQ QQ`，号码保留）→ 首条有机器人回复 →
管理员登录 → 运营回复进入接管 → 接管后访客再问**只落库不自动答** → 访客轮询拿得到
`operatorTakeover` → 交还后机器人回来 → 显式停用后又不答 → 身份闸门仍然拦住自报不符的请求 →
`setAutoAssist` 未登录调不动。

库里最终的消息序列（直接 SQL 查的，不是接口回显）：

```
1 customer  这个 EA 多少钱？
2 auto      【自动值守（机器人回复，不是人工）】…     ← 接管前，机器人先答
3 operator  默认 3 个账户，可加购。                  ← 运营开口 = 接管
4 customer  那加购一个多少钱                        ← 接管后：只有客户这条，没有 auto
5 customer  装不上怎么办                            ← 交还自动接待之后
6 auto      【自动值守（机器人回复，不是人工）】…     ← 机器人回来了
7 customer  在吗                                    ← 显式停用之后，又只剩客户这条
```

## 八、没做 / 做不到的，说清楚

- **没在生产库上验过**。上面所有证据都来自本机一次性 MySQL。生产升级要跑一次
  `ensureSupportChatSchema`（新列是 `ALTER TABLE ... ADD COLUMN`，可重复执行，不锁表写数据）。
  `tests/support-mysql.test.ts` 的漂移守卫会在忘记登记新列时直接挂。
- **没 push、没部署、没碰 `main`**，所以线上那条 `EAX-XRY3JF4` 现在**仍然会被机器人抢答**。
  代码改了不等于上线了。
- 「人工接管（停自动接待）」这个反向按钮是顺带给的，需求里只要求「能交还」；两个方向共用同一列、
  同一套锁，不是第二套状态。
- 客户端侧只有服务端下发的 `operatorTakeover` 一个来源，没有做前端本地推导的兜底：
  接口挂掉时状态条不显示，但**服务端该不答还是不答**，不会因为界面没提示就恢复抢答。
