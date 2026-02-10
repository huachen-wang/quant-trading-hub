# 最新项目代码巡检报告（数据库 / 后端 / 前端）

> 巡检范围：基于当前分支代码静态检查 + TypeScript 检查 + Vitest 测试结果。

## 一、数据库层（Database）问题

### 1) 测试和本地运行强依赖外部 MySQL，缺少降级/隔离方案
- 目前 `server/db.ts` 直接通过 `process.env.DATABASE_URL` 初始化 MySQL 连接池，业务函数普遍直接执行 SQL；一旦数据库不可达，调用就会抛错而不是自动切换 mock/in-memory。  
- `pnpm test` 结果显示大量用例因 `ECONNREFUSED` 失败，属于“测试环境与数据库强耦合”。

**影响**
- CI 或新开发者环境没起库时，几乎无法跑通测试。
- 功能回归效率低，问题定位容易被环境问题淹没。

**建议**
- 为测试环境增加隔离层（例如：test profile 使用 sqlite/in-memory，或在 vitest setup 中做 DB mock）。
- 在 DB 不可达时对只读接口返回可观测错误对象（含错误码）而非直接炸栈。

---

## 二、后端层（Backend）问题

### 2) 管理员认证为硬编码口令，且通过固定 Header 透传
- `server/_core/context.ts` 使用硬编码 `ADMIN_PASSWORD = "admin123"`，仅通过 `X-Admin-Token` 头判断管理员。  
- `lib/admin-api.ts` 中同样硬编码该密码并自动附在每个后台请求。  

**影响**
- 口令泄露风险极高（前端可逆向）。
- 无法区分具体管理员身份，无审计追踪能力。

**建议**
- 改为服务端签发的短期 token（或沿用 OAuth + RBAC）。
- 管理员账号密码从环境变量读取并加密存储，不应出现在前端代码。

### 3) 后端自动“换端口”会破坏前后端联调约定
- `server/_core/index.ts` 在 3000 被占用时会自动寻找新端口。  
- 但前端 `constants/oauth.ts` 默认推导 API 地址为 `:3000`（本地/沙箱模式），两边可能不一致。

**影响**
- 出现“前端可打开但 API 全挂”的隐性故障。

**建议**
- 开发环境保持固定端口失败即退出（Fail Fast），或把真实端口回写到前端可读取配置。

### 4) 评论删除权限模型与页面行为不一致
- 策略详情页中管理员 UI 可见“删除备注”按钮（`app/strategy/[id].tsx`）。  
- 但它调用的是 `comments.delete`（普通受保护接口），底层 `db.deleteComment(id, userId)` 仅允许删除“自己发的评论”。

**影响**
- 管理员会看到删除按钮但删除他人评论失败（权限逻辑不一致）。

**建议**
- 管理员界面应调用 `admin.comments.delete`。
- 或在 `comments.delete` 中加入 admin 角色豁免逻辑。

---

## 三、前端层（Frontend）问题

### 5) TypeScript 存在隐式 any，类型安全回退
`pnpm check` 报错显示以下位置存在 `implicit any`：
- `app/(tabs)/subscribe.tsx`
- `app/strategy/[id].tsx`
- `tests/admin.test.ts`
- `tests/simplified-api.test.ts`
- `tests/ux-improvements.test.ts`

**影响**
- 编译失败，且会掩盖真实接口契约问题。

**建议**
- 补齐 map/forEach 回调参数类型（可直接从 tRPC 返回类型推导）。
- 测试代码也应启用强类型，避免“测试能写、上线会炸”。

### 6) 后台登录仍是前端本地态 + 硬编码校验
- `app/admin/login.tsx` 直接用硬编码账号密码比对，成功后仅写 `AsyncStorage` 标志位。

**影响**
- 任何拿到包的人都能获得后台口令。
- 与服务端真实会话体系（OAuth/session）割裂。

**建议**
- 登录逻辑迁移到后端，前端仅提交凭证并保存后端签发会话。
- 后台页面统一复用服务端鉴权中间件。

---

## 四、我已执行的验证命令

1. `pnpm -s check`：失败（隐式 any）  
2. `pnpm -s test`：失败（大量用例 `ECONNREFUSED`，并提示 `JWT_SECRET` 缺失）

---

## 五、优先级建议（从高到低）

1. **P0 安全**：去除管理员硬编码口令与前端透传 token。  
2. **P0 稳定性**：统一 API 端口策略，避免前后端端口漂移。  
3. **P1 可维护性**：修复 TS `implicit any`，恢复类型检查。  
4. **P1 测试可靠性**：为测试引入数据库隔离层，避免环境导致的假失败。  
5. **P2 体验一致性**：修复管理员删除评论权限链路。
