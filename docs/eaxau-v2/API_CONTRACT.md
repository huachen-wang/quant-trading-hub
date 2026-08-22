# EAXAU V2：Quant Data Core API 契约

状态：Draft 0.2，EAXAU BFF 契约与只读 Provider 已实现；独立 Quant Data Core 仍待部署。
原则：品牌中立、只读优先、显式来源、版本化、可被 EAXAU 与未来白标站点复用。

## 1. 边界

- 外部基址示例：`https://quant-api.example.com/v1`。
- EAXAU 浏览器不直接调用本 API，由 EAXAU BFF 代理并做用户授权检查。
- 公开策略接口可缓存；账户、持仓、交易和方案接口禁止公共缓存。
- 当前 EAXAU 只读适配器把牛帮公开 `signal.detail` 转换为本契约，牛帮现有 tRPC 不改名、不改返回值。
- Draft 0.2 不包含下单、平仓、修改牛帮订阅或写入交易账户的接口。
- 大量 EA 商城数据属于 EAXAU BFF 的 Catalog API，不进入 Quant Data Core，也不自动成为可分仓策略。

## 2. 通用约定

```ts
type DataMode = "DEMO" | "CUSTOM" | "LIVE" | "HYBRID";
type Freshness = "FRESH" | "STALE" | "OFFLINE";

type SourceMeta = {
  provider: string;
  providerAccountRef?: string;
  observedAt: string;
  receivedAt: string;
  freshness: Freshness;
  dataMode: DataMode;
  historyHandoverAt?: string | null;
};

type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
};
```

- 时间使用 ISO 8601 UTC。
- 金额使用十进制字符串与明确币种，例如 `{ amount: "12500.42", currency: "USD" }`。
- 百分比统一使用 `0..100`，例如 `12.5` 表示 12.5%。
- 列表使用游标分页：`cursor`、`limit`、`nextCursor`。
- 每个响应返回 `requestId`；私有请求写入租户、用户、scope 和结果状态审计。
- `CUSTOM` 表示 EAXAU 后台维护的接入前历史；`HYBRID` 表示接管线之前为自定义/迁移历史、之后为只读实盘。
- 接管线后的点不允许由 EAXAU 后台编辑；同一时间戳以提供方实盘点为准。

## 3. 鉴权

| 场景 | 方式 | Scope 示例 |
|---|---|---|
| 公开六策略 | EAXAU BFF 服务令牌 | `strategies:read` |
| 客户账户 | 服务令牌 + 用户授权上下文 | `accounts:read` |
| 持仓与交易 | 服务令牌 + 账户 scope | `positions:read`, `trades:read` |
| SSE | 短期签名订阅令牌 | `streams:read` |

服务令牌按租户隔离并定期轮换。用户授权必须可撤销；撤销后缓存中的私有数据按保留策略清理。

## 4. 策略接口

### `GET /strategies`

返回 EAXAU 获准展示的六策略摘要。支持 `slot=home`，响应顺序由 EAXAU 内容配置决定，不由收益排序决定。

```ts
type StrategySummary = {
  id: string;
  code: string;
  displayName: string;
  shortName: string;
  marketTags: string[];
  styleTags: string[];
  riskLevel: "R1" | "R2" | "R3" | "R4" | "UNRATED";
  status: "ACTIVE" | "PAUSED" | "CLOSED" | "SYNCING";
  metrics: {
    return30dPct: number | null;
    return90dPct: number | null;
    maxDrawdownPct: number | null;
    winRatePct: number | null;
    tradeCount: number | null;
  };
  sparkline: Array<{ t: string; equity: string }>;
  source: SourceMeta;
};
```

### `GET /strategies/{strategyId}`

返回策略固定资料、平台兼容性、风险说明和最新指标。富文本内容块仍由 EAXAU BFF 返回，不放在 Quant Data Core。

### `GET /strategies/{strategyId}/equity?range=30d&maxPoints=120`

```ts
type EquityPoint = {
  t: string;
  equity: string;
  balance?: string;
  floatingPnl?: string;
  returnPct?: number;
};
```

