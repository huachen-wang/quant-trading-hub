import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

const TYPES = [
  { value: "info", label: "通知", color: "#3B82F6" },
  { value: "success", label: "成功", color: "#22C55E" },
  { value: "warning", label: "警告", color: "#F59E0B" },
  { value: "promo", label: "推广", color: "#A855F7" },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [icon, setIcon] = useState("📢");
  const [type, setType] = useState("info");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery({});
  const createMutation = trpc.notifications.create.useMutation();
  const updateMutation = trpc.notifications.update.useMutation();
  const deleteMutation = trpc.notifications.delete.useMutation();

  const resetForm = () => {
    setTitle("");
    setContent("");
    setIcon("📢");
    setType("info");
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (n: any) => {
    setEditId(n.id);
    setTitle(n.title);
    setContent(n.content);
    setIcon(n.icon || "📢");
    setType(n.type || "info");
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert("提示", "请填写标题和内容");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, title: title.trim(), content: content.trim(), icon, type, isActive: true });
      } else {
        await createMutation.mutateAsync({ title: title.trim(), content: content.trim(), icon, type });
      }
      resetForm();
      refetch();
    } catch (error) {
      Alert.alert("失败", "操作失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("确认删除", "确定要删除这条通知吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          await deleteMutation.mutateAsync({ id });
          refetch();
        },
      },
    ]);
  };

  const handleToggle = async (n: any) => {
    await updateMutation.mutateAsync({
      id: n.id,
      title: n.title,
      content: n.content,
      icon: n.icon,
      type: n.type,
      isActive: !n.isActive,
    });
    refetch();
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>📢 通知公告管理</Text>
          <TouchableOpacity
            onPress={() => { resetForm(); setShowForm(!showForm); }}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>{showForm ? "取消" : "+ 新增"}</Text>
          </TouchableOpacity>
        </View>

        {/* 新增/编辑表单 */}
        {showForm && (
          <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>
              {editId ? "编辑通知" : "新增通知"}
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>图标</Text>
            <TextInput
              value={icon}
              onChangeText={setIcon}
              placeholder="📢"
              placeholderTextColor={colors.muted}
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>标题</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="通知标题"
              placeholderTextColor={colors.muted}
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>内容</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="通知内容"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>类型</Text>
            <View style={styles.typeRow}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setType(t.value)}
                  style={[
                    styles.typeBtn,
                    { borderColor: type === t.value ? t.color : colors.border },
                    type === t.value && { backgroundColor: t.color + "15" },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: type === t.value ? t.color : colors.muted, fontWeight: "600", fontSize: 13 }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>{editId ? "更新" : "发布"}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 通知列表 */}
        {notifications && notifications.length > 0 ? (
          notifications.map((n: any) => (
            <View
              key={n.id}
              style={[
                styles.notifCard,
                { backgroundColor: colors.surface, opacity: n.isActive ? 1 : 0.5 },
              ]}
            >
              <View style={styles.notifHeader}>
                <Text style={{ fontSize: 20 }}>{n.icon || "📢"}</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.notifTitle, { color: colors.foreground }]}>{n.title}</Text>
                  <Text style={[styles.notifType, { color: TYPES.find((t) => t.value === n.type)?.color || colors.muted }]}>
                    {TYPES.find((t) => t.value === n.type)?.label || n.type}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: n.isActive ? colors.success + "20" : colors.error + "20" }]}>
                  <Text style={{ color: n.isActive ? colors.success : colors.error, fontSize: 12, fontWeight: "600" }}>
                    {n.isActive ? "显示中" : "已隐藏"}
                  </Text>
                </View>
              </View>
              <Text style={[styles.notifContent, { color: colors.muted }]}>{n.content}</Text>
              <View style={styles.notifActions}>
                <TouchableOpacity
                  onPress={() => handleToggle(n)}
                  style={[styles.actionBtn, { backgroundColor: colors.primary + "12" }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                    {n.isActive ? "隐藏" : "显示"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleEdit(n)}
                  style={[styles.actionBtn, { backgroundColor: colors.warning + "12" }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.warning, fontSize: 13, fontWeight: "600" }}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(n.id)}
                  style={[styles.actionBtn, { backgroundColor: colors.error + "12" }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.muted, fontSize: 15 }}>暂无通知公告</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  pageTitle: { fontSize: 22, fontWeight: "800" },
  addBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  formCard: { borderRadius: 16, padding: 18, marginBottom: 20 },
  formTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  fieldLabel: { fontSize: 13, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 4 },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  typeRow: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 12 },
  typeBtn: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  submitBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  notifCard: { borderRadius: 14, padding: 14, marginBottom: 10 },
  notifHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  notifTitle: { fontSize: 16, fontWeight: "700" },
  notifType: { fontSize: 12, fontWeight: "600" },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  notifContent: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  notifActions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  emptyCard: { borderRadius: 14, padding: 24, alignItems: "center" },
});
