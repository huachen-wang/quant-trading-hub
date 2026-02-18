import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { adminQuery, createAdminStrategy, updateAdminStrategy } from "@/lib/admin-api";
import { useState, useEffect } from "react";

export default function StrategyForm() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams<{ mode: "create" | "edit"; id?: string }>();
  const isEdit = params.mode === "edit";
  const strategyId = params.id ? parseInt(params.id) : undefined;

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    platform: "MT4" as "MT4" | "MT5",
    pairs: "",
    timeframe: "",
    coverImage: "",
    totalReturn: "0.00",
    maxDrawdown: "0.00",
    sharpeRatio: "0.00",
    winRate: "0.00",
    downloadUrl: "",
    price: "0.00",
    isFree: true,
    telegramGroup: "",
    qqGroup: "",
    virtualSubscribers: 0,
    virtualDownloads: 0,
    sortOrder: 0,
    hotScore: 0,
    status: "published" as "draft" | "published" | "archived",
  });

  useEffect(() => {
    if (isEdit && strategyId) {
      setIsLoading(true);
      adminQuery("admin.strategies.detail", { id: strategyId })
        .then((strategy: any) => {
          if (strategy) {
            setFormData({
              title: strategy.title || "",
              description: strategy.description || "",
              platform: strategy.platform || "MT4",
              pairs: strategy.pairs || "",
              timeframe: strategy.timeframe || "",
              coverImage: strategy.coverImage || "",
              totalReturn: strategy.totalReturn || "0.00",
              maxDrawdown: strategy.maxDrawdown || "0.00",
              sharpeRatio: strategy.sharpeRatio || "0.00",
              winRate: strategy.winRate || "0.00",
              downloadUrl: strategy.downloadUrl || "",
              price: strategy.price || "0.00",
              isFree: strategy.isFree ?? true,
              telegramGroup: strategy.telegramGroup || "",
              qqGroup: strategy.qqGroup || "",
              virtualSubscribers: strategy.virtualSubscribers || 0,
              virtualDownloads: strategy.virtualDownloads || 0,
              sortOrder: strategy.sortOrder || 0,
              hotScore: strategy.hotScore || 0,
              status: strategy.status || "published",
            });
          }
        })
        .catch((err: any) => console.error("Failed to load strategy:", err))
        .finally(() => setIsLoading(false));
    }
  }, [isEdit, strategyId]);

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      const msg = "请输入策略标题";
      if (Platform.OS === "web") alert(msg); else Alert.alert("错误", msg);
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEdit && strategyId) {
        await updateAdminStrategy({ id: strategyId, ...formData });
      } else {
        await createAdminStrategy(formData);
      }
      const msg = isEdit ? "策略已更新" : "策略已创建";
      if (Platform.OS === "web") { alert(msg); router.back(); }
      else Alert.alert("成功", msg, [{ text: "确定", onPress: () => router.back() }]);
    } catch (error: any) {
      const msg = error?.message || "操作失败";
      if (Platform.OS === "web") alert(msg); else Alert.alert("错误", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer style={{ alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const inputStyle = [s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, maxWidth: 600, alignSelf: "center" as any, width: "100%" as any }}>
        <Text style={[s.pageTitle, { color: colors.foreground }]}>
          {isEdit ? "编辑策略" : "添加新策略"}
        </Text>

        {/* 基本信息 */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>基本信息</Text>

        <Text style={[s.label, { color: colors.foreground }]}>策略标题 *</Text>
        <TextInput value={formData.title} onChangeText={(t) => setFormData({ ...formData, title: t })} placeholder="输入策略名称" placeholderTextColor={colors.muted} style={inputStyle} />

        <Text style={[s.label, { color: colors.foreground }]}>策略描述</Text>
        <TextInput value={formData.description} onChangeText={(t) => setFormData({ ...formData, description: t })} placeholder="详细描述策略特点" placeholderTextColor={colors.muted} multiline numberOfLines={4} style={[...inputStyle, { minHeight: 100, textAlignVertical: "top" }]} />

        <Text style={[s.label, { color: colors.foreground }]}>平台</Text>
        <View style={s.row}>
          {(["MT4", "MT5"] as const).map((p) => (
            <TouchableOpacity key={p} onPress={() => setFormData({ ...formData, platform: p })} style={[s.chip, { backgroundColor: formData.platform === p ? colors.primary : colors.surface }]} activeOpacity={0.7}>
              <Text style={{ color: formData.platform === p ? "#fff" : colors.foreground, fontWeight: "600", textAlign: "center" }}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.label, { color: colors.foreground }]}>交易对 (逗号分隔)</Text>
        <TextInput value={formData.pairs} onChangeText={(t) => setFormData({ ...formData, pairs: t })} placeholder="EURUSD, GBPUSD" placeholderTextColor={colors.muted} style={inputStyle} />

        <Text style={[s.label, { color: colors.foreground }]}>时间周期</Text>
        <TextInput value={formData.timeframe} onChangeText={(t) => setFormData({ ...formData, timeframe: t })} placeholder="H1, H4, D1" placeholderTextColor={colors.muted} style={inputStyle} />

        {/* 实盘数据 */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>实盘数据</Text>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.foreground }]}>总收益率 (%)</Text>
            <TextInput value={formData.totalReturn} onChangeText={(t) => setFormData({ ...formData, totalReturn: t })} keyboardType="numeric" style={inputStyle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.foreground }]}>胜率 (%)</Text>
            <TextInput value={formData.winRate} onChangeText={(t) => setFormData({ ...formData, winRate: t })} keyboardType="numeric" style={inputStyle} />
          </View>
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.foreground }]}>最大回撤 (%)</Text>
            <TextInput value={formData.maxDrawdown} onChangeText={(t) => setFormData({ ...formData, maxDrawdown: t })} keyboardType="numeric" style={inputStyle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.foreground }]}>夏普比率</Text>
            <TextInput value={formData.sharpeRatio} onChangeText={(t) => setFormData({ ...formData, sharpeRatio: t })} keyboardType="numeric" style={inputStyle} />
          </View>
        </View>

        {/* 下载和定价 */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>下载和定价</Text>
        <Text style={[s.label, { color: colors.foreground }]}>下载链接</Text>
        <TextInput value={formData.downloadUrl} onChangeText={(t) => setFormData({ ...formData, downloadUrl: t })} placeholder="EA文件下载地址" placeholderTextColor={colors.muted} style={inputStyle} />

        <Text style={[s.label, { color: colors.foreground }]}>封面图片URL</Text>
        <TextInput value={formData.coverImage} onChangeText={(t) => setFormData({ ...formData, coverImage: t })} placeholder="策略封面图片地址" placeholderTextColor={colors.muted} style={inputStyle} />

        <View style={[s.row, { alignItems: "center", justifyContent: "space-between", marginBottom: 12 }]}>
          <Text style={[s.label, { color: colors.foreground, marginBottom: 0 }]}>免费策略</Text>
          <TouchableOpacity onPress={() => setFormData({ ...formData, isFree: !formData.isFree })} style={[s.toggle, { backgroundColor: formData.isFree ? colors.success : colors.muted }]} activeOpacity={0.7}>
            <View style={[s.toggleDot, { marginLeft: formData.isFree ? 22 : 2 }]} />
          </TouchableOpacity>
        </View>

        {!formData.isFree && (
          <>
            <Text style={[s.label, { color: colors.foreground }]}>价格</Text>
            <TextInput value={formData.price} onChangeText={(t) => setFormData({ ...formData, price: t })} keyboardType="numeric" style={inputStyle} />
          </>
        )}

        {/* 联系方式 */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>联系方式</Text>
        <Text style={[s.label, { color: colors.foreground }]}>Telegram群组</Text>
        <TextInput value={formData.telegramGroup} onChangeText={(t) => setFormData({ ...formData, telegramGroup: t })} placeholder="Telegram群组链接" placeholderTextColor={colors.muted} style={inputStyle} />

        <Text style={[s.label, { color: colors.foreground }]}>QQ群号</Text>
        <TextInput value={formData.qqGroup} onChangeText={(t) => setFormData({ ...formData, qqGroup: t })} placeholder="QQ群号" placeholderTextColor={colors.muted} keyboardType="numeric" style={inputStyle} />

        {/* 虚拟数据（运营用） */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>虚拟数据（运营用）</Text>
        <Text style={[{ fontSize: 12, color: colors.muted, marginBottom: 8 }]}>前端显示 = 实际值 + 虚拟值，用于运营推广</Text>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.foreground }]}>虚拟订阅数</Text>
            <TextInput value={String(formData.virtualSubscribers)} onChangeText={(t) => setFormData({ ...formData, virtualSubscribers: parseInt(t) || 0 })} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={inputStyle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.foreground }]}>虚拟下载量</Text>
            <TextInput value={String(formData.virtualDownloads)} onChangeText={(t) => setFormData({ ...formData, virtualDownloads: parseInt(t) || 0 })} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={inputStyle} />
          </View>
        </View>

        {/* 排序和热度 */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>排序和热度</Text>
        <Text style={[{ fontSize: 12, color: colors.muted, marginBottom: 8 }]}>排序值越大越靠前，默认0；热度值越大在“热度”排序中越靠前</Text>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.foreground }]}>排序值</Text>
            <TextInput value={String(formData.sortOrder)} onChangeText={(t) => setFormData({ ...formData, sortOrder: parseInt(t) || 0 })} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={inputStyle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.foreground }]}>热度值</Text>
            <TextInput value={String(formData.hotScore)} onChangeText={(t) => setFormData({ ...formData, hotScore: parseInt(t) || 0 })} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={inputStyle} />
          </View>
        </View>

        {/* 发布状态 */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>发布状态</Text>
        <View style={s.row}>
          {([{ label: "草稿", value: "draft" }, { label: "已发布", value: "published" }, { label: "已归档", value: "archived" }] as const).map((opt) => (
            <TouchableOpacity key={opt.value} onPress={() => setFormData({ ...formData, status: opt.value })} style={[s.chip, { backgroundColor: formData.status === opt.value ? colors.primary : colors.surface }]} activeOpacity={0.7}>
              <Text style={{ color: formData.status === opt.value ? "#fff" : colors.foreground, fontWeight: "600", textAlign: "center" }}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 提交按钮 */}
        <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting} style={[s.submitBtn, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]} activeOpacity={0.8}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : (
            <Text style={s.submitBtnText}>{isEdit ? "保存修改" : "创建策略"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontSize: 22, fontWeight: "800", marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12, marginTop: 20 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, marginBottom: 12 },
  row: { flexDirection: "row", gap: 10, marginBottom: 8 },
  chip: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: "center" },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  submitBtn: { marginTop: 24, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
