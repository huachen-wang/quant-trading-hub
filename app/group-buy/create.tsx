import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";
import * as Haptics from "expo-haptics";

const ADVANTAGE_ITEMS = [
  "覆盖 Telegram、QQ、微信等主要交易社群",
  "触达活跃 EA 交易者，提高成团效率",
  "统一记录合购信息，减少反复对账",
  "审核通过后进入合购列表展示",
];

function showAlert(title: string, message: string, onOk?: () => void) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n${message}`);
    onOk?.();
  } else {
    Alert.alert(title, message, [{ text: "确定", onPress: onOk }]);
  }
}

export default function CreateGroupBuyScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isDesktop } = useResponsive();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [eaName, setEaName] = useState("");
  const [eaDescription, setEaDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      showAlert("提示", "请输入您的姓名");
      return;
    }
    if (!contact.trim()) {
      showAlert("提示", "请输入联系方式");
      return;
    }
    if (!eaName.trim()) {
      showAlert("提示", "请输入EA名称");
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setIsSubmitting(true);
    try {
      const result = await fetch(`${getApiBase()}/api/trpc/groupBuys.requestGroupBuy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            name: name.trim(),
            contact: contact.trim(),
            eaName: eaName.trim(),
            eaDescription: eaDescription.trim() || undefined,
          },
        }),
      });
      const data = await result.json();
      if (data.result) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setSubmitSuccess(true);
        showAlert("提交成功", "您的合购申请已提交，我们会尽快审核并上架。审核通过后会通过您留下的联系方式通知您。", () => {
          router.back();
        });
      } else {
        const errMsg = data.error?.json?.message || data.error?.message || "提交失败，请稍后重试";
        showAlert("提交失败", errMsg);
      }
    } catch (error: any) {
      showAlert("提交失败", error?.message || "网络错误，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.scrollContent, isDesktop && s.scrollContentDesktop]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* 返回按钮 */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={[s.backBtn, { backgroundColor: colors.surface }]}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20, color: colors.foreground }}>←</Text>
        </TouchableOpacity>

        <View style={isDesktop ? s.desktopShell : undefined}>
          <View style={[isDesktop && s.introPanel, isDesktop && { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.kicker, { color: colors.primary }]}>GROUP BUY INTAKE</Text>
            <Text style={[s.pageTitle, isDesktop && s.pageTitleDesktop, { color: colors.foreground }]}>发起合购</Text>
            <Text style={[s.pageSubtitle, isDesktop && s.pageSubtitleDesktop, { color: colors.muted }]}>
              填写基础信息后，我们会审核 EA 名称、授权范围和参与方式，再联系您确认上架细节。
            </Text>

            <View style={[s.advantageBox, isDesktop && s.advantageBoxDesktop, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "24" }]}>
              <Text style={[s.advantageTitle, { color: colors.primary }]}>平台优势</Text>
              {ADVANTAGE_ITEMS.map((item, index) => (
                <View key={item} style={s.advantageItemRow}>
                  <View style={[s.advantageCode, { borderColor: colors.primary + "44", backgroundColor: colors.background }]}>
                    <Text style={[s.advantageCodeText, { color: colors.primary }]}>{String(index + 1).padStart(2, "0")}</Text>
                  </View>
                  <Text style={[s.advantageItem, { color: colors.foreground }]}>{item}</Text>
                </View>
              ))}
            </View>

            {isDesktop && (
              <View style={[s.reviewPanel, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[s.reviewTitle, { color: colors.foreground }]}>审核节奏</Text>
                <Text style={[s.reviewText, { color: colors.muted }]}>T+0 收到申请 · T+1 核对资料 · T+2 可进入合购列表</Text>
              </View>
            )}
          </View>

          <View style={isDesktop ? s.formColumn : undefined}>
            <View style={[s.formCard, isDesktop && s.formCardDesktop, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.fieldGroup}>
                <Text style={[s.fieldLabel, { color: colors.foreground }]}>您的姓名 *</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="请输入您的姓名或昵称"
                  placeholderTextColor={colors.muted}
                  maxLength={100}
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={[s.fieldLabel, { color: colors.foreground }]}>联系方式 *</Text>
                <TextInput
                  value={contact}
                  onChangeText={setContact}
                  placeholder="Telegram/QQ/微信/邮箱"
                  placeholderTextColor={colors.muted}
                  maxLength={255}
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                />
                <Text style={[s.fieldHint, { color: colors.muted }]}>我们会通过此联系方式与您沟通合购详情</Text>
              </View>

              <View style={s.fieldGroup}>
                <Text style={[s.fieldLabel, { color: colors.foreground }]}>EA名称 *</Text>
                <TextInput
                  value={eaName}
                  onChangeText={setEaName}
                  placeholder="请输入要合购的EA名称"
                  placeholderTextColor={colors.muted}
                  maxLength={255}
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>

              <View style={s.fieldGroup}>
                <Text style={[s.fieldLabel, { color: colors.foreground }]}>EA描述(可选)</Text>
                <TextInput
                  value={eaDescription}
                  onChangeText={setEaDescription}
                  placeholder="简单描述EA的功能、策略类型、预期价格等"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={2000}
                  style={[s.input, s.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>
            </View>

            {submitSuccess && (
              <View style={[s.successBox, { backgroundColor: colors.success + "15" }]}>
                <Text style={{ color: colors.success, fontSize: 14, fontWeight: "600" }}>提交成功！我们会尽快审核。</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
              style={[s.submitBtn, { backgroundColor: isSubmitting ? colors.muted : colors.primary }]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.submitBtnText}>提交申请</Text>
              )}
            </TouchableOpacity>

            <View style={{ marginBottom: 24 }}>
              <Text style={[s.footerText, isDesktop && s.footerTextDesktop, { color: colors.muted }]}>
                提交后我们会在1-2个工作日内审核并联系您{"\n"}
                审核通过后会展示在合购列表中供用户参与
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function getApiBase(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:3000`;
    }
    if (hostname.startsWith("8081-")) {
      return `${protocol}//${hostname.replace(/^8081-/, "3000-")}`;
    }
    return `${protocol}//${hostname}`;
  }
  return "";
}

const s = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 40 },
  scrollContentDesktop: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 22,
  },
  backBtn: { width: 40, height: 40, borderRadius: 6, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  desktopShell: { flexDirection: "row", gap: 18, alignItems: "flex-start" },
  introPanel: { width: 430, borderWidth: 1, borderRadius: 8, padding: 22 },
  formColumn: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 12, fontWeight: "900", marginBottom: 10 },
  pageTitle: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  pageTitleDesktop: { fontSize: 30, lineHeight: 38, fontWeight: "900" },
  pageSubtitle: { fontSize: 14, lineHeight: 20 },
  pageSubtitleDesktop: { lineHeight: 22, marginBottom: 20 },
  advantageBox: { borderRadius: 8, padding: 16, marginBottom: 24, borderWidth: 1 },
  advantageBoxDesktop: { marginBottom: 16 },
  advantageTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  advantageItemRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  advantageCode: { width: 34, height: 24, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  advantageCodeText: { fontSize: 11, fontWeight: "900" },
  advantageItem: { flex: 1, fontSize: 14, lineHeight: 20 },
  reviewPanel: { borderWidth: 1, borderRadius: 8, padding: 14 },
  reviewTitle: { fontSize: 13, fontWeight: "900", marginBottom: 6 },
  reviewText: { fontSize: 12, lineHeight: 18 },
  formCard: { borderRadius: 8, padding: 16, marginBottom: 20, borderWidth: 1 },
  formCardDesktop: { padding: 22 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  fieldHint: { fontSize: 12, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  textArea: { minHeight: 100, paddingTop: 12 },
  successBox: { borderRadius: 8, padding: 14, marginBottom: 16 },
  submitBtn: { borderRadius: 8, paddingVertical: 14, alignItems: "center", marginBottom: 14 },
  submitBtnText: { color: "#07111F", fontWeight: "900", fontSize: 16 },
  footerText: { fontSize: 12, textAlign: "center", lineHeight: 18 },
  footerTextDesktop: { textAlign: "left" },
});