### `GET /strategies/{strategyId}/positions`

只返回平台允许公开的持仓投影。服务器、账号、票据和提供方原始错误必须脱敏。

### `GET /strategies/{strategyId}/trades?cursor=...`

返回已关闭交易或延迟公开记录。延迟策略由数据提供方授权决定并在响应中说明。

## 5. EA 资料库接口（EAXAU BFF）

EA 资料库沿用 EAXAU 自有 API 与数据库，和 Quant Data Core 的六策略接口分开。建议提供：

```text
GET /api/catalog/eas?q=&platform=&category=&status=&cursor=
GET /api/catalog/eas/{eaId}
GET /api/catalog/eas/{eaId}/comments
POST /api/catalog/eas/{eaId}/favorite
GET /api/catalog/filters
```

```ts
type EaCatalogItem = {
  id: string;
  slug: string;
  title: string;
  shortTitle?: string;
  platform: "MT4" | "MT5";
  categories: string[];
  symbols: string[];
  status: "PUBLISHED" | "DRAFT" | "ARCHIVED";
  consultationMode: "CONTACT" | "DOWNLOAD" | "EXTERNAL";
  cover: { src: string; width: number; height: number; blurhash?: string };
  hasLiveData: boolean;
  linkedCoreStrategyId?: string;
};
```

- `consultationMode=CONTACT` 时前端只进入联系方式页面。
- `DOWNLOAD` 必须有经过后台校验的文件或安全下载记录。
- `EXTERNAL` 必须经过允许域名校验；开户推广域名不得伪装成下载。
- `hasLiveData=false` 时不得填充虚构收益、回撤或在线状态。
- 列表查询必须分页、可搜索并返回稳定排序；后台使用同一搜索索引，不再依靠人工滚动查找。

## 6. 平台接口

### `GET /platforms`

```ts
type PlatformProfile = {
  id: string;
  displayName: string;
  legalEntity?: string;
  regions: string[];
  terminals: Array<"MT4" | "MT5" | "OTHER">;
  accountTypes: string[];
  openingStatus: "AVAILABLE" | "RESTRICTED" | "UNAVAILABLE" | "UNKNOWN";
  minimumDeposit?: { amount: string; currency: string };
  supportedStrategyIds: string[];
  source: SourceMeta;
};
```

### `GET /platforms/{platformId}/commercial-terms`

返回带版本和有效期的点差、佣金、返佣和额外权益规则。返佣不能只返回一个裸数字。

```ts
type CommercialTerms = {
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  spreadSamples: Array<{
    symbol: string;
    accountType: string;
    medianPoints: number | null;
    p95Points: number | null;
    sampleWindow: string;
  }>;
  commissions: Array<{ accountType: string; amountPerLot: string; currency: string }>;
  rebates: Array<{
    accountType: string;
    amountPerLot: string;
    currency: string;
    eligibility: string[];
    cap?: string;
  }>;
  withdrawalStats?: {
    sampleSize: number;
    p50Hours: number | null;
    p95Hours: number | null;
    methodology: string;
  };
  source: SourceMeta;
};
```

### `POST /platforms/compare`

输入 1 至 3 个平台 ID、资金、地区和候选策略，返回可比较的规范化成本与兼容性。缺失数据返回 `null + warning`，不得以零代替。

## 7. 分仓校验与推荐

### `POST /allocation/recommendations`

输入资金、地区、风险偏好、可选平台和可选策略，返回一个或多个带解释的 `DEMO` 或 `LIVE` 草稿。第一版可由规则引擎实现。

### `POST /allocation/validate`

```ts
type ValidationIssue = {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  path: string;
  message: string;
  remediation?: string;
};

type AllocationValidation = {
  valid: boolean;
  normalizedDraft: AllocationDraft;
  issues: ValidationIssue[];
  estimated: {
    annualizedKnownCosts?: { amount: string; currency: string };
    platformConcentrationPct: Record<string, number>;
    strategyConcentrationPct: Record<string, number>;
    modeledDrawdownPct?: number;
  };
  ruleSetVersion: string;
  termsVersions: Record<string, string>;
};
```

