import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getSiteSettings, updateSiteSetting } from "@/lib/admin-api";

interface SettingField {
  key: string;
  label: string;
  placeholder: string;
  description: string;
}

const CONTACT_FIELDS: SettingField[] = [
  { key: "contact_title", label: "弹窗标题", placeholder: "联系我们", description: "联系方式弹窗的主标题" },
  { key: "contact_subtitle", label: "弹窗副标题", placeholder: "上架EA策略 | 代挂合作服务", description: "联系方式弹窗的副标题" },
  { key: "contact_telegram", label: "Telegram", placeholder: "@YourChannel", description: "Telegram频道或用户名" },
  { key: "contact_telegram_link", label: "Telegram链接", placeholder: "https://t.me/YourChannel", description: "点击后跳转的Telegram链接" },
  { key: "contact_qq", label: "QQ群", placeholder: "123456789", description: "QQ群号" },
  { key: "contact_wechat", label: "微信", placeholder: "YourWeChatID", description: "微信号" },
  { key: "contact_description", label: "说明文字", placeholder: "我们提供专业的EA策略代挂服务...", description: "弹窗底部的说明文字" },
];

export default function ContactSettingsScreen() {
  const colors = useColors();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await getSiteSettings();
      if (settings && Array.isArray(settings)) {
        const map: Record<string, string> = {};
        settings.forEach((s: any) => { map[s.key] = s.value; });
        setValues(map);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      const desc = CONTACT_FIELDS.find((f) => f.key === key)?.description;
      await updateSiteSetting(key, values[key] || "", desc);
      const msg = "设置已保存";
      if (Platform.OS === "web") alert(msg); else Alert.alert("成功", msg);
    } catch {
      const msg = "保存失败，请重试";
      if (Platform.OS === "web") alert(msg); else Alert.alert("失败", msg);
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer style={{ alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ marginBottom: 20 }}>
          <Text style={[s.pageTitle, { color: colors.foreground }]}>📞 联系方式设置</Text>
          <Text style={[s.pageDesc, { color: colors.muted }]}>
            设置"上架EA"弹窗中显示的联系方式，修改后实时生效
          </Text>
        </View>

        {CONTACT_FIELDS.map((field) => (
          <View key={field.key} style={[s.fieldCard, { backgroundColor: colors.surface }]}>
            <Text style={[s.fieldLabel, { color: colors.foreground }]}>{field.label}</Text>
            <Text style={[s.fieldDesc, { color: colors.muted }]}>{field.description}</Text>
            <View style={s.fieldRow}>
              <TextInput
                value={values[field.key] || ""}
                onChangeText={(t) => setValues((prev) => ({ ...prev, [field.key]: t }))}
                placeholder={field.placeholder}
                placeholderTextColor={colors.muted}
                style={[s.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              />
              <TouchableOpacity
                onPress={() => handleSave(field.key)}
                disabled={saving === field.key}
                style={[s.saveBtn, { backgroundColor: colors.primary, opacity: saving === field.key ? 0.7 : 1 }]}
                activeOpacity={0.8}
              >
                {saving === field.key ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.saveBtnText}>保存</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontSize: 24, fontWeight: "800", marginBottom: 6 },
  pageDesc: { fontSize: 14, lineHeight: 20 },
  fieldCard: { borderRadius: 14, padding: 16, marginBottom: 12 },
  fieldLabel: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  fieldDesc: { fontSize: 13, marginBottom: 10 },
  fieldRow: { flexDirection: "row", gap: 10 },
  fieldInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  saveBtn: { borderRadius: 10, paddingHorizontal: 18, justifyContent: "center", alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
