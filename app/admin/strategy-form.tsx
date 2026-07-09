import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import { adminQuery, createAdminStrategy, updateAdminStrategy } from "@/lib/admin-api";
import { useState, useEffect } from "react";

export default function StrategyForm() {
  const router = useRouter();
  const colors = useColors();
  const { isDesktop } = useResponsive();
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
    originalPrice: "",
    isFree: true,
    telegramGroup: "",
    qqGroup: "",
    virtualSubscribers: 0,
    virtualDownloads: 0,
    status: "published" as "draft" | "published" | "archived",
    // 新增字段
    productType: "ea" as "ea" | "indicator" | "tool",
    tags: "",
    galleryImages: "",
    isFeatured: false,
    featuredLink: "",
    // A.2 新增
    saleMode: "inquiry" as "direct" | "inquiry",
    richDescription: "",
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
              originalPrice: strategy.originalPrice || "",
              isFree: strategy.isFree ?? true,
              telegramGroup: strategy.telegramGroup || "",
              qqGroup: strategy.qqGroup || "",
              virtualSubscribers: strategy.virtualSubscribers || 0,
              virtualDownloads: strategy.virtualDownloads || 0,
              status: strategy.status || "published",
              productType: strategy.productType || "ea",
              tags: strategy.tags || "",
              galleryImages: strategy.galleryImages || "",
              isFeatured: strategy.isFeatured ?? false,
              featuredLink: strategy.featuredLink || "",
              // A.2
              saleMode: strategy.saleMode || "inquiry",
              richDescription: strategy.richDescription || "",
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
      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.headerPanel}>
          <Text style={s.kicker}>STRATEGY RECORD EDITOR</Text>
          <Text style={[s.pageTitle, { color: colors.foreground }]}>
            {isEdit ? "编辑策略" : "添加新策略"}
          </Text>
          <Text style={[s.headerMeta, { color: colors.muted }]}>
            统一维护策略展示、价格、实盘指标、交付入口和前台运营数据。
          </Text>
        </View>

        <View style={[s.formPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>

        {/* 基本信息 */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>基本信息</Text>

        <Text style={[s.label, { color: colors.foreground }]}>策略标题 *</Text>
        <TextInput value={formData.title} onChangeText={(t) => setFormData({ ...formData, title: t })} placeholder="输入策略名称" placeholderTextColor={colors.muted} style={inputStyle} />

        <Text style={[s.label, { color: colors.foreground }]}>策略描述</Text>
        <TextInput value={formData.description} onChangeText={(t) => setFormData({ ...formData, description: t })} placeholder="详细描述策略特点" placeholderTextColor={colors.muted} multiline numberOfLines={4} style={[...inputStyle, { minHeight: isDesktop ? 76 : 100, textAlignVertical: "top" }]} />
        {/* A.2: 富文本介绍 */}
        <Text style={[s.label, { color: colors.foreground, marginTop: 8 }]}>详细介绍（富文本 HTML）</Text>
        <TextInput
          value={formData.richDescription}
          onChangeText={(t) => setFormData({ ...formData, richDescription: t })}
          placeholder={"<h2>核心策略原理</h2>\n<p>本 EA 基于 <strong>多重技术面共振</strong>...</p>"}
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={10}
          style={[...inputStyle, { minHeight: isDesktop ? 142 : 200, textAlignVertical: "top", fontSize: 13 }]}
        />

        <View style={[s.fieldGrid, isDesktop && s.fieldGridDesktop]}>
          <View style={s.fieldCell}>
            <Text style={[s.label, { color: colors.foreground }]}>平台</Text>
            <View style={s.row}>
              {(["MT4", "MT5"] as const).map((p) => (
                <TouchableOpacity key={p} onPress={() => setFormData({ ...formData, platform: p })} style={[s.chip, { backgroundColor: formData.platform === p ? colors.primary : colors.surface }]} activeOpacity={0.7}>
                  <Text style={{ color: formData.platform === p ? "#fff" : colors.foreground, fontWeight: "600", textAlign: "center" }}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.fieldCell}>
            <Text style={[s.label, { color: colors.foreground }]}>产品类型</Text>
            <View style={s.row}>
              {([
                { label: "EA", value: "ea" },
                { label: "指标", value: "indicator" },
                { label: "工具", value: "tool" },
              ] as const).map((opt) => (
                <TouchableOpacity key={opt.value} onPress={() => setFormData({ ...formData, productType: opt.value })} style={[s.chip, { backgroundColor: formData.productType === opt.value ? colors.primary : colors.surface }]} activeOpacity={0.7}>
                  <Text style={{ color: formData.productType === opt.value ? "#fff" : colors.foreground, fontWeight: "600", textAlign: "center" }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.fieldCell}>
            <Text style={[s.label, { color: colors.foreground }]}>销售模式</Text>
            <View style={s.row}>
              {([
                { label: "私聊授权", value: "inquiry" },
                { label: "直接购买", value: "direct" },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setFormData({ ...formData, saleMode: opt.value })}
                  style={[s.chip, { backgroundColor: formData.saleMode === opt.value ? "#A8895A" : colors.surface }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: formData.saleMode === opt.value ? "#fff" : colors.foreground, fontWeight: "600", textAlign: "center" }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={[s.fieldGrid, isDesktop && s.fieldGridDesktop]}>
          <View style={s.fieldCell}>
            <Text style={[s.label, { color: colors.foreground }]}>标签 (逗号分隔)</Text>
            <TextInput value={formData.tags} onChangeText={(t) => setFormData({ ...formData, tags: t })} placeholder="马丁,对冲,趋势,剥头皮,黄金" placeholderTextColor={colors.muted} style={inputStyle} />
          </View>
          <View style={s.fieldCell}>
            <Text style={[s.label, { color: colors.foreground }]}>交易对 (逗号分隔)</Text>
            <TextInput value={formData.pairs} onChangeText={(t) => setFormData({ ...formData, pairs: t })} placeholder="EURUSD, GBPUSD" placeholderTextColor={colors.muted} style={inputStyle} />
          </View>
          <View style={s.fieldCell}>
            <Text style={[s.label, { color: colors.foreground }]}>时间周期</Text>
            <TextInput value={formData.timeframe} onChangeText={(t) => setFormData({ ...formData, timeframe: t })} placeholder="H1, H4, D1" placeholderTextColor={colors.muted} style={inputStyle} />
          </View>
        </View>

        {/* 旗舰产品设置 */}
        <Text style={[s.sectionTitle, { color: "#A8895A" }]}>旗舰产品设置</Text>
        <Text style={[{ fontSize: 12, color: colors.muted, marginBottom: 8 }]}>旗舰产品将在首页置顶展示，并显示金色标签</Text>

        <View style={[s.row, { alignItems: "center", justifyContent: "space-between", marginBottom: 12 }]}>
          <Text style={[s.label, { color: colors.foreground, marginBottom: 0 }]}>标记为旗舰产品</Text>
          <TouchableOpacity onPress={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })} style={[s.toggle, { backgroundColor: formData.isFeatured ? "#A8895A" : colors.muted }]} activeOpacity={0.7}>
            <View style={[s.toggleDot, { marginLeft: formData.isFeatured ? 22 : 2 }]} />
          </TouchableOpacity>
        </View>

        {formData.isFeatured && (
          <>
            <Text style={[s.label, { color: colors.foreground }]}>旗舰跳转链接</Text>
            <TextInput value={formData.featuredLink} onChangeText={(t) => setFormData({ ...formData, featuredLink: t })} placeholder="https://ddxau.com" placeholderTextColor={colors.muted} style={inputStyle} />
          </>
        )}

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

        <Text style={[s.label, { color: colors.foreground }]}>画廊图片 (JSON数组)</Text>
        <TextInput value={formData.galleryImages} onChangeText={(t) => setFormData({ ...formData, galleryImages: t })} placeholder='["https://img1.jpg","https://img2.jpg"]' placeholderTextColor={colors.muted} multiline numberOfLines={3} style={[...inputStyle, { minHeight: 70, textAlignVertical: "top" }]} />
        <Text style={[{ fontSize: 11, color: colors.muted, marginBottom: 12, marginTop: -8 }]}>用于详情页图片画廊，格式为JSON数组</Text>

        <View style={[s.row, { alignItems: "center", justifyContent: "space-between", marginBottom: 12 }]}>
          <Text style={[s.label, { color: colors.foreground, marginBottom: 0 }]}>免费策略</Text>
          <TouchableOpacity onPress={() => setFormData({ ...formData, isFree: !formData.isFree })} style={[s.toggle, { backgroundColor: formData.isFree ? colors.success : colors.muted }]} activeOpacity={0.7}>
            <View style={[s.toggleDot, { marginLeft: formData.isFree ? 22 : 2 }]} />
          </TouchableOpacity>
        </View>

        {!formData.isFree && (
          <>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.foreground }]}>现价</Text>
                <TextInput value={formData.price} onChangeText={(t) => setFormData({ ...formData, price: t })} keyboardType="numeric" style={inputStyle} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.foreground }]}>原价 (划线价)</Text>
                <TextInput value={formData.originalPrice} onChangeText={(t) => setFormData({ ...formData, originalPrice: t })} keyboardType="numeric" placeholder="留空则不显示折扣" placeholderTextColor={colors.muted} style={inputStyle} />
              </View>
            </View>
            {formData.originalPrice && (parseFloat(formData.originalPrice) || 0) > (parseFloat(formData.price) || 0) && (parseFloat(formData.originalPrice) || 0) > 0 && (
              <View style={[s.discountPreview, { backgroundColor: "#EF4444" + "15" }]}>
                <Text style={[s.discountPreviewText, { color: "#EF4444" }]}>
                  折扣预览: 原价 ¥{formData.originalPrice} → 现价 ¥{formData.price}，优惠 {Math.round((1 - (parseFloat(formData.price) || 0) / (parseFloat(formData.originalPrice) || 1)) * 100)}%
                </Text>
              </View>
            )}
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
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 32, maxWidth: 1240, alignSelf: "center" as any, width: "100%" as any },
  headerPanel: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    borderRadius: 8,
    padding: 18,
    marginBottom: 14,
    backgroundColor: "rgba(15,23,42,0.68)",
  },
  kicker: { color: "#D8BC83", fontSize: 11, fontWeight: "900", marginBottom: 6 },
  pageTitle: { fontSize: 24, fontWeight: "900", marginBottom: 6 },
  headerMeta: { fontSize: 13, lineHeight: 20 },
  formPanel: { borderWidth: 1, borderRadius: 8, padding: 18 },
  sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: 12, marginTop: 16 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, marginBottom: 12 },
  row: { flexDirection: "row", gap: 10, marginBottom: 8 },
  fieldGrid: { gap: 8 },
  fieldGridDesktop: { flexDirection: "row", gap: 12 },
  fieldCell: { flex: 1, minWidth: 0 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.20)",
    alignItems: "center",
  },
  toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: "center" },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  submitBtn: { marginTop: 24, paddingVertical: 14, borderRadius: 6, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  discountPreview: { borderRadius: 10, padding: 10, marginBottom: 12, marginTop: -4 },
  discountPreviewText: { fontSize: 12, fontWeight: "600", textAlign: "center" },
});
