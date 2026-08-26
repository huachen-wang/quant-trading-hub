import type { AppLanguage } from "@/lib/language";
import type {
  ContentBlock,
  CoreStrategy,
  PlatformProfile,
  ServiceAccount,
} from "@/shared/v2/contracts";

type StrategyCopy = Pick<
  CoreStrategy,
  "name" | "shortName" | "version" | "tagline" | "description" | "style"
>;

const ENGLISH_STRATEGY_COPY: Record<string, StrategyCopy> = {
  "jingge-v51": {
    name: "Iron Cavalry V5.1",
    shortName: "Iron Cavalry",
    version: "V5.1 Risk-Controlled",
    tagline: "Gold trend · Dynamic risk budget",
    description:
      "Builds positions in stages after trend confirmation and caps exposure with an account-level risk budget.",
    style: "Gold trend and drawdown control",
  },
  "night-hunter": {
    name: "Night Hunter Pro",
    shortName: "Night Hunter",
    version: "R3.8",
    tagline: "Night session · Short-cycle execution",
    description:
      "Targets short-cycle volatility across the European and US overlap, with an emphasis on execution quality and fast exits.",
    style: "Night-session short-term execution",
  },
  "quantum-queen": {
    name: "Quantum Queen X",
    shortName: "Quantum Queen",
    version: "V4.3",
    tagline: "Multi-factor signals · Portfolio filters",
    description:
      "Uses multi-timeframe filters to form portfolio signals and reduce single-indicator momentum chasing.",
    style: "Multi-factor adaptive model",
  },
  "gold-reaper": {
    name: "The Gold Reaper",
    shortName: "Gold Reaper",
    version: "V4.5",
    tagline: "Key levels · Breakout follow-through",
    description:
      "Enters after key market structure is confirmed and uses time-based exits to reduce overnight exposure.",
    style: "Gold breakout trend-following",
  },
  "black-aura": {
    name: "Aura Black Edition",
    shortName: "Black Aura",
    version: "V2.6",
    tagline: "Order flow · Volatility filters",
    description:
      "Filters opportunities with liquidity structure and volatility thresholds, focusing on trend continuation.",
    style: "Order flow and structure breakout",
  },
  "bitcoin-core": {
    name: "Bitcoin Core Quant",
    shortName: "Bitcoin Core",
    version: "V1.9",
    tagline: "Digital assets · Layered volatility",
    description:
      "Responds by tier to high-volatility digital-asset regimes while preserving a separate risk budget.",
    style: "Digital-asset volatility management",
  },
};

const ARABIC_STRATEGY_COPY: Record<string, StrategyCopy> = {
  "jingge-v51": {
    name: "Iron Cavalry V5.1",
    shortName: "Iron Cavalry",
    version: "V5.1 بضوابط مخاطر",
    tagline: "اتجاه الذهب · ميزانية مخاطر ديناميكية",
    description:
      "يبني المراكز على مراحل بعد تأكيد الاتجاه ويحد من الانكشاف عبر ميزانية مخاطر على مستوى الحساب.",
    style: "اتجاه الذهب والتحكم في التراجع",
  },
  "night-hunter": {
    name: "Night Hunter Pro",
    shortName: "Night Hunter",
    version: "R3.8",
    tagline: "الجلسة الليلية · تنفيذ قصير الدورة",
    description:
      "يستهدف تقلبات الفترات القصيرة خلال تداخل الجلستين الأوروبية والأمريكية مع التركيز على جودة التنفيذ والخروج السريع.",
    style: "تنفيذ قصير الأجل في الجلسة الليلية",
  },
  "quantum-queen": {
    name: "Quantum Queen X",
    shortName: "Quantum Queen",
    version: "V4.3",
    tagline: "إشارات متعددة العوامل · مرشحات للمحفظة",
    description:
      "يستخدم مرشحات متعددة الأطر الزمنية لبناء إشارات المحفظة وتقليل الاعتماد على مؤشر واحد.",
    style: "نموذج تكيفي متعدد العوامل",
  },
  "gold-reaper": {
    name: "The Gold Reaper",
    shortName: "Gold Reaper",
    version: "V4.5",
    tagline: "مستويات رئيسية · متابعة الاختراق",
    description:
      "يدخل بعد تأكيد بنية السوق الرئيسية ويستخدم خروجا زمنيا لتقليل الانكشاف الليلي.",
    style: "متابعة اختراقات الذهب",
  },
  "black-aura": {
    name: "Aura Black Edition",
    shortName: "Black Aura",
    version: "V2.6",
    tagline: "تدفق الأوامر · مرشحات التقلب",
    description:
      "يرشح الفرص عبر بنية السيولة وحدود التقلب مع التركيز على استمرار الاتجاه.",
    style: "تدفق الأوامر واختراق البنية",
  },
  "bitcoin-core": {
    name: "Bitcoin Core Quant",
    shortName: "Bitcoin Core",
    version: "V1.9",
    tagline: "الأصول الرقمية · تقلب متعدد الطبقات",
    description:
      "يستجيب على طبقات لبيئات التقلب المرتفع في الأصول الرقمية مع ميزانية مخاطر مستقلة.",
    style: "إدارة تقلب الأصول الرقمية",
  },
};

