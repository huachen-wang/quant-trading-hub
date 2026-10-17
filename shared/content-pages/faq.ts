import { SUPPORT_QQ, SUPPORT_TELEGRAM_URL, SUPPORT_WECHAT } from "../community-contacts";
import { COOPERATION_EN_PATH, COOPERATION_ZH_PATH, GUIDE_EN_PATH, GUIDE_ZH_PATH } from "./paths";

/**
 * 常见问题（中英，2026-10-18）。
 *
 * 问题清单参考 收件/gpt/eaxau/GPT-24/faq.md 与 收件/gpt/shared/GPT-28/eaxau/en-copy.md 的 FAQ 草稿，
 * 但**只收答案能在站内现有内容里逐句找到出处的那几条**，答案按站内原话改写：
 * - 定位、商品页写什么、价格与授权按订单确认：首页 description（shared/seo-meta.ts）与 /llms.txt；
 * - 运行依赖、交付与支持：商品页预渲染（server/_core/seo-render.ts）；
 * - 源码 / 授权 / MT4→MT5 / 咨询要带什么：合作页（./cooperation.ts）；
 * - 需求怎么写、怎么验收：需求与验收指南（./ea-requirements-guide.ts）；
 * - 客服：shared/community-contacts.ts；风险声明：/llms.txt。
 * 草稿里主体信息、退款、争议受理、试用、促销 / 合购 / 订阅规则、价格与付款方式等还没定的条目一律不收
 * （待站主确认）。每个问题是一个 H2，下面的段落是答案；FAQPage 结构化数据从同一份正文生成，只含页面上看得到的问答。
 */

export const FAQ_ZH_MARKDOWN = `# EAXAU 常见问题

这里回答第一次来 EAXAU 时最常问的几个问题。具体版本、价格、授权范围与交付内容，以每次咨询书面确认的内容为准。

## EAXAU 是什么网站？

EAXAU（AI量化联盟）是 MT4 / MT5 EA、指标与量化交易工具商城，同时提供工作室合作与授权对接：成品授权、源码许可、现有项目适配和定制开发都可以咨询，详见[工作室合作与授权](${COOPERATION_ZH_PATH})。

## 商品页会写明哪些信息？

每个商品页写明运行平台、交易品种、常用周期、运行依赖与授权交付方式；价格与授权范围按订单确认。商品资料里没写清的项目，请在下单前向客服问清楚。

## 第一次买 EA，应该先核对什么？

先确认需要的是 EA 自动交易程序、指标还是交易工具，再核对运行平台（MT4 或 MT5）、交易品种、常用周期和运行依赖。EA 需要在对应的终端里运行，建议配合稳定网络或 VPS；点差、合约规格与交易时段按经纪商环境确认。

外汇、贵金属等杠杆交易有风险，EA 和策略的历史表现不代表未来收益。

## MT4 的 EA 能直接在 MT5 上用吗？

不能默认通用。MT4 与 MT5 是不同的交付选项；把 MT4 项目换成 MT5，需要评估具体实现、依赖和目标环境，适配是否可行、改动范围及验收条件确认后再报价。

## 买成品 EA 会包含源码吗？

不一定。成品授权与源码许可需要分别确认，不能从商品名称推断。拿到源码后能否修改、出售或交给其他工作室，取决于书面许可范围。

## 拿到文件，就等于拿到全部使用权吗？

不是。取得一个文件，不等于同时取得全部使用权。确认合作时，应写明可使用的账户、设备、期限和项目范围，是否允许修改、商业使用、转售或再分发，以及更新、维护和支持由谁负责、持续到何时。

## 下单或授权确认后会交付什么？

下单或授权确认后提供安装包与授权信息，并按版本提供安装、参数说明与后续更新支持；具体版本、参数、适用环境与授权范围以顾问确认为准。源码或定制项目还应按约定列出可编辑文件、依赖、构建方式、配置说明、测试样例与验收记录。

## 定制开发或源码许可的需求要怎么写？

写清运行环境、每项功能（触发条件、操作、预期结果和异常情况）、使用权要求、交付清单、验收方法和后续支持。可以直接套用[需求与验收指南](${GUIDE_ZH_PATH})里的模板，不确定的项目标注“需共同确认”。

## 交付后怎么验收？

开始前约定测试环境、参与验收的人、反馈时间和通过条件；验收时按已确认的功能逐项记录“通过／待修订”。没有达到约定要求的事项作为修订处理；原范围之外的新功能，先记录影响，再确认费用与排期。交易结果本身不能替代对代码功能和交付物的验收。

## 咨询时需要提供什么？

已有目标产品，请附商品名称或页面链接；尚未选定产品，先说明希望解决的问题。首次咨询只需业务和技术需求；涉及受限材料时，先确认你有权提供，再通过约定渠道交接。

## 怎么联系客服？

客服 QQ **${SUPPORT_QQ}** · 微信 **${SUPPORT_WECHAT}** · [Telegram 客服](${SUPPORT_TELEGRAM_URL})。交流群入口在页面底部。
`;

