import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { AdminPageChrome, AdminSection } from "@/components/admin/page-chrome";
import { useColors } from "@/hooks/use-colors";
import { getAdminNotifications, createNotification, updateNotification, deleteNotification } from "@/lib/admin-api";

const TYPES = [
  { value: "info", label: "通知", color: "#3B82F6" },
  { value: "success", label: "成功", color: "#22C55E" },
  { value: "warning", label: "警告", color: "#C9A96E" },
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
    return (
      <AdminPageChrome eyebrow="NOTICE BOARD" title="通知公告管理" subtitle="加载公告数据" maxWidth={1220}>
        <View style={s.loadingBox}><ActivityIndicator size="large" color={colors.primary} /></View>
      </AdminPageChrome>
    );
  }

  return (
    <AdminPageChrome
      eyebrow="NOTICE BOARD"
      title="通知公告管理"
      subtitle="维护订阅页公告、促销提醒和运营状态"
      metrics={[
        { label: "公告总数", value: notifications.length, tone: colors.primary },
        { label: "显示中", value: notifications.filter((item) => item.isActive).length, tone: colors.success },
        { label: "已隐藏", value: notifications.filter((item) => !item.isActive).length, tone: colors.muted },
      ]}
      action={
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(!showForm); }} style={[s.addBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
            <Text style={s.addBtnText}>{showForm ? "取消" : "新增公告"}</Text>
          </TouchableOpacity>
      }
      maxWidth={1220}
    >

        {showForm && (
          <View style={[s.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

        <AdminSection title="公告列表" meta="PUBLISHING">
          {notifications.length > 0 ? (
            <View style={[s.tablePanel, { borderColor: colors.border }]}>
              {notifications.map((n: any) => (
                <View key={n.id} style={[s.notifCard, { opacity: n.isActive ? 1 : 0.56, borderBottomColor: colors.border }]}>
                  <View style={s.notifHeader}>
                    <View style={s.typeCode}>
                      <Text style={s.typeCodeText}>{String(n.type || "INFO").slice(0, 4).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[s.notifTitle, { color: colors.foreground }]}>{n.title}</Text>
                      <Text style={{ color: TYPES.find((t) => t.value === n.type)?.color || colors.muted, fontSize: 12, fontWeight: "700" }}>{TYPES.find((t) => t.value === n.type)?.label || n.type}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: n.isActive ? colors.success + "20" : colors.error + "20" }]}>
                      <Text style={{ color: n.isActive ? colors.success : colors.error, fontSize: 12, fontWeight: "700" }}>{n.isActive ? "显示中" : "已隐藏"}</Text>
                    </View>
                  </View>
                  <Text style={[s.notifContent, { color: colors.muted }]}>{n.content}</Text>
                  <View style={s.notifActions}>
                    <TouchableOpacity onPress={() => handleToggle(n)} style={[s.actionBtn, { backgroundColor: colors.primary + "12" }]} activeOpacity={0.7}>
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>{n.isActive ? "隐藏" : "显示"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEdit(n)} style={[s.actionBtn, { backgroundColor: colors.warning + "12" }]} activeOpacity={0.7}>
                      <Text style={{ color: colors.warning, fontSize: 13, fontWeight: "700" }}>编辑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(n.id)} style={[s.actionBtn, { backgroundColor: colors.error + "12" }]} activeOpacity={0.7}>
                      <Text style={{ color: colors.error, fontSize: 13, fontWeight: "700" }}>删除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={[s.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.muted, fontSize: 15 }}>暂无通知公告</Text>
            </View>
          )}
        </AdminSection>
    </AdminPageChrome>
  );
}

const s = StyleSheet.create({
  loadingBox: { minHeight: 260, alignItems: "center", justifyContent: "center" },
  addBtn: { borderRadius: 6, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnText: { color: "#07111F", fontWeight: "900", fontSize: 13 },
  formCard: { borderRadius: 8, padding: 18, marginBottom: 20, borderWidth: 1 },
  formTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  fieldLabel: { fontSize: 13, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 4 },
  textArea: { minHeight: 70, textAlignVertical: "top" as any },
  typeRow: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 12 },
  typeBtn: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  submitBtn: { borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#07111F", fontWeight: "900", fontSize: 15 },
  tablePanel: { borderWidth: 1, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(15,23,42,0.56)" },
  notifCard: { padding: 14, borderBottomWidth: 1 },
  notifHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  notifTitle: { fontSize: 16, fontWeight: "700" },
  typeCode: { width: 42, height: 32, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(216,188,131,0.12)", borderWidth: 1, borderColor: "rgba(216,188,131,0.24)" },
  typeCodeText: { color: "#D8BC83", fontSize: 10, fontWeight: "900" },
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  notifContent: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  notifActions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  emptyCard: { borderRadius: 8, padding: 24, alignItems: "center", borderWidth: 1 },
});
