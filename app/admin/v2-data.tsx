import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { ActionDialog } from "@/components/v2/action-dialog";
import { StatusBadge } from "@/components/v2/status-badge";
import { V2ErrorState } from "@/components/v2/page-state";
import { V2, V2_LAYOUT } from "@/components/v2/tokens";
import {
  dataEditorFormToOverride,
  overrideToDataEditorForm,
  type StrategyDataEditorForm,
} from "@/lib/v2/data-editor";
import { trpc } from "@/lib/trpc";

const METRIC_FIELDS: Array<{
  key: keyof StrategyDataEditorForm["metrics"];
  label: string;
  suffix?: string;
}> = [
  { key: "return30dPct", label: "近 30 日", suffix: "%" },
  { key: "return90dPct", label: "近 90 日", suffix: "%" },
  { key: "totalReturnPct", label: "累计收益", suffix: "%" },
  { key: "todayPnlPct", label: "今日收益", suffix: "%" },
  { key: "maxDrawdownPct", label: "最大回撤", suffix: "%" },
  { key: "winRatePct", label: "胜率", suffix: "%" },
  { key: "tradeCount", label: "交易次数" },
  { key: "avgHoldingMinutes", label: "平均持仓", suffix: "分钟" },
  { key: "balance", label: "余额", suffix: "USD" },
  { key: "equity", label: "净值", suffix: "USD" },
  { key: "floatingPnl", label: "浮动盈亏", suffix: "USD" },
];

