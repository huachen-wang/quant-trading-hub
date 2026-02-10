import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getAdminNotifications, createNotification, updateNotification, deleteNotification } from "@/lib/admin-api";

const TYPES = [
  { value: "info", label: "通知", color: "#3B82F6" },
  { value: "success", label: "成功", color: "#22C55E" },
  { value: "warning", label: "警告", color: "#F59E0B" },
  { value: "promo", label: "推广", color: "#A855F7" },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [icon, setIcon] = useState("📢");
  const [type, setType] = useState("info");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAdminNotifications({ limit: 100, offset: 0 });
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => { setTitle(""); setContent(""); setIcon("📢"); setType("info"); setEditId(null); setShowForm(false); };

  const handleEdit = (n: any) => { setEditId(n.id); setTitle(n.title); setContent(n.content); setIcon(n.icon || "📢"); setType(n.type || "info"); setShowForm(true); };

  const showMsg = (t: string, m: string) => { if (Platform.OS === "web") alert(m); else Alert.alert(t, m); };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) { showMsg("提示", "请填写标题和内容"); return; }
    setIsSubmitting(true);
    try {
      if (editId) {
        await updateNotification({ id: editId, title: title.trim(), content: content.trim(), icon, type, isActive: true });
      } else {
        await createNotification({ title: title.trim(), content: content.trim(), icon, type });
      }
      resetForm();
      loadData();
    } catch { showMsg("失败", "操作失败，请重试"); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = (id: number) => {
    const doDelete = async () => { try { await deleteNotification(id); loadData(); } catch { showMsg("失败", "删除失败"); } };
    if (Platform.OS === "web") { if (confirm("确定要删除这条通知吗？")) doDelete(); }
    else Alert.alert("确认删除", "确定要删除这条通知吗？", [{ text: "取消", style: "cancel" }, { text: "删除", style: "destructive", onPress: doDelete }]);
  };

  const handleToggle = async (n: any) => {
    try {
      await updateNotification({ id: n.id, title: n.title, content: n.content, icon: n.icon, type: n.type, isActive: !n.isActive });
      loadData();
    } catch { showMsg("失败", "操作失败"); }
  };

  if (isLoading) {
    return (<ScreenContainer style={{ alignItems: "center", justifyContent: "center" }}><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>);
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={s.header}>
          <Text style={[s.pageTitle, { color: colors.foreground }]}>📢 通知公告管理</Text>
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(!showForm); }} style={[s.addBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
            <Text style={s.addBtnText}>{showForm ? "取消" : "+ 新增"}</Text>
          </TouchableOpacity>
        </View>

        {showForm && (
          <View style={[s.formCard, { backgroundColor: colors.surface }]}>
            <Text style={[s.formTitle, { color: colors.foreground }]}>{editId ? "编辑通知" : "新增通知"}</Text>
            <Text style={[s.fieldLabel, { color: colors.muted }]}>图标</Text>
            <TextInput value={icon} onChangeText={setIcon} placeholder="📢" placeholderTextColor={colors.muted} style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
            <Text style={[s.fieldLabel, { color: colors.muted }]}>标题</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="通知标题" placeholderTextColor={colors.muted} style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
            <Text style={[s.fieldLabel, { color: colors.muted }]}>内容</Text>
            <TextInput value={content} onChangeText={setContent} placeholder="通知内容" placeholderTextColor={colors.muted} multiline numberOfLines={3} style={[s.input, s.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
            <Text style={[s.fieldLabel, { color: colors.muted }]}>类型</Text>
            <View style={s.typeRow}>
              {TYPES.map((t) => (
                <TouchableOpacity key={t.value} onPress={() => setType(t.value)} style={[s.typeBtn, { borderColor: type === t.value ? t.color : colors.border }, type === t.value && { backgroundColor: t.color + "15" }]} activeOpacity={0.7}>
                  <Text style={{ color: type === t.value ? t.color : colors.muted, fontWeight: "600", fontSize: 13 }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting} style={[s.submitBtn, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]} activeOpacity={0.8}>
              {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.submitBtnText}>{editId ? "更新" : "发布"}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {notifications.length > 0 ? notifications.map((n: any) => (
          <View key={n.id} style={[s.notifCard, { backgroundColor: colors.surface, opacity: n.isActive ? 1 : 0.5 }]}>
            <View style={s.notifHeader}>
              <Text style={{ fontSize: 20 }}>{n.icon || "📢"}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[s.notifTitle, { color: colors.foreground }]}>{n.title}</Text>
                <Text style={{ color: TYPES.find((t) => t.value === n.type)?.color || colors.muted, fontSize: 12, fontWeight: "600" }}>{TYPES.find((t) => t.value === n.type)?.label || n.type}</Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: n.isActive ? colors.success + "20" : colors.error + "20" }]}>
                <Text style={{ color: n.isActive ? colors.success : colors.error, fontSize: 12, fontWeight: "600" }}>{n.isActive ? "显示中" : "已隐藏"}</Text>
              </View>
            </View>
            <Text style={[s.notifContent, { color: colors.muted }]}>{n.content}</Text>
            <View style={s.notifActions}>
              <TouchableOpacity onPress={() => handleToggle(n)} style={[s.actionBtn, { backgroundColor: colors.primary + "12" }]} activeOpacity={0.7}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>{n.isActive ? "隐藏" : "显示"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleEdit(n)} style={[s.actionBtn, { backgroundColor: colors.warning + "12" }]} activeOpacity={0.7}>
                <Text style={{ color: colors.warning, fontSize: 13, fontWeight: "600" }}>编辑</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(n.id)} style={[s.actionBtn, { backgroundColor: colors.error + "12" }]} activeOpacity={0.7}>
                <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        )) : (
          <View style={[s.emptyCard, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.muted, fontSize: 15 }}>暂无通知公告</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  pageTitle: { fontSize: 22, fontWeight: "800" },
  addBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  formCard: { borderRadius: 16, padding: 18, marginBottom: 20 },
  formTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  fieldLabel: { fontSize: 13, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 4 },
  textArea: { minHeight: 70, textAlignVertical: "top" as any },
  typeRow: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 12 },
  typeBtn: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  submitBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  notifCard: { borderRadius: 14, padding: 14, marginBottom: 10 },
  notifHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  notifTitle: { fontSize: 16, fontWeight: "700" },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  notifContent: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  notifActions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  emptyCard: { borderRadius: 14, padding: 24, alignItems: "center" },
});
