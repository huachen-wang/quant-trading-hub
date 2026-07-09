import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, StyleSheet, TextInput } from "react-native";
import { AdminPageChrome, AdminSection } from "@/components/admin/page-chrome";
import { useColors } from "@/hooks/use-colors";
import { adminQuery, adminMutation } from "@/lib/admin-api";
import { useState, useEffect, useCallback } from "react";

export default function AdminComments() {
  const colors = useColors();
  // Tab: "reviews" = 匿名评论审核, "notes" = 备注管理
  const [tab, setTab] = useState<"reviews" | "notes">("reviews");
  const [comments, setComments] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  // 备注添加
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminQuery("anonymousComments.listAll", { limit: 200, offset: 0 });
      let list = Array.isArray(data) ? data : [];
      if (filter === "pending") list = list.filter((c: any) => !c.isApproved);
      else if (filter === "approved") list = list.filter((c: any) => c.isApproved);
      setComments(list);
    } catch (err) {
      console.error("Failed to load comments:", err);
      try {
        const data = await adminQuery("admin.comments.list", { limit: 200, offset: 0 });
        setComments(Array.isArray(data) ? data : []);
      } catch { setComments([]); }
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminQuery("admin.comments.list", { limit: 200, offset: 0 });
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStrategies = useCallback(async () => {
    try {
      const data = await adminQuery("admin.strategies.list", {});
      setStrategies(Array.isArray(data) ? data : []);
    } catch {
      setStrategies([]);
    }
  }, []);

  useEffect(() => {
    if (tab === "reviews") loadReviews();
    else { loadNotes(); loadStrategies(); }
  }, [tab, loadReviews, loadNotes, loadStrategies]);

  const handleApprove = async (id: number) => {
    try {
      await adminMutation("anonymousComments.approve", { id });
      loadReviews();
    } catch {
      const msg = "审核失败";
      if (Platform.OS === "web") alert(msg); else Alert.alert("错误", msg);
    }
  };

  const handleDeleteReview = (id: number) => {
    const doDelete = async () => {
      try {
        await adminMutation("anonymousComments.delete", { id });
        loadReviews();
      } catch {
        const msg = "删除失败";
        if (Platform.OS === "web") alert(msg); else Alert.alert("错误", msg);
      }
    };
    if (Platform.OS === "web") {
      if (confirm("确定要删除这条评论吗?")) doDelete();
    } else {
      Alert.alert("确认删除", "确定要删除这条评论吗?", [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleDeleteNote = (id: number) => {
    const doDelete = async () => {
      try {
        await adminMutation("admin.comments.delete", { id });
        loadNotes();
      } catch {
        const msg = "删除失败";
        if (Platform.OS === "web") alert(msg); else Alert.alert("错误", msg);
      }
    };
    if (Platform.OS === "web") {
      if (confirm("确定要删除这条备注吗?")) doDelete();
    } else {
      Alert.alert("确认删除", "确定要删除这条备注吗?", [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleAddNote = async () => {
    if (!selectedStrategyId || !noteContent.trim()) return;
    setIsSubmitting(true);
    try {
      await adminMutation("admin.comments.create", {
        strategyId: selectedStrategyId,
        content: noteContent.trim(),
      });
      setNoteContent("");
      loadNotes();
      const msg = "备注添加成功";
      if (Platform.OS === "web") alert(msg); else Alert.alert("成功", msg);
    } catch (err: any) {
      const msg = "添加失败: " + (err?.message || "未知错误");
      if (Platform.OS === "web") alert(msg); else Alert.alert("错误", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (d: any) => {
    try {
      const date = d instanceof Date ? d : new Date(d);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    } catch { return String(d); }
  };

  const pendingCount = comments.filter((c) => !c.isApproved).length;
  const selectedStrategy = strategies.find((s: any) => s.id === selectedStrategyId);

  return (
    <AdminPageChrome
      eyebrow="COMMENT OPS"
      title={tab === "reviews" ? "评论审核" : "备注管理"}
      subtitle="审核公开评价，维护策略备注和后台运营记录"
      metrics={[
        { label: "评论队列", value: comments.length, tone: colors.primary },
        { label: "待审核", value: pendingCount, tone: colors.warning },
        { label: "备注记录", value: notes.length, tone: "#60A5FA" },
      ]}
      maxWidth={1240}
    >
        <View style={st.tabRow}>
          <TouchableOpacity
            onPress={() => setTab("reviews")}
            style={[
              st.tabBtn,
              { backgroundColor: tab === "reviews" ? colors.primary + "18" : colors.surface, borderColor: tab === "reviews" ? colors.primary : colors.border },
            ]}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: tab === "reviews" ? colors.primary : colors.muted }}>评论审核</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("notes")}
            style={[
              st.tabBtn,
              { backgroundColor: tab === "notes" ? colors.primary + "18" : colors.surface, borderColor: tab === "notes" ? colors.primary : colors.border },
            ]}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: tab === "notes" ? colors.primary : colors.muted }}>备注管理</Text>
          </TouchableOpacity>
        </View>

        {tab === "reviews" ? (
          <AdminSection title="审核队列" meta={pendingCount > 0 ? `${pendingCount} PENDING` : "CLEAR"}>
            <View style={st.filterRow}>
              {([{ label: "全部", value: "all" }, { label: "待审核", value: "pending" }, { label: "已通过", value: "approved" }] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setFilter(opt.value)}
                  style={[
                    st.filterChip,
                    { backgroundColor: filter === opt.value ? colors.primary : colors.surface, borderColor: filter === opt.value ? colors.primary : colors.border },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: filter === opt.value ? "#07111F" : colors.foreground }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {isLoading ? (
              <View style={st.center}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : comments.length === 0 ? (
              <View style={st.empty}><Text style={{ color: colors.muted, fontSize: 15 }}>暂无评论</Text></View>
            ) : (
              <View style={[st.queuePanel, { borderColor: colors.border }]}>
                {comments.map((item) => (
                  <View key={item.id} style={[st.card, { borderBottomColor: colors.border }]}>
                    <View style={st.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.nickname, { color: colors.foreground }]}>{item.nickname || "匿名用户"}</Text>
                        <Text style={[st.meta, { color: colors.muted }]}>{formatDate(item.createdAt)}</Text>
                      </View>
                      <View style={[st.statusBadge, { backgroundColor: item.isApproved ? colors.success + "20" : colors.warning + "20" }]}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: item.isApproved ? colors.success : colors.warning }}>
                          {item.isApproved ? "已通过" : "待审核"}
                        </Text>
                      </View>
                    </View>
                    <Text style={[st.content, { color: colors.foreground }]}>{item.content}</Text>
                    {item.rating && (
                      <Text style={[st.rating, { color: colors.warning }]}>评分 {item.rating}/5</Text>
                    )}
                    <View style={st.actions}>
                      {!item.isApproved && (
                        <TouchableOpacity onPress={() => handleApprove(item.id)} style={[st.actionBtn, { backgroundColor: colors.success + "15" }]} activeOpacity={0.7}>
                          <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>通过</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => handleDeleteReview(item.id)} style={[st.actionBtn, { backgroundColor: colors.error + "15" }]} activeOpacity={0.7}>
                        <Text style={{ color: colors.error, fontWeight: "600", fontSize: 13 }}>删除</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </AdminSection>
        ) : (
          <AdminSection title="策略备注" meta="INTERNAL NOTES">
            <View style={[st.addNoteSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[st.addNoteTitle, { color: colors.foreground }]}>添加备注</Text>

              {/* 策略选择 */}
              <TouchableOpacity
                onPress={() => setShowStrategyPicker(!showStrategyPicker)}
                style={[st.strategySelector, { backgroundColor: colors.background, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: selectedStrategy ? colors.foreground : colors.muted, fontSize: 14 }}>
                  {selectedStrategy ? `${selectedStrategy.title}` : "选择策略..."}
                </Text>
                <Text style={{ color: colors.muted }}>{showStrategyPicker ? "▲" : "▼"}</Text>
              </TouchableOpacity>

              {showStrategyPicker && (
                <View style={[st.pickerDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  {strategies.map((s: any) => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => { setSelectedStrategyId(s.id); setShowStrategyPicker(false); }}
                      style={[st.pickerItem, { borderBottomColor: colors.border }, selectedStrategyId === s.id && { backgroundColor: colors.primary + "15" }]}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 14 }}>{s.title}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{s.platform} · ID:{s.id}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TextInput
                value={noteContent}
                onChangeText={setNoteContent}
                placeholder="输入备注内容..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                style={[st.noteInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />

              <TouchableOpacity
                onPress={handleAddNote}
                disabled={!selectedStrategyId || !noteContent.trim() || isSubmitting}
                style={[st.addNoteBtn, { backgroundColor: (selectedStrategyId && noteContent.trim()) ? colors.primary : colors.border }]}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: (selectedStrategyId && noteContent.trim()) ? "#fff" : colors.muted, fontWeight: "600", fontSize: 14 }}>发布备注</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 备注列表 */}
            {isLoading ? (
              <View style={st.center}><ActivityIndicator size="large" color={colors.primary} /></View>
            ) : notes.length === 0 ? (
              <View style={st.empty}><Text style={{ color: colors.muted, fontSize: 15 }}>暂无备注</Text></View>
            ) : (
              <View style={[st.queuePanel, { borderColor: colors.border }]}>
                {notes.map((item) => (
                  <View key={item.id} style={[st.card, { borderBottomColor: colors.border }]}>
                    <View style={st.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.nickname, { color: colors.foreground }]}>{item.user?.name || "管理员"}</Text>
                        <Text style={[st.meta, { color: colors.muted }]}>{formatDate(item.createdAt)}</Text>
                      </View>
                      {item.strategy && (
                        <View style={[st.statusBadge, { backgroundColor: colors.primary + "15" }]}>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.primary }}>{item.strategy.title}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[st.content, { color: colors.foreground }]}>{item.content}</Text>
                    <View style={st.actions}>
                      <TouchableOpacity onPress={() => handleDeleteNote(item.id)} style={[st.actionBtn, { backgroundColor: colors.error + "15" }]} activeOpacity={0.7}>
                        <Text style={{ color: colors.error, fontWeight: "600", fontSize: 13 }}>删除</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </AdminSection>
        )}
    </AdminPageChrome>
  );
}

const st = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 6, borderWidth: 1 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, borderWidth: 1 },
  center: { minHeight: 220, alignItems: "center", justifyContent: "center" },
  queuePanel: { borderWidth: 1, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(15,23,42,0.56)" },
  card: { padding: 14, borderBottomWidth: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  nickname: { fontSize: 14, fontWeight: "600" },
  meta: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  content: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  rating: { fontSize: 14, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  empty: { padding: 32, alignItems: "center" },
  addNoteSection: { padding: 16, borderWidth: 1, borderRadius: 8, marginBottom: 14 },
  addNoteTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  strategySelector: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 10 },
  pickerDropdown: { borderRadius: 8, borderWidth: 1, marginBottom: 10, maxHeight: 200, overflow: "scroll" as any },
  pickerItem: { padding: 12, borderBottomWidth: 0.5 },
  noteInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: "top", marginBottom: 10 },
  addNoteBtn: { paddingVertical: 10, borderRadius: 8, alignItems: "center" },
});
