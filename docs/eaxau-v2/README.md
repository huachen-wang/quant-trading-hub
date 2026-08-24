# EAXAU AI 量化 V2

状态：V2 已成为根首页，支持模拟、自定义历史、牛帮只读映射和 Quant Data Core 接入。
更新时间：2026-08-24。

## 已确认的产品决策

- 首页核心不是 EA 商城，而是六款量化策略及其实盘状态。
- 现有大量 EA 名录完整保留为独立的“EA 资料库/商城”页面，不占用六个核心策略席位。
- 策略详情采用可编辑的图文内容块，并展示可追溯的净值、收益、回撤、持仓与交易数据。
- 主产品统一为 `Managed Session`：30/90/180 天可撤销的限时资管会话，交易权与出金权严格分离。
- 资金路由不再拆成两套产品：MVP 为 `DIRECT_BROKER`（U 直达客户的合作券商账户），`MANAGED_VAULT` 与 `MIXED` 可先保存草案，但默认不可激活。
- “系统推荐”与“客户手动配置”是配置来源，不是第三种业务模式。
- 量化方案由资金规模、风险预算、策略组合、平台选择和管理模式共同组成。
- 券商模式的高级选配允许启用 1 至 3 个平台桶，并由服务端契约再次校验。
- 牛帮继续独立运行。EAXAU 不直连牛帮数据库，也不调用交易引擎内部函数。
- 可复用能力通过品牌中立、版本化的 Quant Data Core API 输出，后续可服务其他公司网站。
- 演示数据必须标记为 `DEMO`；正式页面不得把占位数据伪装成实盘。

## 阅读顺序

1. [产品与系统架构](PRODUCT_ARCHITECTURE.md)
2. [API 契约](API_CONTRACT.md)
3. [数据接入与交接](DATA_INTEGRATION.md)
4. [Claude Code 独立复查任务](CLAUDE_UI_HANDOFF.md)
5. [Managed Session 与 USDT 上线说明](MANAGED_USDT.md)
6. [实现状态与验收门槛](IMPLEMENTATION_STATUS.md)

## 已实现预览

本仓库已完成以下 V2 预览链路：

`六策略首页 -> Managed Session 选配 -> 1–2 券商执行槽 -> DRAFT 审计记录`

同时保留独立的 EA 资料库，并新增六策略图文与数据后台。正式首页入口为 `/`，旧
EA 商城保留在 `/market`；兼容预览入口为 `/v2-preview`。后台入口为
`/admin/v2-content` 与 `/admin/v2-data`。EA 商城支持由后台把指定商品设为
`direct`，通过锁定 USDT 报价、Tx Hash 对账与受控流式下载交付。

未配置外部服务时使用与正式 API 同结构的确定性 `DEMO` Provider。可设置
`NIUBANG_DATA_URL + NIUBANG_STRATEGY_MAP` 读取牛帮公开策略，也可设置
`QUANT_DATA_CORE_URL` 启用品牌中立 HTTP Provider；请求失败不会静默伪装成实盘。

## 生产边界

当前完成的是 EAXAU 仓库内的 V2 产品、界面、契约、适配器和校验引擎。以下工作属于
外部系统，不能仅靠本仓库伪造完成：

- 独立 Quant Data Core 服务部署；
- 牛帮客户私有账户的服务鉴权、用户授权映射和字段脱敏；
- 六款策略的真实账户、平台条款及法律/合同信息；
- 真实数据接入后的业务验收、灰度切流和回滚演练。

未映射席位会继续显示 `模拟数据`，自定义历史显示 `CUSTOM`，只读接入故障显示
`OFFLINE`，不会冒充实盘。
