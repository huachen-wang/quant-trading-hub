import { SUPPORT_TELEGRAM_URL } from "../community-contacts";
import { COOPERATION_EN_PATH, COOPERATION_ZH_PATH } from "./paths";

/**
 * C04｜EA 定制与源码授权：需求和验收指南（2026-10-18）。
 *
 * 正文来自 收件/gpt/seo-geo-20261018/首批六页/04_EA需求与验收指南.md 的 PUBLIC 区块。
 * 与稿件的差异：站内链接改成相对地址（英文页指向 /en/cooperation），Telegram 链接从
 * shared/community-contacts.ts 取。示例表保留「示例」字样，不是已交付项目或报价。
 */

export const GUIDE_ZH_MARKDOWN = `# EA 定制与源码授权：把需求写成可以验收的清单

“做一个 EA”或“给我源码”还不足以形成可比较的报价。写清运行环境、功能边界、使用权和交付结果，能让双方更早判断是否适合合作，也让验收有据可查。

这份清单可用于新开发、现有项目适配或源码许可咨询。先填写已知部分，不确定的项目标注“需共同确认”，再交给顾问评估。

[带着需求咨询 EAXAU](${SUPPORT_TELEGRAM_URL}) · [了解工作室合作](${COOPERATION_ZH_PATH})

## 第一步：说明环境和用途

写明 MT4 或 MT5、终端版本、电脑或 VPS 环境，以及目标品种和账户模式。已有项目还需说明当前版本、依赖组件、可提供的材料和允许修改的范围。

用途会影响许可要求：个人使用、团队内部使用、付费服务、二次开发和再分发，需要分别说明。希望交付源码时，同时要求确认第三方依赖及相应使用限制。

## 第二步：用输入和结果描述功能

每个功能至少写出：在什么条件下发生、用户如何操作、系统应显示或输出什么、失败时如何提示。把“界面好用”“运行稳定”拆成能检查的行为。

### 说明示例：MT5 面板状态提示

下面只是需求写法示例，不是已交付项目或报价。

| 项目 | 示例要求 | 检查方法 |
|---|---|---|
| 连接状态 | 显示当前连接状态及最近更新时间 | 在约定的模拟测试环境中改变连接条件，核对显示 |
| 帮助入口 | 点击后打开指定使用说明 | 检查目标页面可打开，链接与版本一致 |
| 异常提示 | 获取状态失败时显示明确提示，不显示旧状态为最新 | 模拟失败响应，记录实际提示 |
| 改动边界 | 本次仅改面板状态显示，不新增交易功能 | 对照范围清单和变更记录检查 |

如果项目涉及交易功能，应另行写清触发、执行、异常处理与测试条件；不能用这个界面示例替代完整的策略规格。

## 第三步：约定具体交付物

| 交付类型 | 报价中应列出的内容 |
|---|---|
| 可运行版本 | 文件名称、版本、适用环境、安装和配置说明 |
| 源码 | 源文件范围、依赖及版本、构建说明、所需工具和许可范围 |
| 验收材料 | 测试输入、预期结果、实际结果及对应记录 |
| 运维说明 | 更新步骤、常见错误提示、问题反馈方式 |
| 后续支持 | 支持期限、问题修复范围、修改轮次及额外需求的处理方式 |

并非每个订单都包含整张表。请让报价明确勾选哪些包含、哪些需要另行安排。

## 第四步：把验收和追加需求分开

开始前约定测试环境、参与验收的人、反馈时间和通过条件。验收时按已确认的功能逐项记录“通过／待修订”，附上能复现问题的步骤。

没有达到已约定要求的事项，作为修订处理。原范围之外的新功能，先记录影响，再确认费用与排期。交易结果本身不能替代对代码功能和交付物的验收。

## 可直接复制的需求模板

> **项目目标：**用一句话说明要解决的问题。
> **交付类型：**成品授权／源码许可／适配／新开发。
> **运行环境：**平台、版本、设备、目标品种、账户模式。
> **已有材料：**公开链接、可合法提供的文件、说明文档。
> **功能清单：**每项写触发条件、操作、预期结果和异常情况。
> **不包含的内容：**本次明确排除的功能和服务。
> **使用权要求：**使用主体、修改、商用、再分发、是否独家。
> **交付清单：**运行文件、源码、依赖、文档、测试记录。
> **验收方法：**测试环境、样例、通过条件和反馈方式。
> **后续支持：**期望支持范围、期限和修改安排。
> **时间与预算：**期望日期、预算范围及优先级。

初次沟通可先提供概括说明。需要进一步交接时，再确认材料权限和交接方式。

## 发出需求前，再核对三件事

1. **范围是否一致：**正文、报价与交付清单描述的是同一个项目。
2. **权利是否明确：**拿到哪些文件，与能如何使用这些文件，分别写清。
3. **验收是否可执行：**双方能在约定环境中，用同一组样例检查结果。

准备好这些信息后，[联系 EAXAU 评估范围](${SUPPORT_TELEGRAM_URL})。可行性、费用和工期根据实际材料确认。
`;

