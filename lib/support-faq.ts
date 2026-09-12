/**
 * 自动值守的 FAQ 规则表。
 *
 * 定位要说清楚：这是**关键词规则**，不是大模型，也不假装真人。命中就给一段确定的、
 * 可核对的答复；没命中就明说「这个要真人确认」，绝不编造版本、价格或交付承诺。
 * 每条自动回复都会被调用方套上 `SUPPORT_AUTO_DISCLOSURE` 前缀。
 *
 * **三语**：站点有中/英/阿三种语言（`lib/language-core.ts`），聊天面板把当前语言随请求送上来，
 * 服务端按它选一份文案。「机器人必须自报是机器人」是产品硬要求，对英语/阿语客户同样成立——
 * 所以身份声明、交给真人的说法、QQ 入口和每条规则的正文都有三份。
 *
 * 合规口径（沿用 registry 对 EA 产品的约束）：不写收益承诺、不写「稳赚 / 不爆仓」，
 * 涉及收益与风险一律引导到真人 + 完整风险披露。三种语言口径一致。
 *
 * 纯函数、无 React / 无 DB，便于单测。
 */

import {
  SUPPORT_AUTO_DISCLOSURE,
  SUPPORT_HUMAN_HANDOFF,
  pickSupportText,
  type SupportLanguage,
  type SupportText,
} from "../shared/support/contracts";

export type SupportFaqContext = {
  strategyTitle?: string | null;
  strategyId?: number | string | null;
  /** 站点设置里的 QQ（群号或号码），用于把客户往 QQ 引。 */
  qq?: string | null;
  /**
   * 经营者的提醒通道是否真的开着（Telegram live + 凭据齐全）。
   * 关着的时候不许说「有人看着」——只说这是留言。默认按关着算，宁可少承诺。
   */
  attended?: boolean;
  /** 客户当前用的站点语言；缺省按中文。 */
  language?: SupportLanguage | string | null;
};

export type SupportFaqRule = {
  key: string;
  /** 命中任意一个关键词即算命中；从上往下第一条命中的生效。关键词本身是三语混合的。 */
  keywords: string[];
  build: (context: SupportFaqContext) => SupportText;
};

function normalizeId(value?: number | string | null) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  return /^\d+$/.test(raw) && raw !== "0" ? raw : "";
}

/** 商品指称，三语各一份。 */
function productLabel(context: SupportFaqContext): SupportText {
  const title = typeof context.strategyTitle === "string" ? context.strategyTitle.trim() : "";
  const id = normalizeId(context.strategyId);
  if (title) {
    return {
      zh: id ? `${title}（商品编号 ${id}）` : title,
      en: id ? `${title} (item #${id})` : title,
      ar: id ? `${title} (المنتج رقم ${id})` : title,
    };
  }
  if (id) {
    return { zh: `商品编号 ${id}`, en: `item #${id}`, ar: `المنتج رقم ${id}` };
  }
  return {
    zh: "你正在看的这个商品",
    en: "the item you are looking at",
    ar: "المنتج الذي تتصفحه",
  };
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
  return pickSupportText(
    {
      zh: `想聊得更细、发截图或传文件，加 QQ ${qq} 最方便，也最容易当场找到人；这里的留言同样留档，两边都能继续。`,
      en: `For screenshots, files or a longer back-and-forth, QQ ${qq} is the fastest way to reach a person; anything you write here is kept on record too.`,
      ar: `لإرسال لقطات الشاشة أو الملفات أو نقاش أطول، QQ ${qq} هو أسرع وسيلة للوصول إلى شخص؛ وما تكتبه هنا يُحفظ أيضًا.`,
    },
    context.language,
  );
}