export default function V2DataAdminPage() {
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const [selectedId, setSelectedId] = useState<string>();
  const [form, setForm] = useState<StrategyDataEditorForm>();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();
  const [pendingDeleteId, setPendingDeleteId] = useState<string>();
  const utils = trpc.useUtils();
  const list = trpc.v2.adminData.list.useQuery(undefined, { staleTime: 10_000 });
  const selected = useMemo(
    () => list.data?.find((item) => item.strategy.id === selectedId),
    [list.data, selectedId],
  );

  useEffect(() => {
    if (!selectedId && list.data?.[0]) setSelectedId(list.data[0].strategy.id);
  }, [list.data, selectedId]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setForm(undefined);
    setMessage(undefined);
    if (selected.override) {
      setForm(overrideToDataEditorForm(selected.override));
      return () => { active = false; };
    }
    void utils.client.v2.adminData.sample
      .query({ strategyId: selected.strategy.id, mode: "CUSTOM" })
      .then((sample) => {
        if (active) setForm(overrideToDataEditorForm(sample));
      })
      .catch((error) => {
        if (active) setMessage({ tone: "error", text: error.message || "无法生成初始数据。" });
      });
    return () => { active = false; };
  }, [selected?.recordId, selected?.strategy.id, utils.client.v2.adminData.sample]);

  const refreshQueries = async () => {
    await Promise.all([
      utils.v2.adminData.list.invalidate(),
      utils.v2.overview.invalidate(),
      utils.v2.strategies.list.invalidate(),
      utils.v2.strategies.byId.invalidate(),
    ]);
  };

  const save = trpc.v2.adminData.save.useMutation({
    onSuccess: async () => {
      await refreshQueries();
      setMessage({ tone: "ok", text: "数据已保存，前台将在下一次查询时读取。" });
    },
    onError: (error) => setMessage({ tone: "error", text: error.message }),
  });
  const remove = trpc.v2.adminData.delete.useMutation({
    onSuccess: async () => {
      await refreshQueries();
      setMessage({ tone: "ok", text: "已恢复为当前数据源。" });
    },
    onError: (error) => setMessage({ tone: "error", text: error.message }),
  });

  const loadCurrent = async (mode: StrategyDataEditorForm["mode"] = form?.mode ?? "CUSTOM") => {
    if (!selected) return;
    try {
      const sample = await utils.client.v2.adminData.sample.query({
        strategyId: selected.strategy.id,
        mode,
      });
      setForm(overrideToDataEditorForm(sample));
      setMessage({ tone: "ok", text: "已载入当前展示数据，确认后再保存。" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "载入失败。" });
    }
  };

  const requestDelete = () => {
    if (!selected?.override || remove.isPending) return;
    setPendingDeleteId(selected.strategy.id);
  };

  if (list.isError) {
    return (
      <V2ErrorState
        detail={list.error.message || "无法读取六策略数据配置。"}
        onRetry={() => list.refetch()}
      />
    );
  }

  if (list.isLoading || !selected || !form) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={V2.gold} />
        <Text style={styles.muted}>正在读取六策略数据配置</Text>
      </View>
    );
  }

  const submit = () => {
    try {
      setMessage(undefined);
      save.mutate(dataEditorFormToOverride(selected.strategy.id, form));
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "数据格式有误。" });
    }
  };

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, isMobile && styles.pageMobile]}>
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>V2 DATA STUDIO</Text>
            <Text style={[styles.title, isMobile && styles.titleMobile]}>策略数据与实盘接管</Text>
            <Text style={styles.subtitle}>
              实盘接入前可编辑历史指标和净值；接入后以接管时间为界，历史段保持不变，后续点只由实盘数据源写入。
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" onPress={() => loadCurrent()} style={styles.secondaryButton}>
              <MaterialIcons name="refresh" size={17} color={V2.text} />
              <Text style={styles.secondaryText}>载入当前数据</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={submit} disabled={save.isPending} style={styles.saveButton}>
              <MaterialIcons name="save" size={17} color={V2.background} />
              <Text style={styles.saveText}>{save.isPending ? "保存中" : "保存数据"}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {list.data?.map((item) => {
            const active = item.strategy.id === selected.strategy.id;
            return (
              <Pressable
                key={item.strategy.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedId(item.strategy.id)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.strategy.shortName}</Text>
                <View style={[styles.tabDot, { backgroundColor: item.override ? V2.blue : V2.textDim }]} />
              </Pressable>
            );
          })}
        </ScrollView>

        {message ? (
          <View style={[styles.message, message.tone === "error" ? styles.messageError : styles.messageOk]}>
            <MaterialIcons name={message.tone === "error" ? "error-outline" : "check-circle-outline"} size={17} color={message.tone === "error" ? V2.red : V2.green} />
            <Text style={styles.messageText}>{message.text}</Text>
          </View>
        ) : null}

        <View style={styles.sourceRow}>
          <View style={styles.sourceCopy}>
            <Text style={styles.sectionTitle}>{selected.strategy.name}</Text>
            <Text style={styles.sectionDetail}>{selected.override ? "当前使用后台自定义数据" : "尚未保存覆盖，当前继承提供方数据"}</Text>
          </View>
          <StatusBadge dataMode={selected.strategy.source.dataMode} freshness={selected.strategy.source.freshness} />
          {selected.override ? (
            <Pressable accessibilityRole="button" onPress={requestDelete} style={styles.iconButton} accessibilityLabel="恢复当前数据源">
              <MaterialIcons name="delete-outline" size={19} color={V2.red} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>数据模式</Text>
          <View style={styles.modeControl}>
            {(["CUSTOM", "HYBRID"] as const).map((mode) => {
              const active = form.mode === mode;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => setForm({
                    ...form,
                    mode,
                    historyHandoverAt: mode === "HYBRID"
                      ? form.historyHandoverAt || new Date().toISOString()
                      : "",
                  })}
                  style={[styles.modeButton, active && styles.modeButtonActive]}
                >
                  <MaterialIcons name={mode === "CUSTOM" ? "edit-note" : "swap-horiz"} size={18} color={active ? V2.gold : V2.textMuted} />
                  <View>
                    <Text style={[styles.modeTitle, active && styles.modeTitleActive]}>{mode === "CUSTOM" ? "自定义历史" : "历史 → 实盘"}</Text>
                    <Text style={styles.modeDetail}>{mode === "CUSTOM" ? "完全使用后台填写的数据" : "接管线之后只读取实盘点"}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {form.mode === "HYBRID" ? (
            <LabeledInput
              label="实盘接管时间（ISO）"
              value={form.historyHandoverAt}
              onChangeText={(value) => setForm({ ...form, historyHandoverAt: value })}
              placeholder="2026-08-22T12:00:00.000Z"
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>核心指标</Text>
          <View style={styles.metricGrid}>
            {METRIC_FIELDS.map((field) => (
              <View key={field.key} style={[styles.metricField, isMobile && styles.metricFieldMobile]}>
                <LabeledInput
                  label={field.label}
                  value={form.metrics[field.key]}
                  suffix={field.suffix}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => setForm({
                    ...form,
                    metrics: { ...form.metrics, [field.key]: value },
                  })}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionTitle}>净值数据点</Text>
              <Text style={styles.sectionDetail}>每行：时间 | 余额 | 净值，最多 365 行；混合模式下只能填写接管线之前的数据。</Text>
            </View>
            <Text style={styles.pointCount}>{form.equityText.split("\n").filter((line) => line.trim()).length} 点</Text>
          </View>
          <TextInput
            accessibilityLabel="净值数据点"
            multiline
            value={form.equityText}
            onChangeText={(equityText) => setForm({ ...form, equityText })}
            placeholder="2026-08-01T00:00:00.000Z | 10000 | 10020"
            placeholderTextColor={V2.textDim}
            style={styles.textarea}
          />
        </View>

        <View style={styles.section}>
          <LabeledInput
            label="内部说明"
            value={form.note}
            onChangeText={(note) => setForm({ ...form, note })}
            placeholder="说明这批数据的来源、口径或后续接管安排"
            multiline
          />
        </View>
        </View>
      </ScrollView>
      <ActionDialog
        visible={!!pendingDeleteId}
        title="恢复当前数据源"
        message="确认移除这份自定义历史吗？前台将恢复读取当前 Provider，已保存的覆盖数据会被删除。"
        tone="danger"
        confirmLabel="确认恢复"
        onCancel={() => setPendingDeleteId(undefined)}
        onConfirm={() => {
          const strategyId = pendingDeleteId;
          setPendingDeleteId(undefined);
          if (strategyId) remove.mutate({ strategyId });
        }}
      />
    </>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  suffix,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  suffix?: string;
  keyboardType?: "decimal-pad";
  multiline?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputFrame, multiline && styles.inputFrameMultiline]}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={V2.textDim}
          keyboardType={keyboardType}
          multiline={multiline}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
        {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: V2.background },
  scrollContent: { paddingBottom: 60 },
  page: { width: "100%", maxWidth: V2_LAYOUT.maxWidth, alignSelf: "center", paddingHorizontal: 28, paddingTop: 28, gap: 24 },
  pageMobile: { paddingHorizontal: 14, paddingTop: 18 },
  loading: { flex: 1, minHeight: 520, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: V2.background },
  muted: { color: V2.textMuted, fontSize: 12 },
  header: { paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: V2.border, flexDirection: "row", alignItems: "flex-end", gap: 20 },
  headerMobile: { flexDirection: "column", alignItems: "stretch" },
  headerCopy: { flex: 1, gap: 6 },
  eyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  title: { color: V2.text, fontSize: 34, lineHeight: 42, fontWeight: "900" },
  titleMobile: { fontSize: 28, lineHeight: 35 },
  subtitle: { color: V2.textMuted, fontSize: 12, lineHeight: 19, maxWidth: 820 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  secondaryButton: { minHeight: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: V2.border, borderRadius: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  secondaryText: { color: V2.text, fontSize: 11, fontWeight: "800" },
  saveButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 4, backgroundColor: V2.gold, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  saveText: { color: V2.background, fontSize: 11, fontWeight: "900" },
  tabs: { minHeight: 44, gap: 4, alignItems: "stretch", borderBottomWidth: 1, borderBottomColor: V2.border },
  tab: { minWidth: 116, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: V2.gold, backgroundColor: "rgba(216,188,131,0.05)" },
  tabText: { color: V2.textMuted, fontSize: 12, fontWeight: "800" },
  tabTextActive: { color: V2.text },
  tabDot: { width: 5, height: 5, borderRadius: 3 },
  message: { minHeight: 40, paddingHorizontal: 12, borderWidth: 1, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 8 },
  messageOk: { borderColor: "rgba(66,211,161,0.34)", backgroundColor: "rgba(66,211,161,0.06)" },
  messageError: { borderColor: "rgba(240,112,99,0.38)", backgroundColor: "rgba(240,112,99,0.06)" },
  messageText: { flex: 1, color: V2.text, fontSize: 11, lineHeight: 17 },
  sourceRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: V2.border },
  sourceCopy: { flex: 1, gap: 3 },
  section: { gap: 13, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: V2.border },
  sectionHeadingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: V2.text, fontSize: 15, fontWeight: "900" },
  sectionDetail: { marginTop: 4, color: V2.textMuted, fontSize: 10, lineHeight: 15 },
  pointCount: { color: V2.gold, fontSize: 11, fontWeight: "900" },
  iconButton: { width: 38, height: 38, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  modeControl: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  modeButton: { minWidth: 230, minHeight: 62, padding: 11, borderWidth: 1, borderColor: V2.border, borderRadius: 5, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: V2.surfaceMuted },
  modeButtonActive: { borderColor: "rgba(216,188,131,0.48)", backgroundColor: "rgba(216,188,131,0.06)" },
  modeTitle: { color: V2.textMuted, fontSize: 12, fontWeight: "900" },
  modeTitleActive: { color: V2.text },
  modeDetail: { marginTop: 2, color: V2.textDim, fontSize: 9 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricField: { width: "23.8%", minWidth: 200 },
  metricFieldMobile: { width: "100%", minWidth: 0 },
  inputGroup: { gap: 6 },
  inputLabel: { color: V2.textDim, fontSize: 10, fontWeight: "800" },
  inputFrame: { minHeight: 40, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, flexDirection: "row", alignItems: "center", backgroundColor: V2.backgroundRaised },
  inputFrameMultiline: { minHeight: 84, alignItems: "stretch" },
  input: { flex: 1, minHeight: 38, paddingHorizontal: 10, color: V2.text, fontSize: 12, outlineStyle: "none" } as any,
  inputMultiline: { minHeight: 80, paddingTop: 10, textAlignVertical: "top" },
  inputSuffix: { paddingHorizontal: 10, color: V2.textDim, fontSize: 9, fontWeight: "800" },
  textarea: { minHeight: 260, padding: 12, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, color: V2.text, backgroundColor: V2.backgroundRaised, fontSize: 11, lineHeight: 18, textAlignVertical: "top", outlineStyle: "none" } as any,
});
