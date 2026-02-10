import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { adminQuery, adminMutation } from "@/lib/admin-api";
import { useState, useEffect, useCallback } from "react";

export default function AdminComments() {
  const colors = useColors();
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load anonymous comments (the main comment system now)
      const data = await adminQuery("anonymousComments.listAll", { limit: 200, offset: 0 });
      let list = Array.isArray(data) ? data : [];
      if (filter === "pending") list = list.filter((c: any) => !c.isApproved);
      else if (filter === "approved") list = list.filter((c: any) => c.isApproved);
      setComments(list);
    } catch (err) {
      console.error("Failed to load comments:", err);
      // Fallback: try admin.comments.list
      try {
        const data = await adminQuery("admin.comments.list", { limit: 200, offset: 0 });
        setComments(Array.isArray(data) ? data : []);
      } catch { setComments([]); }
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (id: number) => {
    try {
      await adminMutation("anonymousComments.approve", { id });
      loadData();
    } catch {
      const msg = "审核失败";
      if (Platform.OS === "web") alert(msg); else Alert.alert("错误", msg);
    }
  };

  const handleDelete = (id: number) => {
    const doDelete = async () => {
      try {
        await adminMutation("anonymousComments.delete", { id });
        loadData();
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

  const formatDate = (d: any) => {
    try {
      const date = d instanceof Date ? d : new Date(d);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    } catch { return String(d); }
  };

  const pendingCount = comments.filter((c) => !c.isApproved).length;

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <View style={[st.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[st.title, { color: colors.foreground }]}>💬 评论审核</Text>
            <Text style={[st.subtitle, { color: colors.muted }]}>
              {pendingCount > 0 ? `${pendingCount} 条待审核` : "暂无待审核评论"}
            </Text>
          </View>
        </View>

        <View style={[st.filterRow, { borderBottomColor: colors.border }]}>
          {([{ label: "全部", value: "all" }, { label: "待审核", value: "pending" }, { label: "已通过", value: "approved" }] as const).map((opt) => (
            <TouchableOpacity key={opt.value} onPress={() => setFilter(opt.value)} style={[st.filterChip, { backgroundColor: filter === opt.value ? colors.primary : colors.surface }]} activeOpacity={0.7}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: filter === opt.value ? "#fff" : colors.foreground }}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={st.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={[st.card, { backgroundColor: colors.surface, borderLeftColor: item.isApproved ? colors.success : colors.warning, borderLeftWidth: 3 }]}>
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
                  <Text style={[st.rating, { color: colors.warning }]}>{"⭐".repeat(item.rating)}</Text>
                )}
                <View style={st.actions}>
                  {!item.isApproved && (
                    <TouchableOpacity onPress={() => handleApprove(item.id)} style={[st.actionBtn, { backgroundColor: colors.success + "15" }]} activeOpacity={0.7}>
                      <Text style={{ color: colors.success, fontWeight: "600", fontSize: 13 }}>✓ 通过</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={[st.actionBtn, { backgroundColor: colors.error + "15" }]} activeOpacity={0.7}>
                    <Text style={{ color: colors.error, fontWeight: "600", fontSize: 13 }}>删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<View style={st.empty}><Text style={{ color: colors.muted, fontSize: 15 }}>暂无评论</Text></View>}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const st = StyleSheet.create({
  header: { padding: 16, borderBottomWidth: 0.5 },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 4 },
  filterRow: { flexDirection: "row", gap: 8, padding: 12, borderBottomWidth: 0.5 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  nickname: { fontSize: 14, fontWeight: "600" },
  meta: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  content: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  rating: { fontSize: 14, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  empty: { padding: 32, alignItems: "center" },
});
