import type { AppLanguage } from "@/lib/language";

export type RiskProfile = "LOW" | "MEDIUM" | "HIGH";
export type AllianceBrokerId = "exness" | "ic-markets" | "blueberry-markets";
export type OnboardingMode = "SELF_OPENED" | "PLATFORM_ASSISTED";
export type FundingPath = "BROKER_DIRECT" | "PLATFORM_COLLECTION";

export type RiskOption = {
  id: RiskProfile;
  title: string;
  drawdown: number;
  detail: string;
};

export type AllianceBroker = {
  id: AllianceBrokerId;
  code: string;
  name: string;
  detail: string;
  signupUrl: string;
  managementUrl: string;
  fundingUrl?: string;
  collectionApproval: "NOT_APPROVED" | "PENDING" | "APPROVED" | "SUSPENDED";
};

export type OnboardingOption = {
  id: OnboardingMode;
  title: string;
  badge: string;
  detail: string;
};

export const CAPITAL_PRESETS = [10_000, 50_000, 100_000, 300_000];

export const RISK_OPTIONS: RiskOption[] = [
  { id: "LOW", title: "稳健", drawdown: 8, detail: "优先控制波动与集中度" },
  { id: "MEDIUM", title: "均衡", drawdown: 12, detail: "兼顾增长与回撤预算" },
  { id: "HIGH", title: "进取", drawdown: 18, detail: "接受更高波动换取弹性" },
];

/**
 * Product-level broker catalog. It intentionally contains no deposit network,
 * address or fee claim: customers must obtain those changing values from the
 * selected broker's own client portal for every funding attempt.
 */
export const ALLIANCE_BROKERS: AllianceBroker[] = [
  {
    id: "exness",
    code: "EXN",
    name: "Exness",
    detail: "可选执行券商；开户、地区可用性与当次入金能力以券商客户后台为准。",
    signupUrl: "https://my.exness.com/accounts/sign-up?lng=zh",
    managementUrl:
      "https://portfolio-management.exness.help/hc/en-us/articles/6787235670418-Joining-a-fund",
    collectionApproval: "PENDING",
  },
  {
    id: "ic-markets",
    code: "ICM",
    name: "IC Markets",
    detail: "可选执行券商；开户、地区可用性与当次入金能力以券商客户后台为准。",
    signupUrl: "https://www.ic.com/cn/open-trading-account/live",
    managementUrl: "https://www.icmarketspartners.com/en/apply",
    fundingUrl: "https://www.ic.com/en/trading-accounts/funding",
    collectionApproval: "PENDING",
  },
  {
    id: "blueberry-markets",
    code: "BBM",
    name: "Blueberry Markets",
    detail: "可选执行券商；开户、地区可用性与当次入金能力以券商客户后台为准。",
    signupUrl: "https://portal.blueberrymarkets.com/en/sign-up",
    managementUrl: "https://portal.blueberrypartners.com/en/signup",
    collectionApproval: "PENDING",
  },
];

export const FUNDING_PATH_OPTIONS: {
  id: FundingPath;
  title: string;
  badge: string;
  detail: string;
}[] = [
  {
    id: "BROKER_DIRECT",
    title: "U 直达本人券商",
    badge: "默认",
    detail:
      "客户从券商客户后台获取当次网络、地址与标签，USDT 直接进入客户本人券商账户。",
  },
  {
    id: "PLATFORM_COLLECTION",
    title: "平台专属地址代收",
    badge: "协助通道",
    detail:
      "为单笔代收单生成专属地址；平台核对后再转入客户本人券商账户，全程与其他款项分账。",
  },
];

export const ONBOARDING_OPTIONS: OnboardingOption[] = [
  {
    id: "SELF_OPENED",
    title: "客户自主开户",
    badge: "自主办理",
    detail: "客户自行完成券商开户与验证；USDT 直接进入客户本人券商账户。",
  },
  {
    id: "PLATFORM_ASSISTED",
    title: "平台协助接入",
    badge: "流程协助",
    detail:
      "平台协助开户与交易授权；U 可直达本人券商，已获书面批准的通道也可使用平台专属代收单。",
  },
];

export const BROKER_FUNDING_STEPS = [
  "选择可选券商并完成自主开户或申请平台协助接入",
  "从券商客户后台获取当次 USDT 网络、地址及标签（如有）",
  "从客户钱包转账，提交 txHash 与申报金额",
  "等待确认中；网络、金额或标签不符会进入异常处理",
  "券商实际入账并经后台核对后显示已到账",
] as const;

export const ASSISTED_FUNDING_STEPS = [
  "生成或等待单笔专属代收单",
  "客户按代收单指定网络、金额与专属地址转入",
  "提交 txHash，等待确认中；异常会进入独立人工处理",
  "平台核对后从外部企业钱包转入客户本人券商账户",
  "券商实际入账后显示已到账；退款或未到账显示异常",
] as const;

