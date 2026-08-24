import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { ActionDialog } from "@/components/v2/action-dialog";
import { AllocationSummary } from "@/components/v2/allocation/allocation-summary";
import {
  PlatformBucketEditor,
  type BucketDropStatus,
} from "@/components/v2/allocation/platform-bucket";
import {
  DraggableStrategy,
  StrategyDropTarget,
} from "@/components/v2/allocation/web-dnd";
import {
  exitModeLabel,
  fundingRouteLabel,
  type ExitMode,
  type FundingRoute,
  type ManagedSessionDuration,
} from "@/components/v2/configurator/types";
import { buildManagedSessionDraft } from "@/components/v2/configurator/managed-session-draft";
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import {
  SelectionInspector,
  type SelectionInspectorItem,
} from "@/components/v2/selection-inspector";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import {
  STRATEGY_DROP_REASON_LABEL,
  appendStrategyToBucket,
  evaluateStrategyDrop,
  rebalanceBucket,
  rebalanceDraft,
} from "@/lib/v2/allocation";
import type {
  AllocationBucket,
  AllocationDraft,
} from "@/lib/v2/allocation-types";
import { trpc } from "@/lib/trpc";
import type { CoreStrategy, PlatformProfile } from "@/shared/v2/contracts";

type RiskProfile = AllocationDraft["riskBudget"]["profile"];

