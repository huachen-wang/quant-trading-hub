# AI 量化联盟：资管与 USDT 资金链路

更新时间：2026-08-24。

AI 量化联盟是持续运行的量化资管产品，不使用“限时资管”“Managed Session”或“Managed Vault”作为客户产品名称。平台固定提供六款策略，每笔委托可选 1–6 款并使所选权重合计 100%；同时可选择 1 至 3 家可选执行券商：Exness、IC Markets、Blueberry Markets。平台是独立技术与运营方；券商只是可选执行通道，不代表任何券商已经与平台建立官方合作、背书平台，或同意平台代客户收款。

## 1. 产品模型

开户接入方式只有两种：

- `SELF_OPENED`：客户自行在所选券商开户、完成 KYC，并向平台提交脱敏账户参考信息以建立交易授权与策略映射。
- `PLATFORM_ASSISTED`：平台协助客户完成开户资料准备、券商资管/MAM/PAMM 接入与账户映射；平台不索取或保存密码、短信验证码、API Key、钱包私钥或助记词。

资金路由只有两种：

- `BROKER_DIRECT`：客户从本人钱包直接向本人券商后台显示的收款地址付款。平台记录指引、客户提交的 Tx Hash 和券商入账结果，但不经手资金。
- `PLATFORM_COLLECTION`：只允许与 `PLATFORM_ASSISTED` 组合。客户向平台为该笔业务分配的专用代收地址付款；平台完成归属声明、筛查、对账和管理员动态验证后，再通过外部企业钱包向对应客户的券商账户划转。

`PLATFORM_COLLECTION` 不是默认能力。每家券商必须先在后台登记书面许可并启用门控；没有许可、许可暂停或许可范围不覆盖当前网络/金额时，系统只能使用 `BROKER_DIRECT`。

## 2. 三条 USDT 账路必须分账

| 账路 | 付款用途 | 收款地址来源 | 到账后的结果 | 账务边界 |
| --- | --- | --- | --- | --- |
| EA 商品销售 | 购买 EA 文件或授权 | 平台 EA 商户收款地址 | 管理员核对到账后生成受控下载 | 商品订单与交付账 |
| 客户直充券商 | 为本人券商账户入金 | 客户登录券商后台后取得的地址 | 券商确认客户账户入账 | 券商资金指引与入账跟踪账 |
| 平台代收再划转 | 平台协助接入时的代收与转付 | 平台为该笔意向分配的专用地址 | 动态验证后由外部企业钱包转出，最终确认券商入账 | 代收、筛查、对账、转付、退款与异常账 |

三类记录不得共享“已付款”“已入账”状态，也不得把 EA 商户地址当成资管入金地址。客户提交链上交易只表示“已申报”，不等于平台已收妥、已批准或券商已入账。

## 3. EA 商品销售账路

EA 商品销售沿用独立订单和支付记录：

1. 后台把商品设置为可直接购买，并配置真实交付文件。
2. 系统按后台汇率生成有失效时间的 USDT 报价；只有“收款地址 + 正数汇率”完整时才向客户显示该支付方式。
3. 客户必须选择网络、确认收款地址并提交 Tx Hash。
4. 后台核对代币、网络、目标地址、报价金额、实收金额、确认数和交易唯一性。
5. 只有管理员明确批准到账后，系统才生成短期签名下载；文件继续由后端流式交付，不能暴露真实存储路径。

当前链上确认仍可由管理员人工完成；配置 RPC 或托管服务后才能增加自动观察。无论是否自动观察，退款、少付、多付、错链和重复 Tx 都必须由后台处理，不能自动解锁下载。

```dotenv
ENABLE_USDT_PAYMENT=true
USDT_TRC20_ADDRESS=
USDT_ERC20_ADDRESS=
USDT_CNY_PER_USDT=
DOWNLOAD_SIGNING_SECRET=
```

生产环境必须替换为平台实际控制的企业收款地址、实际报价来源和高强度签名密钥；仓库不附带任何真实私钥或资金凭据。

## 4. 客户直充券商账路

`BROKER_DIRECT` 是无需平台代收许可的默认资金路由：