`modeledDrawdownPct` 是模型结果，不是承诺；必须返回模型版本、输入数据模式和免责声明。

### `POST /allocation/plans`

由 EAXAU BFF 调用，把已通过校验且经客户确认的草稿变成不可变版本。Quant Data Core 可再次校验，但方案主记录属于 EAXAU。

第一阶段本端点只返回确认凭证，不触发交易执行。

## 8. 客户账户接口

### `GET /accounts`

返回当前 EAXAU 用户已授权的账户投影，不暴露牛帮用户 ID 或提供方密钥。

### `GET /accounts/{accountId}/snapshot`

```ts
type AccountSnapshot = {
  accountId: string;
  serviceMode: "MANAGED_CONTRACT" | "SELF_ALLOCATED";
  platformId: string;
  currency: string;
  balance: string | null;
  equity: string | null;
  floatingPnl: string | null;
  todayPnl: string | null;
  totalPnl: string | null;
  totalPnlPct: number | null;
  maxDrawdownPct: number | null;
  connectionStatus: "CONNECTED" | "DEGRADED" | "DISCONNECTED" | "PENDING";
  source: SourceMeta;
};
```

### `GET /accounts/{accountId}/equity`

返回下采样净值点。对应牛帮现有 `mySubscriptionMetrics` 能力，但 DTO 不暴露 subscription 内部字段。

### `GET /accounts/{accountId}/positions`

对应经授权的镜像持仓投影。隐藏交易密码、主账户票据、内部游标和原始提供方错误。

### `GET /accounts/{accountId}/trades`

返回分页交易记录，并标明数据延迟和最近同步时间。

### `GET /accounts/{accountId}/execution-quality`

返回 24 小时聚合执行质量，复用牛帮现有客户安全投影，不返回内部错误正文。

## 9. 实时事件

### `GET /streams?topics=strategy:{id},account:{id}`

使用 SSE。事件类型：

```text
strategy.snapshot.updated
strategy.position.changed
account.snapshot.updated
account.position.changed
source.freshness.changed
```

事件只传增量与版本号。客户端断线重连后先通过 REST 拉完整快照，再从 `Last-Event-ID` 继续。

## 10. 牛帮能力映射

| Quant Data Core | 牛帮当前能力 | 接入方式 |
|---|---|---|
| Strategy list/detail | `signal.list`, `signal.detail` | 只读转换 |
| Live snapshot/feed | `signal.live`, `signal.liveFeed` | 只读转换 |
| Equity history | `signalEquityPoints` 的公开投影 | Adapter 查询 |
| User accounts | `mySubscriptions` | 授权后转换 |
| Open positions | `myMirrors` | 授权后脱敏 |
| Account metrics | `mySubscriptionMetrics` | 授权后转换 |
| Execution quality | `myExecutionQuality` | 直接使用安全投影 |

禁止直接从 EAXAU 复用 `updateSettings`、`flattenNow`、`catchUp` 或 copy engine 写接口。未来如需控制能力，必须另建写 API、强鉴权、幂等键、审批与审计，并进行独立风险评审。

## 11. 缓存与新鲜度

- 六策略摘要：服务端缓存 15 至 30 秒，支持 stale-while-revalidate。
- EA 资料库列表：按查询条件缓存，并使用游标分页；详情内容发布后主动失效。
- 净值曲线：按策略与时间范围缓存 60 秒。
- 公开持仓：遵守提供方延迟策略，缓存时间写入响应。
- 私有账户快照：不进入公共 CDN，服务端短缓存不超过 10 秒。
- 平台商业条款：按规则版本缓存，变更立即失效。

## 12. 版本与变更规则

- 兼容新增字段可进入当前版本，客户端必须忽略未知字段。
- 字段改名、语义变化、百分比单位变化或权限变化必须升主版本。
- 每个发布版本附 JSON Schema/TypeScript 类型、契约测试和变更日志。
- Quant Data Core 与 Niubang Adapter 使用消费者驱动契约测试，避免牛帮内部重构破坏 EAXAU。
