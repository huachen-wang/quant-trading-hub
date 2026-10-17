import { SUPPORT_QQ, SUPPORT_TELEGRAM_URL, SUPPORT_WECHAT } from "../community-contacts";
import { GUIDE_EN_PATH, GUIDE_ZH_PATH } from "./paths";

/**
 * C03｜EAXAU 工作室合作与授权（2026-10-18）。
 *
 * 正文来自 收件/gpt/seo-geo-20261018/首批六页/03_EAXAU工作室合作与授权.md 的 PUBLIC 区块。
 * 与稿件的差异（都在交付回执里写明）：
 * - 客服号码从 shared/community-contacts.ts 取（站内规定不在页面写死号码），微信因此是现行的两个号；
 * - 站内链接改成相对地址（/、/cooperation、/en/cooperation）；
 * - 按稿件「上线前核对」要求，在「一份可核对的交付清单」段后加一句指向需求与验收指南（C04）的链接。
 */

export const COOPERATION_ZH_MARKDOWN = `# EA 工作室合作：先把授权和交付说清楚

EAXAU 提供工作室合作与授权对接，围绕策略筛选、技术适配和授权核验展开。无论你需要成品 EA、源码使用许可，还是一项定制开发，都先明确产品来源、使用范围和交付内容，再确认报价。

[咨询工作室合作](${SUPPORT_TELEGRAM_URL})

QQ **${SUPPORT_QQ}** · 微信 **${SUPPORT_WECHAT}**。已有目标产品，请附商品名称或页面链接；尚未选定产品，先说明希望解决的问题。

## 你需要哪一种合作

| 需求 | 开始前要说清楚 |
|---|---|
| 成品 EA 或工具授权 | 产品与版本、MT4 或 MT5、使用环境、授权账户数和期限 |
| 源码使用许可 | 源文件范围、编译环境、第三方依赖，以及是否允许修改、商用或再分发 |
| 现有项目适配 | 当前问题、目标环境、允许改动的部分、需保留的功能 |
| 定制开发 | 功能需求、输入输出、验收样例、交付边界与计划时间 |
| 工作室供给合作 | 你有权提供的产品、权属依据、交付能力和可承担的支持范围 |

MT4 与 MT5、成品文件与源码，是不同的交付选项。是否可做、如何适配和具体费用，需要根据材料逐项确认。

## 授权范围写进合作确认

取得一个文件，不等于同时取得全部使用权。确认合作时，应写明许可由谁提供、适用于哪个版本，以及以下事项：

- 可使用的账户、设备、期限和项目范围。
- 是否允许修改；修改后的成果可用于什么场景。
- 是否允许商业使用、转售、再分发或向第三方提供。
- 是否独家；第三方组件还有哪些独立限制。
- 更新、维护和支持由谁负责，持续到何时。

源码交付、独家许可、转售权和后续维护应分别确认。没有写入协议的权利，不应仅凭“拿到源码”推定已获得。

## 一份可核对的交付清单

成品授权通常需要确认安装文件、版本、授权信息和安装说明。源码或定制项目还应按约定列出可编辑文件、依赖、构建方式、配置说明、测试样例与验收记录。

每次报价同时列明包含项、排除项、验收方式、修改范围和支持期限。额外功能、第三方费用及后续维护如需另计，应在开始前说明。

正式合作以可核验的授权依据、书面范围和签署文件为准。是否包含某项交付，以本次确认的清单为准。

需求怎么写成清单、交付后怎么逐项验收，可以参考 [EA 定制与源码授权：需求和验收指南](${GUIDE_ZH_PATH})。

## 从需求到交付，分四步推进

1. **说明需求。**提供产品链接或简短说明，写明平台、用途和希望得到的交付物。
2. **核对来源与可行性。**确认授权方、已有材料、技术环境及缺少的信息。
3. **确认书面报价。**把范围、费用、付款安排、验收和支持写清楚，再启动约定工作。
4. **按清单交付与验收。**核对文件、功能和许可范围，记录需要修订的事项及处理结果。

## 咨询时可直接复制这份清单

> 我要咨询：成品授权／源码许可／适配／定制／工作室供给合作。
> 目标产品或现有材料：名称、公开链接，或一段功能说明。
> 运行环境：MT4 或 MT5，电脑或 VPS，拟使用的品种与账户模式。
> 使用范围：个人使用／团队使用／商业项目；是否需要修改或再分发。
> 希望交付：安装文件／源码／文档／培训说明等。
> 时间与预算：期望时间、预算范围及必须满足的条件。

首次咨询只需业务和技术需求。涉及受限材料时，先确认你有权提供，再通过约定渠道交接。

## 常见问题

**购买成品 EA 会包含源码吗？**
不一定。成品授权与源码许可需要分别确认，不能从商品名称推断。

**拿到源码后可以修改、出售或交给其他工作室吗？**
取决于书面许可范围。咨询时说明计划用途，让授权方逐项确认。

**能否把 MT4 项目直接换成 MT5？**
需要评估具体实现、依赖和目标环境。适配是否可行、改动范围及验收条件确认后再报价。

**可以先看实际交付要求吗？**
可以。先提出拟购买或定制的范围，要求在报价中列出交付清单、验收方式和支持期限。

[把你的需求发给 EAXAU](${SUPPORT_TELEGRAM_URL}) · [查看现有产品入口](/)
`;