export const SUPPORT_FAQ_RULES: SupportFaqRule[] = [
  {
    key: "price",
    keywords: ["多少钱", "价格", "报价", "费用", "贵", "price", "cost", "how much", "سعر", "تكلفة"],
    build: (c) => {
      const product = productLabel(c);
      return {
        zh: [
          `${product.zh} 的价格按授权范围（账户数 / 有效期）定，不是一口价，所以这里不给你一个可能不准的数字。`,
          "把你的账户数、要用的时长、MT4 还是 MT5 告诉我，顾问会在这个会话里给你具体价。",
        ].join("\n"),
        en: [
          `Pricing for ${product.en} depends on the licence scope (number of accounts / duration), so there is no single sticker price and I will not quote you a number that might be wrong.`,
          "Tell me how many accounts, how long you need it, and whether it is MT4 or MT5 — an advisor will give you the exact price in this thread.",
        ].join("\n"),
        ar: [
          `يعتمد سعر ${product.ar} على نطاق الترخيص (عدد الحسابات / المدة)، فلا يوجد سعر واحد ثابت ولن أعطيك رقمًا قد يكون خاطئًا.`,
          "أخبرني بعدد الحسابات والمدة المطلوبة وهل هي MT4 أم MT5 — وسيعطيك المستشار السعر الدقيق في هذه المحادثة.",
        ].join("\n"),
      };
    },
  },
  {
    key: "license",
    keywords: [
      "授权", "绑定", "几个账户", "账号数", "换电脑", "有效期",
      "licence", "license", "bind", "ترخيص", "حساب",
    ],
    build: (c) => {
      const product = productLabel(c);
      return {
        zh: [
          `${product.zh} 是按账户授权的：一份授权对应约定数量的交易账号，换券商或换账号需要重新绑定。`,
          "具体能绑几个、到期怎么续、换机器要多久，由顾问按你的实际情况确认。",
        ].join("\n"),
        en: [
          `${product.en} is licensed per trading account: one licence covers an agreed number of accounts, and switching broker or account needs a re-bind.`,
          "How many accounts, how renewal works and how long a machine change takes are confirmed by an advisor for your specific case.",
        ].join("\n"),
        ar: [
          `يُرخَّص ${product.ar} لكل حساب تداول: يغطي الترخيص الواحد عددًا متفقًا عليه من الحسابات، وتغيير الوسيط أو الحساب يتطلب إعادة ربط.`,
          "عدد الحسابات وطريقة التجديد ومدة تغيير الجهاز يؤكدها المستشار حسب حالتك.",
        ].join("\n"),
      };
    },
  },
  {
    key: "delivery",
    keywords: [
      "交付", "安装", "部署", "怎么用", "源码", "ex4", "ex5", "vps",
      "install", "deploy", "setup", "تثبيت", "تسليم",
    ],
    build: () => ({
      zh: [
        "交付内容一般是编译好的 EA 文件 + 参数说明 + 安装步骤；源码是否提供按具体商品和授权谈。",
        "安装可以远程带你走一遍：装到 MT4/MT5、挂到图表、核对参数。你先说说是本机还是 VPS。",
      ].join("\n"),
      en: [
        "Delivery is normally the compiled EA file + a parameter sheet + install steps; whether source code is included depends on the item and the licence.",
        "We can walk you through the install remotely: dropping it into MT4/MT5, attaching it to a chart, checking the parameters. Tell me first whether it runs on your own machine or a VPS.",
      ].join("\n"),
      ar: [
        "يشمل التسليم عادةً ملف EA المُجمَّع + ورقة الإعدادات + خطوات التثبيت؛ أما توفير الشيفرة المصدرية فيعتمد على المنتج والترخيص.",
        "يمكننا مرافقتك في التثبيت عن بُعد: إضافته إلى MT4/MT5 وربطه بالرسم البياني ومراجعة الإعدادات. أخبرني أولًا هل سيعمل على جهازك أم على VPS.",
      ].join("\n"),
    }),
  },
  {
    key: "payment",
    keywords: [
      "付款", "支付", "怎么付", "usdt", "支付宝", "微信支付", "转账",
      "payment", "pay", "دفع", "تحويل",
    ],
    build: () => ({
      zh: [
        "付款方式在确认授权范围之后由真人顾问给你，不在这里发收款账号——防的是有人冒充客服截胡。",
        "任何让你先打款到私人账号的消息，都请先在这个会话里跟我们核对一遍。",
      ].join("\n"),
      en: [
        "Payment details are given by a human advisor after the licence scope is agreed. I do not post any payment account here — that is exactly how impersonators intercept money.",
        "If anything tells you to send money to a personal account first, check it with us in this thread before you pay.",
      ].join("\n"),
      ar: [
        "يقدّم المستشار تفاصيل الدفع بعد الاتفاق على نطاق الترخيص. لا أنشر أي حساب للدفع هنا — فهذه بالضبط طريقة المنتحلين لاعتراض الأموال.",
        "إذا طلب منك أحد تحويل المال إلى حساب شخصي أولًا، فتحقّق معنا في هذه المحادثة قبل الدفع.",
      ].join("\n"),
    }),
  },
  {
    key: "trial",
    keywords: ["试用", "体验", "demo", "模拟", "免费", "trial", "free", "تجربة", "مجاني"],
    build: (c) => {
      const product = productLabel(c);
      return {
        zh: [
          `${product.zh} 能不能试、怎么试，各商品不一样：有的有模拟账号体验版，有的只提供回测与实盘记录核对。`,
          "顾问会按这个商品的实际情况告诉你可核验的材料有哪些。",
        ].join("\n"),
        en: [
          `Whether ${product.en} can be trialled, and how, differs per item: some have a demo-account version, others only offer backtests and live records you can verify.`,
          "An advisor will tell you exactly what verifiable material exists for this item.",
        ].join("\n"),
        ar: [
          `إمكانية تجربة ${product.ar} وطريقتها تختلف بين المنتجات: بعضها له نسخة على حساب تجريبي، وبعضها يوفّر فقط نتائج اختبار تاريخي وسجلات تداول حقيقية يمكنك التحقق منها.`,
          "سيخبرك المستشار بالمواد القابلة للتحقق المتاحة لهذا المنتج تحديدًا.",
        ].join("\n"),
      };
    },
  },
  {
    key: "performance",
    keywords: [
      "收益", "赚", "回撤", "爆仓", "胜率", "年化", "翻倍",
      "profit", "return", "drawdown", "ربح", "عائد",
    ],
    build: () => ({
      zh: [
        "先把话说直：这里不做任何收益承诺，也不会说「不会爆仓」。EA 的历史回测和实盘记录只能说明过去，不代表未来。",
        "能给你的是可核对的东西——回测区间、参数、账户曲线、风险披露。真人顾问会把完整材料发给你，好坏都在里面。",
      ].join("\n"),
      en: [
        "Straight answer: we make no return promises here, and we will not say an account 'cannot blow up'. Backtests and live records describe the past only; they do not predict the future.",
        "What we can give you is verifiable material — the backtest window, the parameters, the equity curve, the risk disclosure. An advisor sends you the full set, the bad parts included.",
      ].join("\n"),
      ar: [
        "بصراحة: لا نقدّم أي وعود بالأرباح هنا، ولن نقول إن الحساب «لا يمكن أن يُصفّى». نتائج الاختبار التاريخي وسجلات التداول تصف الماضي فقط ولا تتنبأ بالمستقبل.",
        "ما يمكننا تقديمه مواد قابلة للتحقق — فترة الاختبار والإعدادات ومنحنى رأس المال وإفصاح المخاطر. سيرسل لك المستشار الملف الكامل بما فيه الجوانب السلبية.",
      ].join("\n"),
    }),
  },
  {
    key: "aftersales",
    keywords: [
      "售后", "报错", "不开单", "没反应", "退款", "坏了",
      "bug", "error", "refund", "support", "استرداد", "خطأ",
    ],
    build: () => ({
      zh: [
        "售后走这同一个会话，不用另开窗口：把 MT4/MT5 的「智能交易」日志截图发过来，顾问按日志定位。",
        "常见的三类是：自动交易没开、图表周期/品种不对、账号授权没绑上。",
      ].join("\n"),
      en: [
        "After-sales stays in this same thread — no need to open anything else. Send a screenshot of the MT4/MT5 Expert Advisors log and an advisor will work from it.",
        "The three usual causes: auto-trading is switched off, the chart timeframe/symbol is wrong, or the account licence was never bound.",
      ].join("\n"),
      ar: [
        "خدمة ما بعد البيع تبقى في هذه المحادثة نفسها — لا حاجة لفتح أي قناة أخرى. أرسل لقطة شاشة من سجل «المستشارين الخبراء» في MT4/MT5 وسيعمل المستشار انطلاقًا منها.",
        "الأسباب الثلاثة الشائعة: التداول الآلي غير مُفعَّل، أو الإطار الزمني/الرمز غير صحيح، أو لم يتم ربط ترخيص الحساب.",
      ].join("\n"),
    }),
  },
  {
    key: "contact",
    keywords: [
      "qq", "微信", "telegram", "电话", "怎么联系", "加你",
      "contact", "wechat", "تواصل", "اتصال",
    ],
    build: (c) => {
      const qq = typeof c.qq === "string" ? c.qq.trim() : "";
      if (!qq) {
        return {
          zh: "你直接在这里留言就行，内容会留档；需要其他联系方式的话，顾问会在会话里给你。",
          en: "Just write here — everything is kept on record. If you need another contact channel, an advisor will give it to you in this thread.",
          ar: "اكتب هنا مباشرة — كل شيء يُحفظ في السجل. وإذا احتجت قناة تواصل أخرى فسيزوّدك بها المستشار في هذه المحادثة.",
        };
      }
      return {
        zh: `QQ ${qq} 是我们最常用的入口，加上之后发截图、传文件都方便，也最容易当场找到人。网页这边的留言同样会留档。`,
        en: `QQ ${qq} is the channel we use most — screenshots and files are easy there, and it is the fastest way to reach a person. Anything you write here is kept on record too.`,
        ar: `QQ ${qq} هو القناة الأكثر استخدامًا لدينا — إرسال لقطات الشاشة والملفات أسهل هناك، وهي أسرع وسيلة للوصول إلى شخص. وما تكتبه هنا يُحفظ أيضًا.`,
      };
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

/** 命中返回规则与正文（按 context.language 选语言）；没命中返回 null。 */
export function matchSupportFaq(
  message: string,
  context: SupportFaqContext = {},
): SupportFaqMatch | null {
  const query = normalizeQuery(typeof message === "string" ? message : "");
  if (!query.trim()) return null;
  for (const rule of SUPPORT_FAQ_RULES) {
    if (rule.keywords.some((keyword) => query.includes(keyword.toLowerCase()))) {
      return { key: rule.key, body: pickSupportText(rule.build(context), context.language) };
    }
  }
  return null;
}

/** 没命中任何规则时的兜底：明说自己答不了，把人交给真人，不瞎编。 */
export function buildSupportFallback(context: SupportFaqContext = {}) {
  const product = productLabel(context);
  return pickSupportText(
    {
      zh: [
        `这条我答不了——${product.zh} 的具体情况得真人确认，我不猜。`,
        "你可以先补一句：用哪个平台（MT4/MT5）、几个账户、打算什么时候上，顾问看到后在这里回你。",
      ].join("\n"),
      en: [
        `I can't answer that one — the specifics of ${product.en} need a human to confirm, and I won't guess.`,
        "It helps if you add: which platform (MT4/MT5), how many accounts, and when you plan to go live. An advisor will reply here.",
      ].join("\n"),
      ar: [
        `لا أستطيع الإجابة عن هذا — تفاصيل ${product.ar} تحتاج تأكيدًا من شخص، ولن أخمّن.`,
        "يفيدنا أن تضيف: أي منصة (MT4/MT5)، وكم عدد الحسابات، ومتى تنوي البدء. سيرد عليك المستشار هنا.",
      ].join("\n"),
    },
    context.language,
  );
}

/**
 * 组装一条完整的自动回复：身份声明 + 正文 + 真人兜底 + QQ 入口。
 *
 * 身份声明放最前面，任何情况下、任何语言下都不省略——客户必须一眼看出这是机器人。
 */
export function buildAutoReply(
  message: string,
  context: SupportFaqContext = {},
): { body: string; ruleKey: string } {
  const match = matchSupportFaq(message, context);
  const ruleKey = match?.key ?? "fallback";
  const core = match?.body ?? buildSupportFallback(context);
  const disclosure = pickSupportText(SUPPORT_AUTO_DISCLOSURE, context.language);
  const handoff = pickSupportText(
    context.attended ? SUPPORT_HUMAN_HANDOFF.attended : SUPPORT_HUMAN_HANDOFF.unattended,
    context.language,
  );
  const lines = [`【${disclosure}】`, core, handoff];
  const qqLine = buildQqLine(context);
  if (qqLine && ruleKey !== "contact") lines.push(qqLine);
  return { body: lines.join("\n"), ruleKey };
}
