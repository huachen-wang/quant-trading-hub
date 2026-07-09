import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, StyleSheet, TextInput, Modal, ScrollView } from "react-native";
import { AdminPageChrome, AdminSection } from "@/components/admin/page-chrome";
import { useColors } from "@/hooks/use-colors";
import { getAdminGroupBuys, createGroupBuy, updateGroupBuy, deleteGroupBuy } from "@/lib/admin-api";
import { useState, useEffect, useCallback } from "react";

export default function AdminGroupBuys() {
  const colors = useColors();
  const [groupBuys, setGroupBuys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({
    title: "",
    eaName: "",
    description: "",
    coverImage: "",
    targetPrice: "",
    targetParticipants: "",
    pricePerPerson: "",
    contactInfo: "",
    status: "active" as string,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAdminGroupBuys({ limit: 100, offset: 0 });
      setGroupBuys(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load group buys:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setForm({ title: "", eaName: "", description: "", coverImage: "", targetPrice: "", targetParticipants: "", pricePerPerson: "", contactInfo: "", status: "active" });
    setEditingItem(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setForm({
      title: item.title || "",
      eaName: item.eaName || "",
      description: item.description || "",
      coverImage: item.coverImage || "",
      targetPrice: item.targetPrice || "",
      targetParticipants: String(item.targetParticipants || ""),
      pricePerPerson: item.pricePerPerson || "",
      contactInfo: item.contactInfo || "",
      status: item.status || "active",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.eaName || !form.targetPrice || !form.targetParticipants || !form.pricePerPerson || !form.contactInfo) {
      Alert.alert("提示", "请填写所有必填字段");
      return;
    }
    try {
      if (editingItem) {
        await updateGroupBuy({
          id: editingItem.id,
          ...form,
          targetParticipants: parseInt(form.targetParticipants),
        });
      } else {
        await createGroupBuy({
          ...form,
          targetParticipants: parseInt(form.targetParticipants),
        });
      }
      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      Alert.alert("错误", "保存失败: " + (err as Error).message);
    }
  };

  const handleDelete = (id: number, title: string) => {
    const doDelete = async () => {
      try {
        await deleteGroupBuy(id);
        loadData();
      } catch (err) {
        Alert.alert("错误", "删除失败");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`确定删除「${title}」?`)) doDelete();
    } else {
      Alert.alert("确认删除", `确定删除「${title}」?`, [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const statusColors: Record<string, string> = {
    active: colors.success,
    completed: colors.primary,
    cancelled: colors.muted,
  };

  const statusLabels: Record<string, string> = {
    active: "进行中",
    completed: "已完成",
    cancelled: "已取消",
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { borderBottomColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
        <View style={[styles.badge, { backgroundColor: statusColors[item.status] + "20" }]}>
          <Text style={[styles.badgeText, { color: statusColors[item.status] }]}>{statusLabels[item.status] || item.status}</Text>
        </View>
      </View>
      <Text style={[styles.cardSub, { color: colors.muted }]}>EA: {item.eaName}</Text>
      <Text style={[styles.cardSub, { color: colors.muted }]}>
        进度: {item.currentParticipants}/{item.targetParticipants}人 · 人均¥{item.pricePerPerson}
      </Text>
      <Text style={[styles.cardSub, { color: colors.muted }]}>联系: {item.contactInfo}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => openEdit(item)} style={[styles.actionBtn, { backgroundColor: colors.primary + "20" }]}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.id, item.title)} style={[styles.actionBtn, { backgroundColor: colors.error + "20" }]}>
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <AdminPageChrome
      eyebrow="GROUP BUY OPS"
      title="合购管理"
      subtitle="维护合购项目、目标人数、价格和联系方式"
      metrics={[
        { label: "全部项目", value: groupBuys.length, tone: colors.primary },
        { label: "进行中", value: groupBuys.filter((item) => item.status === "active").length, tone: colors.success },
        { label: "已完成", value: groupBuys.filter((item) => item.status === "completed").length, tone: "#60A5FA" },
      ]}
      action={
        <TouchableOpacity onPress={openCreate} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Text style={{ color: "#07111F", fontWeight: "900", fontSize: 13 }}>新建合购</Text>
        </TouchableOpacity>
      }
      maxWidth={1280}
    >

      <AdminSection title="合购项目" meta="PROJECT RECORDS">
        {isLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : groupBuys.length === 0 ? (
          <View style={styles.center}><Text style={{ color: colors.muted, fontSize: 16 }}>暂无合购活动</Text></View>
        ) : (
          <View style={[styles.tablePanel, { borderColor: colors.border }]}>
            {groupBuys.map((item) => renderItem({ item }))}
          </View>
        )}
      </AdminSection>

      {/* 表单弹窗 */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <ScrollView>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editingItem ? "编辑合购" : "新建合购"}
              </Text>

              <Text style={[styles.label, { color: colors.muted }]}>合购标题 *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
                value={form.title}
                onChangeText={(v) => setForm({ ...form, title: v })}
                placeholder="例如: MT5黄金EA合购"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { color: colors.muted }]}>EA名称 *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
                value={form.eaName}
                onChangeText={(v) => setForm({ ...form, eaName: v })}
                placeholder="EA名称"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { color: colors.muted }]}>描述</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                placeholder="合购描述"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.label, { color: colors.muted }]}>封面图片URL</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
                value={form.coverImage}
                onChangeText={(v) => setForm({ ...form, coverImage: v })}
                placeholder="合购封面图片地址（可选）"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { color: colors.muted }]}>目标价格 *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
                value={form.targetPrice}
                onChangeText={(v) => setForm({ ...form, targetPrice: v })}
                placeholder="例如: 999.00"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />

              <Text style={[styles.label, { color: colors.muted }]}>目标人数 *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
                value={form.targetParticipants}
                onChangeText={(v) => setForm({ ...form, targetParticipants: v })}
                placeholder="例如: 10"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
              />

              <Text style={[styles.label, { color: colors.muted }]}>人均价格 *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
                value={form.pricePerPerson}
                onChangeText={(v) => setForm({ ...form, pricePerPerson: v })}
                placeholder="例如: 99.90"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />

              <Text style={[styles.label, { color: colors.muted }]}>联系方式 *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
                value={form.contactInfo}
                onChangeText={(v) => setForm({ ...form, contactInfo: v })}
                placeholder="Telegram/QQ/微信"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { color: colors.muted }]}>状态</Text>
              <View style={styles.statusRow}>
                {["active", "completed", "cancelled"].map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setForm({ ...form, status: s })}
                    style={[styles.statusBtn, form.status === s && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                  >
                    <Text style={{ color: form.status === s ? colors.primary : colors.muted, fontSize: 13 }}>
                      {statusLabels[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }} style={[styles.formBtn, { backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.foreground, fontWeight: "600" }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={[styles.formBtn, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: "#fff", fontWeight: "600" }}>保存</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AdminPageChrome>
  );
}

const styles = StyleSheet.create({
  addBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 6 },
  center: { minHeight: 220, justifyContent: "center", alignItems: "center" },
  tablePanel: { borderWidth: 1, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(15,23,42,0.56)" },
  card: { padding: 16, borderBottomWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  cardSub: { fontSize: 13, marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", maxWidth: 500, maxHeight: "85%", borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 13, marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  statusRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "transparent" },
  formActions: { flexDirection: "row", gap: 12, marginTop: 24, justifyContent: "flex-end" },
  formBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
});
