import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { AdminPageChrome, AdminSection } from "@/components/admin/page-chrome";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

/**
 * 后台：侧边栏自定义入口管理
 *
 * 功能：
 * - 列表（按 sortOrder 排）
 * - 新建：emoji + 文字 + href + 排序值 + 启用
 * - 编辑：在表格里直接改，点保存
 * - 删除
 * - 启用/禁用切换
 */
export default function AdminSiteEntries() {
  const colors = useColors();
  const utils = trpc.useUtils();

  const listQuery = trpc.siteEntries.adminList.useQuery();
  const createMutation = trpc.siteEntries.create.useMutation({
    onSuccess: () => utils.siteEntries.adminList.invalidate(),
  });
  const updateMutation = trpc.siteEntries.update.useMutation({
    onSuccess: () => utils.siteEntries.adminList.invalidate(),
  });
  const deleteMutation = trpc.siteEntries.delete.useMutation({
    onSuccess: () => utils.siteEntries.adminList.invalidate(),
  });

  const [newEmoji, setNewEmoji] = useState("📌");
  const [newLabel, setNewLabel] = useState("");
  const [newHref, setNewHref] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("100");

  const handleCreate = async () => {
    if (!newLabel.trim() || !newHref.trim()) {
      const msg = "请填写文字和链接";
      Platform.OS === "web" ? alert(msg) : Alert.alert("提示", msg);
      return;
    }
    try {
      await createMutation.mutateAsync({
        emoji: newEmoji.trim() || "📌",
        label: newLabel.trim(),
        href: newHref.trim(),
        sortOrder: parseInt(newSortOrder, 10) || 0,
        enabled: true,
      });
      setNewEmoji("📌");
      setNewLabel("");
      setNewHref("");
      setNewSortOrder("100");
    } catch (e: any) {
      const msg = e.message || "创建失败";
      Platform.OS === "web" ? alert(msg) : Alert.alert("错误", msg);
    }
  };

  const handleToggleEnabled = async (id: number, current: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, enabled: !current });
    } catch (e: any) {
      const msg = e.message || "更新失败";
      Platform.OS === "web" ? alert(msg) : Alert.alert("错误", msg);
    }
  };

  const handleDelete = (id: number, label: string) => {
    const confirmText = `确定删除「${label}」吗？`;
    const doDelete = async () => {
      try {
        await deleteMutation.mutateAsync({ id });
      } catch (e: any) {
        const msg = e.message || "删除失败";
        Platform.OS === "web" ? alert(msg) : Alert.alert("错误", msg);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(confirmText)) doDelete();
    } else {
      Alert.alert("确认删除", confirmText, [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  return (
    <AdminPageChrome
      eyebrow="NAV CONFIG"
      title="侧边栏入口管理"
      subtitle="管理悬浮导航里展示的快捷链接和排序"
      metrics={[
        { label: "入口总数", value: listQuery.data?.length ?? "-", tone: colors.primary },
        { label: "已启用", value: listQuery.data?.filter((item: any) => item.enabled).length ?? "-", tone: colors.success },
        { label: "最高排序", value: listQuery.data?.[0]?.sortOrder ?? "-", tone: "#60A5FA" },
      ]}
      maxWidth={1160}
    >
        <AdminSection title="新增入口" meta="CREATE">
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.formRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.label, { color: colors.muted }]}>Emoji</Text>
              <TextInput
                value={newEmoji}
                onChangeText={setNewEmoji}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="📌"
                placeholderTextColor={colors.muted}
                maxLength={4}
              />
            </View>

            <View style={{ flex: 3, marginRight: 8 }}>
              <Text style={[styles.label, { color: colors.muted }]}>文字</Text>
              <TextInput
                value={newLabel}
                onChangeText={setNewLabel}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="MT4 教程"
                placeholderTextColor={colors.muted}
                maxLength={50}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.muted }]}>排序</Text>
              <TextInput
                value={newSortOrder}
                onChangeText={setNewSortOrder}
                keyboardType="number-pad"
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="100"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          <Text style={[styles.label, { color: colors.muted, marginTop: 8 }]}>跳转链接</Text>
          <TextInput
            value={newHref}
            onChangeText={setNewHref}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="/tutorials/mt4 或 https://t.me/eaxau"
            placeholderTextColor={colors.muted}
          />

          <TouchableOpacity
            onPress={handleCreate}
            disabled={createMutation.isPending}
            style={[styles.cta, { opacity: createMutation.isPending ? 0.5 : 1 }]}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#0A1628" />
            ) : (
              <Text style={styles.ctaText}>添加</Text>
            )}
          </TouchableOpacity>
        </View>
        </AdminSection>

        <AdminSection title={`所有入口 (${listQuery.data?.length ?? 0})`} meta="SORTED">

        {listQuery.isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />}

        <View style={[styles.tablePanel, { borderColor: colors.border }]}>
          {listQuery.data?.map((entry: any) => (
            <SiteEntryRow
              key={entry.id}
              entry={entry}
              colors={colors}
              onToggle={() => handleToggleEnabled(entry.id, entry.enabled)}
              onDelete={() => handleDelete(entry.id, entry.label)}
              onUpdate={(patch) => updateMutation.mutate({ id: entry.id, ...patch })}
            />
          ))}
        </View>

        {listQuery.data?.length === 0 && !listQuery.isLoading && (
          <View style={{ padding: 24, alignItems: "center" }}>
            <Text style={{ color: colors.muted }}>暂无入口</Text>
          </View>
        )}
        </AdminSection>
    </AdminPageChrome>
  );
}