const ENGLISH_PLATFORM_COPY: Record<
  string,
  Pick<PlatformProfile, "entity" | "regionLabel" | "summary"> & {
    spreadLabel: string;
    commissionLabel: string;
    rebateLabel: string;
    rebateEligibility: string;
  }
> = {
  "atlas-prime": {
    entity: "Demo Platform A",
    regionLabel: "Availability pending verification",
    summary: "Optimized for low-latency execution and short-term gold trading.",
    spreadLabel: "XAUUSD demo median: 16 pts",
    commissionLabel: "Demo: USD 7 / lot",
    rebateLabel: "Commercial terms pending",
    rebateEligibility: "Referral, region and volume must be verified",
  },
  meridian: {
    entity: "Demo Platform B",
    regionLabel: "Availability pending verification",
    summary: "Designed for multi-asset coverage and stable trading costs.",
    spreadLabel: "Major pairs demo median: 11 pts",
    commissionLabel: "Demo: USD 6 / lot",
    rebateLabel: "Tiered terms pending",
    rebateEligibility: "Verified by account type and monthly volume",
  },
  vertex: {
    entity: "Demo Platform C",
    regionLabel: "Availability pending verification",
    summary: "Designed for MT5, multiple assets and independent risk buckets.",
    spreadLabel: "Costs verified by instrument",
    commissionLabel: "Demo: USD 5.5 / lot",
    rebateLabel: "Portfolio account terms pending",
    rebateEligibility: "Available to designated account entities only",
  },
};

const ARABIC_PLATFORM_COPY: typeof ENGLISH_PLATFORM_COPY = {
  "atlas-prime": {
    entity: "منصة تجريبية A",
    regionLabel: "التوفر الإقليمي قيد التحقق",
    summary: "مهيأة للتنفيذ منخفض التأخير وتداول الذهب قصير الأجل.",
    spreadLabel: "متوسط XAUUSD التجريبي: 16 نقطة",
    commissionLabel: "تجريبي: 7 USD لكل لوت",
    rebateLabel: "الشروط التجارية قيد التأكيد",
    rebateEligibility: "يجب التحقق من الإحالة والمنطقة وحجم التداول",
  },
  meridian: {
    entity: "منصة تجريبية B",
    regionLabel: "التوفر الإقليمي قيد التحقق",
    summary: "مصممة لتغطية أصول متعددة وتكاليف تداول مستقرة.",
    spreadLabel: "متوسط الأزواج الرئيسية التجريبي: 11 نقطة",
    commissionLabel: "تجريبي: 6 USD لكل لوت",
    rebateLabel: "الشروط المتدرجة قيد التأكيد",
    rebateEligibility: "يتم التحقق حسب نوع الحساب وحجم التداول الشهري",
  },
  vertex: {
    entity: "منصة تجريبية C",
    regionLabel: "التوفر الإقليمي قيد التحقق",
    summary: "مصممة لـ MT5 والأصول المتعددة وحاويات المخاطر المستقلة.",
    spreadLabel: "يتم التحقق من التكلفة حسب الأصل",
    commissionLabel: "تجريبي: 5.5 USD لكل لوت",
    rebateLabel: "شروط حساب المحفظة قيد التأكيد",
    rebateEligibility: "متاح لكيانات الحساب المحددة فقط",
  },
};

