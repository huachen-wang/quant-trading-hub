/**
 * 自动值守的 FAQ 规则表。
 *
 * 定位要说清楚：这是**关键词规则**，不是大模型，也不假装真人。命中就给一段确定的、
 * 可核对的答复；没命中就明说「这个要真人确认」，绝不编造版本、价格或交付承诺。
 * 每条自动回复都会被调用方套上 `SUPPORT_AUTO_DISCLOSURE` 前缀。
 *
 * 合规口径（沿用 registry 对 EA 产品的约束）：不写收益承诺、不写「稳赚 / 不爆仓」，
 * 涉及收益与风险一律引导到真人 + 完整风险披露。
 *
 * 纯函数、无 React / 无 DB，便于单测。
 */

import { SUPPORT_AUTO_DISCLOSURE, SUPPORT_HUMAN_HANDOFF } from "../shared/support/contracts";

export type SupportFaqContext = {
  strategyTitle?: string | null;
  strategyId?: number | string | null;
  /** 站点设置里的 QQ（群号或号码），用于把客户往 QQ 引。 */
  qq?: string | null;
};

export type SupportFaqRule = {
  key: string;
  /** 命中任意一个关键词即算命中；从上往下第一条命中的生效。 */
  keywords: string[];
  build: (context: SupportFaqContext) => string;
};

function productLabel(context: SupportFaqContext) {
  const title = typeof context.strategyTitle === "string" ? context.strategyTitle.trim() : "";
  if (title) {
    const id = normalizeId(context.strategyId);
    return id ? `${title}（商品编号 ${id}）` : title;
  }
  const id = normalizeId(context.strategyId);
  return id ? `商品编号 ${id}` : "你正在看的这个商品";
}

function normalizeId(value?: number | string | null) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  return /^\d+$/.test(raw) && raw !== "0" ? raw : "";
}

/**
 * 站点设置没配 QQ 时的兜底号码，与联系方式弹窗共用同一份，避免两处漂移。
 * 这是对外公开的客服号，不是凭据。
 */
export const SUPPORT_QQ_FALLBACK = "1226426670 / 3832001817";

/** QQ 是本站主推的客户沟通入口，几乎每条回复末尾都带上。 */
export function buildQqLine(context: SupportFaqContext) {
  const qq = typeof context.qq === "string" ? context.qq.trim() : "";
  if (!qq) return "";
  return `想聊得更细、发截图或传文件，加 QQ ${qq} 最方便；这里的对话不会丢，两边都能继续。`;
}