export const GUIDE_EN_MARKDOWN = `# EA development and source licensing: write a checkable brief

“Build an EA” or “send the source code” is not enough for comparable quotes. Define the environment, feature boundaries, usage rights and deliverables so both parties can assess the work and agree how to accept it.

Use this checklist for new development, adaptation or a source-code license. Fill in what you know and mark unresolved items “to agree together” before asking for an assessment.

[Discuss your brief with EAXAU](${SUPPORT_TELEGRAM_URL}) · [Studio cooperation](${COOPERATION_EN_PATH})

## 1. Describe the environment and intended use

Specify MT4 or MT5, the terminal version, computer or VPS environment, target instruments and account mode. For an existing project, identify its current version, dependencies, available materials and permitted changes.

Licensing needs depend on intended use. Identify personal use, internal team use, paid services, further development and redistribution separately. If you need source code, also ask for third-party dependencies and their usage restrictions to be identified.

## 2. Describe features through inputs and outcomes

For each feature, state its trigger, the user's action, the expected display or output, and the response to failure. Replace broad requests such as “easy to use” with behaviour that can be checked.

### Illustrative brief: an MT5 panel status display

This is an example of how to write a requirement, not a delivered project or a quote.

| Item | Example requirement | How to check |
|---|---|---|
| Connection status | Display the current connection state and last update time | Change connection conditions in the agreed simulated test environment and inspect the display |
| Help link | Open the specified usage guide | Check that the target opens and matches the version |
| Failure message | Show a clear message if the status cannot be fetched; do not label an old result as current | Simulate a failed response and record the message |
| Change boundary | Update the panel status display only, with no new trading functions | Compare the scope list with the change record |

Projects involving trading functions need separate specifications for triggers, execution, exception handling and test conditions. This interface example is not a complete strategy specification.

## 3. Specify the deliverables

| Delivery type | Items to identify in the quote |
|---|---|
| Runnable version | File names, version, supported environment, installation and configuration instructions |
| Source code | Included source files, dependency versions, build instructions, required tools and licensing scope |
| Acceptance materials | Test inputs, expected outcomes, actual outcomes and supporting records |
| Operating notes | Update steps, common error messages and issue-reporting process |
| Support | Duration, defect-correction scope, revision allowance and treatment of additional requests |

Not every order includes the whole table. Ask the quote to distinguish included items from those requiring a separate arrangement.

## 4. Separate acceptance from additional work

Before work starts, agree the test environment, reviewers, feedback period and pass criteria. During acceptance, record “passed” or “revision needed” for each agreed feature, with reproducible steps for any issue.

Work that fails an agreed requirement is recorded for revision. A feature outside the original scope should first be assessed for its effect on fees and timing. Trading outcomes do not replace acceptance of code functionality and deliverables.

## A brief you can copy

> **Project goal:** the problem to solve in one sentence.
> **Delivery type:** compiled license / source license / adaptation / new development.
> **Environment:** platform, version, device, instruments and account mode.
> **Available materials:** public links, files you may lawfully supply and documentation.
> **Features:** trigger, action, expected result and exception cases for each item.
> **Exclusions:** functions and services outside this project.
> **Rights required:** licensed user, modification, commercial use, redistribution and exclusivity.
> **Deliverables:** runnable files, source, dependencies, documentation and test records.
> **Acceptance:** environment, examples, pass criteria and feedback process.
> **Support:** desired scope, duration and revision arrangements.
> **Timing and budget:** preferred date, budget range and priorities.

An initial discussion can use a high-level description. Confirm permissions and the handover method before sharing further materials.

## Three checks before sending

1. **Consistent scope:** the brief, quote and delivery list describe the same project.
2. **Clear rights:** the files supplied and the permitted uses of those files are specified separately.
3. **Practical acceptance:** both parties can check the outcome using the same examples in the agreed environment.

When ready, [ask EAXAU to assess the scope](${SUPPORT_TELEGRAM_URL}). Feasibility, fees and timing depend on the actual materials.
`;