1. 客户从六款策略中选 1–6 款、设置权重，选择券商及 `SELF_OPENED` 或 `PLATFORM_ASSISTED`。
2. 客户登录自己的券商后台，按当时页面展示取得币种、网络、地址、Tag/Memo、限额和费用。
3. 客户从券商允许的本人支付来源转账，并向平台提交 Tx Hash。付款钱包和归属声明可选留档，不是券商直入指令的强制前置条件。
4. 平台可记录链上核验与异常，但以客户本人券商后台的实际入账结果为唯一最终依据。
5. 券商入账后，平台完成账户映射、交易授权校验与策略部署；平台不取得客户出金凭据。

券商支持的币种、网络、限额和地区资格会随客户实体、地区和账户状态变化。网页和客服只能引导客户以本人券商后台为准，不能生成或猜测券商充值地址。

## 5. 平台代收再划转账路

### 5.1 上线门槛

每一家券商分别设置代收许可记录，默认均为 `NOT_APPROVED`。启用前至少应保存：

- 券商或其适用实体的书面许可参考号及文件哈希；
- 允许的代币、网络、金额区间、地区和账户类型；
- 生效时间、复核人和暂停/撤销状态；
- 目标券商账户的归属、入金指引与最终入账核对方式。

[Exness 官方出入金说明](https://www.exness.com/deposits-and-withdrawals/)与 [IC Markets 官方 Funding 页面](https://www.ic.com/en/trading-accounts/funding)均要求资金来自客户本人/不接受第三方付款，因此没有针对本平台的书面例外许可时不得开放平台代收。Blueberry Markets 同样必须按客户所属实体和书面确认执行，不能根据“支持加密货币充值”推断其已允许平台代收。

### 5.2 单笔处理流程

```text
WAITING_INSTRUCTIONS
  -> READY_TO_FUND
  -> TX_SUBMITTED
  -> RECEIVED
  -> RECONCILED
  -> AWAITING_PAYOUT
  -> PAYOUT_SUBMITTED
  -> BROKER_CREDIT_PENDING
  -> CREDITED
```

任一步骤出现错链、少付、多付、风险命中、地址不匹配、转出失败或券商拒收，转入 `EXCEPTION`；等待合规判断时进入冻结/保持状态，不得继续划转。

操作要求：

1. **专用地址**：每笔资金意向分配一个专用地址，完成后默认不重新分配给其他客户，避免迟到付款串账。
2. **付款人归属**：记录付款钱包地址和客户的本人钱包归属声明，不收集客户钱包私钥或签名密钥。
3. **筛查与冻结**：记录筛查状态、外部参考号、复核人和时间；只有 `CLEARED` 才能进入转付审批。
4. **链上对账**：核对代币合约、网络、接收地址、金额、确认数与 Tx 唯一性；Tx Hash 不可跨意向重复使用。
5. **多次动态验证**：代收许可、对账、转付确认、转出 Tx 登记和退款等敏感操作都要输入管理员 Authenticator 的 6 位动态码；同一时间片动态码只能使用一次。
6. **外部签名**：服务器只记录转出请求、动态验证和最终 Tx Hash，不保存私钥，不在 Web 进程中签名或自动转币。管理员在 BVNK、Cobo 或经批准的外部企业钱包完成实际转账。
7. **券商入账**：转出成功不等于券商已入账；必须记录券商参考号并单独确认 `CREDITED`。
8. **退款与异常**：退款地址必须经过归属核验和管理员批准；记录退款原因、金额、网络和 Tx Hash。不得把资金自动退向任意用户输入地址。

## 6. 后台运营清单

平台代收上线前，后台至少完成以下配置和演练：

- 为每家券商建立独立许可门控，默认关闭；
- 录入由企业钱包系统生成的地址池，不录入私钥；
- 配置网络、代币合约、确认数、最小/最大金额和地址启停状态；
- 配置至少 160 bit 的 `ADMIN_TOTP_SECRET_BASE32`，并在管理员 Authenticator 中保存；未配置时平台代收保持关闭；
- 为收款、对账、筛查、转付确认、券商入账和退款保留独立操作与事件记录；
- 演练少付、多付、错链、重复 Tx、筛查冻结、转出失败、券商退回和退款；
- 对每日地址余额、未对账款、待转付款、转出 Tx 与券商入账做三方核对；
- 保留追加式事件记录，禁止运营人员覆盖或删除历史资金事件。

平台可先使用后台人工地址池与人工链上核验。首选成熟收付款服务是 **BVNK**：它提供 Hosted Payment、单笔收款地址、链上监控、Webhook、USDT 收款和两步付款能力。先在 [BVNK Sandbox](https://signup.sandbox.bvnk.com/create-dev-account) 创建测试账户，按 [API Key 与 2FA 指南](https://docs.bvnk.com/bvnk/get-started/generate-api-keys/) 配置 Hawk 凭据，再按 [上线流程](https://docs.bvnk.com/bvnk/get-started/get-started-w-bvnk/) 申请生产权限；收款与付款接口分别见 [Receive stablecoins](https://docs.bvnk.com/bvnk/use-cases/stablecoin-payments-for-platforms/get-payment/) 和 [Create payouts](https://docs.bvnk.com/bvnk/use-cases/stablecoin-payments-for-platforms/pay-out-to-your-users/)。

若项目更需要自有地址池、MPC 和企业钱包治理，可改用 [Cobo Portal](https://portal.cobo.com/)，并按 [开户注册说明](https://manuals.cobo.com/en/portal/sign-up) 与 [WaaS 2.0 接入指南](https://www.cobo.com/developers/v2/guides/get-started/get-started-with-waas) 申请。当前仓库默认使用 `MANUAL` 提供器；BVNK/Cobo 账户、生产 API、Webhook 与钱包策略都需要项目方另行申请。未配置真实凭据时，系统不得显示为自动收付款。

## 7. 官方开户与资管申请入口

以下都是券商官方入口，客户能否开户、使用 USDT 或参加资管计划，以实际注册地区、KYC、券商实体和登录后台显示为准：

| 可选执行券商 | 客户开户 | 资管/管理人入口 | USDT 口径 |
| --- | --- | --- | --- |
| Exness | [官方注册](https://my.exness.com/accounts/sign-up?lng=zh)、[注册说明](https://get.exness.help/hc/en-us/articles/360004039971-Registering-an-Exness-account) | [Portfolio Management 帮助中心](https://portfolio-management.exness.help/hc/en-us)、[加入基金说明](https://portfolio-management.exness.help/hc/en-us/articles/6787235670418-Joining-a-fund)；管理人资格应在 PA 或官方支持中确认 | 公开说明要求客户在 Personal Area 查看当前可用支付方式；平台不得承诺 USDT、网络或限额，见 [PA Payments wallets](https://get.exness.help/hc/en-us/articles/17537791070748-PA-Payments-wallets) |
| IC Markets | [官方真实账户](https://www.ic.com/cn/open-trading-account/live) | [MAM/PAMM 申请](https://www.icmarketspartners.com/en/apply)、[MAM 说明](https://www.icmarketspartners.com/en/multi-account-manager)、[PAMM 说明](https://www.icmarketspartners.com/en/percentage-allocation-management) | [官方 Funding 页面](https://www.ic.com/en/trading-accounts/funding)公开列出 USDT；具体链、限额、费用和可用性以 Secure Client Area 为准 |
| Blueberry Markets | [官方注册](https://portal.blueberrymarkets.com/en/sign-up) | [Fund Manager 申请](https://portal.blueberrypartners.com/en/signup)、[Managed Accounts](https://www.blueberrypartners.com/fund-managers/) | 官方帮助中心列出多链加密入金，见 [NAEWE USDT](https://helpcenter.blueberrymarkets.com/en/articles/12016636-depositing-funds-with-multichannel-crypto-naewe) 与 [BVNK/NAEWE 对比](https://helpcenter.blueberrymarkets.com/en/articles/12024955-multichannel-crypto-naewe-vs-crypto-bvnk)；地址为一次性且限额以客户 Portal 为准 |

不要在页面使用“官方合作券商”“券商背书”“保证开户”“保证入金”或“已获代收许可”等措辞。对外统一称“可选执行券商”或“接入通道”。

## 8. 仍需项目方完成的外部事项

- 向三家券商分别申请所需的管理人/MAM/PAMM/交易授权和生产账户；
- 针对 `PLATFORM_COLLECTION` 取得适用券商实体的书面许可，并在后台登记范围；
- 申请 BVNK（首选）或 Cobo 企业账户、生产 API、Webhook 与钱包安全策略；开户前可继续使用带 TOTP 动态验证的人工流程；
- 配置六策略真实账户与只读数据 Provider，完成交易执行适配与风险验收；
- 配置 EA 商户真实地址、报价来源、商品文件和退款 SOP；
- 完成适用地区的合同、KYC/AML、客户资产、会计与税务审阅。

代码中的状态机、地址池、权限和审计记录不能代替上述外部账户、券商许可或法律安排。未完成时必须保持对应能力关闭并明确显示“待接入/待审批”。
