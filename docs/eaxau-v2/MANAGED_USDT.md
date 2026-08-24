# Managed Session 与 USDT 上线说明

本版把“U 直达券商”和“Managed Vault”收进同一个资管会话数据模型，不再为后期 Vault 重做客户流程。

## 当前可用

- 固定六策略，1–2 个券商执行槽，30/90/180 天会话。
- `DIRECT_BROKER`、`MANAGED_VAULT` 或 `MIXED` 资金路由可保存为 DRAFT。
- 会话状态机、事件审计、券商授权参考号、到期自动停止新执行。
- 交易权可审核，出金权永远为 `NONE`；不保存券商密码、API Key、钱包私钥或助记词。
- EA 直购可用 USDT 结算：报价锁定至订单过期，用户必须提交 Tx Hash，管理员核对到账后才解锁后端流式下载。

## 激活门槛

创建 DRAFT 永远不转币、不下单、不开启执行。进入 ACTIVE 必须同时满足：

1. 数据 Provider 不是 DEMO，六策略均有 LIVE/HYBRID 数据且可用；
2. 所有券商槽位已验证，交易授权为 `GRANTED`，存在脱敏外部授权参考号；
3. 券商合计覆盖六策略，会话整体交易授权已通过；
4. 出金权为 `NONE`；
5. Vault/Mixed 与外部托管、合约和券商通道完成后，才可设置 `MANAGED_VAULT_ENABLED=true`。

## 生产配置

```dotenv
EAXAU_V2_ENABLED=true
MANAGED_VAULT_ENABLED=false

ENABLE_USDT_PAYMENT=true
USDT_TRC20_ADDRESS=
USDT_ERC20_ADDRESS=
USDT_CNY_PER_USDT=
DOWNLOAD_SIGNING_SECRET=
```

USDT 支付方式只有在“收款地址 + 正数汇率”齐全时才对客户显示。不得把商户 EA 销售收款地址当作客户资管入金地址；`DIRECT_BROKER` 的 U 由客户直接转入券商为该客户生成的账户地址。

## 尚需外部接入

- 真实券商 MAM/PAMM/API/MT5 trade-only 授权与订单执行适配器；
- 按用户隔离的真实账户快照接口；当前全量 `/accounts` 在非 DEMO 环境会 fail closed；
- Vault 托管、合约、跨券商调度与对账系统；
- 自动链上确认器。当前 EA 结算为必填 Tx Hash + 管理员人工核对。
