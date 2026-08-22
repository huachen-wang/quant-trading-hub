# EAXAU V2 实现状态

更新时间：2026-08-22。

## 结论

EAXAU 仓库内的 V2 演示纵向链路已开发完成，并以新增路由和新增 `v2` tRPC
命名空间实现，没有替换 V1 根路由、旧 API 或旧数据库结构。它可以用于产品评审、UI
复查和外部数据联调，但在独立 Quant Data Core 与真实账户接入前只能称为 `DEMO`，
不能称为已上线实盘。

## 已完成

- `/v2-preview` 六策略首页，包含组合曲线、六席位、状态、新鲜度和两种服务模式。
- `/v2-preview/strategies/[id]` 策略详情，包含指标、区间、净值、持仓、成交及图文块。
- `/v2-preview/allocate` 自主分仓配置器，支持 1 至 3 个平台、策略权重和风险预算。
- `/v2-preview/accounts` 与账户详情，覆盖签约管理和自主分仓两种只读视图。
- `/v2-preview/ea-library` 独立 EA 资料库，复用旧目录、搜索、筛选、分页和咨询流程。
- `/admin/v2-content` 六策略内容后台，支持新建、编辑、排序、显隐、预览和删除。
- 确定性 Demo Provider、HTTP Quant Data Provider 和严格的 Zod 数据契约。
- 平台、策略、资金权重、集中度、数据状态和回撤预算校验引擎。
- `DEMO`、`LIVE`、`STALE`、`OFFLINE`、加载、空数据、部分数据和错误表现。
- V2 单元测试、契约测试以及不修改 V1 顶层路由的兼容实现。
- 十张策略视觉图压缩为 960x540，降低首页图片传输和解码压力。
- `EAXAU_V2_ENABLED` 功能开关；关闭时只保留状态查询，其余 V2 调用被拒绝。

## 没有改动

- 现有 V1 tRPC procedure 名称、输入和输出。
- 现有支付、下载、登录、OAuth、邮件、短信和定时任务接口。
- 现有数据库迁移与表结构；V2 内容复用 `page_contents` 表。
- 牛帮交易执行、数据库和内部函数。
- EA 资料库原有目录与旧入口。

## 外部依赖，尚未接入

- 独立 Quant Data Core 的生产服务、缓存、SSE/推送及服务级监控。
- Niubang Export Adapter、服务间鉴权、用户授权映射和敏感字段脱敏。
- 六款策略的真实账户 ID、正式净值、成交、持仓和证据资料。
- 三个平台的正式点差、返佣、出金、地区限制、合同和责任主体。
- 真实数据环境的端到端联调、故障演练、灰度切流和生产验收。

这些工作不能用演示数字代替。`QUANT_DATA_CORE_URL` 未设置时系统固定使用 `DEMO`；
设置后 HTTP Provider 校验所有响应，失败会明确报错，不会伪装成实时数据。

## 当前技术入口

```text
/v2-preview
/v2-preview/strategies/jingge-v51
/v2-preview/allocate
/v2-preview/accounts
/v2-preview/ea-library
/admin/v2-content
```

## 发布门槛

1. 本仓库类型检查、lint、全量测试、后端构建、Web 导出和静态验证全部通过。
2. 桌面 1440px、平板 1024px、手机 390px 无横向溢出、遮挡或空白页。
3. 生产环境设置 Node.js 24、数据库、鉴权密钥和 `EAXAU_V2_ENABLED=true`。
4. 接真实数据时设置 Quant Data Core URL/Key，并逐项核验来源和更新时间。
5. 业务方完成六策略、平台条款、风险文案与合同责任主体审核。
6. 先保留 `/v2-preview` 灰度入口，验收后再单独决定是否切换根首页。

最新一次自动化和视觉验证结果记录在仓库根目录 `DEPLOYMENT_AUDIT.md`。