function SiteEntryRow({
  entry, colors, onToggle, onDelete, onUpdate,
}: {
  entry: any;
  colors: any;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (patch: { emoji?: string; label?: string; href?: string; sortOrder?: number }) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [emoji, setEmoji] = useState(entry.emoji);
  const [label, setLabel] = useState(entry.label);
  const [href, setHref] = useState(entry.href);
  const [sortOrder, setSortOrder] = useState(String(entry.sortOrder));

  const handleSave = () => {
    onUpdate({
      emoji: emoji.trim() || "📌",
      label: label.trim(),
      href: href.trim(),
      sortOrder: parseInt(sortOrder, 10) || 0,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.formRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextInput
              value={emoji} onChangeText={setEmoji}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              maxLength={4}
            />
          </View>
          <View style={{ flex: 3, marginRight: 8 }}>
            <TextInput
              value={label} onChangeText={setLabel}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              value={sortOrder} onChangeText={setSortOrder} keyboardType="number-pad"
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />
          </View>
        </View>
        <TextInput
          value={href} onChangeText={setHref}
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, marginTop: 8 }]}
        />
        <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
          <TouchableOpacity onPress={handleSave} style={[styles.cta, { flex: 1 }]}>
            <Text style={styles.ctaText}>保存</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsEditing(false)} style={[styles.ctaGhost, { flex: 1 }]}>
            <Text style={[styles.ctaGhostText, { color: colors.muted }]}>取消</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, { borderBottomColor: colors.border, opacity: entry.enabled ? 1 : 0.5 }]}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={styles.entryCode}>
          <Text style={styles.entryCodeText}>{String(entry.label || "NAV").slice(0, 3).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
            {entry.label}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {entry.href}
          </Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 11, marginRight: 12 }}>#{entry.sortOrder}</Text>
      </View>

      <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
        <TouchableOpacity onPress={onToggle} style={[styles.ctaGhost, { flex: 1 }]}>
          <Text style={{ color: entry.enabled ? colors.success : colors.muted, fontWeight: "600" }}>
            {entry.enabled ? "✓ 启用" : "✗ 禁用"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsEditing(true)} style={[styles.ctaGhost, { flex: 1 }]}>
          <Text style={{ color: colors.accent, fontWeight: "600" }}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={[styles.ctaGhost, { flex: 1 }]}>
          <Text style={{ color: colors.error, fontWeight: "600" }}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  formRow: { flexDirection: "row", alignItems: "flex-end" },
  label: { fontSize: 11, fontWeight: "600", marginBottom: 4, letterSpacing: 0.5 },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  cta: {
    backgroundColor: "#C9A96E",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  ctaText: { color: "#0A1628", fontSize: 14, fontWeight: "700" },
  ctaGhost: {
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "rgba(148,163,184,0.06)",
  },
  ctaGhostText: { fontSize: 13, fontWeight: "600" },
  row: {
    padding: 14,
    borderBottomWidth: 1,
  },
  tablePanel: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.56)",
  },
  entryCode: {
    width: 42,
    height: 34,
    borderRadius: 4,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(216,188,131,0.12)",
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.24)",
  },
  entryCodeText: {
    color: "#D8BC83",
    fontSize: 10,
    fontWeight: "900",
  },
});