export default function AllocationPage() {
  const {
    strategyId,
    strategyIds,
    platformIds,
    capital: requestedCapital,
    risk: requestedRisk,
    durationDays: requestedDurationDays,
    exitMode: requestedExitMode,
    fundingRoutes: requestedFundingRoutes,
  } = useLocalSearchParams<{
    strategyId?: string;
    strategyIds?: string;
    platformIds?: string;
    capital?: string;
    risk?: string;
    durationDays?: string;
    exitMode?: string;
    fundingRoutes?: string;
  }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const dragEnabled = Platform.OS === "web" && !isMobile;
  const [draft, setDraft] = useState<AllocationDraft>();
  const [capitalFocused, setCapitalFocused] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [draftBuildError, setDraftBuildError] = useState<string>();
  const [draggedStrategyId, setDraggedStrategyId] = useState<string | null>(
    null,
  );
  const [dropHover, setDropHover] = useState<string | null>(null);
  const [dropFlash, setDropFlash] = useState<{
    platformId: string;
    kind: "success" | "reject";
    message: string;
  } | null>(null);
  const [inspector, setInspector] = useState<{
    item: SelectionInspectorItem;
    targetBucketIndex?: number;
  } | null>(null);
  const [hoveredPlatformId, setHoveredPlatformId] = useState<string | null>(
    null,
  );
  const [hoveredStrategyId, setHoveredStrategyId] = useState<string | null>(
    null,
  );
  const requestedInitial = useRef(false);
  const durationDays: ManagedSessionDuration =
    requestedDurationDays === "30"
      ? 30
      : requestedDurationDays === "180"
        ? 180
        : 90;
  const exitMode: ExitMode =
    requestedExitMode === "CLOSE_NOW" ||
    requestedExitMode === "HAND_BACK_POSITIONS"
      ? requestedExitMode
      : "NO_NEW_ENTRIES";
  const fundingRoutes = useMemo<FundingRoute[]>(() => {
    const requested = (requestedFundingRoutes?.split(",") ?? []).filter(
      (route): route is FundingRoute =>
        route === "DIRECT_BROKER" || route === "MANAGED_VAULT",
    );
    return requested.length
      ? Array.from(new Set(requested))
      : ["DIRECT_BROKER"];
  }, [requestedFundingRoutes]);
  const preferredStrategyIds = useMemo(
    () =>
      Array.from(
        new Set(
          [strategyId, ...(strategyIds?.split(",") ?? [])]
            .map((value) => value?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [strategyId, strategyIds],
  );
  const preferredPlatformIds = useMemo(
    () =>
      Array.from(
        new Set(
          (platformIds?.split(",") ?? [])
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ).slice(0, 2),
    [platformIds],
  );
  const strategies = trpc.v2.strategies.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  const platforms = trpc.v2.platforms.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  const managedCapabilities = trpc.v2.managedSessions.capabilities.useQuery(
    undefined,
    {
      staleTime: 60_000,
    },
  );
  const validate = trpc.v2.allocation.validate.useMutation();
  const validateDraft = validate.mutate;
  const recommend = trpc.v2.allocation.recommend.useMutation();
  const createSession = trpc.v2.managedSessions.create.useMutation();

  useEffect(() => {
    if (!strategies.data || !platforms.data || requestedInitial.current) return;
    requestedInitial.current = true;
    const initialCapital =
      requestedCapital && /^\d+(?:\.\d{1,2})?$/.test(requestedCapital)
        ? requestedCapital
        : "50000";
    const initialRisk: RiskProfile =
      requestedRisk === "LOW" ||
      requestedRisk === "HIGH" ||
      requestedRisk === "MEDIUM"
        ? requestedRisk
        : "MEDIUM";
    recommend.mutate(
      {
        capital: { amount: initialCapital, currency: "USD" },
        riskProfile: initialRisk,
        platformIds: preferredPlatformIds.length
          ? preferredPlatformIds
          : undefined,
        strategyIds: preferredStrategyIds.length
          ? preferredStrategyIds
          : undefined,
      },
      {
        onSuccess: (next) => {
          setDraft(
            includePreferredStrategies(
              next,
              preferredStrategyIds,
              strategies.data ?? [],
              platforms.data ?? [],
            ),
          );
        },
      },
    );
  }, [
    platforms.data,
    preferredPlatformIds,
    preferredStrategyIds,
    recommend,
    requestedCapital,
    requestedRisk,
    strategies.data,
  ]);

  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => validateDraft(draft), 420);
    return () => clearTimeout(timer);
  }, [draft, validateDraft]);

  useEffect(() => {
    if (!dropFlash) return;
    const timer = setTimeout(() => setDropFlash(null), 2600);
    return () => clearTimeout(timer);
  }, [dropFlash]);

  const selectedPlatformIds = useMemo(
    () =>
      new Set(draft?.platformBuckets.map((bucket) => bucket.platformId) ?? []),
    [draft?.platformBuckets],
  );

  if (strategies.isLoading || platforms.isLoading || recommend.isPending) {
    return <V2LoadingState label="正在生成分仓草稿" />;
  }
  if (!strategies.data || !platforms.data || !draft) {
    return (
      <V2ErrorState
        title="分仓配置暂时不可用"
        detail={
          strategies.error?.message ||
          platforms.error?.message ||
          recommend.error?.message ||
          "没有取得配置数据。"
        }
        onRetry={() => {
          requestedInitial.current = false;
          strategies.refetch();
          platforms.refetch();
        }}
      />
    );
  }

  const capital = Number(draft.capital.amount) || 0;

  const changeRisk = (profile: RiskProfile) => {
    const maxDrawdownPct = profile === "LOW" ? 8 : profile === "HIGH" ? 18 : 12;
    setDraft((current) =>
      current
        ? {
            ...current,
            source: "CUSTOM",
            riskBudget: { profile, maxDrawdownPct },
          }
        : current,
    );
  };

  const addPlatform = (platform: PlatformProfile) => {
    if (
      draft.platformBuckets.length >= 2 ||
      selectedPlatformIds.has(platform.id)
    )
      return;
    const initialStrategy = strategies.data.find(
      (strategy) =>
        platform.supportedStrategyIds.includes(strategy.id) &&
        strategy.source.freshness !== "OFFLINE",
    );
    if (!initialStrategy) return;
    setDraft(
      rebalanceDraft({
        ...draft,
        platformBuckets: [
          ...draft.platformBuckets,
          {
            platformId: platform.id,
            capitalWeightPct: 0,
            strategies: [
              {
                strategyId: initialStrategy.id,
                weightPct: 100,
                riskMultiplier: 0.8,
              },
            ],
          },
        ],
      }),
    );
  };

  const updateBucket = (index: number, bucket: AllocationBucket) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            source: "CUSTOM",
            platformBuckets: current.platformBuckets.map((item, itemIndex) =>
              itemIndex === index ? bucket : item,
            ),
          }
        : current,
    );
  };

  const removeBucket = (index: number) => {
    if (draft.platformBuckets.length <= 1) return;
    setDraft(
      rebalanceDraft({
        ...draft,
        platformBuckets: draft.platformBuckets.filter(
          (_, itemIndex) => itemIndex !== index,
        ),
      }),
    );
  };

  const requestRecommendation = () => {
    recommend.mutate(
      {
        capital: draft.capital,
        riskProfile: draft.riskBudget.profile,
        platformIds: draft.platformBuckets.map((bucket) => bucket.platformId),
        strategyIds: Array.from(
          new Set(
            draft.platformBuckets.flatMap((bucket) =>
              bucket.strategies.map((strategy) => strategy.strategyId),
            ),
          ),
        ),
      },
      { onSuccess: setDraft },
    );
  };

  const evaluateDropForBucket = (
    bucket: AllocationBucket,
    platform: PlatformProfile,
    strategyId: string,
  ) => {
    const strategy = strategies.data?.find((item) => item.id === strategyId);
    return evaluateStrategyDrop({
      bucket,
      supportedStrategyIds: platform.supportedStrategyIds,
      strategyId,
      strategyOffline: strategy?.source.freshness === "OFFLINE",
    });
  };

  const confirmStrategyAdd = (index: number, strategyId: string) => {
    const bucket = draft.platformBuckets[index];
    const platform = platforms.data?.find(
      (item) => item.id === bucket?.platformId,
    );
    if (!bucket || !platform) return;
    const verdict = evaluateDropForBucket(bucket, platform, strategyId);
    if (!verdict.allowed) {
      setDropFlash({
        platformId: platform.id,
        kind: "reject",
        message: STRATEGY_DROP_REASON_LABEL[verdict.reason],
      });
      return;
    }
    const strategy = strategies.data?.find((item) => item.id === strategyId);
    updateBucket(index, appendStrategyToBucket(bucket, strategyId));
    setDropFlash({
      platformId: platform.id,
      kind: "success",
      message: `已加入「${strategy?.shortName ?? strategyId}」`,
    });
  };

  const requestStrategyDrop = (index: number, strategyId: string) => {
    const bucket = draft.platformBuckets[index];
    const platform = platforms.data?.find(
      (item) => item.id === bucket?.platformId,
    );
    const strategy = strategies.data?.find((item) => item.id === strategyId);
    if (!bucket || !platform || !strategy) return;
    const verdict = evaluateDropForBucket(bucket, platform, strategyId);
    if (!verdict.allowed) {
      setDropFlash({
        platformId: platform.id,
        kind: "reject",
        message: STRATEGY_DROP_REASON_LABEL[verdict.reason],
      });
      return;
    }
    setInspector({
      item: { kind: "strategy", strategy },
      targetBucketIndex: index,
    });
  };

  const bucketDropStatus = (
    bucket: AllocationBucket,
    platform: PlatformProfile,
  ): BucketDropStatus | null => {
    if (!dragEnabled) return null;
    if (dropFlash?.platformId === platform.id) {
      return {
        tone: dropFlash.kind === "success" ? "success" : "reject",
        message: dropFlash.message,
      };
    }
    if (!draggedStrategyId) return null;
    const verdict = evaluateDropForBucket(bucket, platform, draggedStrategyId);
    if (verdict.allowed) {
      return {
        tone: "valid",
        message:
          dropHover === platform.id ? "松开鼠标查看详情" : "可放入此平台桶",
      };
    }
    return {
      tone: "invalid",
      message: STRATEGY_DROP_REASON_LABEL[verdict.reason],
    };
  };

  const inspectStrategy = (
    strategy: CoreStrategy,
    targetBucketIndex?: number,
  ) => {
    setInspector({ item: { kind: "strategy", strategy }, targetBucketIndex });
  };

  const inspectedStrategy =
    inspector?.item.kind === "strategy" ? inspector.item.strategy : null;
  const inspectedPlatform =
    inspector?.item.kind === "platform" ? inspector.item.platform : null;
  const inspectorTargetIndex = inspectedStrategy
    ? (inspector?.targetBucketIndex ??
      draft.platformBuckets.findIndex((bucket) => {
        const platform = platforms.data?.find(
          (item) => item.id === bucket.platformId,
        );
        return (
          !!platform &&
          evaluateDropForBucket(bucket, platform, inspectedStrategy.id).allowed
        );
      }))
    : -1;
  const inspectedPlatformSelected = inspectedPlatform
    ? selectedPlatformIds.has(inspectedPlatform.id)
    : false;
  const inspectedPlatformDisabled = inspectedPlatform
    ? !inspectedPlatformSelected && draft.platformBuckets.length >= 2
    : false;

  const createManagedSessionDraft = () => {
    try {
      const input = buildManagedSessionDraft({
        draft,
        strategies: strategies.data ?? [],
        durationDays,
        exitMode,
        fundingRoutes,
      });
      setDraftBuildError(undefined);
      createSession.reset();
      createSession.mutate(input, {
        onSuccess: () => setSummaryVisible(true),
        onError: () => setSummaryVisible(true),
      });
    } catch (error) {
      setDraftBuildError(
        error instanceof Error ? error.message : "资管会话草案生成失败。",
      );
      setSummaryVisible(true);
    }
  };

  const creationError = draftBuildError ?? createSession.error?.message;
  const createdSession = createSession.data;
  const unavailableStrategyCount =
    createdSession?.readiness.unavailableStrategyIds.length ?? 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>MANAGED SESSION</Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              资管会话执行槽精配
            </Text>
            <Text style={styles.subtitle}>
              选择 1–2
              个券商执行槽，把六策略分配到资金桶，再由规则引擎检查兼容性、集中度和风险预算。
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={requestRecommendation}
            disabled={recommend.isPending}
            style={({ pressed }) => [
              styles.recommendButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="auto-awesome" size={18} color={V2.gold} />
            <Text style={styles.recommendText}>生成推荐方案</Text>
          </Pressable>
        </View>

        <View
          style={[styles.sessionTerms, isMobile && styles.sessionTermsMobile]}
        >
          <View style={styles.sessionTermPrimary}>
            <View style={styles.sessionTermIcon}>
              <MaterialIcons name="schedule" size={22} color={V2.gold} />
            </View>
            <View style={styles.sessionTermCopy}>
              <Text style={styles.sessionTermLabel}>会话期限</Text>
              <Text style={styles.sessionTermValue}>{durationDays} 天</Text>
              <Text style={styles.sessionTermDetail}>
                退出：{exitModeLabel(exitMode)} · 交易权不含出金
              </Text>
            </View>
          </View>
          <View style={styles.sessionTermRoute}>
            <Text style={styles.sessionTermLabel}>USDT 资金路由</Text>
            <Text style={styles.sessionRouteValue}>
              {fundingRouteLabel(fundingRoutes)}
            </Text>
            <Text style={styles.sessionTermDetail}>
              {fundingRoutes.includes("MANAGED_VAULT")
                ? managedCapabilities.data?.vaultActivationEnabled
                  ? "Managed Vault 能力开关已开启；实际执行仍需逐槽完成托管、合约与授权核验。"
                  : "Managed Vault 当前为接入准备状态，未配置前不执行入金。"
                : "U 直达支持稳定币的合作券商账户。"}
            </Text>
          </View>
        </View>

        <View style={[styles.settings, isMobile && styles.settingsMobile]}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>USDT 名义资金</Text>
            <View
              style={[
                styles.moneyInput,
                capitalFocused && styles.moneyInputFocused,
              ]}
            >
              <TextInput
                accessibilityLabel="资金基数"
                onFocus={() => setCapitalFocused(true)}
                onBlur={() => setCapitalFocused(false)}
                value={draft.capital.amount}
                onChangeText={(value) => {
                  const clean = value.replace(/[^0-9.]/g, "");
                  if (!/^\d*(?:\.\d{0,2})?$/.test(clean)) return;
                  setDraft({
                    ...draft,
                    source: "CUSTOM",
                    capital: { ...draft.capital, amount: clean || "0" },
                  });
                }}
                keyboardType="decimal-pad"
                style={styles.input}
                placeholder="50000"
                placeholderTextColor={V2.textDim}
              />
              <Text style={styles.currency}>USDT</Text>
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>风险预算</Text>
            <View style={styles.riskControl}>
              {(["LOW", "MEDIUM", "HIGH"] as RiskProfile[]).map((profile) => (
                <Pressable
                  key={profile}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: draft.riskBudget.profile === profile,
                  }}
                  onPress={() => changeRisk(profile)}
                  style={[
                    styles.riskButton,
                    draft.riskBudget.profile === profile &&
                      styles.riskButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.riskText,
                      draft.riskBudget.profile === profile &&
                        styles.riskTextActive,
                    ]}
                  >
                    {profile === "LOW"
                      ? "稳健"
                      : profile === "MEDIUM"
                        ? "均衡"
                        : "进取"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.budgetReadout}>
            <Text style={styles.budgetLabel}>模型回撤上限</Text>
            <Text style={styles.budgetValue}>
              {draft.riskBudget.maxDrawdownPct}%
            </Text>
          </View>
        </View>

        <View style={styles.platformPicker}>
          <View style={styles.pickerHeading}>
            <View>
              <Text style={styles.pickerTitle}>平台资金桶</Text>
              <Text style={styles.pickerDetail}>
                已选择 {draft.platformBuckets.length} / 2
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraft(rebalanceDraft(draft))}
              style={({ pressed }) => [
                styles.rebalanceButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="balance" size={17} color={V2.text} />
              <Text style={styles.rebalanceText}>自动均衡权重</Text>
            </Pressable>
          </View>
          <View style={styles.platformOptions}>
            {platforms.data.map((platform) => {
              const selected = selectedPlatformIds.has(platform.id);
              const disabled = !selected && draft.platformBuckets.length >= 2;
              const hovered = hoveredPlatformId === platform.id;
              return (
                <Pressable
                  key={platform.id}
                  accessibilityRole="button"
                  accessibilityLabel={`查看 ${platform.name} 平台详情`}
                  accessibilityState={{ checked: selected, disabled }}
                  onHoverIn={() =>
                    Platform.OS === "web" && setHoveredPlatformId(platform.id)
                  }
                  onHoverOut={() =>
                    Platform.OS === "web" && setHoveredPlatformId(null)
                  }
                  onPress={() =>
                    setInspector({
                      item: {
                        kind: "platform",
                        platform,
                        strategies: strategies.data ?? [],
                      },
                    })
                  }
                  style={[
                    styles.platformOption,
                    selected && styles.platformOptionSelected,
                    disabled && styles.disabled,
                  ]}
                >
                  <View style={styles.platformOptionCode}>
                    <Text style={styles.platformOptionCodeText}>
                      {platform.code}
                    </Text>
                  </View>
                  <View style={styles.platformOptionCopy}>
                    <Text style={styles.platformOptionName}>
                      {platform.name}
                    </Text>
                    <Text style={styles.platformOptionMeta} numberOfLines={2}>
                      {hovered
                        ? `${platform.commercialTerms.spreadLabel} · P50 出金 ${platform.commercialTerms.withdrawalP50Hours ?? "--"}h`
                        : `${platform.accountType} · 参考门槛 ${platform.minimumCapital.toLocaleString("zh-CN")} USDT`}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={selected ? "check-circle" : "info-outline"}
                    size={20}
                    color={selected ? V2.green : V2.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {dragEnabled ? (
          <View style={styles.palette}>
            <View style={styles.paletteHeading}>
              <Text style={styles.paletteTitle}>策略面板</Text>
              <Text style={styles.paletteDetail}>
                悬停查看摘要；点击或拖入平台桶会先打开详情，确认后再加入方案。
              </Text>
            </View>
            <View style={styles.paletteChips}>
              {strategies.data.map((strategy) => {
                const offline = strategy.source.freshness === "OFFLINE";
                return (
                  <DraggableStrategy
                    key={strategy.id}
                    strategyId={strategy.id}
                    disabled={offline}
                    onDragStateChange={(id) => {
                      setDraggedStrategyId(id);
                      if (!id) setDropHover(null);
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`查看 ${strategy.shortName} 选配详情`}
                      onPress={() => inspectStrategy(strategy)}
                      onHoverIn={() =>
                        Platform.OS === "web" &&
                        setHoveredStrategyId(strategy.id)
                      }
                      onHoverOut={() =>
                        Platform.OS === "web" && setHoveredStrategyId(null)
                      }
                      style={[
                        styles.paletteChip,
                        offline && styles.paletteChipOffline,
                      ]}
                    >
                      <View
                        style={[
                          styles.paletteRail,
                          { backgroundColor: strategy.accent },
                        ]}
                      />
                      <View style={styles.paletteCopy}>
                        <Text style={styles.paletteName}>
                          {strategy.shortName}
                        </Text>
                        <Text style={styles.paletteMeta}>
                          {offline
                            ? "连接中断 · 暂不可拖入"
                            : hoveredStrategyId === strategy.id
                              ? `90D ${strategy.metrics.return90dPct ?? "--"}% · 回撤 ${strategy.metrics.maxDrawdownPct ?? "--"}%`
                              : strategy.style}
                        </Text>
                      </View>
                      <MaterialIcons
                        name={
                          hoveredStrategyId === strategy.id
                            ? "info-outline"
                            : "drag-indicator"
                        }
                        size={17}
                        color={V2.textDim}
                      />
                    </Pressable>
                  </DraggableStrategy>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={[styles.workspace, isMobile && styles.workspaceMobile]}>
          <View style={styles.bucketColumn}>
            {draft.platformBuckets.map((bucket, index) => {
              const platform = platforms.data.find(
                (item) => item.id === bucket.platformId,
              );
              if (!platform) return null;
              return (
                <StrategyDropTarget
                  key={bucket.platformId}
                  evaluate={(strategyId) =>
                    evaluateDropForBucket(bucket, platform, strategyId)
                  }
                  onDropStrategy={(strategyId) =>
                    requestStrategyDrop(index, strategyId)
                  }
                  onHoverChange={(hover) =>
                    setDropHover((current) =>
                      hover
                        ? platform.id
                        : current === platform.id
                          ? null
                          : current,
                    )
                  }
                >
                  <PlatformBucketEditor
                    bucket={bucket}
                    platform={platform}
                    strategies={strategies.data}
                    totalCapital={capital}
                    currency="USDT"
                    dropStatus={bucketDropStatus(bucket, platform)}
                    onChange={(next) => updateBucket(index, next)}
                    onRemove={() => removeBucket(index)}
                    onInspectStrategy={(strategy) =>
                      inspectStrategy(strategy, index)
                    }
                  />
                </StrategyDropTarget>
              );
            })}
          </View>
          <View
            style={[
              styles.summaryColumn,
              isMobile && styles.summaryColumnMobile,
            ]}
          >
            <AllocationSummary
              draft={draft}
              validation={validate.data}
              isValidating={validate.isPending}
              isCreating={createSession.isPending}
              onValidate={() => validateDraft(draft)}
              onConfirm={createManagedSessionDraft}
            />
            {createdSession ? (
              <View style={styles.createdSession}>
                <View style={styles.createdSessionTopline}>
                  <MaterialIcons
                    name="check-circle"
                    size={19}
                    color={V2.green}
                  />
                  <Text style={styles.createdSessionStatus}>
                    {createdSession.status}
                  </Text>
                </View>
                <Text style={styles.createdSessionNo}>
                  {createdSession.sessionNo}
                </Text>
                <Text style={styles.createdSessionDetail}>
                  草案已保存；交易授权 {createdSession.tradeAuthorizationStatus}
                  ，出金权 {createdSession.withdrawalPermission}
                  ，执行开关已关闭。
                </Text>
                {unavailableStrategyCount ? (
                  <Text style={styles.createdSessionWarning}>
                    {unavailableStrategyCount} 款策略当前离线；可保留在
                    DRAFT，但会阻断激活。
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <ActionDialog
        visible={summaryVisible}
        title={
          creationError ? "DRAFT 创建失败" : "Managed Session DRAFT 已创建"
        }
        message={
          creationError
            ? `${creationError} 草案未保存，也没有转移 USDT 或执行交易。`
            : `${createdSession?.sessionNo ?? "--"} · DRAFT。本次操作只保存可审阅会话，没有授予交易权、转移 USDT 或执行交易。`
        }
        tone={creationError ? "danger" : "success"}
        confirmLabel={creationError ? "重试创建" : "知道了"}
        confirmOnly={!creationError}
        onConfirm={() => {
          if (creationError) {
            setSummaryVisible(false);
            createManagedSessionDraft();
            return;
          }
          setSummaryVisible(false);
        }}
        onCancel={() => setSummaryVisible(false)}
      />
      <SelectionInspector
        item={inspector?.item ?? null}
        onClose={() => setInspector(null)}
        onOpenStrategy={(id) => {
          setInspector(null);
          router.push(`/v2-preview/strategies/${id}` as never);
        }}
        onSelect={
          inspectedPlatform
            ? () => {
                if (!inspectedPlatformSelected && !inspectedPlatformDisabled)
                  addPlatform(inspectedPlatform);
                setInspector(null);
              }
            : inspectedStrategy && inspectorTargetIndex >= 0
              ? () => {
                  confirmStrategyAdd(
                    inspectorTargetIndex,
                    inspectedStrategy.id,
                  );
                  setInspector(null);
                }
              : undefined
        }
        selectDisabled={
          !!inspectedPlatform &&
          (inspectedPlatformSelected || inspectedPlatformDisabled)
        }
        selectLabel={
          inspectedPlatform
            ? inspectedPlatformSelected
              ? "已选择此平台"
              : inspectedPlatformDisabled
                ? "最多选择两个券商执行槽"
                : "选择此平台"
            : inspectedStrategy && inspectorTargetIndex >= 0
              ? `加入 ${platforms.data?.find((item) => item.id === draft.platformBuckets[inspectorTargetIndex]?.platformId)?.name ?? "兼容资金桶"}`
              : undefined
        }
      />
    </ScrollView>
  );
}

function includePreferredStrategies(
  draft: AllocationDraft,
  strategyIds: string[],
  strategies: CoreStrategy[],
  platforms: PlatformProfile[],
) {
  return strategyIds.reduce((current, strategyId) => {
    if (
      current.platformBuckets.some((bucket) =>
        bucket.strategies.some((item) => item.strategyId === strategyId),
      )
    ) {
      return current;
    }
    const strategy = strategies.find(
      (item) => item.id === strategyId && item.source.freshness !== "OFFLINE",
    );
    if (!strategy) return current;
    const bucketIndex = current.platformBuckets.findIndex((bucket) => {
      const platform = platforms.find((item) => item.id === bucket.platformId);
      return platform?.supportedStrategyIds.includes(strategy.id);
    });
    if (bucketIndex < 0) return current;
    return {
      ...current,
      source: "CUSTOM" as const,
      platformBuckets: current.platformBuckets.map((bucket, index) =>
        index === bucketIndex
          ? rebalanceBucket({
              ...bucket,
              strategies: [
                ...bucket.strategies,
                { strategyId: strategy.id, weightPct: 0, riskMultiplier: 0.8 },
              ],
            })
          : bucket,
      ),
    };
  }, draft);
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: V2.background },
  scrollContent: { paddingBottom: 60 },
  page: {
    width: "100%",
    maxWidth: V2_LAYOUT.maxWidth,
    alignSelf: "center",
    paddingHorizontal: V2_LAYOUT.pagePaddingDesktop,
    paddingTop: 26,
    gap: 28,
  },
  pageMobile: {
    paddingHorizontal: V2_LAYOUT.pagePaddingMobile,
    paddingTop: 18,
  },
  header: {
    minHeight: 118,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 22,
  },
  headerMobile: { alignItems: "stretch", flexDirection: "column" },
  headerCopy: { flex: 1, minWidth: 0, gap: 6 },
  eyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  title: {
    color: V2.text,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "900",
    letterSpacing: 0,
  },
  titleMobile: { fontSize: 29, lineHeight: 36 },
  subtitle: {
    color: V2.textMuted,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 760,
  },
  recommendButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.46)",
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(216,188,131,0.06)",
  },
  recommendText: { color: V2.text, fontSize: 12, fontWeight: "900" },
  sessionTerms: {
    minHeight: 92,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.38)",
    borderRadius: 6,
    backgroundColor: "rgba(216,188,131,0.05)",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
  },
  sessionTermsMobile: { flexDirection: "column" },
  sessionTermPrimary: {
    flex: 1,
    minWidth: 240,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  sessionTermIcon: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.4)",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionTermCopy: { flex: 1, minWidth: 0, gap: 3 },
  sessionTermRoute: {
    flex: 1.25,
    minWidth: 280,
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: V2.border,
    justifyContent: "center",
    gap: 3,
  },
  sessionTermLabel: { color: V2.textDim, fontSize: 9, fontWeight: "800" },
  sessionTermValue: { color: V2.gold, fontSize: 18, fontWeight: "900" },
  sessionRouteValue: { color: V2.text, fontSize: 13, fontWeight: "900" },
  sessionTermDetail: { color: V2.textMuted, fontSize: 9, lineHeight: 14 },
  settings: {
    minHeight: 80,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 18,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
  },
  settingsMobile: { alignItems: "stretch", flexDirection: "column" },
  field: { minWidth: 220, gap: 6 },
  fieldLabel: { color: V2.textDim, fontSize: 10, fontWeight: "800" },
  moneyInput: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    overflow: "hidden",
  },
  moneyInputFocused: { borderColor: V2.gold },
  input: {
    flex: 1,
    height: 38,
    paddingHorizontal: 11,
    color: V2.text,
    fontSize: 13,
    fontWeight: "800",
    outlineStyle: "none",
  } as any,
  currency: {
    width: 48,
    color: V2.textMuted,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  riskControl: {
    height: 38,
    padding: 3,
    flexDirection: "row",
    gap: 2,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    backgroundColor: V2.surfaceMuted,
  },
  riskButton: {
    flex: 1,
    minWidth: 62,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  riskButtonActive: { backgroundColor: V2.surface },
  riskText: { color: V2.textMuted, fontSize: 11, fontWeight: "700" },
  riskTextActive: { color: V2.gold, fontWeight: "900" },
  budgetReadout: {
    marginLeft: "auto",
    minWidth: 138,
    minHeight: 38,
    justifyContent: "center",
    gap: 4,
  },
  budgetLabel: { color: V2.textDim, fontSize: 10 },
  budgetValue: { color: V2.amber, fontSize: 17, fontWeight: "900" },
  platformPicker: { gap: 12 },
  pickerHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  pickerTitle: { color: V2.text, fontSize: 15, fontWeight: "900" },
  pickerDetail: { marginTop: 3, color: V2.textDim, fontSize: 10 },
  rebalanceButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rebalanceText: { color: V2.text, fontSize: 11, fontWeight: "800" },
  platformOptions: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  platformOption: {
    flex: 1,
    minWidth: 250,
    minHeight: 66,
    padding: 11,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: V2.surfaceMuted,
  },
  platformOptionSelected: {
    borderColor: "rgba(66,211,161,0.36)",
    backgroundColor: "rgba(66,211,161,0.05)",
  },
  platformOptionCode: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.34)",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  platformOptionCodeText: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  platformOptionCopy: { flex: 1, minWidth: 0, gap: 3 },
  platformOptionName: { color: V2.text, fontSize: 13, fontWeight: "900" },
  platformOptionMeta: { color: V2.textMuted, fontSize: 10, lineHeight: 14 },
  palette: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
  },
  paletteHeading: { gap: 3 },
  paletteTitle: { color: V2.text, fontSize: 14, fontWeight: "900" },
  paletteDetail: { color: V2.textMuted, fontSize: 11, lineHeight: 17 },
  paletteChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paletteChip: {
    minHeight: 46,
    minWidth: 168,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: V2.surfaceMuted,
    userSelect: "none",
  } as any,
  paletteChipOffline: { opacity: 0.45 },
  paletteRail: { width: 3, height: 24 },
  paletteCopy: { gap: 2 },
  paletteName: { color: V2.text, fontSize: 12, fontWeight: "900" },
  paletteMeta: { color: V2.textMuted, fontSize: 10 },
  workspace: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  workspaceMobile: { flexDirection: "column" },
  bucketColumn: { flex: 1, minWidth: 0, gap: 13 },
  summaryColumn: { width: 330, flexShrink: 0 },
  summaryColumnMobile: { width: "100%" },
  createdSession: {
    marginTop: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(66,211,161,0.35)",
    borderRadius: 6,
    backgroundColor: "rgba(66,211,161,0.05)",
    gap: 5,
  },
  createdSessionTopline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  createdSessionStatus: { color: V2.green, fontSize: 10, fontWeight: "900" },
  createdSessionNo: { color: V2.text, fontSize: 15, fontWeight: "900" },
  createdSessionDetail: { color: V2.textMuted, fontSize: 9, lineHeight: 14 },
  createdSessionWarning: { color: V2.amber, fontSize: 9, lineHeight: 14 },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.7 },
});