export const BROKER_FUNDING_WARNINGS = [
  "网络必须与券商当次显示完全一致；错链可能无法找回。",
  "不要复用历史入金地址、二维码或标签；每次都从券商客户后台重新获取。",
  "少付、多付、迟到、未到账或标签遗漏会进入人工核对，不代表已入账。",
  "提交 txHash 只是申报；只有券商账户实际入账并经后台核对后才算完成。",
] as const;

const ENGLISH_RISK_OPTIONS: RiskOption[] = [
  {
    id: "LOW",
    title: "Conservative",
    drawdown: 8,
    detail: "Prioritize volatility and concentration control",
  },
  {
    id: "MEDIUM",
    title: "Balanced",
    drawdown: 12,
    detail: "Balance growth with a drawdown budget",
  },
  {
    id: "HIGH",
    title: "Growth",
    drawdown: 18,
    detail: "Accept more volatility for greater flexibility",
  },
];

const ARABIC_RISK_OPTIONS: RiskOption[] = [
  {
    id: "LOW",
    title: "محافظ",
    drawdown: 8,
    detail: "الأولوية لضبط التقلب والتركيز",
  },
  {
    id: "MEDIUM",
    title: "متوازن",
    drawdown: 12,
    detail: "موازنة النمو مع ميزانية التراجع",
  },
  {
    id: "HIGH",
    title: "نمو",
    drawdown: 18,
    detail: "قبول تقلب أعلى مقابل مرونة أكبر",
  },
];

export function getRiskOptions(language: AppLanguage): RiskOption[] {
  return language === "ar"
    ? ARABIC_RISK_OPTIONS
    : language === "en"
      ? ENGLISH_RISK_OPTIONS
      : RISK_OPTIONS;
}

export function getAllianceBrokers(language: AppLanguage): AllianceBroker[] {
  if (language === "zh") return ALLIANCE_BROKERS;
  const detail =
    language === "ar"
      ? "وسيط تنفيذ اختياري. يجب التحقق من فتح الحساب والتوفر الإقليمي وإمكانية الإيداع الحالية في بوابة الوسيط."
      : "Optional execution broker. Account opening, regional availability and current funding support must be verified in the broker portal.";
  return ALLIANCE_BROKERS.map((broker) => ({ ...broker, detail }));
}

export function getFundingPathOptions(language: AppLanguage) {
  if (language === "zh") return FUNDING_PATH_OPTIONS;
  return language === "ar"
    ? [
        {
          id: "BROKER_DIRECT" as const,
          title: "USDT مباشرة إلى حساب الوسيط",
          badge: "افتراضي",
          detail:
            "يحصل العميل على الشبكة والعنوان والوسم الحالي من بوابة الوسيط، ثم تصل USDT مباشرة إلى حسابه الشخصي لدى الوسيط.",
        },
        {
          id: "PLATFORM_COLLECTION" as const,
          title: "عنوان تحصيل مخصص للطلب",
          badge: "مسار مساعد",
          detail:
            "يُنشأ عنوان مخصص لطلب واحد، وبعد المطابقة تُحوّل الأموال إلى حساب العميل الشخصي لدى الوسيط مع فصل كامل للسجلات.",
        },
      ]
    : [
        {
          id: "BROKER_DIRECT" as const,
          title: "USDT direct to your broker",
          badge: "Default",
          detail:
            "Retrieve the current network, address and tag from the broker portal, then send USDT directly to your own broker account.",
        },
        {
          id: "PLATFORM_COLLECTION" as const,
          title: "Dedicated collection address",
          badge: "Assisted route",
          detail:
            "A dedicated address is created for one collection order. After reconciliation, funds are forwarded to your own broker account with separate records.",
        },
      ];
}

export function getOnboardingOptions(
  language: AppLanguage,
): OnboardingOption[] {
  if (language === "zh") return ONBOARDING_OPTIONS;
  return language === "ar"
    ? [
        {
          id: "SELF_OPENED",
          title: "فتح الحساب ذاتيا",
          badge: "إدارة ذاتية",
          detail:
            "يكمل العميل فتح الحساب والتحقق بنفسه، وتصل USDT مباشرة إلى حسابه الشخصي لدى الوسيط.",
        },
        {
          id: "PLATFORM_ASSISTED",
          title: "ربط بمساعدة المنصة",
          badge: "مساعدة إجرائية",
          detail:
            "تساعد المنصة في فتح الحساب وتفويض التداول. يمكن الإيداع مباشرة أو عبر طلب تحصيل مخصص لمسار حاصل على موافقة مكتوبة.",
        },
      ]
    : [
        {
          id: "SELF_OPENED",
          title: "Self-service account",
          badge: "Self-managed",
          detail:
            "The client completes broker onboarding and verification. USDT goes directly to the client's own broker account.",
        },
        {
          id: "PLATFORM_ASSISTED",
          title: "Platform-assisted setup",
          badge: "Process support",
          detail:
            "The platform assists with onboarding and trading authorization. Funding can remain direct or use a dedicated collection order on a route with written approval.",
        },
      ];
}

