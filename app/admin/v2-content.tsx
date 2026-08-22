import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { ActionDialog } from "@/components/v2/action-dialog";
import { V2ErrorState } from "@/components/v2/page-state";
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
  isNew: boolean;
  sortOrder: number;
  isVisible: boolean;
  form: ContentEditorForm;
  baseline: string;
};

type DialogState = Omit<ComponentProps<typeof ActionDialog>, "visible">;

function editingSnapshot(state: Pick<EditingState, "sortOrder" | "isVisible" | "form">) {
  return JSON.stringify([state.form, state.sortOrder, state.isVisible]);
}

function AdminTextInput(props: ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[props.style, focused && styles.inputFocused]}
    />
  );
}

export default function V2ContentAdminPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const utils = trpc.useUtils();
  const strategies = trpc.v2.strategies.list.useQuery(undefined, { staleTime: 30_000 });
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<EditingState>();
  const [dialog, setDialog] = useState<DialogState>();
  const [savedFlash, setSavedFlash] = useState(false);
  const content = trpc.v2.adminContent.list.useQuery(
    { strategyId: selectedId },
    { enabled: Boolean(selectedId) },
  );
  const save = trpc.v2.adminContent.save.useMutation({
    onSuccess: async () => {
      setEditing(undefined);
      setSavedFlash(true);
      await Promise.all([
        utils.v2.adminContent.list.invalidate({ strategyId: selectedId }),
        utils.v2.strategies.invalidate(),
        utils.v2.overview.invalidate(),
      ]);
    },
    onError: (error) => showNotice("保存失败", error.message, "danger"),
  });
  const remove = trpc.v2.adminContent.delete.useMutation({
    onSuccess: async () => {
      setSavedFlash(true);
      await Promise.all([
        utils.v2.adminContent.list.invalidate({ strategyId: selectedId }),
        utils.v2.strategies.invalidate(),
        utils.v2.overview.invalidate(),
      ]);
    },
    onError: (error) => showNotice("删除失败", error.message, "danger"),
  });
  const reorder = trpc.v2.adminContent.reorder.useMutation({
    onSuccess: async () => {
      setSavedFlash(true);
      await Promise.all([
        utils.v2.adminContent.list.invalidate({ strategyId: selectedId }),
        utils.v2.strategies.invalidate(),
        utils.v2.overview.invalidate(),
      ]);
    },
    onError: (error) => showNotice("排序失败", error.message, "danger"),
  });

  function closeDialog() {
    setDialog(undefined);
  }

  function showNotice(
    title: string,
    message: string,
    tone: ComponentProps<typeof ActionDialog>["tone"] = "warning",
  ) {
    setDialog({
      title,
      message,
      tone,
      confirmLabel: "知道了",
      confirmOnly: true,
      onConfirm: closeDialog,
      onCancel: closeDialog,
    });
  }

  function askForConfirmation(
    options: Pick<DialogState, "title" | "message" | "tone" | "confirmLabel" | "cancelLabel">,
    action: () => void,
  ) {
    setDialog({
      ...options,
      onConfirm: () => {
        setDialog(undefined);
        action();
      },
      onCancel: closeDialog,
    });
  }

  useEffect(() => {
    if (!selectedId && strategies.data?.length) setSelectedId(strategies.data[0].id);
  }, [selectedId, strategies.data]);

  useEffect(() => {
    if (!savedFlash) return;
    const timer = setTimeout(() => setSavedFlash(false), 2400);
    return () => clearTimeout(timer);
  }, [savedFlash]);

  const selectedStrategy = strategies.data?.find((item) => item.id === selectedId);
  const busy = save.isPending || remove.isPending || reorder.isPending;

  const openCreate = () => {
    const next = {
      recordId: null,
      isNew: true,
      sortOrder:
        Math.max(0, ...(content.data?.map((item) => item.sortOrder) ?? [])) + 10,
      isVisible: true,
      form: emptyEditorForm(),
    };
    setEditing({ ...next, baseline: editingSnapshot(next) });
  };

  const requestCloseEditor = () => {
    if (!editing) return;
    if (editingSnapshot(editing) === editing.baseline) {
      setEditing(undefined);
      return;
    }
    askForConfirmation(
      {
        title: "放弃修改",
        message: "当前区块有未保存的修改，关闭后将无法恢复。",
        tone: "danger",
        confirmLabel: "放弃修改",
        cancelLabel: "继续编辑",
      },
      () => setEditing(undefined),
    );
  };

  const selectStrategy = (strategyId: string) => {
    if (strategyId === selectedId) return;
    const apply = () => {
      setEditing(undefined);
      setSelectedId(strategyId);
    };
    if (editing && editingSnapshot(editing) !== editing.baseline) {
      askForConfirmation(
        {
          title: "切换策略",
          message: "当前区块有未保存的修改。切换策略后，这些修改将无法恢复。",
          tone: "warning",
          confirmLabel: "放弃并切换",
          cancelLabel: "继续编辑",
        },
        apply,
      );
      return;
    }
    apply();
  };

  const changeEditingType = (type: ContentBlockType) => {
    if (!editing || editing.form.type === type) return;
    const apply = () =>
      setEditing((current) =>
        current
          ? { ...current, form: { ...current.form, type, body: "", items: "" } }
          : current,
      );
    if (editing.form.body.trim() || editing.form.items.trim()) {
      askForConfirmation(
        {
          title: "切换区块类型",
          message: "当前正文和列表内容将被清空，区块标题会保留。",
          tone: "warning",
          confirmLabel: "继续切换",
          cancelLabel: "取消",
        },
        apply,
      );
      return;
    }
    apply();
  };

  const handleSave = () => {
    if (!editing || !selectedId) return;
    if (!editing.form.heading.trim()) {
      showNotice("内容不完整", "请填写区块标题。");
      return;
    }
    const block = editorFormToBlock(editing.form);
    if (
      (block.type === "rich_text" && block.paragraphs.length === 0) ||
      (block.type === "risk_notice" && !block.content) ||
      ("items" in block && block.items.length === 0)
    ) {
      showNotice("内容不完整", "请填写正文或至少一条列表内容。");
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

  const moveBlock = (index: number, direction: -1 | 1) => {
    if (!selectedId || !content.data) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= content.data.length) return;
    const next = [...content.data];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    reorder.mutate({
      strategyId: selectedId,
      blockIds: next.map((item) => item.block.id),
    });
  };

  if (strategies.isLoading) {
    return <ScreenContainer><View style={styles.loading}><ActivityIndicator size="large" color={V2.gold} /></View></ScreenContainer>;
  }
  if (!strategies.data) {
    return (
      <ScreenContainer>
        <V2ErrorState
          title="核心策略加载失败"
          detail={strategies.error?.message || "没有取得可编辑的核心策略。"}
          onRetry={() => strategies.refetch()}
        />
      </ScreenContainer>
    );
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
            <Pressable accessibilityRole="link" accessibilityState={{ disabled: !selectedId }} disabled={!selectedId} onPress={() => router.push(`/v2-preview/strategies/${selectedId}` as never)} style={({ pressed }) => [styles.previewButton, !selectedId && styles.disabled, pressed && styles.pressed]}>
              <MaterialIcons name="open-in-new" size={17} color={V2.text} />
              <Text style={styles.previewText}>预览页面</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !selectedId }} disabled={!selectedId} onPress={openCreate} style={({ pressed }) => [styles.addButton, !selectedId && styles.disabled, pressed && styles.pressed]}>
              <MaterialIcons name="add" size={18} color={V2.background} />
              <Text style={styles.addText}>新建区块</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.strategyPicker}>
          {strategies.data.map((strategy) => (
            <Pressable
              key={strategy.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedId === strategy.id }}
              onPress={() => selectStrategy(strategy.id)}
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
            <Text style={styles.sectionMeta}>{content.data?.length ?? 0} 个内容区块 · 上下箭头调整顺序，眼睛图标控制前台显隐</Text>
          </View>
          <View accessibilityLiveRegion="polite" style={styles.headingStatus}>
            {busy ? (
              <View style={styles.savingChip}>
                <ActivityIndicator size="small" color={V2.gold} />
                <Text style={styles.savingText}>保存中…</Text>
              </View>
            ) : savedFlash ? (
              <View style={[styles.savingChip, styles.savedChip]}>
                <MaterialIcons name="check-circle" size={14} color={V2.green} />
                <Text style={[styles.savingText, styles.savedText]}>已保存</Text>
              </View>
            ) : content.isFetching ? (
              <ActivityIndicator size="small" color={V2.gold} />
            ) : null}
          </View>
        </View>

        <View style={styles.blockList}>
          {content.error ? (
            <View accessibilityRole="alert" style={styles.inlineError}>
              <MaterialIcons name="sync-problem" size={24} color={V2.amber} />
              <View style={styles.inlineErrorCopy}>
                <Text style={styles.inlineErrorTitle}>内容区块加载失败</Text>
                <Text style={styles.inlineErrorDetail}>{content.error.message}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => content.refetch()} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                <MaterialIcons name="refresh" size={17} color={V2.text} />
                <Text style={styles.retryText}>重试</Text>
              </Pressable>
            </View>
          ) : content.isLoading ? (
            <View accessibilityLiveRegion="polite" style={styles.listLoading}>
              <ActivityIndicator color={V2.gold} />
              <Text style={styles.listLoadingText}>正在读取内容区块</Text>
            </View>
          ) : content.data?.map((item, index) => (
            <View key={item.block.id} style={[styles.blockRow, isMobile && styles.blockRowMobile, !item.isVisible && styles.blockHidden]}>
              <View style={styles.orderControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`上移「${item.block.heading}」`}
                  accessibilityState={{ disabled: index === 0 || busy }}
                  disabled={index === 0 || busy}
                  onPress={() => moveBlock(index, -1)}
                  style={({ pressed }) => [styles.iconButton, index === 0 && styles.disabled, pressed && styles.pressed]}
                >
                  <MaterialIcons name="keyboard-arrow-up" size={20} color={V2.textMuted} />
                </Pressable>
                <Text style={styles.order}>{String(item.sortOrder).padStart(2, "0")}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`下移「${item.block.heading}」`}
                  accessibilityState={{ disabled: index === (content.data?.length ?? 1) - 1 || busy }}
                  disabled={index === (content.data?.length ?? 1) - 1 || busy}
                  onPress={() => moveBlock(index, 1)}
                  style={({ pressed }) => [styles.iconButton, index === (content.data?.length ?? 1) - 1 && styles.disabled, pressed && styles.pressed]}
                >
                  <MaterialIcons name="keyboard-arrow-down" size={20} color={V2.textMuted} />
                </Pressable>
              </View>
              <View style={styles.blockCopy}>
                <View style={styles.blockTitleRow}>
                  <View style={styles.typeChip}><Text style={styles.blockType}>{CONTENT_TYPE_LABELS[item.block.type]}</Text></View>
                  {item.isFallback ? <View style={[styles.typeChip, styles.fallbackChip]}><Text style={styles.fallback}>默认占位</Text></View> : null}
                  {!item.isVisible ? <View style={[styles.typeChip, styles.hiddenChip]}><Text style={styles.hiddenLabel}>已隐藏</Text></View> : null}
                </View>
                <Text style={styles.blockTitle}>{item.block.heading}</Text>
                <Text style={styles.blockPreview} numberOfLines={2}>{blockPreview(item.block)}</Text>
              </View>
              <View style={styles.blockActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.isVisible ? `隐藏「${item.block.heading}」` : `显示「${item.block.heading}」`}
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => quickSave(item, { isVisible: !item.isVisible })}
                  style={({ pressed }) => [styles.iconButtonLarge, pressed && styles.pressed]}
                >
                  <MaterialIcons name={item.isVisible ? "visibility" : "visibility-off"} size={18} color={V2.textMuted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`编辑「${item.block.heading}」`}
                  onPress={() => {
                    const next = {
                      recordId: item.recordId,
                      isNew: false,
                      sortOrder: item.sortOrder,
                      isVisible: item.isVisible,
                      form: blockToEditorForm(item.block),
                    };
                    setEditing({ ...next, baseline: editingSnapshot(next) });
                  }}
                  style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                >
                  <MaterialIcons name="edit" size={16} color={V2.blue} />
                  <Text style={styles.editText}>编辑</Text>
                </Pressable>
                {item.recordId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`删除「${item.block.heading}」`}
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() =>
                      askForConfirmation(
                        {
                          title: "删除内容区块",
                          message: `确认删除「${item.block.heading}」吗？删除后会恢复默认占位（若存在）。`,
                          tone: "danger",
                          confirmLabel: "删除",
                          cancelLabel: "取消",
                        },
                        () => remove.mutate({ recordId: item.recordId! }),
                      )
                    }
                    style={({ pressed }) => [styles.iconButtonLarge, pressed && styles.pressed]}
                  >
                    <MaterialIcons name="delete-outline" size={18} color={V2.red} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          {!content.error && !content.isLoading && !content.data?.length ? (
            <View style={styles.empty}>
              <MaterialIcons name="article" size={26} color={V2.textDim} />
              <Text style={styles.emptyText}>这个策略还没有内容区块。</Text>
              <Pressable accessibilityRole="button" onPress={openCreate} style={({ pressed }) => [styles.emptyCreate, pressed && styles.pressed]}>
                <MaterialIcons name="add" size={16} color={V2.background} />
                <Text style={styles.emptyCreateText}>新建第一个区块</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={requestCloseEditor}>
        <Pressable style={styles.modalBackdrop} onPress={requestCloseEditor}>
          <Pressable style={[styles.modal, isMobile && styles.modalMobile]} onPress={(event) => event.stopPropagation()}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeading}>
                <View><Text style={styles.modalEyebrow}>CONTENT BLOCK</Text><Text style={styles.modalTitle}>{editing?.isNew ? "新建区块" : "编辑区块"}</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="关闭编辑窗口" onPress={requestCloseEditor} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><MaterialIcons name="close" size={20} color={V2.textMuted} /></Pressable>
              </View>

              <Text style={styles.label}>区块类型</Text>
              <View style={styles.typePicker}>
                {(Object.keys(CONTENT_TYPE_LABELS) as ContentBlockType[]).map((type) => (
                  <Pressable
                    key={type}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: editing?.form.type === type }}
                    onPress={() => changeEditingType(type)}
                    style={({ pressed }) => [styles.typeButton, editing?.form.type === type && styles.typeButtonActive, pressed && styles.pressed]}
                  >
                    <Text style={[styles.typeText, editing?.form.type === type && styles.typeTextActive]}>{CONTENT_TYPE_LABELS[type]}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.typeHint}>切换类型会清空正文与列表内容，标题会保留。</Text>

              <Text style={styles.label}>标题</Text>
              <AdminTextInput
                accessibilityLabel="区块标题"
                value={editing?.form.heading ?? ""}
                onChangeText={(heading) => setEditing((current) => current ? { ...current, form: { ...current.form, heading } } : current)}
                style={styles.input}
                placeholder="输入区块标题"
                placeholderTextColor={V2.textDim}
              />

              {editing?.form.type === "rich_text" || editing?.form.type === "risk_notice" ? (
                <>
                  <Text style={styles.label}>{editing.form.type === "rich_text" ? "正文（空行分段）" : "风险说明"}</Text>
                  <AdminTextInput
                    accessibilityLabel={editing.form.type === "rich_text" ? "区块正文" : "风险说明正文"}
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
                  <AdminTextInput
                    accessibilityLabel="列表内容"
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
                <View style={styles.sortField}><Text style={styles.label}>排序</Text><AdminTextInput accessibilityLabel="排序序号" value={String(editing?.sortOrder ?? 1)} onChangeText={(value) => setEditing((current) => current ? { ...current, sortOrder: Math.max(0, Number.parseInt(value, 10) || 0) } : current)} keyboardType="number-pad" style={styles.input} /></View>
                <View style={styles.visibleField}><View><Text style={styles.label}>前台可见</Text><Text style={styles.visibleHelp}>关闭后保留内容但不渲染</Text></View><Switch accessibilityLabel="前台可见" value={editing?.isVisible ?? true} onValueChange={(isVisible) => setEditing((current) => current ? { ...current, isVisible } : current)} trackColor={{ false: V2.borderStrong, true: `${V2.green}88` }} thumbColor={editing?.isVisible ? V2.green : V2.textMuted} /></View>
              </View>

              <View style={styles.modalActions}>
                <Pressable accessibilityRole="button" onPress={requestCloseEditor} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={styles.cancelText}>取消</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: save.isPending, busy: save.isPending }} onPress={handleSave} disabled={save.isPending} style={({ pressed }) => [styles.saveButton, save.isPending && styles.disabled, pressed && styles.pressed]}>
                  {save.isPending ? <ActivityIndicator size="small" color={V2.background} /> : <MaterialIcons name="save" size={18} color={V2.background} />}
                  <Text style={styles.saveText}>{save.isPending ? "正在保存…" : "保存区块"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      {dialog ? <ActionDialog visible {...dialog} /> : null}
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

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  page: { width: "100%", maxWidth: 1320, alignSelf: "center", padding: 22, paddingBottom: 50, gap: 20 },
  pageMobile: { padding: 14 },
  header: { minHeight: 116, padding: 17, borderWidth: 1, borderColor: V2.border, borderRadius: 6, backgroundColor: "rgba(11,17,28,0.88)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18 },
  headerMobile: { alignItems: "stretch", flexDirection: "column" },
  headerCopy: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  title: { color: V2.text, fontSize: 24, lineHeight: 31, fontWeight: "900" },
  subtitle: { color: V2.textMuted, fontSize: 12, lineHeight: 18, maxWidth: 700 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  previewButton: { minHeight: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  previewText: { color: V2.text, fontSize: 11, fontWeight: "800" },
  addButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 4, backgroundColor: V2.gold, flexDirection: "row", alignItems: "center", gap: 6 },
  addText: { color: V2.background, fontSize: 11, fontWeight: "900" },
  strategyPicker: { padding: 4, flexDirection: "row", flexWrap: "wrap", gap: 4, borderWidth: 1, borderColor: V2.border, borderRadius: 5, backgroundColor: V2.surfaceMuted },
  strategyButton: { minHeight: 40, minWidth: 132, paddingHorizontal: 10, borderRadius: 3, flexDirection: "row", alignItems: "center", gap: 8 },
  strategyButtonActive: { backgroundColor: V2.surface },
  strategyRail: { width: 3, height: 20 },
  strategyButtonText: { color: V2.textMuted, fontSize: 12, fontWeight: "700" },
  strategyButtonTextActive: { color: V2.text, fontWeight: "900" },
  sectionHeading: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: V2.text, fontSize: 16, fontWeight: "900" },
  sectionMeta: { marginTop: 4, color: V2.textDim, fontSize: 10 },
  headingStatus: { minWidth: 96, minHeight: 30, alignItems: "flex-end", justifyContent: "center" },
  savingChip: { minHeight: 30, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(216,188,131,0.4)", borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(216,188,131,0.07)" },
  savedChip: { borderColor: "rgba(66,211,161,0.4)", backgroundColor: "rgba(66,211,161,0.07)" },
  savingText: { color: V2.gold, fontSize: 11, fontWeight: "800" },
  savedText: { color: V2.green },
  blockList: { borderTopWidth: 1, borderTopColor: V2.border },
  inlineError: { minHeight: 96, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: V2.border, backgroundColor: "rgba(224,176,75,0.05)" },
  inlineErrorCopy: { flex: 1, minWidth: 0, gap: 4 },
  inlineErrorTitle: { color: V2.text, fontSize: 13, fontWeight: "900" },
  inlineErrorDetail: { color: V2.textMuted, fontSize: 11, lineHeight: 17 },
  retryButton: { minHeight: 38, paddingHorizontal: 11, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  retryText: { color: V2.text, fontSize: 11, fontWeight: "800" },
  listLoading: { minHeight: 140, alignItems: "center", justifyContent: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: V2.border },
  listLoadingText: { color: V2.textMuted, fontSize: 11 },
  blockRow: { minHeight: 104, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: 1, borderBottomColor: V2.border },
  blockRowMobile: { flexWrap: "wrap", alignItems: "flex-start", rowGap: 10 },
  blockHidden: { opacity: 0.55 },
  orderControls: { width: 42, alignItems: "center", gap: 2 },
  iconButton: { width: 36, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 3 },
  order: { color: V2.textDim, fontSize: 10, fontWeight: "900" },
  blockCopy: { flex: 1, minWidth: 200, gap: 5 },
  blockTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  typeChip: { minHeight: 20, paddingHorizontal: 7, borderWidth: 1, borderColor: "rgba(216,188,131,0.38)", borderRadius: 3, justifyContent: "center", backgroundColor: "rgba(216,188,131,0.07)" },
  fallbackChip: { borderColor: "rgba(98,168,246,0.38)", backgroundColor: "rgba(98,168,246,0.07)" },
  hiddenChip: { borderColor: "rgba(240,122,116,0.4)", backgroundColor: "rgba(240,122,116,0.07)" },
  blockType: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  fallback: { color: V2.blue, fontSize: 10, fontWeight: "800" },
  hiddenLabel: { color: V2.red, fontSize: 10, fontWeight: "800" },
  blockTitle: { color: V2.text, fontSize: 14, fontWeight: "900" },
  blockPreview: { color: V2.textMuted, fontSize: 11, lineHeight: 16 },
  blockActions: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  iconButtonLarge: { width: 38, height: 38, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  editButton: { minHeight: 38, paddingHorizontal: 11, borderWidth: 1, borderColor: "rgba(98,168,246,0.36)", borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 5 },
  editText: { color: V2.blue, fontSize: 11, fontWeight: "800" },
  empty: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: V2.border },
  emptyText: { color: V2.textMuted, fontSize: 12 },
  emptyCreate: { minHeight: 38, paddingHorizontal: 13, borderRadius: 4, backgroundColor: V2.gold, flexDirection: "row", alignItems: "center", gap: 6 },
  emptyCreateText: { color: V2.background, fontSize: 11, fontWeight: "900" },
  modalBackdrop: { flex: 1, padding: 20, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center" },
  modal: { width: "100%", maxWidth: 820, maxHeight: "92%", borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 6, backgroundColor: V2.backgroundRaised, overflow: "hidden" },
  modalMobile: { maxHeight: "96%" },
  modalContent: { padding: 20, gap: 9 },
  modalHeading: { minHeight: 48, marginBottom: 4, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  modalEyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  modalTitle: { marginTop: 3, color: V2.text, fontSize: 20, fontWeight: "900" },
  closeButton: { width: 38, height: 38, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  label: { color: V2.textMuted, fontSize: 10, fontWeight: "800", marginTop: 4 },
  typePicker: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  typeButton: { minHeight: 36, paddingHorizontal: 11, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  typeButtonActive: { borderColor: "rgba(216,188,131,0.48)", backgroundColor: "rgba(216,188,131,0.08)" },
  typeText: { color: V2.textMuted, fontSize: 11, fontWeight: "700" },
  typeTextActive: { color: V2.gold, fontWeight: "900" },
  typeHint: { color: V2.textDim, fontSize: 10, lineHeight: 14 },
  input: { minHeight: 42, paddingHorizontal: 11, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, color: V2.text, backgroundColor: V2.surfaceMuted, fontSize: 13, outlineStyle: "none" } as any,
  textarea: { minHeight: 122, padding: 11, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, color: V2.text, backgroundColor: V2.surfaceMuted, fontSize: 13, lineHeight: 20, outlineStyle: "none" } as any,
  inputFocused: { borderColor: V2.gold },
  formRow: { flexDirection: "row", alignItems: "flex-end", gap: 14, flexWrap: "wrap" },
  sortField: { width: 130, gap: 5 },
  visibleField: { flex: 1, minWidth: 220, minHeight: 58, paddingHorizontal: 12, borderWidth: 1, borderColor: V2.border, borderRadius: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  visibleHelp: { marginTop: 3, color: V2.textDim, fontSize: 10 },
  modalActions: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  cancelButton: { minHeight: 42, minWidth: 90, paddingHorizontal: 14, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  cancelText: { color: V2.textMuted, fontSize: 11, fontWeight: "800" },
  saveButton: { minHeight: 42, minWidth: 120, paddingHorizontal: 14, borderRadius: 4, backgroundColor: V2.gold, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  saveText: { color: V2.background, fontSize: 11, fontWeight: "900" },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.72 },
});
