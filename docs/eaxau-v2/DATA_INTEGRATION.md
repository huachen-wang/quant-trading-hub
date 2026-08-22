# EAXAU V2 数据接入与交接

更新时间：2026-08-22。

## 1. 数据优先级

系统只有一个前台契约，但支持三种来源：

1. 未配置外部服务时使用确定性 `DEMO`，页面始终显示模拟标识。
2. 运营在 `/admin/v2-data` 保存指标和净值后，该策略变为 `CUSTOM`。
3. 配置只读 Provider 后，可把历史模式切为 `HYBRID`。`historyHandoverAt` 之前读取后台历史，之后只读取 Provider 的 `LIVE` 点。

外部 Provider 不可用时返回 `OFFLINE`，不会自动把模拟点标为实盘。账户接口在 HTTP/NIUBANG 模式下要求登录；当前 Niubang 适配器只读取公开策略详情，不读取或写入客户交易账户。

## 2. 直接复用牛帮公开策略

EAXAU 通过服务端只读调用牛帮现有 `signal.detail`，没有修改牛帮 tRPC、数据库或交易执行路径。部署环境示例：

```dotenv
EAXAU_V2_ENABLED=true
V2_DATA_PROVIDER=NIUBANG
NIUBANG_DATA_URL=https://niubang.ai
NIUBANG_DATA_API_KEY=
NIUBANG_STRATEGY_MAP={"jingge-v51":"public-signal-slug"}
QUANT_DATA_CORE_TIMEOUT_MS=8000
```

`NIUBANG_STRATEGY_MAP` 的键只能是 EAXAU 六个固定策略 ID，值是牛帮公开策略 slug。未映射的席位继续显示 `DEMO`；映射请求失败的席位显示 `OFFLINE`。牛帮返回的“多/空”会在 BFF 内归一化为 `BUY/SELL`，相对图片地址会解析为牛帮绝对地址。

## 3. 使用独立 Quant Data Core

```dotenv
V2_DATA_PROVIDER=HTTP
QUANT_DATA_CORE_URL=https://quant-api.example.com/v1
QUANT_DATA_CORE_API_KEY=replace-with-service-token
QUANT_DATA_CORE_TIMEOUT_MS=8000
```

HTTP Provider 会用 `shared/v2/contracts.ts` 严格校验 overview、strategies、platforms、accounts 和 allocation 响应。格式错误会明确失败，不会降级成伪实盘。

## 4. 运营交接步骤

1. 在 `/admin/v2-data` 选择策略并载入当前数据。
2. 校正指标和接入前净值点，先以“自定义历史”保存。
3. Provider 已能持续返回实盘点后，选择“历史 → 实盘”并填写 ISO 8601 UTC 接管时间。
4. 保证所有自定义点早于接管时间；保存后前台应显示 `HYBRID`。
5. 在策略详情核对接管时间、最新同步时间、首尾净值、当前持仓与最近成交。

内容与数据分开管理：图文、证据、FAQ 和图库在 `/admin/v2-content`；收益、净值与交接线在 `/admin/v2-data`。

## 5. 发布前检查

```bash
pnpm check
pnpm lint
pnpm test
pnpm build:web
```

生产环境必须使用 Node.js 24，并配置数据库、`JWT_SECRET`、`COOKIE_SECRET`、`DOWNLOAD_SIGNING_SECRET` 与管理员凭据。不要把任何密钥或客户账户凭据提交到 GitHub。
