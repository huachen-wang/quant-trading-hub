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
  ASSISTED_FUNDING_STEPS,
  BROKER_FUNDING_STEPS,
  BROKER_FUNDING_WARNINGS,
  RISK_OPTIONS,
  fundingPathLabel,
  onboardingModeLabel,
  type AllianceBrokerId,
  type FundingPath,
  type OnboardingMode,
  type RiskProfile,
} from "@/components/v2/configurator/types";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { trpc } from "@/lib/trpc";
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
  OTHER: "其他网络",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "待入金",
  WAITING_ACCOUNT: "待入金",
  WAITING_INSTRUCTIONS: "待入金",
  READY_TO_FUND: "待入金",
  TX_SUBMITTED: "确认中",
  RECEIVED: "确认中",
  RECONCILED: "确认中",
  AWAITING_PAYOUT: "转入券商中",
  PAYOUT_SUBMITTED: "转入券商中",
  BROKER_CREDIT_PENDING: "转入券商中",
  CREDITED: "已到账",
  EXCEPTION: "异常处理中",
  CANCELLED: "已取消",
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
  const capabilities = trpc.v2.managedSessions.capabilities.useQuery(undefined, {
    staleTime: 60_000,
  });
  const createSession = trpc.v2.managedSessions.create.useMutation();
  const submitSession = trpc.v2.managedSessions.submit.useMutation();
  const createIntent = trpc.v2.managedSessions.createFundingIntent.useMutation();
  const submitIntent = trpc.v2.managedSessions.submitFundingIntent.useMutation();
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
      Array.from(new Set((params.brokerIds?.split(",") ?? []).filter(isBrokerId))),
    [params.brokerIds],
  );
  const brokerIds = requestedBrokerIds.length
    ? requestedBrokerIds
    : (["exness"] as AllianceBrokerId[]);
  const brokers = ALLIANCE_BROKERS.filter((broker) =>
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
  const selectedStrategies =
    strategiesQuery.data?.filter((strategy) =>
      requestedStrategyIds.length
        ? isAllianceStrategyId(strategy.id) &&
          requestedStrategyIds.includes(strategy.id)
        : ["jingge-v51", "quantum-queen", "black-aura"].includes(strategy.id),
    ) ?? [];
  const autoStrategyWeights = distributeWeights(selectedStrategies.length);
  const strategyWeights = selectedStrategies.map((strategy, index) =>
    Number(
      strategyWeightOverrides[strategy.id] ?? autoStrategyWeights[index],
    ),
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
            collectionApproval?: "NOT_APPROVED" | "PENDING" | "APPROVED" | "SUSPENDED";
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
  const activeExpectedAmount =
    slotFundingAmounts[activeSlotIndex] ?? capital;
  const fundingIntents = trpc.v2.managedSessions.fundingIntents.useQuery(
    { sessionNo },
    { enabled: Boolean(sessionNo), staleTime: 2_000 },
  );
  const slotIntent = fundingIntents.data?.find(
    (intent) => intent.slotKey === effectiveSlotKey,
  );
  const newlyCreatedIntent =
    createIntent.data?.slotKey === effectiveSlotKey ? createIntent.data : undefined;
  const effectiveIntentNo =
    activeIntentNo || slotIntent?.intentNo || newlyCreatedIntent?.intentNo || "";
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
    return <V2LoadingState label="正在准备六策略资管方案" />;
  if (!strategiesQuery.data) {
    return (
      <V2ErrorState
        title="策略资料不可用"
        detail={strategiesQuery.error?.message || "暂时无法读取六策略。"}
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
        maxDrawdownPct: RISK_OPTIONS.find((item) => item.id === riskProfile)!
          .drawdown,
        strategies: selectedStrategies.map((strategy, index) => ({
          strategyId: strategy.id as (typeof ALLIANCE_STRATEGY_IDS)[number],
          weightPct: strategyWeights[index],
          riskMultiplier: 1,
        })),
        executionSlots: brokers.map((broker, index) => ({
          brokerId: broker.id,
          label: `${broker.name} 客户本人账户`,
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
      ? ASSISTED_FUNDING_STEPS
      : BROKER_FUNDING_STEPS;
  const activeBroker = brokers.find(
    (broker) => broker.id === intent?.brokerId,
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={17} color={V2.textMuted} />
          <Text style={styles.backText}>返回方案选配</Text>
        </Pressable>

        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>AI量化联盟 · 资管接入</Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              开户、交易授权与 USDT 入金
            </Text>
            <Text style={styles.subtitle}>
              先保存普通资管方案，再为每个客户本人券商账户创建独立入金单。
              页面不会把草案、txHash 申报或链上确认误写成券商已到账。
            </Text>
          </View>
          <View style={styles.boundaryCard}>
            <MaterialIcons name="shield" size={21} color={V2.green} />
            <View style={styles.boundaryCopy}>
              <Text style={styles.boundaryTitle}>交易权不含提款权</Text>
              <Text style={styles.boundaryText}>
                客户本人持有券商账户；项目方只申请约定交易权限，不保存出金权限、私钥或钱包助记词。
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.summaryGrid, isMobile && styles.summaryGridMobile]}>
          <SummaryCard label="计划资金" value={formatUsdt(Number(capital))} />
          <SummaryCard
            label="接入方式"
            value={onboardingModeLabel(onboardingMode)}
          />
          <SummaryCard label="入金路线" value={fundingPathLabel(fundingPath)} />
          <SummaryCard label="策略组合" value={`已选 ${selectedStrategies.length} / 6`} />
        </View>

        <Section
          index="01"
          title={`所选策略权重（${selectedStrategies.length} / 6）`}
          detail="单个委托可选 1–6 款；所选策略权重必须合计 100%。离线或非实盘数据会保留准确标签并阻断真实启用。"
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
                        ? "当前离线 · 不可启用"
                        : `${strategy.source.dataMode} · 以证据标签为准`}
                    </Text>
                  </View>
                </View>
                <View style={styles.weightRow}>
                  <Text style={styles.weightLabel}>策略权重</Text>
                  <TextInput
                    accessibilityLabel={`${strategy.shortName} 策略权重`}
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
              合计 {Math.round(strategyWeightTotal * 100) / 100}%
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setStrategyWeightOverrides({})}
              style={styles.equalizeButton}
            >
              <MaterialIcons name="balance" size={15} color={V2.gold} />
              <Text style={styles.equalizeText}>自动均分</Text>
            </Pressable>
          </View>
        </Section>

        <Section
          index="02"
          title={`可选券商（${brokers.length} 家）`}
          detail="开户与资管申请请前往对应官方站点；平台不代表券商官方背书，也不承诺地区可用性。"
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
                    <Text style={styles.brokerMeta}>客户本人账户</Text>
                  </View>
                </View>
                <Text style={styles.brokerDetail}>{broker.detail}</Text>
                <View style={styles.weightRow}>
                  <Text style={styles.weightLabel}>计划资金权重</Text>
                  <TextInput
                    accessibilityLabel={`${broker.name} 资金权重`}
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
                  <OfficialLink label="官方开户" url={broker.signupUrl} />
                  {onboardingMode === "PLATFORM_ASSISTED" ? (
                    <OfficialLink
                      label="资管通道说明/申请"
                      url={broker.managementUrl}
                    />
                  ) : null}
                  {broker.fundingUrl ? (
                    <OfficialLink label="官方入金说明" url={broker.fundingUrl} />
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
              合计 {Math.round(brokerWeightTotal * 100) / 100}%
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setBrokerWeightOverrides({})}
              style={styles.equalizeButton}
            >
              <MaterialIcons name="balance" size={15} color={V2.gold} />
              <Text style={styles.equalizeText}>自动均分</Text>
            </Pressable>
          </View>
          <View style={styles.portalNotice}>
            <MaterialIcons name="info-outline" size={18} color={V2.blue} />
            <Text style={styles.portalNoticeText}>
              Exness 的 USDT 可用性须在客户个人专区按地区确认；IC Markets 与 Blueberry Markets
              的币种、网络、限额同样以客户门户当次显示为准。禁止第三方入金的通道不得使用平台代收。
            </Text>
          </View>
        </Section>

        <Section
          index="03"
          title={fundingPathLabel(fundingPath)}
          detail="每次都重新获取或生成当次指令；不得复用旧地址、旧二维码或旧标签。"
        >
          <View style={styles.networkRow}>
            {(["TRON", "ETHEREUM", "BSC", "SOLANA"] as const).map((item) => (
              <View key={item} style={styles.networkChip}>
                <Text style={styles.networkChipText}>{NETWORK_LABELS[item]}</Text>
              </View>
            ))}
            <Text style={styles.networkHint}>实际网络以当次券商门户/代收单为准</Text>
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
                <Text style={styles.gateTitle}>USDT 运营配置未就绪</Text>
                <Text style={styles.gateText}>
                  当前可保存并提交资管方案，但不能生成或下发入金指令。需由运营端完成动态验证与企业钱包/人工操作配置后才开放。
                </Text>
              </View>
            </View>
          ) : null}
          {fundingPath === "PLATFORM_COLLECTION" && !collectionApproved ? (
            <View style={styles.gateWarning}>
              <MaterialIcons name="gpp-maybe" size={20} color={V2.amber} />
              <View style={styles.gateCopy}>
                <Text style={styles.gateTitle}>平台企业钱包待配置 / 通道未就绪</Text>
                <Text style={styles.gateText}>
                  所选券商尚未全部满足书面通道放行、动态验证与企业钱包服务就绪条件，当前不可生成专属代收地址。
                  客户侧不展示内部风控分数或审核备注。
                </Text>
              </View>
            </View>
          ) : null}
        </Section>

        <Section
          index="04"
          title="保存资管方案"
          detail="保存只创建内部草案；不会开户、授予交易权、转币或启动自动交易。"
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
                  {createSession.isPending ? "正在保存" : "保存资管方案草案"}
                </Text>
              </Pressable>
              {createSession.error ? (
                <Text style={styles.errorText}>{createSession.error.message}</Text>
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
                草案已保存；交易授权未自动授予，执行开关未自动开启，提款权为无。
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
                    {submitSession.isPending ? "正在提交" : "提交资管方案审核"}
                  </Text>
                </Pressable>
              ) : null}
              {submitSession.error ? (
                <Text style={styles.errorText}>{submitSession.error.message}</Text>
              ) : null}
            </View>
          )}
        </Section>

        {sessionNo && plan?.status !== "DRAFT" ? (
          <Section
            index="05"
            title="逐券商创建独立入金单"
            detail="多券商方案必须逐槽核对；每个入金单都有自己的金额、地址/标签、txHash 与到账状态。"
          >
            <View style={styles.slotTabs}>
              {executionSlots.map(
                (slot: {
                  slotKey: string;
                  brokerId: string;
                  capitalWeightPct: number;
                }) => {
                const broker = brokers.find((item) => item.id === slot.brokerId);
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
                    <Text style={[styles.slotTabText, active && styles.slotTabTextActive]}>
                      {broker?.name ?? slot.brokerId} · {slot.capitalWeightPct}% · {" "}
                      {slotFundingAmounts[
                        executionSlots.findIndex(
                          (item: { slotKey: string }) =>
                            item.slotKey === slot.slotKey,
                        )
                      ] ?? "0"} U
                    </Text>
                  </Pressable>
                );
                },
              )}
            </View>
            <Text style={styles.slotTotal}>
              各券商入金单合计 {capital} USDT（等于方案目标资金）
            </Text>

            {!intent ? (
              <View style={styles.actionBlock}>
                <Text style={styles.actionHelp}>
                  {fundingPath === "BROKER_DIRECT"
                    ? "创建入金单后，等待登记从客户券商门户取得的当次网络、地址与标签。"
                    : "创建代收单后，只有合规闸放行才会分配单笔专属企业地址。"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={!routeGateOpen || createIntent.isPending}
                  onPress={createFundingInstruction}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (!routeGateOpen || createIntent.isPending) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {createIntent.isPending ? "正在创建" : "创建该券商入金单"}
                  </Text>
                </Pressable>
                {createIntent.error ? (
                  <Text style={styles.errorText}>{createIntent.error.message}</Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.intentCard}>
                <View style={styles.intentHeader}>
                  <View>
                    <Text style={styles.intentEyebrow}>入金单</Text>
                    <Text style={styles.intentNo}>{intent.intentNo}</Text>
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>
                      {STATUS_LABELS[intent.status] ?? intent.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.intentRows}>
                  <InfoRow label="券商" value={activeBroker?.name ?? intent.brokerId} />
                  <InfoRow label="预计金额" value={`${intent.expectedAmount} USDT`} />
                  <InfoRow
                    label="网络"
                    value={network ? NETWORK_LABELS[network] : "等待当次指令"}
                  />
                  <InfoRow
                    label="地址"
                    value={
                      instructionExpired
                        ? "当次指令已过期，需重新获取"
                        : intent.depositAddress ?? "等待当次指令"
                    }
                    selectable={!instructionExpired}
                  />
                  <InfoRow
                    label="标签/Memo"
                    value={intent.depositTag ?? "无或等待指令"}
                    selectable={!instructionExpired}
                  />
                  <InfoRow
                    label="指令失效时间"
                    value={
                      intent.instructionsExpireAt
                        ? new Date(intent.instructionsExpireAt).toLocaleString()
                        : "未配置，不可转账"
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
                      提交入金指令申请
                    </Text>
                  </Pressable>
                ) : null}
                {intent.status === "WAITING_ACCOUNT" ? (
                  <Text style={styles.intentFootnote}>
                    等待后台核验该客户本人券商账户与交易授权；请勿上传券商密码、API Key 或验证码。
                  </Text>
                ) : null}

                {intent.status === "READY_TO_FUND" ? (
                  <View style={styles.txForm}>
                    {instructionExpired ? (
                      <View style={styles.gateWarning}>
                        <MaterialIcons name="timer-off" size={20} color={V2.amber} />
                        <View style={styles.gateCopy}>
                          <Text style={styles.gateTitle}>当次入金指令已过期</Text>
                          <Text style={styles.gateText}>
                            不要复用或复制旧地址/标签，请重新获取当次指令。如果您已经实际在链上转出，仍可以提交 txHash 作为晚到/异常申报，但不代表券商已入账。
                          </Text>
                        </View>
                      </View>
                    ) : null}
                    <Text style={styles.txTitle}>转账后提交 txHash</Text>
                    <Text style={styles.txHelp}>
                      {network === "SOLANA"
                        ? "Solana 签名通常较长；页面不会按 64 位十六进制误判。"
                        : "TRON / Ethereum / BSC 等网络按 64 位十六进制交易哈希校验；最终以服务端校验为准。"}
                    </Text>
                    <TextInput
                      accessibilityLabel="交易哈希"
                      value={txHash}
                      onChangeText={setTxHash}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="粘贴本次交易 txHash / Solana 签名"
                      placeholderTextColor={V2.textDim}
                      style={styles.txInput}
                    />
                    {instructionExpired ? (
                      <ConfirmLine
                        checked={lateTransferAttested}
                        onPress={() =>
                          setLateTransferAttested((current) => !current)
                        }
                        text="我确认这是已经发生的链上转出，现仅提交晚到/异常申报，不会再向过期地址转账。"
                      />
                    ) : null}
                    {fundingPath === "PLATFORM_COLLECTION" ? (
                      <>
                        <TextInput
                          accessibilityLabel="付款钱包地址"
                          value={payerWalletAddress}
                          onChangeText={setPayerWalletAddress}
                          autoCapitalize="none"
                          autoCorrect={false}
                          placeholder="本次付款钱包地址"
                          placeholderTextColor={V2.textDim}
                          style={styles.txInput}
                        />
                        <ConfirmLine
                          checked={payerOwnershipAttested}
                          onPress={() =>
                            setPayerOwnershipAttested((value) => !value)
                          }
                          text="我声明该付款钱包由本人或已授权主体控制，可接受合规筛查"
                        />
                      </>
                    ) : null}
                    <TextInput
                      accessibilityLabel="申报 USDT 金额"
                      value={declaredAmount}
                      onChangeText={(value) =>
                        setDeclaredAmount(value.replace(/[^0-9.]/g, ""))
                      }
                      keyboardType="decimal-pad"
                      placeholder="申报 USDT 金额"
                      placeholderTextColor={V2.textDim}
                      style={styles.txInput}
                    />
                    <ConfirmLine
                      checked={confirmedNetwork}
                      onPress={() => setConfirmedNetwork((value) => !value)}
                      text="我已逐字核对网络与当次指令完全一致"
                    />
                    <ConfirmLine
                      checked={confirmedAddress}
                      onPress={() => setConfirmedAddress((value) => !value)}
                      text="我确认地址/标签来自本入金单，没有复用历史地址"
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
                          ? "正在提交"
                          : "提交 txHash 等待核对"}
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
                    客户侧仅显示待入金、确认中、转入券商中、已到账或异常；
                    当前进度来自后台记录，不代表自动转币或自动交易。
                  </Text>
                ) : null}
              </View>
            )}
          </Section>
        ) : null}

        <Section
          index="05"
          title="异常与三账隔离"
          detail="少付、多付、错链、迟到、标签遗漏与未到账都进入独立人工核对。"
        >
          <View style={styles.warningGrid}>
            {BROKER_FUNDING_WARNINGS.map((warning) => (
              <View key={warning} style={styles.warningCard}>
                <MaterialIcons name="warning-amber" size={17} color={V2.amber} />
                <Text style={styles.warningText}>{warning}</Text>
              </View>
            ))}
          </View>
          <View style={styles.ledgerNotice}>
            <Text style={styles.ledgerTitle}>账务边界</Text>
            <Text style={styles.ledgerText}>
              ① EA 商城销售款 ② 客户直充券商 ③ 资管平台代收，三套订单、地址、txHash、
              对账与异常记录严格隔离。平台代收不展示全局共用地址，私钥不进入业务平台；
              任何转出都要经过动态验证，在外部企业钱包完成，并记录转出 txHash。
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

function OfficialLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [styles.officialLink, pressed && styles.pressed]}
    >
      <Text style={styles.officialLinkText}>{label} · 官方站点</Text>
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
  pageMobile: { paddingHorizontal: V2_LAYOUT.pagePaddingMobile, paddingTop: 12 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start" },
  backText: { color: V2.textMuted, fontSize: 10, fontWeight: "800" },
  header: { flexDirection: "row", alignItems: "stretch", gap: 18 },
  headerMobile: { flexDirection: "column" },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  title: { color: V2.text, fontSize: 30, lineHeight: 37, fontWeight: "900" },
  titleMobile: { fontSize: 24, lineHeight: 31 },
  subtitle: { color: V2.textMuted, fontSize: 11, lineHeight: 18, maxWidth: 760 },
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
  summaryGrid: { flexDirection: "row", gap: 1, borderWidth: 1, borderColor: V2.border, borderRadius: 6, overflow: "hidden" },
  summaryGridMobile: { flexWrap: "wrap" },
  summaryCard: { flex: 1, minWidth: 170, padding: 13, gap: 5, backgroundColor: V2.backgroundRaised },
  summaryLabel: { color: V2.textDim, fontSize: 9 },
  summaryValue: { color: V2.text, fontSize: 13, fontWeight: "900" },
  section: { padding: 16, borderWidth: 1, borderColor: V2.border, borderRadius: 6, backgroundColor: V2.backgroundRaised, gap: 14 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  sectionIndex: { color: V2.gold, fontSize: 10, fontWeight: "900", paddingTop: 3 },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { color: V2.text, fontSize: 16, fontWeight: "900" },
  sectionDetail: { color: V2.textMuted, fontSize: 10, lineHeight: 16 },
  brokerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  brokerCard: { flex: 1, minWidth: 260, padding: 13, borderWidth: 1, borderColor: V2.border, borderRadius: 5, backgroundColor: V2.surfaceMuted, gap: 9 },
  strategyAccent: { width: 5, minHeight: 34, borderRadius: 3 },
  brokerTopline: { flexDirection: "row", alignItems: "center", gap: 9 },
  brokerCode: { width: 38, height: 38, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  brokerCodeText: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  brokerCopy: { flex: 1, gap: 2 },
  brokerName: { color: V2.text, fontSize: 13, fontWeight: "900" },
  brokerMeta: { color: V2.green, fontSize: 8, fontWeight: "800" },
  brokerDetail: { color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  weightRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  weightLabel: { flex: 1, color: V2.textDim, fontSize: 8, fontWeight: "800" },
  weightInput: { width: 68, minHeight: 34, paddingHorizontal: 8, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, color: V2.text, fontSize: 10, textAlign: "right" },
  weightUnit: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  weightFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 },
  weightTotal: { fontSize: 9, fontWeight: "900" },
  equalizeButton: { minHeight: 30, paddingHorizontal: 9, borderWidth: 1, borderColor: V2.border, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 5 },
  equalizeText: { color: V2.gold, fontSize: 8, fontWeight: "900" },
  linkRow: { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: V2.border },
  officialLink: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" },
  officialLinkText: { color: V2.gold, fontSize: 9, fontWeight: "800" },
  portalNotice: { padding: 11, flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderColor: "rgba(83,159,255,0.3)", borderRadius: 5 },
  portalNoticeText: { flex: 1, color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  networkRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 },
  networkChip: { paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 3 },
  networkChipText: { color: V2.text, fontSize: 9, fontWeight: "800" },
  networkHint: { color: V2.textDim, fontSize: 8 },
  steps: { gap: 8 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  stepIndex: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(216,188,131,0.1)", alignItems: "center", justifyContent: "center" },
  stepIndexText: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  stepText: { flex: 1, color: V2.text, fontSize: 10, lineHeight: 15 },
  gateWarning: { padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 9, borderWidth: 1, borderColor: "rgba(231,183,95,0.34)", borderRadius: 5, backgroundColor: "rgba(231,183,95,0.05)" },
  gateCopy: { flex: 1, gap: 3 },
  gateTitle: { color: V2.amber, fontSize: 11, fontWeight: "900" },
  gateText: { color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  actionBlock: { gap: 9 },
  actionHelp: { color: V2.textMuted, fontSize: 10, lineHeight: 16 },
  primaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 4, backgroundColor: V2.gold, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "flex-start" },
  primaryButtonText: { color: V2.background, fontSize: 10, fontWeight: "900" },
  secondaryButton: { minHeight: 40, paddingHorizontal: 14, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  secondaryButtonText: { color: V2.text, fontSize: 10, fontWeight: "900" },
  errorText: { color: V2.red, fontSize: 9, lineHeight: 14 },
  savedCard: { padding: 13, borderWidth: 1, borderColor: "rgba(66,211,161,0.32)", borderRadius: 5, backgroundColor: "rgba(66,211,161,0.04)", gap: 5 },
  savedTopline: { flexDirection: "row", alignItems: "center", gap: 7 },
  savedStatus: { color: V2.green, fontSize: 9, fontWeight: "900" },
  savedNo: { color: V2.text, fontSize: 14, fontWeight: "900" },
  savedText: { color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  slotTabs: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  slotTab: { minHeight: 36, paddingHorizontal: 12, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  slotTabActive: { borderColor: V2.gold, backgroundColor: "rgba(216,188,131,0.07)" },
  slotTabText: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  slotTabTextActive: { color: V2.gold },
  slotTotal: { color: V2.green, fontSize: 9, lineHeight: 14, fontWeight: "900" },
  intentCard: { padding: 14, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 5, backgroundColor: V2.surfaceMuted, gap: 12 },
  intentHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  intentEyebrow: { color: V2.textDim, fontSize: 8 },
  intentNo: { marginTop: 3, color: V2.text, fontSize: 13, fontWeight: "900" },
  statusPill: { paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(66,211,161,0.34)", borderRadius: 3 },
  statusText: { color: V2.green, fontSize: 8, fontWeight: "900" },
  intentRows: { borderTopWidth: 1, borderTopColor: V2.border },
  infoRow: { minHeight: 39, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: V2.border, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  infoLabel: { width: 78, color: V2.textDim, fontSize: 9, lineHeight: 14 },
  infoValue: { flex: 1, color: V2.text, fontSize: 9, lineHeight: 14, fontWeight: "800", textAlign: "right" },
  txForm: { gap: 9, paddingTop: 5 },
  txTitle: { color: V2.text, fontSize: 12, fontWeight: "900" },
  txHelp: { color: V2.textMuted, fontSize: 9, lineHeight: 14 },
  txInput: { minHeight: 43, paddingHorizontal: 11, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, color: V2.text, fontSize: 10 },
  confirmLine: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  confirmText: { flex: 1, color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  intentFootnote: { color: V2.textDim, fontSize: 8, lineHeight: 14 },
  warningGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  warningCard: { flex: 1, minWidth: 250, padding: 10, borderWidth: 1, borderColor: "rgba(231,183,95,0.28)", borderRadius: 4, flexDirection: "row", alignItems: "flex-start", gap: 7 },
  warningText: { flex: 1, color: V2.textMuted, fontSize: 9, lineHeight: 15 },
  ledgerNotice: { padding: 12, borderWidth: 1, borderColor: "rgba(216,188,131,0.3)", borderRadius: 5, gap: 4 },
  ledgerTitle: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  ledgerText: { color: V2.textMuted, fontSize: 9, lineHeight: 16 },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.72 },
});
