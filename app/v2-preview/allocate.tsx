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
import { V2ErrorState, V2LoadingState } from "@/components/v2/page-state";
import {
  SelectionInspector,
  type SelectionInspectorItem,
} from "@/components/v2/selection-inspector";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
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
import {
  localizePlatforms,
  localizeStrategies,
  localizeStrategy,
} from "@/lib/v2/localized-content";
import type { CoreStrategy, PlatformProfile } from "@/shared/v2/contracts";

type RiskProfile = AllocationDraft["riskBudget"]["profile"];

export default function AllocationPage() {
  const {
    strategyId,
    strategyIds,
    platformIds,
    capital: requestedCapital,
    risk: requestedRisk,
  } = useLocalSearchParams<{
    strategyId?: string;
    strategyIds?: string;
    platformIds?: string;
    capital?: string;
    risk?: string;
  }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const dragEnabled = Platform.OS === "web" && !isMobile;
  const { language, locale, text } = useLanguage();
  const [draft, setDraft] = useState<AllocationDraft>();
  const [capitalFocused, setCapitalFocused] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
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
      ).slice(0, 3),
    [platformIds],
  );
  const strategies = trpc.v2.strategies.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  const platforms = trpc.v2.platforms.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  const validate = trpc.v2.allocation.validate.useMutation();
  const recommend = trpc.v2.allocation.recommend.useMutation();

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
    const timer = setTimeout(() => validate.mutate(draft), 420);
    return () => clearTimeout(timer);
  }, [draft]);

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
    return (
      <V2LoadingState
        label={text(
          "正在生成分仓草稿",
          "Generating allocation draft",
          "جارٍ إنشاء مسودة التوزيع",
        )}
      />
    );
  }
  if (!strategies.data || !platforms.data || !draft) {
    return (
      <V2ErrorState
        title={text(
          "分仓配置暂时不可用",
          "Allocation is temporarily unavailable",
          "التوزيع غير متاح مؤقتا",
        )}
        detail={
          strategies.error?.message ||
          platforms.error?.message ||
          recommend.error?.message ||
          text(
            "没有取得配置数据。",
            "No configuration data was returned.",
            "لم يتم استلام بيانات الإعداد.",
          )
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
  const visibleStrategies = localizeStrategies(strategies.data, language);
  const visiblePlatforms = localizePlatforms(platforms.data, language);
  const dropReasonLabel = (reason: keyof typeof STRATEGY_DROP_REASON_LABEL) =>
    reason === "INCOMPATIBLE"
      ? text(
          STRATEGY_DROP_REASON_LABEL[reason],
          "This platform does not support the strategy",
          "هذه المنصة لا تدعم الاستراتيجية",
        )
      : reason === "OFFLINE"
        ? text(
            STRATEGY_DROP_REASON_LABEL[reason],
            "The strategy feed is offline and cannot be added",
            "مصدر الاستراتيجية غير متصل ولا يمكن إضافتها",
          )
        : text(
            STRATEGY_DROP_REASON_LABEL[reason],
            "The strategy is already in this platform bucket",
            "الاستراتيجية موجودة بالفعل في حاوية المنصة",
          );

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
      draft.platformBuckets.length >= 3 ||
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
        message: dropReasonLabel(verdict.reason),
      });
      return;
    }
    const strategy = strategies.data?.find((item) => item.id === strategyId);
    updateBucket(index, appendStrategyToBucket(bucket, strategyId));
    setDropFlash({
      platformId: platform.id,
      kind: "success",
      message: text(
        `已加入「${strategy?.shortName ?? strategyId}」`,
        `${strategy ? localizeStrategy(strategy, language).shortName : strategyId} added`,
        `تمت إضافة ${strategy ? localizeStrategy(strategy, language).shortName : strategyId}`,
      ),
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
        message: dropReasonLabel(verdict.reason),
      });
      return;
    }
    setInspector({
      item: {
        kind: "strategy",
        strategy: localizeStrategy(strategy, language),
      },
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
          dropHover === platform.id
            ? text(
                "松开鼠标查看详情",
                "Release to review details",
                "أفلت لعرض التفاصيل",
              )
            : text(
                "可放入此平台桶",
                "Compatible with this platform",
                "متوافقة مع هذه المنصة",
              ),
      };
    }
    return {
      tone: "invalid",
      message: dropReasonLabel(verdict.reason),
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
    ? !inspectedPlatformSelected && draft.platformBuckets.length >= 3
    : false;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.page, isMobile && styles.pageMobile]}>
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>
              {text("分仓配置", "ALLOCATION BUILDER", "منشئ التوزيع")}
            </Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              {text(
                "券商模式精细选配",
                "Fine-tune the broker plan",
                "ضبط خطة الوسيط",
              )}
            </Text>
            <Text style={styles.subtitle}>
              {text(
                "选择 1 至 3 个平台，把核心策略分配到资金桶，再由规则引擎检查兼容性、集中度和风险预算。",
                "Choose one to three platforms, allocate core strategies to capital buckets, then validate compatibility, concentration and risk budget.",
                "اختر من منصة إلى ثلاث منصات ووزع الاستراتيجيات الأساسية على حاويات رأس المال، ثم تحقق من التوافق والتركيز وميزانية المخاطر.",
              )}
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
            <Text style={styles.recommendText}>
              {text("生成推荐方案", "Generate recommendation", "إنشاء توصية")}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.settings, isMobile && styles.settingsMobile]}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {text("资金基数", "Capital base", "رأس المال الأساسي")}
            </Text>
            <View
              style={[
                styles.moneyInput,
                capitalFocused && styles.moneyInputFocused,
              ]}
            >
              <TextInput
                accessibilityLabel={text(
                  "资金基数",
                  "Capital base",
                  "رأس المال الأساسي",
                )}
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
              <Text style={styles.currency}>{draft.capital.currency}</Text>
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {text("风险预算", "Risk budget", "ميزانية المخاطر")}
            </Text>
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
                      ? text("稳健", "Conservative", "محافظ")
                      : profile === "MEDIUM"
                        ? text("均衡", "Balanced", "متوازن")
                        : text("进取", "Growth", "نمو")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.budgetReadout}>
            <Text style={styles.budgetLabel}>
              {text(
                "模型回撤上限",
                "Modeled drawdown cap",
                "حد التراجع النموذجي",
              )}
            </Text>
            <Text style={styles.budgetValue}>
              {draft.riskBudget.maxDrawdownPct}%
            </Text>
          </View>
        </View>

        <View style={styles.platformPicker}>
          <View style={styles.pickerHeading}>
            <View>
              <Text style={styles.pickerTitle}>
                {text("平台资金桶", "Platform buckets", "حاويات المنصات")}
              </Text>
              <Text style={styles.pickerDetail}>
                {text(
                  `已选择 ${draft.platformBuckets.length} / 3`,
                  `Selected ${draft.platformBuckets.length} / 3`,
                  `تم اختيار ${draft.platformBuckets.length} / 3`,
                )}
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
              <Text style={styles.rebalanceText}>
                {text("自动均衡权重", "Balance weights", "موازنة الأوزان")}
              </Text>
            </Pressable>
          </View>
          <View style={styles.platformOptions}>
            {visiblePlatforms.map((platform) => {
              const selected = selectedPlatformIds.has(platform.id);
              const disabled = !selected && draft.platformBuckets.length >= 3;
              const hovered = hoveredPlatformId === platform.id;
              return (
                <Pressable
                  key={platform.id}
                  accessibilityRole="button"
                  accessibilityLabel={text(
                    `查看 ${platform.name} 平台详情`,
                    `View ${platform.name} details`,
                    `عرض تفاصيل ${platform.name}`,
                  )}
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
                        ? `${platform.commercialTerms.spreadLabel} · ${text("P50 出金", "Withdrawal P50", "السحب P50")} ${platform.commercialTerms.withdrawalP50Hours ?? "--"}h`
                        : `${platform.accountType} · ${text("最低", "Minimum", "الحد الأدنى")} ${platform.minimumCapital.toLocaleString(locale)} USD`}
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
              <Text style={styles.paletteTitle}>
                {text("策略面板", "Strategy palette", "لوحة الاستراتيجيات")}
              </Text>
              <Text style={styles.paletteDetail}>
                {text(
                  "悬停查看摘要；点击或拖入平台桶会先打开详情，确认后再加入方案。",
                  "Hover for a summary. Click or drag to a platform bucket to review details before adding.",
                  "مرر المؤشر لعرض الملخص. انقر أو اسحب إلى حاوية منصة لمراجعة التفاصيل قبل الإضافة.",
                )}
              </Text>
            </View>
            <View style={styles.paletteChips}>
              {visibleStrategies.map((strategy) => {
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
                      accessibilityLabel={text(
                        `查看 ${strategy.shortName} 选配详情`,
                        `Review ${strategy.shortName} allocation details`,
                        `عرض تفاصيل توزيع ${strategy.shortName}`,
                      )}
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
                            ? text(
                                "连接中断 · 暂不可拖入",
                                "Feed offline · Cannot add",
                                "المصدر غير متصل · لا يمكن الإضافة",
                              )
                            : hoveredStrategyId === strategy.id
                              ? `90D ${strategy.metrics.return90dPct ?? "--"}% · ${text("回撤", "DD", "تراجع")} ${strategy.metrics.maxDrawdownPct ?? "--"}%`
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
              const platform = visiblePlatforms.find(
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
                    strategies={visibleStrategies}
                    totalCapital={capital}
                    currency={draft.capital.currency}
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
              onValidate={() => validate.mutate(draft)}
              onConfirm={() => setSummaryVisible(true)}
            />
          </View>
        </View>
      </View>
      <ActionDialog
        visible={summaryVisible}
        title={text(
          "确认摘要已生成",
          "Confirmation summary generated",
          "تم إنشاء ملخص التأكيد",
        )}
        message={text(
          "当前是演示方案，不会开户、入金或执行交易。正式流程将增加客户确认、规则版本和审计凭证。",
          "This is a demo plan and will not open an account, deposit funds or execute trades. The live workflow adds client confirmation, rule versions and audit records.",
          "هذه خطة تجريبية ولن تفتح حسابا أو تودع أموالا أو تنفذ صفقات. تضيف العملية الحية تأكيد العميل وإصدارات القواعد وسجلات التدقيق.",
        )}
        tone="success"
        confirmLabel={text("知道了", "Done", "تم")}
        confirmOnly
        onConfirm={() => setSummaryVisible(false)}
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
              ? text("已选择此平台", "Platform selected", "تم اختيار المنصة")
              : inspectedPlatformDisabled
                ? text(
                    "最多选择三个平台",
                    "Maximum of three platforms",
                    "الحد الأقصى ثلاث منصات",
                  )
                : text("选择此平台", "Select platform", "اختيار المنصة")
            : inspectedStrategy && inspectorTargetIndex >= 0
              ? text(
                  `加入 ${platforms.data?.find((item) => item.id === draft.platformBuckets[inspectorTargetIndex]?.platformId)?.name ?? "兼容资金桶"}`,
                  `Add to ${platforms.data?.find((item) => item.id === draft.platformBuckets[inspectorTargetIndex]?.platformId)?.name ?? "compatible bucket"}`,
                  `إضافة إلى ${platforms.data?.find((item) => item.id === draft.platformBuckets[inspectorTargetIndex]?.platformId)?.name ?? "حاوية متوافقة"}`,
                )
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
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.7 },
});