export const SUPPORT_FAQ_RULES: SupportFaqRule[] = [
  {
    key: "price",
    keywords: ["多少钱", "价格", "报价", "费用", "贵", "price", "cost", "how much"],
    build: (c) =>
      [
        `${productLabel(c)} 的价格按授权范围（账户数 / 有效期）定，不是一口价，所以这里不给你一个可能不准的数字。`,
        "把你的账户数、要用的时长、MT4 还是 MT5 告诉我，真人顾问会直接在这个会话里报到具体价。",
      ].join("\n"),
  },
  {
    key: "license",
    keywords: ["授权", "绑定", "几个账户", "账号数", "换电脑", "有效期", "licence", "license", "bind"],
    build: (c) =>
      [
        `${productLabel(c)} 是按账户授权的：一份授权对应约定数量的交易账号，换券商或换账号需要重新绑定。`,
        "具体能绑几个、到期怎么续、换机器要多久，真人顾问会按你的实际情况确认。",
      ].join("\n"),
  },
  {
    key: "delivery",
    keywords: ["交付", "安装", "部署", "怎么用", "源码", "ex4", "ex5", "vps", "install", "deploy", "setup"],
    build: (c) =>
      [
        `交付内容一般是编译好的 EA 文件 + 参数说明 + 安装步骤；源码是否提供按具体商品和授权谈。`,
        "安装可以远程带你走一遍：装到 MT4/MT5、挂到图表、核对参数。你先说说是本机还是 VPS。",
      ].join("\n"),
  },
  {
    key: "payment",
    keywords: ["付款", "支付", "怎么付", "usdt", "支付宝", "微信支付", "转账", "payment", "pay"],
    build: () =>
      [
        "付款方式在确认授权范围之后由真人顾问给你，不在这里发收款账号——防的是有人冒充客服截胡。",
        "任何让你先打款到私人账号的消息，都请先在这个会话里跟我们核对一遍。",
      ].join("\n"),
  },
  {
    key: "trial",
    keywords: ["试用", "体验", "demo", "模拟", "免费", "trial", "free"],
    build: (c) =>
      [
        `${productLabel(c)} 能不能试、怎么试，各商品不一样：有的有模拟账号体验版，有的只提供回测与实盘记录核对。`,
        "真人顾问会按这个商品的实际情况告诉你可核验的材料有哪些。",
      ].join("\n"),
  },
  {
    key: "performance",
    keywords: ["收益", "赚", "回撤", "爆仓", "胜率", "年化", "翻倍", "profit", "return", "drawdown"],
    build: () =>
      [
        "先把话说直：这里不做任何收益承诺，也不会说「不会爆仓」。EA 的历史回测和实盘记录只能说明过去，不代表未来。",
        "能给你的是可核对的东西——回测区间、参数、账户曲线、风险披露。真人顾问会把完整材料发给你，好坏都在里面。",
      ].join("\n"),
  },
  {
    key: "aftersales",
    keywords: ["售后", "报错", "不开单", "没反应", "退款", "坏了", "bug", "error", "refund", "support"],
    build: () =>
      [
        "售后走这同一个会话，不用另开窗口：把 MT4/MT5 的「智能交易」日志截图发过来，真人顾问按日志定位。",
        "常见的三类是：自动交易没开、图表周期/品种不对、账号授权没绑上。",
      ].join("\n"),
  },
  {
    key: "contact",
    keywords: ["qq", "微信", "telegram", "电话", "怎么联系", "加你", "contact", "wechat"],
    build: (c) => {
      const qq = typeof c.qq === "string" ? c.qq.trim() : "";
      return qq
        ? `QQ ${qq} 是我们最常用的入口，加上之后发截图、传文件都方便。这个网页会话同样有人看，你在哪边说都行。`
        : "这个网页会话有人看，你直接在这里说就行；需要其他联系方式的话，真人顾问会在会话里给你。";
    },
  },
];

export type SupportFaqMatch = {
  key: string;
  body: string;
};

function normalizeQuery(message: string) {
  return message.toLowerCase();
}

/** 命中返回规则与正文；没命中返回 null（调用方负责兜底话术）。 */
export function matchSupportFaq(
  message: string,
  context: SupportFaqContext = {},
): SupportFaqMatch | null {
  const query = normalizeQuery(typeof message === "string" ? message : "");
  if (!query.trim()) return null;
  for (const rule of SUPPORT_FAQ_RULES) {
    if (rule.keywords.some((keyword) => query.includes(keyword.toLowerCase()))) {
      return { key: rule.key, body: rule.build(context) };
    }
  }
  return null;
}

/** 没命中任何规则时的兜底：明说自己答不了，把人交给真人，不瞎编。 */
export function buildSupportFallback(context: SupportFaqContext = {}) {
  return [
    `这条我答不了——${productLabel(context)} 的具体情况得真人确认，我不猜。`,
    "你可以先补一句：用哪个平台（MT4/MT5）、几个账户、打算什么时候上。真人顾问看到会直接在这里回你。",
  ].join("\n");
}

/**
 * 组装一条完整的自动回复：身份声明 + 正文 + 真人兜底 + QQ 入口。
 *
 * 身份声明放最前面，任何情况下都不省略——客户必须一眼看出这是机器人。
 */
export function buildAutoReply(
  message: string,
  context: SupportFaqContext = {},
): { body: string; ruleKey: string } {
  const match = matchSupportFaq(message, context);
  const ruleKey = match?.key ?? "fallback";
  const core = match?.body ?? buildSupportFallback(context);
  const lines = [`【${SUPPORT_AUTO_DISCLOSURE.zh}】`, core, SUPPORT_HUMAN_HANDOFF.zh];
  const qqLine = buildQqLine(context);
  if (qqLine && ruleKey !== "contact") lines.push(qqLine);
  return { body: lines.join("\n"), ruleKey };
}
