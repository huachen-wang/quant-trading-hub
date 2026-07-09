import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, TextInput, Modal, ActivityIndicator, StyleSheet, Alert, Platform, ScrollView } from "react-native";
import { AdminPageChrome, AdminSection } from "@/components/admin/page-chrome";
import { useColors } from "@/hooks/use-colors";
import { getAdminPageContents, createPageContent, updatePageContent, deletePageContent } from "@/lib/admin-api";

type ContentItem = { id: number; pageKey: string; sectionKey: string; title: string; content: string; icon: string | null; sortOrder: number; isVisible: boolean; };

// 合作页面的三大板块
const SECTION_OPTIONS = [
  { key: "compliance", label: "合规支持" },
  { key: "technology", label: "技术支持" },
  { key: "business", label: "业务支持" },
  { key: "custom", label: "自定义板块" },
];

export default function CooperationContentsAdmin() {
  const colors = useColors();
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [form, setForm] = useState({
    pageKey: "cooperation",
    sectionKey: "compliance",
    title: "",
    content: "",
    icon: "",
    sortOrder: 0,
    isVisible: true,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAdminPageContents("cooperation");
      setContents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setContents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showMsg = (t: string, m: string) => {
    if (Platform.OS === "web") alert(m);
    else Alert.alert(t, m);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setForm({
      pageKey: "cooperation",
      sectionKey: "compliance",
      title: "",
      content: "",
      icon: "",
      sortOrder: contents.length + 1,
      isVisible: true,
    });
    setShowModal(true);
  };

  const openEditModal = (item: ContentItem) => {
    setEditingItem(item);
    setForm({
      pageKey: item.pageKey,
      sectionKey: item.sectionKey,
      title: item.title,
      content: item.content,
      icon: item.icon || "",
      sortOrder: item.sortOrder,
      isVisible: item.isVisible,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      showMsg("提示", "标题和内容不能为空");
      return;
    }
    setIsSaving(true);
    try {
      if (editingItem) {
        await updatePageContent({
          id: editingItem.id,
          title: form.title,
          content: form.content,
          icon: form.icon || undefined,
          sortOrder: form.sortOrder,
          isVisible: form.isVisible,
        });
      } else {
        await createPageContent({
          pageKey: "cooperation",
          sectionKey: form.sectionKey,
          title: form.title,
          content: form.content,
          icon: form.icon || undefined,
          sortOrder: form.sortOrder,
          isVisible: form.isVisible,
        });
      }
      setShowModal(false);
      loadData();
    } catch {
      showMsg("错误", "保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const doDelete = async () => {
      try { await deletePageContent(id); loadData(); }
      catch { showMsg("错误", "删除失败"); }
    };
    if (Platform.OS === "web") {
      if (confirm("确定要删除这条内容吗？")) await doDelete();
    } else {
      Alert.alert("确认删除", "确定要删除这条内容吗？", [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  // 按板块筛选
  const filteredContents = selectedSection === "all"
    ? contents
    : contents.filter(c => c.sectionKey === selectedSection);

  // 获取板块标签
  const getSectionLabel = (key: string) => {
    const found = SECTION_OPTIONS.find(s => s.key === key);
    return found ? found.label : key;
  };

  const getSectionColor = (key: string) => {
    switch (key) {
      case "compliance": return "#3b82f6";
      case "technology": return "#7c3aed";
      case "business": return "#16a34a";
      default: return "#c9a96e";
    }
  };

  const renderItem = ({ item }: { item: ContentItem }) => (
    <View style={[st.card, { borderBottomColor: colors.border }]}>
      <View style={st.cardHeader}>
        <View style={st.contentCode}>
          <Text style={st.contentCodeText}>{item.sectionKey.slice(0, 3).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[st.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
          <View style={st.cardMetaRow}>
            <View style={[st.sectionTag, { backgroundColor: getSectionColor(item.sectionKey) + "20" }]}>
              <Text style={[st.sectionTagText, { color: getSectionColor(item.sectionKey) }]}>
                {getSectionLabel(item.sectionKey)}
              </Text>
            </View>
            <Text style={[st.cardMeta, { color: colors.muted }]}>
              排序: {item.sortOrder} | {item.isVisible ? "可见" : "隐藏"}
            </Text>
          </View>
        </View>
      </View>
      <Text style={[st.cardContent, { color: colors.muted }]} numberOfLines={3}>{item.content}</Text>
      <View style={st.cardActions}>
        <TouchableOpacity onPress={() => openEditModal(item)} style={[st.actionBtn, { backgroundColor: colors.primary + "15" }]} activeOpacity={0.7}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={[st.actionBtn, { backgroundColor: colors.error + "15" }]} activeOpacity={0.7}>
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <AdminPageChrome
      eyebrow="COOPERATION PAGE CMS"
      title="合作页面管理"
      subtitle="管理合作页服务内容，按合规、技术、业务板块分组展示"
      metrics={[
        { label: "内容总数", value: contents.length, tone: colors.primary },
        { label: "当前筛选", value: selectedSection === "all" ? "全部" : getSectionLabel(selectedSection), tone: "#60A5FA" },
        { label: "可见内容", value: contents.filter((item) => item.isVisible).length, tone: colors.success },
      ]}
      action={
        <TouchableOpacity onPress={openCreateModal} style={[st.addBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
          <Text style={st.addBtnText}>添加内容</Text>
        </TouchableOpacity>
      }
      maxWidth={1240}
    >
      <AdminSection title="内容板块" meta="FILTER">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterRow}>
          <TouchableOpacity
            onPress={() => setSelectedSection("all")}
            style={[st.filterChip, { backgroundColor: selectedSection === "all" ? colors.primary : colors.surface, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={{ color: selectedSection === "all" ? "#07111F" : colors.foreground, fontSize: 13, fontWeight: "700" }}>全部</Text>
          </TouchableOpacity>
          {SECTION_OPTIONS.map(s => (
            <TouchableOpacity
              key={s.key}
              onPress={() => setSelectedSection(s.key)}
              style={[st.filterChip, { backgroundColor: selectedSection === s.key ? getSectionColor(s.key) : colors.surface, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: selectedSection === s.key ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "700" }}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={st.loadingBox}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : filteredContents.length > 0 ? (
          <View style={[st.tablePanel, { borderColor: colors.border }]}>
            {filteredContents.map((item) => renderItem({ item }))}
          </View>
        ) : (
          <View style={st.emptyContainer}>
            <Text style={[st.emptyText, { color: colors.muted }]}>
              暂无自定义内容{"\n"}当前使用默认内容展示
            </Text>
            <Text style={[st.emptyHint, { color: colors.primary }]}>
              点击添加内容来自定义合作页面
            </Text>
          </View>
        )}
      </AdminSection>

      {/* 编辑弹窗 */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <ScrollView contentContainerStyle={st.modalScrollContent}>
            <View style={[st.modalContent, { backgroundColor: colors.background }]}>
              <Text style={[st.modalTitle, { color: colors.foreground }]}>
                {editingItem ? "编辑内容" : "添加合作内容"}
              </Text>

              {/* 板块选择 */}
              {!editingItem && (
                <View style={st.formGroup}>
                  <Text style={[st.formLabel, { color: colors.foreground }]}>所属板块</Text>
                  <View style={st.sectionPicker}>
                    {SECTION_OPTIONS.map(s => (
                      <TouchableOpacity
                        key={s.key}
                        onPress={() => setForm({ ...form, sectionKey: s.key })}
                        style={[
                          st.sectionPickerItem,
                          {
                            backgroundColor: form.sectionKey === s.key ? getSectionColor(s.key) + "20" : colors.surface,
                            borderColor: form.sectionKey === s.key ? getSectionColor(s.key) : colors.border,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: form.sectionKey === s.key ? getSectionColor(s.key) : colors.foreground, fontSize: 13, fontWeight: "600" }}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={st.formGroup}>
                <Text style={[st.formLabel, { color: colors.foreground }]}>图标代码</Text>
                <TextInput
                  value={form.icon}
                  onChangeText={(t) => setForm({ ...form, icon: t })}
                  placeholder="如: SAFE / PLAN / FAST"
                  placeholderTextColor={colors.muted}
                  style={[st.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>

              <View style={st.formGroup}>
                <Text style={[st.formLabel, { color: colors.foreground }]}>标题</Text>
                <TextInput
                  value={form.title}
                  onChangeText={(t) => setForm({ ...form, title: t })}
                  placeholder="如: 牌照申请与维护"
                  placeholderTextColor={colors.muted}
                  style={[st.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>

              <View style={st.formGroup}>
                <Text style={[st.formLabel, { color: colors.foreground }]}>内容描述</Text>
                <TextInput
                  value={form.content}
                  onChangeText={(t) => setForm({ ...form, content: t })}
                  placeholder="详细描述该服务项目..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  style={[st.formTextarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>

              <View style={st.formRow}>
                <View style={[st.formGroup, { flex: 1 }]}>
                  <Text style={[st.formLabel, { color: colors.foreground }]}>排序</Text>
                  <TextInput
                    value={form.sortOrder.toString()}
                    onChangeText={(t) => setForm({ ...form, sortOrder: parseInt(t) || 0 })}
                    keyboardType="numeric"
                    style={[st.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  />
                </View>
                <View style={[st.formGroup, { flex: 1 }]}>
                  <Text style={[st.formLabel, { color: colors.foreground }]}>可见</Text>
                  <TouchableOpacity
                    onPress={() => setForm({ ...form, isVisible: !form.isVisible })}
                    style={[st.toggleBtn, { backgroundColor: form.isVisible ? colors.success + "20" : colors.error + "20", borderColor: form.isVisible ? colors.success : colors.error }]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: form.isVisible ? colors.success : colors.error, fontWeight: "600" }}>
                      {form.isVisible ? "可见" : "隐藏"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={st.modalActions}>
                <TouchableOpacity onPress={() => setShowModal(false)} style={[st.modalBtn, { backgroundColor: colors.surface }]} activeOpacity={0.7}>
                  <Text style={[st.modalBtnText, { color: colors.foreground }]}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={isSaving} style={[st.modalBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]} activeOpacity={0.8}>
                  {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[st.modalBtnText, { color: "#fff" }]}>保存</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </AdminPageChrome>
  );
}

const st = StyleSheet.create({
  addBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 6 },
  addBtnText: { color: "#07111F", fontWeight: "900", fontSize: 13 },
  filterRow: { marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderWidth: 1, marginRight: 8 },
  loadingBox: { minHeight: 220, alignItems: "center", justifyContent: "center" },
  tablePanel: { borderWidth: 1, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(15,23,42,0.56)" },
  card: { padding: 16, borderBottomWidth: 1 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  contentCode: { width: 42, height: 32, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(216,188,131,0.12)", borderWidth: 1, borderColor: "rgba(216,188,131,0.24)" },
  contentCodeText: { color: "#D8BC83", fontSize: 10, fontWeight: "900" },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  sectionTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  sectionTagText: { fontSize: 11, fontWeight: "700" },
  cardMeta: { fontSize: 12 },
  cardContent: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  emptyContainer: { alignItems: "center", marginTop: 40 },
  emptyText: { textAlign: "center", fontSize: 14, lineHeight: 22, marginBottom: 8 },
  emptyHint: { fontSize: 13, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center" },
  modalScrollContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  modalContent: { borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 20 },
  formGroup: { marginBottom: 14 },
  formLabel: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  formInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  formTextarea: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, minHeight: 120 },
  formRow: { flexDirection: "row", gap: 12 },
  sectionPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectionPickerItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  toggleBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  modalBtnText: { fontWeight: "700", fontSize: 15 },
});