export function localizeStrategy(
  strategy: CoreStrategy,
  language: AppLanguage,
): CoreStrategy {
  if (language === "zh") return strategy;
  const copy = (
    language === "ar" ? ARABIC_STRATEGY_COPY : ENGLISH_STRATEGY_COPY
  )[strategy.id];
  if (!copy) return strategy;
  const localized = { ...strategy, ...copy };
  return {
    ...localized,
    contentBlocks: localizeFallbackContentBlocks(strategy, localized, language),
  };
}

function localizeFallbackContentBlocks(
  source: CoreStrategy,
  localized: CoreStrategy,
  language: Exclude<AppLanguage, "zh">,
): ContentBlock[] {
  return source.contentBlocks.map((block) => {
    if (isFallbackOverview(block, source)) {
      const risk =
        source.riskLevel === "LOW"
          ? language === "ar"
            ? "منخفض"
            : "Low"
          : source.riskLevel === "MEDIUM"
            ? language === "ar"
              ? "متوسط"
              : "Medium"
            : language === "ar"
              ? "مرتفع"
              : "High";
      return {
        ...block,
        heading: language === "ar" ? "منطق الاستراتيجية" : "Strategy logic",
        paragraphs:
          language === "ar"
            ? [
                `يبني ${localized.name} قواعد الإشارة والتنفيذ والخروج حول ${localized.style}. يوضح هذا الملف بنية الاستراتيجية وربط البيانات التجريبية.`,
                `الأصول الأولية: ${localized.instruments.join(" / ")}. يجب إعادة معايرة المعايير حسب فروق المنصة وجلسات التداول ورأس مال الحساب قبل التشغيل الحي.`,
              ]
            : [
                `${localized.name} builds signal, execution and exit rules around ${localized.style}. This profile demonstrates the strategy structure and demo data integration.`,
                `Initial instruments: ${localized.instruments.join(" / ")}. Before live use, recalibrate parameters for platform spreads, trading sessions and account capital.`,
              ],
        bullets:
          language === "ar"
            ? [
                `رأس المال المقترح: ${source.minimumCapital.toLocaleString("ar-AE")} USD`,
                `مستوى المخاطر: ${risk}`,
                `المنصات التقنية: ${source.terminals.join(" / ")}`,
              ]
            : [
                `Suggested capital: USD ${source.minimumCapital.toLocaleString("en-US")}`,
                `Risk level: ${risk}`,
                `Compatible terminals: ${source.terminals.join(" / ")}`,
              ],
      };
    }

    if (isFallbackEvidence(block, source)) {
      return {
        ...block,
        heading:
          language === "ar" ? "المنهجية والأدلة" : "Methodology and evidence",
        items: [
          {
            ...block.items[0],
            title:
              language === "ar" ? "مسار بيانات الحقوق" : "Equity data pipeline",
            detail:
              language === "ar"
                ? "يُعرض حاليا منحنى تجريبي ثابت. عند ربط Quant Data Core سيُستبدل بلقطات حساب موقعة المصدر."
                : "A deterministic demo curve is shown now. Once Quant Data Core is connected, it will be replaced by source-signed account snapshots.",
          },
          {
            ...block.items[1],
            title:
              language === "ar"
                ? "مراجعة الإصدار والمعايير"
                : "Version and parameter review",
            detail:
              language === "ar"
                ? `بانتظار رفع قائمة معايير ${localized.version} ومراجعة توافق المنصات قبل النشر.`
                : `The ${localized.version} parameter sheet awaits operator upload and platform compatibility review before release.`,
          },
        ],
      };
    }

    if (isFallbackGallery(block, source)) {
      const titles =
        language === "ar"
          ? ["تصور الاستراتيجية", "هيكل التنفيذ", "مراجعة المخاطر"]
          : ["Strategy visual", "Execution structure", "Risk review"];
      const captions =
        language === "ar"
          ? [
              `الهوية البصرية وسياق التداول الأساسي لـ ${localized.shortName}.`,
              `يوضح العلاقة بين الإشارات والتنفيذ في ${localized.style}.`,
              "مادة تجريبية يمكن استبدالها بلقطات حساب حية أو شرح للمعايير أو وثائق تحقق.",
            ]
          : [
              `${localized.shortName}'s visual identity and primary trading context.`,
              `Explains the relationship between signals and execution in ${localized.style}.`,
              "Demo material that can be replaced by live account screenshots, parameter notes or verification documents.",
            ];
      return {
        ...block,
        heading: language === "ar" ? "مواد الاستراتيجية" : "Strategy materials",
        items: block.items.map((item, index) => ({
          ...item,
          title:
            titles[index] ??
            (language === "ar" ? `مادة ${index + 1}` : `Material ${index + 1}`),
          caption:
            captions[index] ??
            (language === "ar" ? "مادة توضيحية." : "Strategy material."),
          alt: `${localized.shortName} ${
            titles[index] ??
            (language === "ar" ? `مادة ${index + 1}` : `material ${index + 1}`)
          }`,
        })),
      };
    }

    if (isFallbackTimeline(block)) {
      return {
        ...block,
        heading: language === "ar" ? "تقدم المراجعة" : "Review progress",
        items:
          language === "ar"
            ? [
                {
                  date: "المرحلة 01",
                  title: "تنسيق العينات التاريخية",
                  detail:
                    "توحيد الأصول والمناطق الزمنية والتكاليف وعلامات الأوامر غير الطبيعية.",
                },
                {
                  date: "المرحلة 02",
                  title: "ربط تجريبي",
                  detail:
                    "التحقق من حالات العرض وتحديث المنحنى وربط الحسابات وتنبيهات المخاطر.",
                },
                {
                  date: "المرحلة 03",
                  title: "مراجعة الحساب الحي",
                  detail:
                    "لا تتحول الحالة إلى LIVE إلا بعد ربط مصدر بيانات قابل للتحقق.",
                },
              ]
            : [
                {
                  date: "Stage 01",
                  title: "Normalize historical samples",
                  detail:
                    "Standardize instruments, time zones, costs and anomalous-order flags.",
                },
                {
                  date: "Stage 02",
                  title: "Demo integration",
                  detail:
                    "Validate display states, curve refresh, account mapping and risk notices.",
                },
                {
                  date: "Stage 03",
                  title: "Live review",
                  detail:
                    "The status can switch to LIVE only after a verifiable data source is connected.",
                },
              ],
      };
    }

    if (isFallbackRiskNotice(block)) {
      return {
        ...block,
        heading: language === "ar" ? "حدود المخاطر" : "Risk boundary",
        content:
          language === "ar"
            ? "لا تمثل العوائد أو نسب الفوز أو التراجعات التاريخية نتائج مستقبلية. قد تؤدي الرافعة والسيولة والانزلاق وقواعد المنصة وانحراف المعايير إلى خسائر تتجاوز النموذج."
            : "Historical returns, win rates and drawdowns do not predict future results. Leverage, liquidity, slippage, platform rules and parameter drift may create losses beyond the model.",
      };
    }

    if (isFallbackFaq(block)) {
      return {
        ...block,
        heading:
          language === "ar" ? "الأسئلة الشائعة" : "Frequently asked questions",
        items:
          language === "ar"
            ? [
                {
                  question: "هل يمكن ربط حساب حقيقي مباشرة؟",
                  answer:
                    "تنشئ المعاينة الحالية الخطة وخطوات الربط فقط ولا تنفذ أوامر أو تعيد توزيع المراكز تلقائيا. يتطلب الربط الفعلي تفويض الحساب وتأكيد المخاطر.",
                },
                {
                  question: "هل العوائد المعروضة حقيقية؟",
                  answer:
                    "لا. البيانات الموسومة DEMO مخصصة لمراجعة المنتج، ولا تظهر LIVE إلا بعد ربط مصدر البيانات والتحقق منه.",
                },
              ]
            : [
                {
                  question: "Can I connect a live account directly?",
                  answer:
                    "The current preview generates a plan and integration steps only. It does not place orders or rebalance automatically. A live connection requires account authorization and risk confirmation.",
                },
                {
                  question: "Are the displayed returns live returns?",
                  answer:
                    "No. Data marked DEMO is for product review. LIVE appears only after a data source is connected and verified.",
                },
              ],
      };
    }

    return block;
  });
}

