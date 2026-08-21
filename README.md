# 量化军火库 (Quant Trading Hub)

> 当前 `main` 是正在运行的 V1。EAXAU AI 量化 V2 的产品边界、数据架构、分仓配方和 UI 交接要求，统一以 [`docs/eaxau-v2/README.md`](docs/eaxau-v2/README.md) 为准。V2 未完成验收前不得直接替换现网。

**一个专注于MT4/MT5策略实盘数据展示、分享和合作的平台。**

---

**[查看线上演示](https://quant-trading-hub.vercel.app/)** | **[加入Telegram频道](https://t.me/QuantArmory)** | **[联系我们](#联系我们)**

---

`Quant Trading Hub` 是一个为量化交易者打造的移动+Web应用，旨在解决当前EA（智能交易）市场信息不透明、策略质量参差不齐的痛点。我们通过提供**真实实盘数据**、**合理定价**和**开放合作模式**，致力于构建一个值得信赖的量化策略生态系统。

## ✨ 核心功能

| 功能 | 描述 | 状态 |
|---|---|---|
| **策略广场** | 浏览由平台验证和筛选的独家EA策略，支持多维度筛选和排序。 | ✅ 已上线 |
| **实盘数据** | 查看每个策略长达180天的真实实盘数据，包括收益曲线、月度回报、最大回撤等关键指标。 | ✅ 已上线 |
| **回测中心** | 深入分析策略的历史表现，提供详细的交易记录和统计数据。 | ✅ 已上线 |
| **合购模式** | 与其他用户共同购买心仪的策略，以极低的成本试用高性能EA。 | ✅ 已上线 |
| **匿名留言板** | 在每个策略下方进行匿名提问和评价，分享真实的用户反馈。 | ✅ 已上线 |
| **开发者合作** | 为优秀的EA开发者提供策略上架、推广和销售分成服务。 | ✅ 已上线 |
| **跨平台支持** | 支持iOS、Android和Web浏览器，随时随地跟踪策略表现。 | ✅ 已上线 |

## 🚀 快速开始

### 作为用户

1. **访问平台**: [点击这里](https://quant-trading-hub.vercel.app/) 直接在浏览器中访问我们的Web应用。
2. **浏览策略**: 在策略广场发现感兴趣的EA。
3. **分析数据**: 点击策略卡片，进入详情页查看完整的实盘和回测数据。
4. **参与合购/购买**: 通过合购或直接购买获取策略使用权。
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

# 5. 运行数据库迁移
$ pnpm db:push

# 6. 启动开发服务器 (Web + Backend)
$ pnpm dev
```

现在，你可以在 `http://localhost:8081` 访问Web应用。

## 🛠️ 技术栈

- **跨平台框架**: Expo (React Native for Web, iOS, Android)
- **后端API**: tRPC
- **数据库**: MySQL / TiDB
- **ORM**: Drizzle ORM
- **UI**: Tailwind CSS + NativeWind
- **状态管理**: React Query
- **部署**: Vercel (Web), EAS (Mobile)

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
