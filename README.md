# AI 量化联盟 (EAXAU)

> 当前 `main` 的 EAXAU V2 已是根首页。六策略、持续资管接入和三条独立 USDT 账路的真实能力与上线门槛，统一以 [`docs/eaxau-v2/README.md`](docs/eaxau-v2/README.md) 为准。DEMO 数据不得对外表述为实盘。

**一个面向 MT4/MT5 六策略选配、持续资管接入与 EA 交付的平台。**

---

**[查看线上站点](https://www.eaxau.com/)** | **[加入Telegram频道](https://t.me/QuantArmory)** | **[联系我们](#联系我们)**

---

本仓库是 AI 量化联盟的移动 + Web 应用代码库，用于六策略数据展示、Exness / IC Markets / Blueberry Markets 执行券商选配、资管接入、券商直充或受控平台代收，以及 EA 商品交付。页面必须根据数据源明确标记 `DEMO/CUSTOM/LIVE/HYBRID`。

## ✨ 核心功能

| 功能 | 描述 | 状态 |
|---|---|---|
| **六策略选配** | 固定提供六款策略；每笔委托可选 1–6 款并配置权重，再在 1–3 家可选执行券商间分配资金。 | ✅ 已上线 |
| **资管接入** | 支持客户自主开户或平台协助接入；交易授权和出金权限严格分离。 | ⚠️ 工作流已上线，真实券商授权待配置 |
| **USDT 资金链路** | EA 商户收款、客户直充券商、平台代收再划转三账隔离。 | ⚠️ 工作流已上线，真实地址及许可待配置 |
| **策略数据** | 按 `DEMO/CUSTOM/LIVE/HYBRID` 来源展示收益、回撤与交易统计；当前生产环境为 DEMO。 | ⚠️ 接口已上线，实盘源待接入 |
| **回测中心** | 深入分析策略的历史表现，提供详细的交易记录和统计数据。 | ✅ 已上线 |
| **合购模式** | 与其他用户共同购买心仪的策略，以极低的成本试用高性能EA。 | ✅ 已上线 |
| **匿名留言板** | 在每个策略下方进行匿名提问和评价，分享真实的用户反馈。 | ✅ 已上线 |
| **开发者合作** | 为优秀的EA开发者提供策略上架、推广和销售分成服务。 | ✅ 已上线 |
| **跨平台支持** | 支持iOS、Android和Web浏览器，随时随地跟踪策略表现。 | ✅ 已上线 |

## 🚀 快速开始

### 作为用户

1. **访问平台**: [点击这里](https://www.eaxau.com/) 直接在浏览器中访问 Web 应用。
2. **配置方案**: 从六款策略中选择 1–6 款、设置资金与风险，再选择 1–3 家可选执行券商。
3. **核验数据**: 点击策略卡片查看明确标记来源的演示、回测或实盘数据。
4. **申请接入或购买 EA**: 资管接入与 EA 商品结算使用不同资金账路。
5. **加入社区**: [加入我们的Telegram频道](https://t.me/QuantArmory)获取最新资讯和优惠活动。

### 作为开发者

本项目基于 `Expo (React Native)` + `tRPC` + `Drizzle` 构建，你可以轻松地进行二次开发或贡献代码。

**环境准备:**
- Node.js (v18+)
- pnpm
- Docker (用于数据库)

**本地运行:**

```bash
# 1. 克隆仓库
$ git clone https://github.com/huachen-wang/quant-trading-hub.git
$ cd quant-trading-hub

# 2. 安装依赖
$ pnpm install

# 3. 准备环境变量
$ cp .env.example .env

# 4. 启动本地 MySQL 数据库
$ docker-compose up -d

# 5. 运行数据库迁移（调用与生产启动相同的幂等迁移器）
$ pnpm db:push

# 6. 启动开发服务器 (Web + Backend)
$ pnpm dev
```

`server/migrate.ts` 是唯一可执行的 schema 迁移入口：它使用 MySQL advisory lock、
`INFORMATION_SCHEMA` 补列/索引检查并可重复运行。`drizzle/*.sql` 仅用于 schema
变更审计，不应直接对已由服务器迁移过的数据库执行。

现在，你可以在 `http://localhost:8081` 访问Web应用。

## 🛠️ 技术栈

- **跨平台框架**: Expo (React Native for Web, iOS, Android)
- **后端API**: tRPC
- **数据库**: MySQL / TiDB
- **ORM**: Drizzle ORM
- **UI**: Tailwind CSS + NativeWind
- **状态管理**: React Query
- **部署**: Railway (Web/API), EAS (Mobile)

## 🤝 贡献代码 & 合作

我们欢迎各种形式的贡献和合作！

- **Bug反馈**: 如果你发现了Bug，请在 [Issues](https://github.com/huachen-wang/quant-trading-hub/issues) 中提交。
- **功能建议**: 我们很乐意倾听你的想法，请在 [Discussions](https://github.com/huachen-wang/quant-trading-hub/discussions) 中分享。
- **代码贡献**: Fork本仓库，创建你的分支，然后提交Pull Request。
- **策略上架**: 如果你有优秀的EA策略希望上架销售，请通过以下方式联系我们。

## 📞 联系我们

我们正在积极寻找合作伙伴，包括但不限于EA开发者、外汇经纪商、KOL和投资者。

- **商务合作 (Telegram)**: [@QuantArmory](https://t.me/QuantArmory)
- **商务合作 (微信)**: `QuantHub2026`
- **技术交流 (GitHub)**: [Discussions](https://github.com/huachen-wang/quant-trading-hub/discussions)
- **合作方案**: [查看我们的合作方案手册](./partnership-proposals.md)

## 📄 开源许可

本项目基于 [MIT License](./LICENSE) 开源。