function isFallbackOverview(
  block: ContentBlock,
  strategy: CoreStrategy,
): block is Extract<ContentBlock, { type: "rich_text" }> {
  return (
    block.type === "rich_text" &&
    block.heading === "策略逻辑" &&
    block.paragraphs[0] ===
      `${strategy.name}围绕${strategy.style}建立信号、执行与退出规则，当前页面用于展示策略结构和模拟数据接入方式。`
  );
}

function isFallbackEvidence(
  block: ContentBlock,
  strategy: CoreStrategy,
): block is Extract<ContentBlock, { type: "evidence" }> {
  return (
    block.type === "evidence" &&
    block.heading === "说明与证据" &&
    block.items.length === 2 &&
    block.items[0]?.title === "净值数据链路" &&
    block.items[1]?.detail ===
      `${strategy.version} 参数清单等待运营上传，发布前需完成兼容平台复核。`
  );
}

function isFallbackGallery(
  block: ContentBlock,
  strategy: CoreStrategy,
): block is Extract<ContentBlock, { type: "media_gallery" }> {
  return (
    block.type === "media_gallery" &&
    block.heading === "策略资料" &&
    block.items[0]?.caption ===
      `${strategy.shortName}的视觉识别与核心交易场景。`
  );
}

function isFallbackTimeline(
  block: ContentBlock,
): block is Extract<ContentBlock, { type: "timeline" }> {
  return (
    block.type === "timeline" &&
    block.heading === "观察进度" &&
    block.items[0]?.title === "历史样本整理"
  );
}

