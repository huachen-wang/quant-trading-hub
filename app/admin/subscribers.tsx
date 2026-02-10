import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type Subscriber = {
  id: number;
  email: string;
  isActive: boolean;
  createdAt: Date | string;
};

export default function SubscribersAdmin() {
  const colors = useColors();
  const subscribersQuery = trpc.subscriptions.list.useQuery({ limit: 100 });
  const countQuery = trpc.subscriptions.count.useQuery();

  const subscribers = (subscribersQuery.data || []) as Subscriber[];

  const formatDate = (dateStr: string | Date) => {
    try {
      const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return String(dateStr);
    }
  };

  const renderItem = ({ item, index }: { item: Subscriber; index: number }) => (
    <View style={[styles.row, { backgroundColor: index % 2 === 0 ? colors.surface : colors.background, borderColor: colors.border }]}>
      <Text style={[styles.indexCell, { color: colors.muted }]}>{index + 1}</Text>
      <Text style={[styles.emailCell, { color: colors.foreground }]}>{item.email}</Text>
      <View style={[styles.statusBadge, { backgroundColor: item.isActive ? colors.success + "20" : colors.error + "20" }]}>
        <Text style={{ color: item.isActive ? colors.success : colors.error, fontSize: 12, fontWeight: "600" }}>
          {item.isActive ? "活跃" : "已取消"}
        </Text>
      </View>
      <Text style={[styles.dateCell, { color: colors.muted }]}>{formatDate(item.createdAt)}</Text>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      <FlatList
        data={subscribers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>📧 订阅用户列表</Text>
            <View style={[styles.countBadge, { backgroundColor: colors.primary + "15" }]}>
              <Text style={[styles.countText, { color: colors.primary }]}>
                活跃订阅: {countQuery.data ?? "..."}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          subscribersQuery.isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <Text style={[styles.emptyText, { color: colors.muted }]}>暂无订阅用户</Text>
          )
        }
      />
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
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countText: {
    fontSize: 13,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  indexCell: {
    width: 30,
    fontSize: 13,
    textAlign: "center",
  },
  emailCell: {
    flex: 1,
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dateCell: {
    width: 120,
    fontSize: 12,
    textAlign: "right",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
});
