import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getSubscribers, adminQuery } from "@/lib/admin-api";

type Subscriber = { id: number; email: string; isActive: boolean; createdAt: Date | string; };

export default function SubscribersAdmin() {
  const colors = useColors();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [subs, cnt] = await Promise.all([getSubscribers({ limit: 100 }), adminQuery("subscriptions.count")]);
      // cnt might be a number or {count: number}
      setSubscribers(Array.isArray(subs) ? subs : []);
      setCount(typeof cnt === "number" ? cnt : null);
    } catch (err) { console.error(err); setSubscribers([]); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const formatDate = (dateStr: string | Date) => {
    try {
      const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch { return String(dateStr); }
  };

  const renderItem = ({ item, index }: { item: Subscriber; index: number }) => (
    <View style={[st.row, { backgroundColor: index % 2 === 0 ? colors.surface : colors.background, borderColor: colors.border }]}>
      <Text style={[st.indexCell, { color: colors.muted }]}>{index + 1}</Text>
      <Text style={[st.emailCell, { color: colors.foreground }]}>{item.email}</Text>
      <View style={[st.statusBadge, { backgroundColor: item.isActive ? colors.success + "20" : colors.error + "20" }]}>
        <Text style={{ color: item.isActive ? colors.success : colors.error, fontSize: 12, fontWeight: "600" }}>{item.isActive ? "活跃" : "已取消"}</Text>
      </View>
      <Text style={[st.dateCell, { color: colors.muted }]}>{formatDate(item.createdAt)}</Text>
    </View>
  );

  return (
    <ScreenContainer>
      <FlatList
        data={subscribers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={st.listContainer}
        ListHeaderComponent={
          <View style={st.header}>
            <Text style={[st.pageTitle, { color: colors.foreground }]}>📧 订阅用户列表</Text>
            <View style={[st.countBadge, { backgroundColor: colors.primary + "15" }]}>
              <Text style={[st.countText, { color: colors.primary }]}>活跃订阅: {count ?? "..."}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} /> :
          <Text style={[st.emptyText, { color: colors.muted }]}>暂无订阅用户</Text>
        }
      />
    </ScreenContainer>
  );
}

const st = StyleSheet.create({
  listContainer: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  pageTitle: { fontSize: 20, fontWeight: "800" },
  countBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  countText: { fontSize: 13, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 0.5, gap: 8 },
  indexCell: { width: 30, fontSize: 13, textAlign: "center" },
  emailCell: { flex: 1, fontSize: 14 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  dateCell: { width: 120, fontSize: 12, textAlign: "right" },
  emptyText: { textAlign: "center", marginTop: 40, fontSize: 14 },
});