function isFallbackRiskNotice(
  block: ContentBlock,
): block is Extract<ContentBlock, { type: "risk_notice" }> {
  return (
    block.type === "risk_notice" &&
    block.heading === "风险边界" &&
    block.content ===
      "任何历史收益、胜率和回撤都不能代表未来结果。杠杆、流动性、滑点、平台规则和参数偏离均可能造成超出模型的损失。"
  );
}

function isFallbackFaq(
  block: ContentBlock,
): block is Extract<ContentBlock, { type: "faq" }> {
  return (
    block.type === "faq" &&
    block.heading === "常见问题" &&
    block.items[0]?.question === "可以直接连接真实账户吗？"
  );
}

export function localizeStrategies(
  strategies: CoreStrategy[],
  language: AppLanguage,
) {
  return strategies.map((strategy) => localizeStrategy(strategy, language));
}

export function localizePlatform(
  platform: PlatformProfile,
  language: AppLanguage,
): PlatformProfile {
  if (language === "zh") return platform;
  const copy = (
    language === "ar" ? ARABIC_PLATFORM_COPY : ENGLISH_PLATFORM_COPY
  )[platform.id];
  if (!copy) return platform;
  return {
    ...platform,
    entity: copy.entity,
    regionLabel: copy.regionLabel,
    summary: copy.summary,
    commercialTerms: {
      ...platform.commercialTerms,
      spreadLabel: copy.spreadLabel,
      commissionLabel: copy.commissionLabel,
      rebateLabel: copy.rebateLabel,
      rebateEligibility: copy.rebateEligibility,
    },
  };
}

export function localizePlatforms(
  platforms: PlatformProfile[],
  language: AppLanguage,
) {
  return platforms.map((platform) => localizePlatform(platform, language));
}

export function localizeAccount(
  account: ServiceAccount,
  language: AppLanguage,
): ServiceAccount {
  if (language === "zh") return account;
  const names: Record<string, { en: string; ar: string }> = {
    "managed-demo-01": {
      en: "Managed Account Monitor",
      ar: "حساب الإدارة المفوضة",
    },
    "self-demo-01": {
      en: "Broker Mode Demo Account",
      ar: "حساب تجريبي لنمط الوسيط",
    },
  };
  const name = names[account.id]?.[language];
  return name ? { ...account, name } : account;
}