export const FAQ_EN_MARKDOWN = `# EAXAU frequently asked questions

These are the questions people most often ask on a first visit to EAXAU. The version, price, license scope and deliverables for each enquiry are those confirmed in writing.

## What is EAXAU?

EAXAU (eaxau.com) is a marketplace for MT4 / MT5 Expert Advisors (EAs), indicators and trading tools. It also coordinates studio cooperation and licensing: compiled licenses, source-code licenses, adaptation of existing projects and custom development. See [Studio cooperation](${COOPERATION_EN_PATH}).

## What does a product page state?

Each product page states the platform, symbols, timeframe, runtime requirements and licensing/delivery terms; price and license scope are confirmed per order. Product pages are written in Chinese. If anything in a listing is unclear, ask support before ordering.

## What should I check before buying my first EA?

First decide whether you need an automated trading program (EA), an indicator or a trading tool. Then check the platform (MT4 or MT5), symbols, timeframe and runtime requirements. An EA runs in the matching terminal, ideally with a stable network or a VPS; spreads, contract specifications and trading hours depend on the broker.

Leveraged trading in forex and metals involves risk, and the past performance of an EA or strategy does not guarantee future results.

## Can an MT4 EA simply run on MT5?

Do not assume so. MT4 and MT5 are distinct delivery options. Moving an MT4 project to MT5 needs an assessment of the implementation, dependencies and target environment; agree feasibility, scope and acceptance criteria before requesting a final quote.

## Does a compiled EA purchase include source code?

Not necessarily. Compiled-product access and source-code licensing must be confirmed separately. Whether you may modify, sell or pass source code to another studio depends on the written license.

## Does receiving a file give me every right to use it?

No. Receiving a file does not establish every right to use it. Confirm the permitted accounts, devices, term and project scope; whether modification, commercial use, resale or redistribution is allowed; and who is responsible for updates, maintenance and support, and for how long.

## What is delivered once an order or license is confirmed?

Once an order or license is confirmed, EAXAU provides the installation package and license information, with installation, parameter notes and update support according to the version. The exact version, parameters, environment and license scope are as confirmed by the adviser. Source-code or custom work should also list the agreed editable files, dependencies, build process, configuration notes, test examples and acceptance record.

## How should I write a brief for custom development or a source-code license?

Describe the environment, each feature (trigger, action, expected result and exception cases), the rights you need, the deliverables, the acceptance method and the support you expect. You can start from the template in the [EA requirements and acceptance guide](${GUIDE_EN_PATH}) and mark unresolved items “to agree together”.

## How is a delivery reviewed?

Before work starts, agree the test environment, reviewers, feedback period and pass criteria. During acceptance, record “passed” or “revision needed” for each agreed feature. Work that fails an agreed requirement is recorded for revision; a feature outside the original scope is first assessed for its effect on fees and timing. Trading outcomes do not replace acceptance of code functionality and deliverables.

## What should I include in an enquiry?

Include the product name or page link if you have one. Otherwise, describe the problem you want to solve. For an initial enquiry, business and technical requirements are enough; before sharing restricted materials, confirm your right to provide them and use an agreed handover channel.

## How do I contact support?

Support QQ **${SUPPORT_QQ}** · WeChat **${SUPPORT_WECHAT}** · [Telegram support](${SUPPORT_TELEGRAM_URL}). Community group links are at the bottom of this page.
`;
