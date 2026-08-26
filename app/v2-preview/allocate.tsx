import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { formatUsdt } from "@/components/v2/format";
import { allocateCapitalByWeights } from "@/components/v2/configurator/allocation-amount";
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import {
  ALLIANCE_BROKERS,
  fundingPathLabel,
  getAllianceBrokers,
  getAssistedFundingSteps,
  getBrokerFundingSteps,
  getBrokerFundingWarnings,
  getRiskOptions,
  onboardingModeLabel,
  type AllianceBrokerId,
  type FundingPath,
  type OnboardingMode,
  type RiskProfile,
} from "@/components/v2/configurator/types";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { useLanguage, type AppLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import { localizeStrategies } from "@/lib/v2/localized-content";
import {
  ALLIANCE_STRATEGY_IDS,
  isFundingTxHashValid,
  type BrokerFundingNetwork,
} from "@/shared/managed-sessions/contracts";

const NETWORK_LABELS: Record<BrokerFundingNetwork, string> = {
  TRON: "TRON",
  ETHEREUM: "Ethereum",
  BSC: "BSC",
  ARBITRUM: "Arbitrum",
  POLYGON: "Polygon",
  SOLANA: "Solana",
  OTHER: "Other",
};

const RISK_MAP = {
  LOW: "CONSERVATIVE",
  MEDIUM: "BALANCED",
  HIGH: "AGGRESSIVE",
} as const;

export default function AllocationPage() {
  const params = useLocalSearchParams<{
    strategyIds?: string;
    brokerIds?: string;
    capital?: string;
    risk?: string;
    onboardingMode?: string;
    fundsRoute?: string;
  }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { language, locale, text } = useLanguage();
  const isMobile = width < 820;
  const [activeSlotKey, setActiveSlotKey] = useState("");
  const [activeIntentNo, setActiveIntentNo] = useState("");
  const [txHash, setTxHash] = useState("");
  const [declaredAmount, setDeclaredAmount] = useState(
    normalizeAmount(params.capital),
  );
  const [confirmedAddress, setConfirmedAddress] = useState(false);
  const [confirmedNetwork, setConfirmedNetwork] = useState(false);
  const [payerWalletAddress, setPayerWalletAddress] = useState("");
  const [payerOwnershipAttested, setPayerOwnershipAttested] = useState(false);
  const [lateTransferAttested, setLateTransferAttested] = useState(false);
  const [clockMs, setClockMs] = useState(Date.now);
  const [brokerWeightOverrides, setBrokerWeightOverrides] = useState<
    Record<string, string>
  >({});
  const [strategyWeightOverrides, setStrategyWeightOverrides] = useState<
    Record<string, string>
  >({});

  const strategiesQuery = trpc.v2.strategies.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  const capabilities = trpc.v2.managedSessions.capabilities.useQuery(
    undefined,
    {
      staleTime: 60_000,
    },
  );
  const createSession = trpc.v2.managedSessions.create.useMutation();
  const submitSession = trpc.v2.managedSessions.submit.useMutation();
  const createIntent =
    trpc.v2.managedSessions.createFundingIntent.useMutation();
  const submitIntent =
    trpc.v2.managedSessions.submitFundingIntent.useMutation();
  const submitTransaction =
    trpc.v2.managedSessions.submitFundingTransaction.useMutation();

  const onboardingMode: OnboardingMode =
    params.onboardingMode === "PLATFORM_ASSISTED"
      ? "PLATFORM_ASSISTED"
      : "SELF_OPENED";
  const requestedFundingPath: FundingPath =
    params.fundsRoute === "PLATFORM_COLLECTION"
      ? "PLATFORM_COLLECTION"
      : "BROKER_DIRECT";
  const fundingPath: FundingPath =
    onboardingMode === "PLATFORM_ASSISTED"
      ? requestedFundingPath
      : "BROKER_DIRECT";
  const riskProfile: RiskProfile =
    params.risk === "LOW" || params.risk === "HIGH" ? params.risk : "MEDIUM";
  const capital = normalizeAmount(params.capital);
  const requestedBrokerIds = useMemo(
    () =>
      Array.from(
        new Set((params.brokerIds?.split(",") ?? []).filter(isBrokerId)),
      ),
    [params.brokerIds],
  );
  const brokerIds = requestedBrokerIds.length
    ? requestedBrokerIds
    : (["exness"] as AllianceBrokerId[]);
  const allianceBrokers = getAllianceBrokers(language);
  const brokers = allianceBrokers.filter((broker) =>
    brokerIds.includes(broker.id),
  );
  const autoBrokerWeights = distributeWeights(brokers.length);
  const brokerWeights = brokers.map((broker, index) =>
    Number(brokerWeightOverrides[broker.id] ?? autoBrokerWeights[index]),
  );
  const brokerWeightTotal = brokerWeights.reduce(
    (total, weight) => total + (Number.isFinite(weight) ? weight : 0),
    0,
  );
  const brokerWeightsValid = Math.abs(brokerWeightTotal - 100) < 0.01;
  const requestedStrategyIds = useMemo(
    () =>
      Array.from(
        new Set(
          (params.strategyIds?.split(",") ?? [])
            .map((value) => value.trim())
            .filter(isAllianceStrategyId),
        ),
      ),
    [params.strategyIds],
  );
  const localizedStrategies = localizeStrategies(
    strategiesQuery.data ?? [],
    language,
  );
  const selectedStrategies =
    localizedStrategies.filter((strategy) =>
      requestedStrategyIds.length
        ? isAllianceStrategyId(strategy.id) &&
          requestedStrategyIds.includes(strategy.id)
        : ["jingge-v51", "quantum-queen", "black-aura"].includes(strategy.id),
    ) ?? [];
  const riskOptions = getRiskOptions(language);
  const autoStrategyWeights = distributeWeights(selectedStrategies.length);
  const strategyWeights = selectedStrategies.map((strategy, index) =>
    Number(strategyWeightOverrides[strategy.id] ?? autoStrategyWeights[index]),
  );
  const strategyWeightTotal = strategyWeights.reduce(
    (total, weight) => total + (Number.isFinite(weight) ? weight : 0),
    0,
  );
  const strategyWeightsValid =
    selectedStrategies.length > 0 &&
    strategyWeights.every((weight) => weight > 0 && weight <= 100) &&
    Math.abs(strategyWeightTotal - 100) < 0.01;
  const capabilityBrokers = (
    capabilities.data as
      | {
          brokers?: {
            id: string;
            collectionApproval?:
              | "NOT_APPROVED"
              | "PENDING"
              | "APPROVED"
              | "SUSPENDED";
            collectionOperational?: boolean;
          }[];
        }
      | undefined
  )?.brokers;
  const collectionApproved = brokerIds.every(
    (id) =>
      capabilityBrokers?.find((broker) => broker.id === id)
        ?.collectionOperational === true,
  );
  const usdtOperationsReady = capabilities.data?.usdtOperationsReady === true;

  const plan = submitSession.data ?? createSession.data;
  const sessionNo = plan?.sessionNo ?? "";
  const executionSlots = plan?.executionSlots ?? [];
  const effectiveSlotKey = activeSlotKey || executionSlots[0]?.slotKey || "";
  const slotFundingAmounts = allocateCapitalByWeights(
    capital,
    executionSlots.map(
      (slot: { capitalWeightPct: number }) => slot.capitalWeightPct,
    ),
  );
  const activeSlotIndex = executionSlots.findIndex(
    (slot: { slotKey: string }) => slot.slotKey === effectiveSlotKey,
  );
  const activeExpectedAmount = slotFundingAmounts[activeSlotIndex] ?? capital;
  const fundingIntents = trpc.v2.managedSessions.fundingIntents.useQuery(
    { sessionNo },
    { enabled: Boolean(sessionNo), staleTime: 2_000 },
  );
  const slotIntent = fundingIntents.data?.find(
    (intent) => intent.slotKey === effectiveSlotKey,
  );
  const newlyCreatedIntent =
    createIntent.data?.slotKey === effectiveSlotKey
      ? createIntent.data
      : undefined;
  const effectiveIntentNo =
    activeIntentNo ||
    slotIntent?.intentNo ||
    newlyCreatedIntent?.intentNo ||
    "";
  const intentQuery = trpc.v2.managedSessions.fundingIntent.useQuery(
    { sessionNo, intentNo: effectiveIntentNo },
    {
      enabled: Boolean(sessionNo && effectiveIntentNo),
      staleTime: 1_500,
      refetchInterval: 5_000,
    },
  );
  const intent = intentQuery.data ?? slotIntent ?? newlyCreatedIntent;
  const network = intent?.network as BrokerFundingNetwork | null | undefined;
  const instructionExpiresAt = intent?.instructionsExpireAt
    ? new Date(intent.instructionsExpireAt).getTime()
    : Number.NaN;
  const instructionExpired =
    intent?.status === "READY_TO_FUND" &&
    (!Number.isFinite(instructionExpiresAt) || instructionExpiresAt <= clockMs);
  useEffect(() => {
    if (!intent?.instructionsExpireAt) return;
    setClockMs(Date.now());
    const timer = setInterval(() => setClockMs(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [intent?.instructionsExpireAt]);
  useEffect(() => {
    setLateTransferAttested(false);
  }, [intent?.intentNo]);
  const canSubmitTx =
    intent?.status === "READY_TO_FUND" &&
    Boolean(network) &&
    isFundingTxHashValid(txHash, network!) &&
    Number(declaredAmount) > 0 &&
    confirmedAddress &&
    confirmedNetwork &&
    (!instructionExpired || lateTransferAttested) &&
    (fundingPath === "BROKER_DIRECT" ||
      (payerWalletAddress.trim().length >= 8 && payerOwnershipAttested));
  const routeGateOpen =
    usdtOperationsReady &&
    (fundingPath === "BROKER_DIRECT" || collectionApproved);

  if (strategiesQuery.isLoading)
    return (
      <V2LoadingState
        label={text(
          "正在准备六策略资管方案",
          "Preparing your six-strategy managed plan",
          "جارٍ إعداد خطة الإدارة المكونة من ست استراتيجيات",
        )}
      />
    );
  if (!strategiesQuery.data) {
    return (
      <V2ErrorState
        title={text(
          "策略资料不可用",
          "Strategy data unavailable",
          "بيانات الاستراتيجية غير متاحة",
        )}
        detail={
          strategiesQuery.error?.message ||
          text(
            "暂时无法读取六策略。",
            "The six strategies cannot be loaded right now.",
            "يتعذر تحميل الاستراتيجيات الست حالياً.",
          )
        }
        onRetry={() => strategiesQuery.refetch()}
      />
    );
  }

  const createAlliancePlan = () => {
    if (!selectedStrategies.length || !strategyWeightsValid || !brokers.length)
      return;
    createSession.mutate(
      {
        onboardingMode,
        fundsRoute: fundingPath,
        targetCapital: capital,
        settlementAsset: "USDT",
        riskProfile: RISK_MAP[riskProfile],
        maxDrawdownPct: riskOptions.find((item) => item.id === riskProfile)!
          .drawdown,
        strategies: selectedStrategies.map((strategy, index) => ({
          strategyId: strategy.id as (typeof ALLIANCE_STRATEGY_IDS)[number],
          weightPct: strategyWeights[index],
          riskMultiplier: 1,
        })),
        executionSlots: brokers.map((broker, index) => ({
          brokerId: broker.id,
          label: `${broker.name} ${text(
            "客户本人账户",
            "client-owned account",
            "حساب مملوك للعميل",
          )}`,
          capitalWeightPct: brokerWeights[index],
        })),
      },
      {
        onSuccess: (session) =>
          setActiveSlotKey(session.executionSlots[0]?.slotKey ?? ""),
      },
    );
  };

  const submitAlliancePlan = () => {
    if (!sessionNo) return;
    submitSession.mutate(
      { sessionNo },
      {
        onSuccess: (session) =>
          setActiveSlotKey(session.executionSlots[0]?.slotKey ?? ""),
      },
    );
  };

  const createFundingInstruction = () => {
    if (!sessionNo || !effectiveSlotKey || !routeGateOpen) return;
    createIntent.mutate(
      {
        sessionNo,
        slotKey: effectiveSlotKey,
        expectedAmount: activeExpectedAmount,
      },
      {
        onSuccess: (nextIntent) => {
          setActiveIntentNo(nextIntent.intentNo);
          setDeclaredAmount(activeExpectedAmount);
          void fundingIntents.refetch();
        },
      },
    );
  };

  const submitFundingRequest = () => {
    if (!sessionNo || !effectiveIntentNo) return;
    submitIntent.mutate(
      { sessionNo, intentNo: effectiveIntentNo },
      { onSuccess: () => void intentQuery.refetch() },
    );
  };

  const submitTx = () => {
    if (!canSubmitTx || !sessionNo || !effectiveIntentNo) return;
    submitTransaction.mutate(
      {
        sessionNo,
        intentNo: effectiveIntentNo,
        txHash: txHash.trim(),
        declaredAmount,
        payerWalletAddress:
          fundingPath === "PLATFORM_COLLECTION"
            ? payerWalletAddress.trim()
            : undefined,
        payerOwnershipAttested:
          fundingPath === "PLATFORM_COLLECTION"
            ? payerOwnershipAttested
            : false,
      },
      {
        onSuccess: () => {
          setTxHash("");
          setConfirmedAddress(false);
          setConfirmedNetwork(false);
          setPayerWalletAddress("");
          setPayerOwnershipAttested(false);
          void intentQuery.refetch();
          void fundingIntents.refetch();
        },
      },
    );
  };

  const fundingSteps =
    fundingPath === "PLATFORM_COLLECTION"
      ? getAssistedFundingSteps(language)
      : getBrokerFundingSteps(language);
  const activeBroker = brokers.find((broker) => broker.id === intent?.brokerId);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={17} color={V2.textMuted} />
          <Text style={styles.backText}>
            {text(
              "返回方案选配",
              "Back to plan builder",
              "العودة إلى بناء الخطة",
            )}
          </Text>
        </Pressable>

        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>
              {text(
                "AI量化联盟 · 资管接入",
                "AI QUANT ALLIANCE · MANAGED ONBOARDING",
                "تحالف الذكاء الاصطناعي الكمي · الانضمام للإدارة",
              )}
            </Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              {text(
                "开户、交易授权与 USDT 入金",
                "Broker onboarding, trade access and USDT funding",
                "فتح حساب الوسيط وصلاحية التداول والإيداع بعملة USDT",
              )}
            </Text>
            <Text style={styles.subtitle}>
              {text(
                "先保存普通资管方案，再为每个客户本人券商账户创建独立入金单。页面不会把草案、txHash 申报或链上确认误写成券商已到账。",
                "Save the managed plan first, then create a separate funding order for each client-owned broker account. A draft, txHash submission or on-chain confirmation is never presented as broker credit.",
                "احفظ خطة الإدارة أولاً، ثم أنشئ أمر إيداع مستقلاً لكل حساب وسيط يملكه العميل. لا تُعرض المسودة أو معاملة txHash أو التأكيد على السلسلة على أنها رصيد وصل إلى الوسيط.",
              )}
            </Text>
          </View>
          <View style={styles.boundaryCard}>
            <MaterialIcons name="shield" size={21} color={V2.green} />
            <View style={styles.boundaryCopy}>
              <Text style={styles.boundaryTitle}>
                {text(
                  "交易权不含提款权",
                  "Trading access excludes withdrawals",
                  "صلاحية التداول لا تشمل السحب",
                )}
              </Text>
              <Text style={styles.boundaryText}>
                {text(
                  "客户本人持有券商账户；项目方只申请约定交易权限，不保存出金权限、私钥或钱包助记词。",
                  "The client owns the broker account. The service requests only the agreed trading permission and never stores withdrawal access, private keys or wallet seed phrases.",
                  "يمتلك العميل حساب الوسيط. تطلب الخدمة صلاحية التداول المتفق عليها فقط، ولا تحتفظ بصلاحية السحب أو المفاتيح الخاصة أو عبارات استرداد المحفظة.",
                )}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[styles.summaryGrid, isMobile && styles.summaryGridMobile]}
        >
          <SummaryCard
            label={text("计划资金", "Planned capital", "رأس المال المخطط")}
            value={formatUsdt(Number(capital), false, locale)}
          />
          <SummaryCard
            label={text("接入方式", "Onboarding", "طريقة الانضمام")}
            value={onboardingModeLabel(onboardingMode, language)}
          />
          <SummaryCard
            label={text("入金路线", "Funding route", "مسار الإيداع")}
            value={fundingPathLabel(fundingPath, language)}
          />
          <SummaryCard
            label={text("策略组合", "Strategy mix", "مزيج الاستراتيجيات")}
            value={text(
              `已选 ${selectedStrategies.length} / 6`,
              `${selectedStrategies.length} / 6 selected`,
              `تم اختيار ${selectedStrategies.length} من 6`,
            )}
          />
        </View>

        <Section
          index="01"
          title={text(
            `所选策略权重（${selectedStrategies.length} / 6）`,
            `Strategy weights (${selectedStrategies.length} / 6)`,
            `أوزان الاستراتيجيات (${selectedStrategies.length} من 6)`,
          )}
          detail={text(
            "单个委托可选 1–6 款；所选策略权重必须合计 100%。离线或非实盘数据会保留准确标签并阻断真实启用。",
            "Choose one to six strategies per mandate. Selected weights must total 100%. Offline or non-live data remains clearly labelled and cannot be activated as live.",
            "يمكن اختيار استراتيجية واحدة إلى ست استراتيجيات لكل تفويض، ويجب أن يبلغ مجموع الأوزان 100%. تبقى البيانات غير المتصلة أو غير الحية موسومة بوضوح ولا يمكن تفعيلها كتداول حي.",
          )}
        >
          <View style={styles.brokerGrid}>
            {selectedStrategies.map((strategy, index) => (
              <View key={strategy.id} style={styles.brokerCard}>
                <View style={styles.brokerTopline}>
                  <View
                    style={[
                      styles.strategyAccent,
                      { backgroundColor: strategy.accent },
                    ]}
                  />
                  <View style={styles.brokerCopy}>
                    <Text style={styles.brokerName}>{strategy.shortName}</Text>
                    <Text style={styles.brokerMeta}>
                      {strategy.source.freshness === "OFFLINE"
                        ? text(
                            "当前离线 · 不可启用",
                            "Offline · activation unavailable",
                            "غير متصل · التفعيل غير متاح",
                          )
                        : text(
                            `${strategy.source.dataMode} · 以证据标签为准`,
                            `${strategy.source.dataMode} · verify the evidence label`,
                            `${strategy.source.dataMode} · راجع وسم الأدلة`,
                          )}
                    </Text>
                  </View>
                </View>
                <View style={styles.weightRow}>
                  <Text style={styles.weightLabel}>
                    {text("策略权重", "Strategy weight", "وزن الاستراتيجية")}
                  </Text>
                  <TextInput
                    accessibilityLabel={text(
                      `${strategy.shortName} 策略权重`,
                      `${strategy.shortName} strategy weight`,
                      `وزن استراتيجية ${strategy.shortName}`,
                    )}
                    value={String(
                      strategyWeightOverrides[strategy.id] ??
                        autoStrategyWeights[index],
                    )}
                    onChangeText={(value) => {
                      const clean = value.replace(/[^0-9.]/g, "");
                      if (!/^\d*(?:\.\d{0,2})?$/.test(clean)) return;
                      setStrategyWeightOverrides((current) => ({
                        ...current,
                        [strategy.id]: clean,
                      }));
                    }}
                    keyboardType="decimal-pad"
                    style={styles.weightInput}
                  />
                  <Text style={styles.weightUnit}>%</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.weightFooter}>
            <Text
              style={[
                styles.weightTotal,
                { color: strategyWeightsValid ? V2.green : V2.red },
              ]}
            >
              {text("合计", "Total", "المجموع")}{" "}
              {Math.round(strategyWeightTotal * 100) / 100}%
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setStrategyWeightOverrides({})}
              style={styles.equalizeButton}
            >
              <MaterialIcons name="balance" size={15} color={V2.gold} />
              <Text style={styles.equalizeText}>
                {text("自动均分", "Split equally", "توزيع بالتساوي")}
              </Text>
            </Pressable>
          </View>
        </Section>

        <Section
          index="02"
          title={text(
            `可选券商（${brokers.length} 家）`,
            `Selected brokers (${brokers.length})`,
            `الوسطاء المختارون (${brokers.length})`,
          )}
          detail={text(
            "开户与资管申请请前往对应官方站点；平台不代表券商官方背书，也不承诺地区可用性。",
            "Open accounts and request managed access on each broker's official site. This platform does not imply broker endorsement or guarantee regional availability.",
            "افتح الحساب واطلب الإدارة عبر الموقع الرسمي لكل وسيط. لا تعني هذه المنصة اعتماد الوسيط للخدمة ولا تضمن توفرها في منطقتك.",
          )}
        >
          <View style={styles.brokerGrid}>
            {brokers.map((broker) => (
              <View key={broker.id} style={styles.brokerCard}>
                <View style={styles.brokerTopline}>
                  <View style={styles.brokerCode}>
                    <Text style={styles.brokerCodeText}>{broker.code}</Text>
                  </View>
                  <View style={styles.brokerCopy}>
                    <Text style={styles.brokerName}>{broker.name}</Text>
                    <Text style={styles.brokerMeta}>
                      {text(
                        "客户本人账户",
                        "Client-owned account",
                        "حساب مملوك للعميل",
                      )}
                    </Text>
                  </View>
                </View>
                <Text style={styles.brokerDetail}>{broker.detail}</Text>
                <View style={styles.weightRow}>
                  <Text style={styles.weightLabel}>
                    {text(
                      "计划资金权重",
                      "Capital allocation",
                      "تخصيص رأس المال",
                    )}
                  </Text>
                  <TextInput
                    accessibilityLabel={text(
                      `${broker.name} 资金权重`,
                      `${broker.name} capital allocation`,
                      `تخصيص رأس المال لدى ${broker.name}`,
                    )}
                    value={String(
                      brokerWeightOverrides[broker.id] ??
                        autoBrokerWeights[brokers.indexOf(broker)],
                    )}
                    onChangeText={(value) => {
                      const clean = value.replace(/[^0-9.]/g, "");
                      if (!/^\d*(?:\.\d{0,2})?$/.test(clean)) return;
                      setBrokerWeightOverrides((current) => ({
                        ...current,
                        [broker.id]: clean,
                      }));
                    }}
                    keyboardType="decimal-pad"
                    style={styles.weightInput}
                  />
                  <Text style={styles.weightUnit}>%</Text>
                </View>
                <View style={styles.linkRow}>
                  <OfficialLink
                    label={text("开户", "Open account", "فتح حساب")}
                    url={broker.signupUrl}
                    officialLabel={text(
                      "官方站点",
                      "Official site",
                      "الموقع الرسمي",
                    )}
                  />
                  {onboardingMode === "PLATFORM_ASSISTED" ? (
                    <OfficialLink
                      label={text(
                        "资管通道说明/申请",
                        "Managed access guide",
                        "دليل طلب الإدارة",
                      )}
                      url={broker.managementUrl}
                      officialLabel={text(
                        "官方站点",
                        "Official site",
                        "الموقع الرسمي",
                      )}
                    />
                  ) : null}
                  {broker.fundingUrl ? (
                    <OfficialLink
                      label={text("入金说明", "Funding guide", "دليل الإيداع")}
                      url={broker.fundingUrl}
                      officialLabel={text(
                        "官方站点",
                        "Official site",
                        "الموقع الرسمي",
                      )}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </View>
          <View style={styles.weightFooter}>
            <Text
              style={[
                styles.weightTotal,
                { color: brokerWeightsValid ? V2.green : V2.red },
              ]}
            >
              {text("合计", "Total", "المجموع")}{" "}
              {Math.round(brokerWeightTotal * 100) / 100}%
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setBrokerWeightOverrides({})}
              style={styles.equalizeButton}
            >
              <MaterialIcons name="balance" size={15} color={V2.gold} />
              <Text style={styles.equalizeText}>
                {text("自动均分", "Split equally", "توزيع بالتساوي")}
              </Text>
            </Pressable>
          </View>
          <View style={styles.portalNotice}>
            <MaterialIcons name="info-outline" size={18} color={V2.blue} />
            <Text style={styles.portalNoticeText}>
              {text(
                "Exness 的 USDT 可用性须在客户个人专区按地区确认；IC Markets 与 Blueberry Markets 的币种、网络、限额同样以客户门户当次显示为准。禁止第三方入金的通道不得使用平台代收。",
                "Confirm regional USDT availability in the client's Exness portal. Currency, network and limit details for IC Markets and Blueberry Markets are also governed by the client's current portal display. Platform collection must not be used where third-party funding is prohibited.",
                "يجب تأكيد توفر USDT حسب المنطقة داخل بوابة عميل Exness. كما تخضع العملة والشبكة والحدود لدى IC Markets وBlueberry Markets لما يظهر في بوابة العميل وقت العملية. لا يجوز استخدام التحصيل عبر المنصة عندما يمنع الوسيط إيداع الطرف الثالث.",
              )}
            </Text>
          </View>
        </Section>

        <Section
          index="03"
          title={fundingPathLabel(fundingPath, language)}
          detail={text(
            "每次都重新获取或生成当次指令；不得复用旧地址、旧二维码或旧标签。",
            "Retrieve or generate fresh instructions for every transfer. Never reuse an old address, QR code or tag.",
            "استخرج أو أنشئ تعليمات جديدة لكل تحويل. لا تعِد استخدام عنوان أو رمز QR أو وسم قديم.",
          )}
        >
          <View style={styles.networkRow}>
            {(["TRON", "ETHEREUM", "BSC", "SOLANA"] as const).map((item) => (
              <View key={item} style={styles.networkChip}>
                <Text style={styles.networkChipText}>
                  {NETWORK_LABELS[item]}
                </Text>
              </View>
            ))}
            <Text style={styles.networkHint}>
              {text(
                "实际网络以当次券商门户/代收单为准",
                "Use only the network shown in the current broker portal or collection order",
                "استخدم فقط الشبكة الظاهرة في بوابة الوسيط أو أمر التحصيل الحالي",
              )}
            </Text>
          </View>
          <View style={styles.steps}>
            {fundingSteps.map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <View style={styles.stepIndex}>
                  <Text style={styles.stepIndexText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
          {!usdtOperationsReady ? (
            <View style={styles.gateWarning}>
              <MaterialIcons name="gpp-maybe" size={20} color={V2.amber} />
              <View style={styles.gateCopy}>
                <Text style={styles.gateTitle}>
                  {text(
                    "USDT 运营配置未就绪",
                    "USDT operations are not ready",
                    "تشغيل USDT غير جاهز",
                  )}
                </Text>
                <Text style={styles.gateText}>
                  {text(
                    "当前可保存并提交资管方案，但不能生成或下发入金指令。需由运营端完成动态验证与企业钱包/人工操作配置后才开放。",
                    "You can save and submit the managed plan, but funding instructions remain disabled until operations completes dynamic verification and configures the corporate wallet or manual workflow.",
                    "يمكنك حفظ خطة الإدارة وإرسالها، لكن تعليمات الإيداع تبقى معطلة حتى يكمل فريق التشغيل التحقق الديناميكي وإعداد محفظة الشركة أو سير العمل اليدوي.",
                  )}
                </Text>
              </View>
            </View>
          ) : null}
          {fundingPath === "PLATFORM_COLLECTION" && !collectionApproved ? (
            <View style={styles.gateWarning}>
              <MaterialIcons name="gpp-maybe" size={20} color={V2.amber} />
              <View style={styles.gateCopy}>
                <Text style={styles.gateTitle}>
                  {text(
                    "平台企业钱包待配置 / 通道未就绪",
                    "Corporate wallet or funding channel not ready",
                    "محفظة الشركة أو قناة الإيداع غير جاهزة",
                  )}
                </Text>
                <Text style={styles.gateText}>
                  {text(
                    "所选券商尚未全部满足书面通道放行、动态验证与企业钱包服务就绪条件，当前不可生成专属代收地址。客户侧不展示内部风控分数或审核备注。",
                    "Not every selected broker has completed written channel approval, dynamic verification and corporate-wallet readiness, so a dedicated collection address cannot be generated. Internal risk scores and review notes are never exposed to clients.",
                    "لم يستوفِ جميع الوسطاء المختارين بعد موافقة القناة المكتوبة والتحقق الديناميكي وجاهزية محفظة الشركة، لذلك لا يمكن إنشاء عنوان تحصيل مخصص. لا تُعرض درجات المخاطر الداخلية أو ملاحظات المراجعة للعملاء.",
                  )}
                </Text>
              </View>
            </View>
          ) : null}
        </Section>

        <Section
          index="04"
          title={text("保存资管方案", "Save managed plan", "حفظ خطة الإدارة")}
          detail={text(
            "保存只创建内部草案；不会开户、授予交易权、转币或启动自动交易。",
            "Saving creates an internal draft only. It does not open an account, grant trading access, transfer funds or start automated trading.",
            "ينشئ الحفظ مسودة داخلية فقط. ولا يفتح حساباً أو يمنح صلاحية التداول أو يحول أموالاً أو يبدأ التداول الآلي.",
          )}
        >
          {!sessionNo ? (
            <View style={styles.actionBlock}>
              <Pressable
                accessibilityRole="button"
                disabled={
                  selectedStrategies.length < 1 ||
                  !strategyWeightsValid ||
                  !brokerWeightsValid ||
                  createSession.isPending
                }
                onPress={createAlliancePlan}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (selectedStrategies.length < 1 ||
                    !strategyWeightsValid ||
                    !brokerWeightsValid ||
                    createSession.isPending) &&
                    styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="save" size={18} color={V2.background} />
                <Text style={styles.primaryButtonText}>
                  {createSession.isPending
                    ? text("正在保存", "Saving", "جارٍ الحفظ")
                    : text(
                        "保存资管方案草案",
                        "Save managed-plan draft",
                        "حفظ مسودة خطة الإدارة",
                      )}
                </Text>
              </Pressable>
              {createSession.error ? (
                <Text style={styles.errorText}>
                  {createSession.error.message}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.savedCard}>
              <View style={styles.savedTopline}>
                <MaterialIcons name="check-circle" size={19} color={V2.green} />
                <Text style={styles.savedStatus}>{plan?.status}</Text>
              </View>
              <Text style={styles.savedNo}>{sessionNo}</Text>
              <Text style={styles.savedText}>
                {text(
                  "草案已保存；交易授权未自动授予，执行开关未自动开启，提款权为无。",
                  "Draft saved. Trading access has not been granted, execution remains off and no withdrawal permission exists.",
                  "تم حفظ المسودة. لم تُمنح صلاحية التداول، ولا يزال التنفيذ متوقفاً، ولا توجد صلاحية للسحب.",
                )}
              </Text>
              {plan?.status === "DRAFT" ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={submitSession.isPending}
                  onPress={submitAlliancePlan}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    submitSession.isPending && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {submitSession.isPending
                      ? text("正在提交", "Submitting", "جارٍ الإرسال")
                      : text(
                          "提交资管方案审核",
                          "Submit plan for review",
                          "إرسال الخطة للمراجعة",
                        )}
                  </Text>
                </Pressable>
              ) : null}
              {submitSession.error ? (
                <Text style={styles.errorText}>
                  {submitSession.error.message}
                </Text>
              ) : null}
            </View>
          )}
        </Section>

        {sessionNo && plan?.status !== "DRAFT" ? (
          <Section
            index="05"
            title={text(
              "逐券商创建独立入金单",
              "Create a separate funding order for each broker",
              "إنشاء أمر إيداع مستقل لكل وسيط",
            )}
            detail={text(
              "多券商方案必须逐槽核对；每个入金单都有自己的金额、地址/标签、txHash 与到账状态。",
              "Check every broker slot separately. Each funding order has its own amount, address or tag, txHash and credit status.",
              "راجع كل خانة وسيط على حدة. لكل أمر إيداع مبلغه وعنوانه أو وسمه ومعاملة txHash وحالة الرصيد الخاصة به.",
            )}
          >
            <View style={styles.slotTabs}>
              {executionSlots.map(
                (slot: {
                  slotKey: string;
                  brokerId: string;
                  capitalWeightPct: number;
                }) => {
                  const broker = brokers.find(
                    (item) => item.id === slot.brokerId,
                  );
                  const active = slot.slotKey === effectiveSlotKey;
                  return (
                    <Pressable
                      key={slot.slotKey}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        setActiveSlotKey(slot.slotKey);
                        setActiveIntentNo("");
                        setLateTransferAttested(false);
                        const index = executionSlots.findIndex(
                          (item: { slotKey: string }) =>
                            item.slotKey === slot.slotKey,
                        );
                        setDeclaredAmount(slotFundingAmounts[index] ?? capital);
                      }}
                      style={[styles.slotTab, active && styles.slotTabActive]}
                    >
                      <Text
                        style={[
                          styles.slotTabText,
                          active && styles.slotTabTextActive,
                        ]}
                      >
                        {broker?.name ?? slot.brokerId} ·{" "}
                        {slot.capitalWeightPct}% ·{" "}
                        {slotFundingAmounts[
                          executionSlots.findIndex(
                            (item: { slotKey: string }) =>
                              item.slotKey === slot.slotKey,
                          )
                        ] ?? "0"}{" "}
                        U
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
            <Text style={styles.slotTotal}>
              {text(
                `各券商入金单合计 ${capital} USDT（等于方案目标资金）`,
                `Broker funding orders total ${capital} USDT, equal to the plan target`,
                `إجمالي أوامر إيداع الوسطاء ${capital} USDT، وهو يساوي هدف الخطة`,
              )}
            </Text>

            {!intent ? (
              <View style={styles.actionBlock}>
                <Text style={styles.actionHelp}>
                  {fundingPath === "BROKER_DIRECT"
                    ? text(
                        "创建入金单后，等待登记从客户券商门户取得的当次网络、地址与标签。",
                        "After creating the order, register the current network, address and tag from the client's broker portal.",
                        "بعد إنشاء الأمر، سجّل الشبكة والعنوان والوسم الحالي من بوابة وسيط العميل.",
                      )
                    : text(
                        "创建代收单后，只有合规闸放行才会分配单笔专属企业地址。",
                        "After creating the collection order, a unique corporate address is assigned only after compliance approval.",
                        "بعد إنشاء أمر التحصيل، لا يُخصص عنوان شركة فريد إلا بعد موافقة الامتثال.",
                      )}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={!routeGateOpen || createIntent.isPending}
                  onPress={createFundingInstruction}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (!routeGateOpen || createIntent.isPending) &&
                      styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {createIntent.isPending
                      ? text("正在创建", "Creating", "جارٍ الإنشاء")
                      : text(
                          "创建该券商入金单",
                          "Create broker funding order",
                          "إنشاء أمر إيداع الوسيط",
                        )}
                  </Text>
                </Pressable>
                {createIntent.error ? (
                  <Text style={styles.errorText}>
                    {createIntent.error.message}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.intentCard}>
                <View style={styles.intentHeader}>
                  <View>
                    <Text style={styles.intentEyebrow}>
                      {text("入金单", "Funding order", "أمر الإيداع")}
                    </Text>
                    <Text style={styles.intentNo}>{intent.intentNo}</Text>
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>
                      {fundingStatusLabel(intent.status, language)}
                    </Text>
                  </View>
                </View>
                <View style={styles.intentRows}>
                  <InfoRow
                    label={text("券商", "Broker", "الوسيط")}
                    value={activeBroker?.name ?? intent.brokerId}
                  />
                  <InfoRow
                    label={text(
                      "预计金额",
                      "Expected amount",
                      "المبلغ المتوقع",
                    )}
                    value={`${intent.expectedAmount} USDT`}
                  />
                  <InfoRow
                    label={text("网络", "Network", "الشبكة")}
                    value={
                      network
                        ? networkLabel(network, language)
                        : text(
                            "等待当次指令",
                            "Awaiting current instructions",
                            "في انتظار التعليمات الحالية",
                          )
                    }
                  />
                  <InfoRow
                    label={text("地址", "Address", "العنوان")}
                    value={
                      instructionExpired
                        ? text(
                            "当次指令已过期，需重新获取",
                            "Instructions expired; retrieve a new set",
                            "انتهت صلاحية التعليمات؛ استخرج تعليمات جديدة",
                          )
                        : (intent.depositAddress ??
                          text(
                            "等待当次指令",
                            "Awaiting current instructions",
                            "في انتظار التعليمات الحالية",
                          ))
                    }
                    selectable={!instructionExpired}
                  />
                  <InfoRow
                    label={text("标签/Memo", "Tag / memo", "الوسم / المذكرة")}
                    value={
                      intent.depositTag ??
                      text(
                        "无或等待指令",
                        "None or awaiting instructions",
                        "لا يوجد أو في انتظار التعليمات",
                      )
                    }
                    selectable={!instructionExpired}
                  />
                  <InfoRow
                    label={text(
                      "指令失效时间",
                      "Instruction expiry",
                      "انتهاء صلاحية التعليمات",
                    )}
                    value={
                      intent.instructionsExpireAt
                        ? new Date(intent.instructionsExpireAt).toLocaleString(
                            locale,
                          )
                        : text(
                            "未配置，不可转账",
                            "Not configured; do not transfer",
                            "غير مهيأ؛ لا تُجرِ التحويل",
                          )
                    }
                  />
                </View>

                {intent.status === "DRAFT" ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitIntent.isPending}
                    onPress={submitFundingRequest}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      submitIntent.isPending && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {text(
                        "提交入金指令申请",
                        "Request funding instructions",
                        "طلب تعليمات الإيداع",
                      )}
                    </Text>
                  </Pressable>
                ) : null}
                {intent.status === "WAITING_ACCOUNT" ? (
                  <Text style={styles.intentFootnote}>
                    {text(
                      "等待后台核验该客户本人券商账户与交易授权；请勿上传券商密码、API Key 或验证码。",
                      "Waiting for verification of the client-owned broker account and trading permission. Never upload a broker password, API key or verification code.",
                      "بانتظار التحقق من حساب الوسيط المملوك للعميل وصلاحية التداول. لا ترفع كلمة مرور الوسيط أو مفتاح API أو رمز تحقق.",
                    )}
                  </Text>
                ) : null}

                {intent.status === "READY_TO_FUND" ? (
                  <View style={styles.txForm}>
                    {instructionExpired ? (
                      <View style={styles.gateWarning}>
                        <MaterialIcons
                          name="timer-off"
                          size={20}
                          color={V2.amber}
                        />
                        <View style={styles.gateCopy}>
                          <Text style={styles.gateTitle}>
                            {text(
                              "当次入金指令已过期",
                              "Funding instructions expired",
                              "انتهت صلاحية تعليمات الإيداع",
                            )}
                          </Text>
                          <Text style={styles.gateText}>
                            {text(
                              "不要复用或复制旧地址/标签，请重新获取当次指令。如果您已经实际在链上转出，仍可以提交 txHash 作为晚到/异常申报，但不代表券商已入账。",
                              "Do not reuse or copy an old address or tag. Retrieve fresh instructions. If an on-chain transfer has already occurred, you may submit its txHash as a late or exception report, but this does not mean the broker credited it.",
                              "لا تعِد استخدام عنوان أو وسم قديم. استخرج تعليمات جديدة. إذا تم التحويل بالفعل على السلسلة، فيمكن إرسال txHash كبلاغ متأخر أو استثنائي، لكن ذلك لا يعني أن الوسيط أضاف الرصيد.",
                            )}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                    <Text style={styles.txTitle}>
                      {text(
                        "转账后提交 txHash",
                        "Submit the txHash after transfer",
                        "أرسل txHash بعد التحويل",
                      )}
                    </Text>
                    <Text style={styles.txHelp}>
                      {network === "SOLANA"
                        ? text(
                            "Solana 签名通常较长；页面不会按 64 位十六进制误判。",
                            "Solana signatures are usually longer and are not treated as 64-character hexadecimal hashes.",
                            "تكون توقيعات Solana أطول عادةً، ولا تُعامل كقيمة سداسية عشرية من 64 حرفاً.",
                          )
                        : text(
                            "TRON / Ethereum / BSC 等网络按 64 位十六进制交易哈希校验；最终以服务端校验为准。",
                            "TRON, Ethereum and BSC transaction hashes are checked as 64-character hexadecimal values. Server validation is final.",
                            "يتم فحص معاملات TRON وEthereum وBSC كقيم سداسية عشرية من 64 حرفاً. ويظل تحقق الخادم هو المرجع النهائي.",
                          )}
                    </Text>
                    <TextInput
                      accessibilityLabel={text(
                        "交易哈希",
                        "Transaction hash",
                        "معرّف المعاملة",
                      )}
                      value={txHash}
                      onChangeText={setTxHash}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder={text(
                        "粘贴本次交易 txHash / Solana 签名",
                        "Paste this transfer's txHash or Solana signature",
                        "ألصق txHash أو توقيع Solana لهذا التحويل",
                      )}
                      placeholderTextColor={V2.textDim}
                      style={styles.txInput}
                    />
                    {instructionExpired ? (
                      <ConfirmLine
                        checked={lateTransferAttested}
                        onPress={() =>
                          setLateTransferAttested((current) => !current)
                        }
                        text={text(
                          "我确认这是已经发生的链上转出，现仅提交晚到/异常申报，不会再向过期地址转账。",
                          "I confirm this on-chain transfer already occurred. I am submitting only a late or exception report and will not send again to the expired address.",
                          "أؤكد أن هذا التحويل تم بالفعل على السلسلة. أرسل الآن بلاغاً متأخراً أو استثنائياً فقط، ولن أحول مجدداً إلى العنوان منتهي الصلاحية.",
                        )}
                      />
                    ) : null}
                    {fundingPath === "PLATFORM_COLLECTION" ? (
                      <>
                        <TextInput
                          accessibilityLabel={text(
                            "付款钱包地址",
                            "Payer wallet address",
                            "عنوان محفظة الدافع",
                          )}
                          value={payerWalletAddress}
                          onChangeText={setPayerWalletAddress}
                          autoCapitalize="none"
                          autoCorrect={false}
                          placeholder={text(
                            "本次付款钱包地址",
                            "Wallet address used for this payment",
                            "عنوان المحفظة المستخدم لهذا الدفع",
                          )}
                          placeholderTextColor={V2.textDim}
                          style={styles.txInput}
                        />
                        <ConfirmLine
                          checked={payerOwnershipAttested}
                          onPress={() =>
                            setPayerOwnershipAttested((value) => !value)
                          }
                          text={text(
                            "我声明该付款钱包由本人或已授权主体控制，可接受合规筛查",
                            "I confirm this wallet is controlled by me or an authorized party and may undergo compliance screening.",
                            "أؤكد أن هذه المحفظة تحت سيطرتي أو سيطرة جهة مخولة، ويمكن إخضاعها لفحص الامتثال.",
                          )}
                        />
                      </>
                    ) : null}
                    <TextInput
                      accessibilityLabel={text(
                        "申报 USDT 金额",
                        "Declared USDT amount",
                        "مبلغ USDT المصرح به",
                      )}
                      value={declaredAmount}
                      onChangeText={(value) =>
                        setDeclaredAmount(value.replace(/[^0-9.]/g, ""))
                      }
                      keyboardType="decimal-pad"
                      placeholder={text(
                        "申报 USDT 金额",
                        "Declared USDT amount",
                        "مبلغ USDT المصرح به",
                      )}
                      placeholderTextColor={V2.textDim}
                      style={styles.txInput}
                    />
                    <ConfirmLine
                      checked={confirmedNetwork}
                      onPress={() => setConfirmedNetwork((value) => !value)}
                      text={text(
                        "我已逐字核对网络与当次指令完全一致",
                        "I verified that the network exactly matches the current instructions.",
                        "تحققت من أن الشبكة تطابق التعليمات الحالية تماماً.",
                      )}
                    />
                    <ConfirmLine
                      checked={confirmedAddress}
                      onPress={() => setConfirmedAddress((value) => !value)}
                      text={text(
                        "我确认地址/标签来自本入金单，没有复用历史地址",
                        "I confirm the address and tag belong to this funding order and no previous address was reused.",
                        "أؤكد أن العنوان والوسم يخصان أمر الإيداع هذا، ولم أستخدم عنواناً سابقاً.",
                      )}
                    />
                    <Pressable
                      accessibilityRole="button"
                      disabled={!canSubmitTx || submitTransaction.isPending}
                      onPress={submitTx}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        (!canSubmitTx || submitTransaction.isPending) &&
                          styles.disabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {submitTransaction.isPending
                          ? text("正在提交", "Submitting", "جارٍ الإرسال")
                          : text(
                              "提交 txHash 等待核对",
                              "Submit txHash for verification",
                              "إرسال txHash للتحقق",
                            )}
                      </Text>
                    </Pressable>
                    {submitTransaction.error ? (
                      <Text style={styles.errorText}>
                        {submitTransaction.error.message}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {intent.status !== "READY_TO_FUND" ? (
                  <Text style={styles.intentFootnote}>
                    {text(
                      "客户侧仅显示待入金、确认中、转入券商中、已到账或异常；当前进度来自后台记录，不代表自动转币或自动交易。",
                      "Clients see only awaiting funding, confirming, transferring to broker, credited or exception. Progress comes from back-office records and does not imply automatic transfer or trading.",
                      "يرى العميل فقط: بانتظار الإيداع، قيد التأكيد، قيد التحويل إلى الوسيط، تم الإيداع، أو حالة استثنائية. تأتي الحالة من سجلات العمليات ولا تعني تحويلاً أو تداولاً تلقائياً.",
                    )}
                  </Text>
                ) : null}
              </View>
            )}
          </Section>
        ) : null}

        <Section
          index={sessionNo && plan?.status !== "DRAFT" ? "06" : "05"}
          title={text(
            "异常与三账隔离",
            "Exception handling and ledger separation",
            "معالجة الحالات الاستثنائية وفصل السجلات",
          )}
          detail={text(
            "少付、多付、错链、迟到、标签遗漏与未到账都进入独立人工核对。",
            "Underpayment, overpayment, wrong network, late transfer, missing tag and non-credit cases all enter separate manual review.",
            "تخضع حالات النقص أو الزيادة أو الشبكة الخاطئة أو التأخير أو فقدان الوسم أو عدم وصول الرصيد لمراجعة يدوية مستقلة.",
          )}
        >
          <View style={styles.warningGrid}>
            {getBrokerFundingWarnings(language).map((warning) => (
              <View key={warning} style={styles.warningCard}>
                <MaterialIcons
                  name="warning-amber"
                  size={17}
                  color={V2.amber}
                />
                <Text style={styles.warningText}>{warning}</Text>
              </View>
            ))}
          </View>
          <View style={styles.ledgerNotice}>
            <Text style={styles.ledgerTitle}>
              {text("账务边界", "Ledger boundaries", "حدود السجلات المالية")}
            </Text>
            <Text style={styles.ledgerText}>
              {text(
                "① EA 商城销售款 ② 客户直充券商 ③ 资管平台代收，三套订单、地址、txHash、对账与异常记录严格隔离。平台代收不展示全局共用地址，私钥不进入业务平台；任何转出都要经过动态验证，在外部企业钱包完成，并记录转出 txHash。",
                "EA marketplace sales, client-to-broker deposits and managed platform collections use strictly separate orders, addresses, txHashes, reconciliation and exception records. Platform collection never exposes a shared global address, and private keys never enter the business platform. Every outbound transfer requires dynamic verification, executes in an external corporate wallet and records its txHash.",
                "تُفصل بشكل صارم سجلات مبيعات متجر EA، وإيداعات العميل المباشرة لدى الوسيط، وتحصيل منصة الإدارة، بما يشمل الأوامر والعناوين ومعاملات txHash والتسوية والحالات الاستثنائية. لا يعرض تحصيل المنصة عنواناً عاماً مشتركاً، ولا تدخل المفاتيح الخاصة إلى منصة الأعمال. يتطلب كل تحويل صادر تحققاً ديناميكياً، ويُنفذ عبر محفظة شركة خارجية مع تسجيل txHash.",
              )}
            </Text>
          </View>
        </Section>
      </View>
    </ScrollView>
  );
}

function Section({
  index,
  title,
  detail,
  children,
}: {
  index: string;
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionIndex}>{index}</Text>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionDetail}>{detail}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function OfficialLink({
  label,
  url,
  officialLabel,
}: {
  label: string;
  url: string;
  officialLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [styles.officialLink, pressed && styles.pressed]}
    >
      <Text style={styles.officialLinkText}>
        {label} · {officialLabel}
      </Text>
      <MaterialIcons name="open-in-new" size={13} color={V2.gold} />
    </Pressable>
  );
}

function InfoRow({
  label,
  value,
  selectable = false,
}: {
  label: string;
  value: string;
  selectable?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text selectable={selectable} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function ConfirmLine({
  checked,
  onPress,
  text,
}: {
  checked: boolean;
  onPress: () => void;
  text: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.confirmLine}
    >
      <MaterialIcons
        name={checked ? "check-box" : "check-box-outline-blank"}
        size={19}
        color={checked ? V2.green : V2.textMuted}
      />
      <Text style={styles.confirmText}>{text}</Text>
    </Pressable>
  );
}

function normalizeAmount(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? String(Math.round(parsed * 1_000_000) / 1_000_000)
    : "50000";
}

function networkLabel(network: BrokerFundingNetwork, language: AppLanguage) {
  if (network !== "OTHER") return NETWORK_LABELS[network];
  if (language === "en") return "Other network";
  if (language === "ar") return "شبكة أخرى";
  return "其他网络";
}

function fundingStatusLabel(status: string, language: AppLanguage) {
  const statusGroup =
    status === "DRAFT" ||
    status === "WAITING_ACCOUNT" ||
    status === "WAITING_INSTRUCTIONS" ||
    status === "READY_TO_FUND"
      ? "WAITING"
      : status === "TX_SUBMITTED" ||
          status === "RECEIVED" ||
          status === "RECONCILED"
        ? "CONFIRMING"
        : status === "AWAITING_PAYOUT" ||
            status === "PAYOUT_SUBMITTED" ||
            status === "BROKER_CREDIT_PENDING"
          ? "TO_BROKER"
          : status;

  const labels: Record<string, Record<AppLanguage, string>> = {
    WAITING: {
      zh: "待入金",
      en: "Awaiting funding",
      ar: "بانتظار الإيداع",
    },
    CONFIRMING: { zh: "确认中", en: "Confirming", ar: "قيد التأكيد" },
    TO_BROKER: {
      zh: "转入券商中",
      en: "Transferring to broker",
      ar: "قيد التحويل إلى الوسيط",
    },
    CREDITED: { zh: "已到账", en: "Credited", ar: "تم الإيداع" },
    EXCEPTION: {
      zh: "异常处理中",
      en: "Exception review",
      ar: "مراجعة استثنائية",
    },
    CANCELLED: { zh: "已取消", en: "Cancelled", ar: "ملغي" },
  };
  return labels[statusGroup]?.[language] ?? status;
}

function isBrokerId(value: string): value is AllianceBrokerId {
  return ALLIANCE_BROKERS.some((broker) => broker.id === value);
}

function isAllianceStrategyId(
  value: string,
): value is (typeof ALLIANCE_STRATEGY_IDS)[number] {
  return (ALLIANCE_STRATEGY_IDS as readonly string[]).includes(value);
}

function distributeWeights(count: number) {
  const base = Math.floor((100 / count) * 100) / 100;
  return Array.from({ length: count }, (_, index) =>
    index === count - 1
      ? Math.round((100 - base * (count - 1)) * 100) / 100
      : base,
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: V2.background },
  scrollContent: { paddingBottom: 72 },
  page: {
    width: "100%",
    maxWidth: V2_LAYOUT.maxWidth,
    alignSelf: "center",
    paddingHorizontal: V2_LAYOUT.pagePaddingDesktop,
    paddingTop: 20,
    gap: 22,
  },
  pageMobile: {
    paddingHorizontal: V2_LAYOUT.pagePaddingMobile,
    paddingTop: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
  },
  backText: { color: V2.textMuted, fontSize: 10, fontWeight: "800" },
  header: { flexDirection: "row", alignItems: "stretch", gap: 18 },
  headerMobile: { flexDirection: "column" },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  title: { color: V2.text, fontSize: 30, lineHeight: 37, fontWeight: "900" },
  titleMobile: { fontSize: 24, lineHeight: 31 },
  subtitle: {
    color: V2.textMuted,
    fontSize: 11,
    lineHeight: 18,
    maxWidth: 760,
  },
  boundaryCard: {
    width: 340,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(66,211,161,0.34)",
    borderRadius: 6,
    backgroundColor: "rgba(66,211,161,0.05)",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  boundaryCopy: { flex: 1, gap: 4 },
  boundaryTitle: { color: V2.green, fontSize: 12, fontWeight: "900" },
  boundaryText: { color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  summaryGrid: {
    flexDirection: "row",
    gap: 1,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  summaryGridMobile: { flexWrap: "wrap" },
  summaryCard: {
    flex: 1,
    minWidth: 170,
    padding: 13,
    gap: 5,
    backgroundColor: V2.backgroundRaised,
  },
  summaryLabel: { color: V2.textDim, fontSize: 9 },
  summaryValue: { color: V2.text, fontSize: 13, fontWeight: "900" },
  section: {
    padding: 16,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
    gap: 14,
  },
  sectionHeading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  sectionIndex: {
    color: V2.gold,
    fontSize: 10,
    fontWeight: "900",
    paddingTop: 3,
  },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { color: V2.text, fontSize: 16, fontWeight: "900" },
  sectionDetail: { color: V2.textMuted, fontSize: 10, lineHeight: 16 },
  brokerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  brokerCard: {
    flex: 1,
    minWidth: 260,
    padding: 13,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 5,
    backgroundColor: V2.surfaceMuted,
    gap: 9,
  },
  strategyAccent: { width: 5, minHeight: 34, borderRadius: 3 },
  brokerTopline: { flexDirection: "row", alignItems: "center", gap: 9 },
  brokerCode: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  brokerCodeText: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  brokerCopy: { flex: 1, gap: 2 },
  brokerName: { color: V2.text, fontSize: 13, fontWeight: "900" },
  brokerMeta: { color: V2.green, fontSize: 8, fontWeight: "800" },
  brokerDetail: { color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  weightRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  weightLabel: { flex: 1, color: V2.textDim, fontSize: 8, fontWeight: "800" },
  weightInput: {
    width: 68,
    minHeight: 34,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    color: V2.text,
    fontSize: 10,
    textAlign: "right",
  },
  weightUnit: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  weightFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  weightTotal: { fontSize: 9, fontWeight: "900" },
  equalizeButton: {
    minHeight: 30,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  equalizeText: { color: V2.gold, fontSize: 8, fontWeight: "900" },
  linkRow: {
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: V2.border,
  },
  officialLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  officialLinkText: { color: V2.gold, fontSize: 9, fontWeight: "800" },
  portalNotice: {
    padding: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(83,159,255,0.3)",
    borderRadius: 5,
  },
  portalNoticeText: {
    flex: 1,
    color: V2.textMuted,
    fontSize: 9,
    lineHeight: 15,
  },
  networkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
  },
  networkChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 3,
  },
  networkChipText: { color: V2.text, fontSize: 9, fontWeight: "800" },
  networkHint: { color: V2.textDim, fontSize: 8 },
  steps: { gap: 8 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  stepIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(216,188,131,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndexText: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  stepText: { flex: 1, color: V2.text, fontSize: 10, lineHeight: 15 },
  gateWarning: {
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
    borderColor: "rgba(231,183,95,0.34)",
    borderRadius: 5,
    backgroundColor: "rgba(231,183,95,0.05)",
  },
  gateCopy: { flex: 1, gap: 3 },
  gateTitle: { color: V2.amber, fontSize: 11, fontWeight: "900" },
  gateText: { color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  actionBlock: { gap: 9 },
  actionHelp: { color: V2.textMuted, fontSize: 10, lineHeight: 16 },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: V2.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  primaryButtonText: { color: V2.background, fontSize: 10, fontWeight: "900" },
  secondaryButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  secondaryButtonText: { color: V2.text, fontSize: 10, fontWeight: "900" },
  errorText: { color: V2.red, fontSize: 9, lineHeight: 14 },
  savedCard: {
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(66,211,161,0.32)",
    borderRadius: 5,
    backgroundColor: "rgba(66,211,161,0.04)",
    gap: 5,
  },
  savedTopline: { flexDirection: "row", alignItems: "center", gap: 7 },
  savedStatus: { color: V2.green, fontSize: 9, fontWeight: "900" },
  savedNo: { color: V2.text, fontSize: 14, fontWeight: "900" },
  savedText: { color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  slotTabs: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  slotTab: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  slotTabActive: {
    borderColor: V2.gold,
    backgroundColor: "rgba(216,188,131,0.07)",
  },
  slotTabText: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  slotTabTextActive: { color: V2.gold },
  slotTotal: {
    color: V2.green,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "900",
  },
  intentCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 5,
    backgroundColor: V2.surfaceMuted,
    gap: 12,
  },
  intentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  intentEyebrow: { color: V2.textDim, fontSize: 8 },
  intentNo: { marginTop: 3, color: V2.text, fontSize: 13, fontWeight: "900" },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(66,211,161,0.34)",
    borderRadius: 3,
  },
  statusText: { color: V2.green, fontSize: 8, fontWeight: "900" },
  intentRows: { borderTopWidth: 1, borderTopColor: V2.border },
  infoRow: {
    minHeight: 39,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoLabel: { width: 78, color: V2.textDim, fontSize: 9, lineHeight: 14 },
  infoValue: {
    flex: 1,
    color: V2.text,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  txForm: { gap: 9, paddingTop: 5 },
  txTitle: { color: V2.text, fontSize: 12, fontWeight: "900" },
  txHelp: { color: V2.textMuted, fontSize: 9, lineHeight: 14 },
  txInput: {
    minHeight: 43,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    color: V2.text,
    fontSize: 10,
  },
  confirmLine: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  confirmText: { flex: 1, color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  intentFootnote: { color: V2.textDim, fontSize: 8, lineHeight: 14 },
  warningGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  warningCard: {
    flex: 1,
    minWidth: 250,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(231,183,95,0.28)",
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  warningText: { flex: 1, color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  ledgerNotice: {
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.3)",
    borderRadius: 5,
    gap: 4,
  },
  ledgerTitle: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  ledgerText: { color: V2.textMuted, fontSize: 9, lineHeight: 16 },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.72 },
});
