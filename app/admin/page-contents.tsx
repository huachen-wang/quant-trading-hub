import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type ContentItem = {
  id: number;
  pageKey: string;
  sectionKey: string;
  title: string;
  content: string;
  icon: string | null;
  sortOrder: number;
  isVisible: boolean;
};

export default function PageContentsAdmin() {
  const colors = useColors();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [form, setForm] = useState({
    pageKey: "subscribe",
    sectionKey: "",
    title: "",
    content: "",
    icon: "",
    sortOrder: 0,
    isVisible: true,
  });

  const contentsQuery = trpc.pageContents.getAll.useQuery({ pageKey: "subscribe" });
  const createMutation = trpc.pageContents.create.useMutation();
  const updateMutation = trpc.pageContents.update.useMutation();
  const deleteMutation = trpc.pageContents.delete.useMutation();

  const contents = (contentsQuery.data || []) as ContentItem[];

  const openCreateModal = () => {
    setEditingItem(null);
    setForm({
      pageKey: "subscribe",
      sectionKey: "",
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
      const msg = "标题和内容不能为空";
      if (Platform.OS === "web") { alert(msg); } else { Alert.alert("提示", msg); }
      return;
    }

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          title: form.title,
          content: form.content,
          icon: form.icon || undefined,
          sortOrder: form.sortOrder,
          isVisible: form.isVisible,
        });
      } else {
        await createMutation.mutateAsync({
          pageKey: form.pageKey,
          sectionKey: form.sectionKey || form.title.toLowerCase().replace(/\s+/g, "_"),
          title: form.title,
          content: form.content,
          icon: form.icon || undefined,
          sortOrder: form.sortOrder,
          isVisible: form.isVisible,
        });
      }
      setShowModal(false);
      contentsQuery.refetch();
    } catch (error) {
      const msg = "保存失败，请重试";
      if (Platform.OS === "web") { alert(msg); } else { Alert.alert("错误", msg); }
    }
  };

  const handleDelete = async (id: number) => {
    const doDelete = async () => {
      try {
        await deleteMutation.mutateAsync({ id });
        contentsQuery.refetch();
      } catch {
        const msg = "删除失败";
        if (Platform.OS === "web") { alert(msg); } else { Alert.alert("错误", msg); }
      }
    };

    if (Platform.OS === "web") {
      if (confirm("确定要删除这条内容吗？")) {
        await doDelete();
      }
    } else {
      Alert.alert("确认删除", "确定要删除这条内容吗？", [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const renderItem = ({ item }: { item: ContentItem }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={{ fontSize: 20 }}>{item.icon || "📄"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
          <Text style={[styles.cardMeta, { color: colors.muted }]}>
            排序: {item.sortOrder} | {item.isVisible ? "✅ 可见" : "🚫 隐藏"}
          </Text>
        </View>
      </View>
      <Text style={[styles.cardContent, { color: colors.muted }]} numberOfLines={3}>
        {item.content}
      </Text>
      <View style={styles.cardActions}>
        <TouchableOpacity
          onPress={() => openEditModal(item)}
          style={[styles.actionBtn, { backgroundColor: colors.primary + "15" }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionBtnText, { color: colors.primary }]}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          style={[styles.actionBtn, { backgroundColor: colors.error + "15" }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionBtnText, { color: colors.error }]}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      <FlatList
        data={contents}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>📬 订阅页面内容管理</Text>
            <TouchableOpacity
              onPress={openCreateModal}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>+ 添加内容</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          contentsQuery.isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <Text style={[styles.emptyText, { color: colors.muted }]}>暂无内容，点击上方按钮添加</Text>
          )
        }
      />

      {/* 编辑/创建弹窗 */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editingItem ? "编辑内容" : "添加内容"}
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.foreground }]}>图标 (emoji)</Text>
              <TextInput
                value={form.icon}
                onChangeText={(t) => setForm({ ...form, icon: t })}
                placeholder="如: 🛠️"
                placeholderTextColor={colors.muted}
                style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.foreground }]}>标题</Text>
              <TextInput
                value={form.title}
                onChangeText={(t) => setForm({ ...form, title: t })}
                placeholder="输入标题"
                placeholderTextColor={colors.muted}
                style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.foreground }]}>内容</Text>
              <TextInput
                value={form.content}
                onChangeText={(t) => setForm({ ...form, content: t })}
                placeholder="输入内容（支持换行）"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                style={[styles.formTextarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>排序</Text>
                <TextInput
                  value={form.sortOrder.toString()}
                  onChangeText={(t) => setForm({ ...form, sortOrder: parseInt(t) || 0 })}
                  keyboardType="numeric"
                  style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>可见</Text>
                <TouchableOpacity
                  onPress={() => setForm({ ...form, isVisible: !form.isVisible })}
                  style={[styles.toggleBtn, { backgroundColor: form.isVisible ? colors.success + "20" : colors.error + "20", borderColor: form.isVisible ? colors.success : colors.error }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: form.isVisible ? colors.success : colors.error, fontWeight: "600" }}>
                    {form.isVisible ? "✅ 可见" : "🚫 隐藏"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>保存</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  cardContent: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    maxHeight: "90%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  formTextarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 120,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  toggleBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: {
    fontWeight: "700",
    fontSize: 15,
  },
});