export function getBrokerFundingSteps(
  language: AppLanguage,
): readonly string[] {
  if (language === "zh") return BROKER_FUNDING_STEPS;
  return language === "ar"
    ? [
        "اختر وسيطا وأكمل فتح الحساب ذاتيا أو اطلب مساعدة المنصة",
        "احصل من بوابة الوسيط على شبكة USDT والعنوان والوسم الحالي إن وجد",
        "حوّل من محفظة العميل ثم أرسل txHash والمبلغ المعلن",
        "انتظر التأكيد؛ اختلاف الشبكة أو المبلغ أو الوسم يحول العملية إلى المراجعة",
        "تظهر الحالة مكتملة فقط بعد القيد الفعلي في حساب الوسيط والتحقق الإداري",
      ]
    : [
        "Choose a broker and complete self-service onboarding or request platform assistance",
        "Retrieve the current USDT network, address and tag, if any, from the broker portal",
        "Transfer from the client wallet and submit the txHash and declared amount",
        "Wait for confirmation; network, amount or tag mismatches enter exception review",
        "Completion appears only after the broker credits the account and operations verifies it",
      ];
}

export function getAssistedFundingSteps(
  language: AppLanguage,
): readonly string[] {
  if (language === "zh") return ASSISTED_FUNDING_STEPS;
  return language === "ar"
    ? [
        "أنشئ أو انتظر طلب تحصيل مخصصا لعملية واحدة",
        "حوّل بالشبكة والمبلغ والعنوان المخصص المحدد في الطلب",
        "أرسل txHash وانتظر التأكيد؛ الحالات غير المطابقة تدخل مراجعة مستقلة",
        "بعد المطابقة تحول محفظة الشركة الخارجية الأموال إلى حساب العميل الشخصي لدى الوسيط",
        "تظهر الحالة مكتملة بعد القيد الفعلي لدى الوسيط، وتظهر الاستردادات أو عدم القيد كاستثناء",
      ]
    : [
        "Create or wait for a single-use dedicated collection order",
        "Transfer using the network, amount and dedicated address shown on that order",
        "Submit the txHash and await confirmation; mismatches enter independent review",
        "After reconciliation, an external company wallet forwards funds to the client's own broker account",
        "Completion appears after broker credit; refunds or missing credit remain exceptions",
      ];
}

export function getBrokerFundingWarnings(
  language: AppLanguage,
): readonly string[] {
  if (language === "zh") return BROKER_FUNDING_WARNINGS;
  return language === "ar"
    ? [
        "يجب أن تطابق الشبكة تعليمات الوسيط الحالية تماما؛ قد يتعذر استرداد التحويل عبر شبكة خاطئة.",
        "لا تعِد استخدام عنوان أو رمز QR أو وسم قديم؛ احصل على التعليمات من بوابة الوسيط لكل إيداع.",
        "النقص أو الزيادة أو التأخير أو عدم القيد أو غياب الوسم يدخل مراجعة يدوية ولا يعني اكتمال الإيداع.",
        "إرسال txHash مجرد إقرار؛ لا تكتمل العملية إلا بعد القيد الفعلي لدى الوسيط والتحقق الإداري.",
      ]
    : [
        "The network must exactly match the broker's current instruction; a wrong-chain transfer may be unrecoverable.",
        "Never reuse an old address, QR code or tag. Retrieve fresh instructions for every deposit.",
        "Underpayment, overpayment, delay, missing credit or a missing tag enters manual review and is not a completed deposit.",
        "Submitting a txHash is only a declaration. Completion requires actual broker credit and operational verification.",
      ];
}

export function brokerById(id: AllianceBrokerId) {
  return ALLIANCE_BROKERS.find((broker) => broker.id === id)!;
}

export function onboardingModeLabel(
  mode: OnboardingMode,
  language: AppLanguage = "zh",
) {
  return (
    getOnboardingOptions(language).find((option) => option.id === mode)
      ?.title ??
    (language === "ar"
      ? "غير محدد"
      : language === "en"
        ? "Not selected"
        : "未选择")
  );
}

export function fundingPathLabel(
  path: FundingPath,
  language: AppLanguage = "zh",
) {
  return (
    getFundingPathOptions(language).find((option) => option.id === path)
      ?.title ??
    (language === "ar"
      ? "غير محدد"
      : language === "en"
        ? "Not selected"
        : "未选择")
  );
}
