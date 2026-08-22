import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { V2 } from "@/components/v2/tokens";
import {
  CONTENT_TYPE_LABELS,
  blockToEditorForm,
  editorFormToBlock,
  editorItemsHelp,
  emptyEditorForm,
  type ContentBlockType,
  type ContentEditorForm,
} from "@/lib/v2/content-editor";
import { trpc } from "@/lib/trpc";

type EditingState = {
  recordId: number | null;
  sortOrder: number;
  isVisible: boolean;
  form: ContentEditorForm;
};

export default function V2ContentAdminPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const utils = trpc.useUtils();
  const strategies = trpc.v2.strategies.list.useQuery(undefined, { staleTime: 30_000 });
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<EditingState>();
  const content = trpc.v2.adminContent.list.useQuery(
    { strategyId: selectedId },
    { enabled: Boolean(selectedId) },
  );
  const save = trpc.v2.adminContent.save.useMutation({
    onSuccess: async () => {
      setEditing(undefined);
      await Promise.all([
        utils.v2.adminContent.list.invalidate({ strategyId: selectedId }),
        utils.v2.strategies.invalidate(),
        utils.v2.overview.invalidate(),
      ]);
    },
    onError: (error) => showMessage("保存失败", error.message),
  });
  const remove = trpc.v2.adminContent.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.v2.adminContent.list.invalidate({ strategyId: selectedId }),
        utils.v2.strategies.invalidate(),
        utils.v2.overview.invalidate(),
      ]);
    },
    onError: (error) => showMessage("删除失败", error.message),
  });

  useEffect(() => {
    if (!selectedId && strategies.data?.length) setSelectedId(strategies.data[0].id);
  }, [selectedId, strategies.data]);

  const selectedStrategy = strategies.data?.find((item) => item.id === selectedId);

  const openCreate = () => {
    setEditing({
      recordId: null,
      sortOrder: (content.data?.length ?? 0) + 1,
      isVisible: true,
      form: emptyEditorForm(),
    });
  };

  const handleSave = () => {
    if (!editing || !selectedId) return;
    if (!editing.form.heading.trim()) {
      showMessage("内容不完整", "请填写区块标题。");
      return;
    }
    const block = editorFormToBlock(editing.form);
    if (
      (block.type === "rich_text" && block.paragraphs.length === 0) ||
      (block.type === "risk_notice" && !block.content) ||
      ("items" in block && block.items.length === 0)
    ) {
      showMessage("内容不完整", "请填写正文或至少一条列表内容。");
      return;
    }
    save.mutate({
      recordId: editing.recordId,
      strategyId: selectedId,
      block,
      sortOrder: editing.sortOrder,
      isVisible: editing.isVisible,
    });
  };

  const quickSave = (
    item: NonNullable<typeof content.data>[number],
    patch: { sortOrder?: number; isVisible?: boolean },
  ) => {
    save.mutate({
      recordId: item.recordId,
      strategyId: selectedId,
      block: item.block,
      sortOrder: patch.sortOrder ?? item.sortOrder,
      isVisible: patch.isVisible ?? item.isVisible,
    });
  };

  if (strategies.isLoading) {
    return <ScreenContainer><View style={styles.loading}><ActivityIndicator size="large" color={V2.gold} /></View></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, isMobile && styles.pageMobile]}>
        <View style={[styles.header, isMobile && styles.headerMobile]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>V2 CONTENT STUDIO</Text>
            <Text style={styles.title}>核心策略图文编辑</Text>
            <Text style={styles.subtitle}>按内容块编辑说明、证据、时间线、风险边界和常见问题；保存后 V2 详情页即时读取。</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push(`/v2-preview/strategies/${selectedId}` as never)} style={styles.previewButton}>
              <MaterialIcons name="open-in-new" size={17} color={V2.text} />
              <Text style={styles.previewText}>预览页面</Text>
            </Pressable>
            <Pressable onPress={openCreate} style={styles.addButton}>
              <MaterialIcons name="add" size={18} color={V2.background} />
              <Text style={styles.addText}>新建区块</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.strategyPicker}>
          {strategies.data?.map((strategy) => (
            <Pressable
              key={strategy.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedId === strategy.id }}
              onPress={() => setSelectedId(strategy.id)}
              style={[styles.strategyButton, selectedId === strategy.id && styles.strategyButtonActive]}
            >
              <View style={[styles.strategyRail, { backgroundColor: strategy.accent }]} />
              <Text style={[styles.strategyButtonText, selectedId === strategy.id && styles.strategyButtonTextActive]}>{strategy.shortName}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>{selectedStrategy?.name ?? "核心策略"}</Text>
            <Text style={styles.sectionMeta}>{content.data?.length ?? 0} 个内容区块 · 拖序以按钮替代，移动端同样可操作</Text>
          </View>
          {content.isFetching ? <ActivityIndicator size="small" color={V2.gold} /> : null}
        </View>

        <View style={styles.blockList}>
          {content.data?.map((item, index) => (
            <View key={item.block.id} style={[styles.blockRow, !item.isVisible && styles.blockHidden]}>
              <View style={styles.orderControls}>
                <Pressable
                  accessibilityLabel="上移区块"
                  disabled={index === 0 || save.isPending}
                  onPress={() => quickSave(item, { sortOrder: Math.max(0, item.sortOrder - 2) })}
                  style={[styles.iconButton, index === 0 && styles.disabled]}
                >
                  <MaterialIcons name="keyboard-arrow-up" size={20} color={V2.textMuted} />
                </Pressable>
                <Text style={styles.order}>{String(item.sortOrder).padStart(2, "0")}</Text>
                <Pressable
                  accessibilityLabel="下移区块"
                  disabled={index === (content.data?.length ?? 1) - 1 || save.isPending}
                  onPress={() => quickSave(item, { sortOrder: item.sortOrder + 2 })}
                  style={[styles.iconButton, index === (content.data?.length ?? 1) - 1 && styles.disabled]}
                >
                  <MaterialIcons name="keyboard-arrow-down" size={20} color={V2.textMuted} />
                </Pressable>
              </View>
              <View style={styles.blockCopy}>
                <View style={styles.blockTitleRow}>
                  <Text style={styles.blockType}>{CONTENT_TYPE_LABELS[item.block.type]}</Text>
                  {item.isFallback ? <Text style={styles.fallback}>默认占位</Text> : null}
                  {!item.isVisible ? <Text style={styles.hiddenLabel}>已隐藏</Text> : null}
                </View>
                <Text style={styles.blockTitle}>{item.block.heading}</Text>
                <Text style={styles.blockPreview} numberOfLines={2}>{blockPreview(item.block)}</Text>
              </View>
              <View style={styles.blockActions}>
                <Pressable
                  accessibilityLabel={item.isVisible ? "隐藏区块" : "显示区块"}
                  onPress={() => quickSave(item, { isVisible: !item.isVisible })}
                  style={styles.iconButtonLarge}
                >
                  <MaterialIcons name={item.isVisible ? "visibility" : "visibility-off"} size={18} color={V2.textMuted} />
                </Pressable>
                <Pressable
                  accessibilityLabel="编辑区块"
                  onPress={() => setEditing({
                    recordId: item.recordId,
                    sortOrder: item.sortOrder,
                    isVisible: item.isVisible,
                    form: blockToEditorForm(item.block),
                  })}
                  style={styles.editButton}
                >
                  <MaterialIcons name="edit" size={16} color={V2.blue} />
                  <Text style={styles.editText}>编辑</Text>
                </Pressable>
                {item.recordId ? (
                  <Pressable
                    accessibilityLabel="删除自定义区块"
                    onPress={() => confirmDelete(() => remove.mutate({ recordId: item.recordId! }))}
                    style={styles.iconButtonLarge}
                  >
                    <MaterialIcons name="delete-outline" size={18} color={V2.red} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          {!content.isLoading && !content.data?.length ? (
            <View style={styles.empty}><MaterialIcons name="article" size={26} color={V2.textDim} /><Text style={styles.emptyText}>没有内容区块，点击右上角新建。</Text></View>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={() => setEditing(undefined)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEditing(undefined)}>
          <Pressable style={[styles.modal, isMobile && styles.modalMobile]} onPress={(event) => event.stopPropagation()}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeading}>
                <View><Text style={styles.modalEyebrow}>CONTENT BLOCK</Text><Text style={styles.modalTitle}>{editing?.recordId ? "编辑区块" : "新建区块"}</Text></View>
                <Pressable accessibilityLabel="关闭" onPress={() => setEditing(undefined)} style={styles.closeButton}><MaterialIcons name="close" size={20} color={V2.textMuted} /></Pressable>
              </View>

              <Text style={styles.label}>区块类型</Text>
              <View style={styles.typePicker}>
                {(Object.keys(CONTENT_TYPE_LABELS) as ContentBlockType[]).map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setEditing((current) => current ? { ...current, form: { ...current.form, type, body: "", items: "" } } : current)}
                    style={[styles.typeButton, editing?.form.type === type && styles.typeButtonActive]}
                  >
                    <Text style={[styles.typeText, editing?.form.type === type && styles.typeTextActive]}>{CONTENT_TYPE_LABELS[type]}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>标题</Text>
              <TextInput
                value={editing?.form.heading ?? ""}
                onChangeText={(heading) => setEditing((current) => current ? { ...current, form: { ...current.form, heading } } : current)}
                style={styles.input}
                placeholder="输入区块标题"
                placeholderTextColor={V2.textDim}
              />

              {editing?.form.type === "rich_text" || editing?.form.type === "risk_notice" ? (
                <>
                  <Text style={styles.label}>{editing.form.type === "rich_text" ? "正文（空行分段）" : "风险说明"}</Text>
                  <TextInput
                    value={editing.form.body}
                    onChangeText={(body) => setEditing((current) => current ? { ...current, form: { ...current.form, body } } : current)}
                    style={styles.textarea}
                    multiline
                    textAlignVertical="top"
                    placeholder="输入正文"
                    placeholderTextColor={V2.textDim}
                  />
                </>
              ) : null}

              {editing?.form.type !== "risk_notice" ? (
                <>
                  <Text style={styles.label}>{editing ? editorItemsHelp(editing.form.type) : "列表内容"}</Text>
                  <TextInput
                    value={editing?.form.items ?? ""}
                    onChangeText={(items) => setEditing((current) => current ? { ...current, form: { ...current.form, items } } : current)}
                    style={styles.textarea}
                    multiline
                    textAlignVertical="top"
                    placeholder={editing ? editorItemsHelp(editing.form.type) : ""}
                    placeholderTextColor={V2.textDim}
                  />
                </>
              ) : null}

              <View style={styles.formRow}>
                <View style={styles.sortField}><Text style={styles.label}>排序</Text><TextInput value={String(editing?.sortOrder ?? 1)} onChangeText={(value) => setEditing((current) => current ? { ...current, sortOrder: Math.max(0, Number.parseInt(value, 10) || 0) } : current)} keyboardType="number-pad" style={styles.input} /></View>
                <View style={styles.visibleField}><View><Text style={styles.label}>前台可见</Text><Text style={styles.visibleHelp}>关闭后保留内容但不渲染</Text></View><Switch value={editing?.isVisible ?? true} onValueChange={(isVisible) => setEditing((current) => current ? { ...current, isVisible } : current)} trackColor={{ false: V2.borderStrong, true: `${V2.green}88` }} thumbColor={editing?.isVisible ? V2.green : V2.textMuted} /></View>
              </View>

              <View style={styles.modalActions}>
                <Pressable onPress={() => setEditing(undefined)} style={styles.cancelButton}><Text style={styles.cancelText}>取消</Text></Pressable>
                <Pressable onPress={handleSave} disabled={save.isPending} style={[styles.saveButton, save.isPending && styles.disabled]}>
                  {save.isPending ? <ActivityIndicator size="small" color={V2.background} /> : <MaterialIcons name="save" size={18} color={V2.background} />}
                  <Text style={styles.saveText}>保存区块</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

function blockPreview(block: ReturnType<typeof editorFormToBlock>) {
  if (block.type === "rich_text") return [...block.paragraphs, ...block.bullets].join(" · ");
  if (block.type === "risk_notice") return block.content;
  if (block.type === "evidence") return block.items.map((item) => `${item.title}：${item.detail}`).join(" · ");
  if (block.type === "timeline") return block.items.map((item) => `${item.date} ${item.title}`).join(" · ");
  return block.items.map((item) => item.question).join(" · ");
}

function showMessage(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

function confirmDelete(action: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm("删除自定义内容后会恢复默认占位（若存在），确认继续吗？")) action();
    return;
  }
  Alert.alert("删除内容", "删除后会恢复默认占位（若存在）。", [
    { text: "取消", style: "cancel" },
    { text: "删除", style: "destructive", onPress: action },
  ]);
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  page: { width: "100%", maxWidth: 1320, alignSelf: "center", padding: 22, paddingBottom: 50, gap: 20 },
  pageMobile: { padding: 14 },
  header: { minHeight: 116, padding: 17, borderWidth: 1, borderColor: V2.border, borderRadius: 6, backgroundColor: "rgba(11,17,28,0.88)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18 },
  headerMobile: { alignItems: "stretch", flexDirection: "column" },
  headerCopy: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  title: { color: V2.text, fontSize: 24, lineHeight: 31, fontWeight: "900" },
  subtitle: { color: V2.textMuted, fontSize: 10, lineHeight: 16, maxWidth: 700 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  previewButton: { minHeight: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  previewText: { color: V2.text, fontSize: 10, fontWeight: "800" },
  addButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 4, backgroundColor: V2.gold, flexDirection: "row", alignItems: "center", gap: 6 },
  addText: { color: V2.background, fontSize: 10, fontWeight: "900" },
  strategyPicker: { padding: 4, flexDirection: "row", flexWrap: "wrap", gap: 4, borderWidth: 1, borderColor: V2.border, borderRadius: 5, backgroundColor: V2.surfaceMuted },
  strategyButton: { minHeight: 40, minWidth: 132, paddingHorizontal: 10, borderRadius: 3, flexDirection: "row", alignItems: "center", gap: 8 },
  strategyButtonActive: { backgroundColor: V2.surface },
  strategyRail: { width: 3, height: 20 },
  strategyButtonText: { color: V2.textMuted, fontSize: 11, fontWeight: "700" },
  strategyButtonTextActive: { color: V2.text, fontWeight: "900" },
  sectionHeading: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: V2.text, fontSize: 16, fontWeight: "900" },
  sectionMeta: { marginTop: 4, color: V2.textDim, fontSize: 9 },
  blockList: { borderTopWidth: 1, borderTopColor: V2.border },
  blockRow: { minHeight: 104, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: 1, borderBottomColor: V2.border },
  blockHidden: { opacity: 0.55 },
  orderControls: { width: 42, alignItems: "center", gap: 2 },
  iconButton: { width: 30, height: 25, alignItems: "center", justifyContent: "center" },
  order: { color: V2.textDim, fontSize: 8, fontWeight: "900" },
  blockCopy: { flex: 1, minWidth: 0, gap: 4 },
  blockTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  blockType: { color: V2.gold, fontSize: 8, fontWeight: "900" },
  fallback: { color: V2.blue, fontSize: 8, fontWeight: "800" },
  hiddenLabel: { color: V2.red, fontSize: 8, fontWeight: "800" },
  blockTitle: { color: V2.text, fontSize: 14, fontWeight: "900" },
  blockPreview: { color: V2.textMuted, fontSize: 10, lineHeight: 15 },
  blockActions: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  iconButtonLarge: { width: 36, height: 36, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  editButton: { minHeight: 36, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(98,168,246,0.36)", borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 5 },
  editText: { color: V2.blue, fontSize: 10, fontWeight: "800" },
  empty: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: V2.border },
  emptyText: { color: V2.textMuted, fontSize: 10 },
  modalBackdrop: { flex: 1, padding: 20, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center" },
  modal: { width: "100%", maxWidth: 820, maxHeight: "92%", borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 6, backgroundColor: V2.backgroundRaised, overflow: "hidden" },
  modalMobile: { maxHeight: "96%" },
  modalContent: { padding: 20, gap: 9 },
  modalHeading: { minHeight: 48, marginBottom: 4, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  modalEyebrow: { color: V2.gold, fontSize: 8, fontWeight: "900" },
  modalTitle: { marginTop: 3, color: V2.text, fontSize: 20, fontWeight: "900" },
  closeButton: { width: 36, height: 36, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  label: { color: V2.textMuted, fontSize: 9, fontWeight: "800", marginTop: 4 },
  typePicker: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  typeButton: { minHeight: 34, paddingHorizontal: 10, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  typeButtonActive: { borderColor: "rgba(216,188,131,0.48)", backgroundColor: "rgba(216,188,131,0.08)" },
  typeText: { color: V2.textMuted, fontSize: 9, fontWeight: "700" },
  typeTextActive: { color: V2.gold, fontWeight: "900" },
  input: { minHeight: 42, paddingHorizontal: 11, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, color: V2.text, backgroundColor: V2.surfaceMuted, fontSize: 11, outlineStyle: "none" } as any,
  textarea: { minHeight: 122, padding: 11, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, color: V2.text, backgroundColor: V2.surfaceMuted, fontSize: 11, lineHeight: 18, outlineStyle: "none" } as any,
  formRow: { flexDirection: "row", alignItems: "flex-end", gap: 14, flexWrap: "wrap" },
  sortField: { width: 130, gap: 5 },
  visibleField: { flex: 1, minWidth: 220, minHeight: 58, paddingHorizontal: 12, borderWidth: 1, borderColor: V2.border, borderRadius: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  visibleHelp: { marginTop: 3, color: V2.textDim, fontSize: 8 },
  modalActions: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  cancelButton: { minHeight: 42, minWidth: 90, paddingHorizontal: 14, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  cancelText: { color: V2.textMuted, fontSize: 10, fontWeight: "800" },
  saveButton: { minHeight: 42, minWidth: 120, paddingHorizontal: 14, borderRadius: 4, backgroundColor: V2.gold, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  saveText: { color: V2.background, fontSize: 10, fontWeight: "900" },
  disabled: { opacity: 0.35 },
});
