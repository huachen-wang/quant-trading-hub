import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* 返回按钮 */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={[s.backBtn, { backgroundColor: colors.surface }]}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20, color: colors.foreground }}>←</Text>
        </TouchableOpacity>

        {/* 标题 */}
        <View style={{ marginBottom: 16 }}>
          <Text style={[s.pageTitle, { color: colors.foreground }]}>🤝 发起合购</Text>
          <Text style={[s.pageSubtitle, { color: colors.muted }]}>
            填写以下信息提交合购申请，我们会审核并联系您确认详情后上架。
          </Text>
        </View>

        {/* 平台优势说明 */}
        <View style={[s.advantageBox, { backgroundColor: colors.primary + "15" }]}>
          <Text style={[s.advantageTitle, { color: colors.primary }]}>🚀 我们的优势</Text>
          <Text style={[s.advantageItem, { color: colors.foreground }]}>✓ 覆盖多个社交媒体平台(Telegram、QQ、微信等)</Text>
          <Text style={[s.advantageItem, { color: colors.foreground }]}>✓ 活跃的EA交易者社群，精准触达目标用户</Text>
          <Text style={[s.advantageItem, { color: colors.foreground }]}>✓ 专业的合购组织和管理经验</Text>
          <Text style={[s.advantageItem, { color: colors.foreground }]}>✓ 快速审核，高效上架</Text>
        </View>

        {/* 表单 */}
        <View style={[s.formCard, { backgroundColor: colors.surface }]}>
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

        {/* 成功提示 */}
        {submitSuccess && (
          <View style={[s.successBox, { backgroundColor: colors.success + "15" }]}>
            <Text style={{ color: colors.success, fontSize: 14, fontWeight: "600" }}>✅ 提交成功！我们会尽快审核。</Text>
          </View>
        )}

        {/* 提交按钮 */}
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
          <Text style={[s.footerText, { color: colors.muted }]}>
            提交后我们会在1-2个工作日内审核并联系您{"\n"}
            审核通过后会展示在合购列表中供用户参与
          </Text>
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
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  pageSubtitle: { fontSize: 14, lineHeight: 20 },
  advantageBox: { borderRadius: 16, padding: 16, marginBottom: 24 },
  advantageTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  advantageItem: { fontSize: 14, lineHeight: 22, marginBottom: 2 },
  formCard: { borderRadius: 16, padding: 16, marginBottom: 24 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  fieldHint: { fontSize: 12, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  textArea: { minHeight: 100, paddingTop: 12 },
  successBox: { borderRadius: 12, padding: 14, marginBottom: 16 },
  submitBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center", marginBottom: 16 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  footerText: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});