export const COOPERATION_EN_MARKDOWN = `# EA studio cooperation: define the license and delivery

EAXAU coordinates studio cooperation and licensing around strategy selection, technical adaptation and license verification. Whether you need a compiled EA, a source-code license or custom development, start by identifying the source, permitted use and deliverables before agreeing a quote.

[Discuss studio cooperation](${SUPPORT_TELEGRAM_URL})

QQ **${SUPPORT_QQ}** · WeChat **${SUPPORT_WECHAT}**. Include the product name or page link if you have one. Otherwise, describe the problem you want to solve.

## Choose the type of cooperation

| Requirement | What to clarify first |
|---|---|
| Compiled EA or tool license | Product and version, MT4 or MT5, environment, account allowance and term |
| Source-code license | Included source files, build environment, third-party dependencies and rights to modify, use commercially or redistribute |
| Adaptation of an existing project | Current issue, target environment, permitted changes and functions to preserve |
| Custom development | Features, inputs and outputs, acceptance examples, delivery scope and timing |
| Studio supply partnership | Products you are entitled to supply, evidence of rights, delivery capability and support scope |

MT4 and MT5, and compiled files and source code, are distinct delivery options. Feasibility, adaptation work and fees depend on the materials and scope under review.

## Put the license scope in writing

Receiving a file does not establish every right to use it. Confirm who grants the license, which version it covers and the following details:

- Permitted accounts, devices, term and project scope.
- Whether modifications are allowed and how modified work may be used.
- Rights to commercial use, resale, redistribution or supply to third parties.
- Whether the license is exclusive, and any separate restrictions on third-party components.
- Responsibility for updates, maintenance and support, including their duration.

Source delivery, exclusivity, resale rights and maintenance should be agreed separately. Do not infer rights omitted from the agreement merely because source files are supplied.

## Make delivery checkable

For a compiled product, confirm the installation file, version, license information and installation instructions. For source-code or custom work, also specify the editable files, dependencies, build process, configuration notes, test examples and acceptance record that are included.

Each quote should state inclusions, exclusions, acceptance criteria, revision scope and support duration. Additional features, third-party costs and ongoing maintenance should be identified before work starts if they are charged separately.

Formal cooperation depends on verifiable licensing evidence, a written scope and signed documents. The agreed delivery list determines what is included in a particular order.

To turn a requirement into a checklist and review the delivery item by item, see the [EA requirements and acceptance guide](${GUIDE_EN_PATH}).

## Four steps from enquiry to delivery

1. **Describe the requirement.** Share a product link or short brief, the platform, intended use and desired deliverables.
2. **Check rights and feasibility.** Establish the licensing party, available materials, technical environment and missing information.
3. **Agree a written quote.** Specify scope, fees, payment arrangements, acceptance and support before starting the agreed work.
4. **Deliver and review against the list.** Check files, functionality and licensing scope; record revisions and their resolution.

## Copy this enquiry checklist

> Type: compiled license / source-code license / adaptation / custom development / studio supply.
> Product or materials: name, public link or a short feature description.
> Environment: MT4 or MT5, computer or VPS, intended instruments and account mode.
> Intended use: individual / team / commercial project; modification or redistribution required?
> Deliverables: installation files / source code / documentation / training notes.
> Timing and budget: preferred date, budget range and essential conditions.

For an initial enquiry, business and technical requirements are enough. Before sharing restricted materials, confirm your right to provide them and use an agreed handover channel.

## Common questions

**Does a compiled EA purchase include source code?**
Not necessarily. Compiled-product access and source-code licensing must be confirmed separately.

**Can I modify, sell or pass source code to another studio?**
That depends on the written license. Explain your intended use so the licensing party can confirm each permission.

**Can an MT4 project simply be switched to MT5?**
The implementation, dependencies and target environment need assessment. Agree feasibility, scope and acceptance criteria before requesting a final quote.

**Can I see delivery requirements before ordering?**
Yes. Describe the intended purchase or development scope and request a delivery list, acceptance method and support term in the quote.

[Send your requirement to EAXAU](${SUPPORT_TELEGRAM_URL}) · [Browse the product entry point](/)
`;
