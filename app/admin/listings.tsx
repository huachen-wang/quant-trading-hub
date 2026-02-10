import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getListingRequests, updateListingRequestStatus, deleteListingRequest } from "@/lib/admin-api";
import { useState, useEffect, useCallback } from "react";

export default function AdminListings() {
  const colors = useColors();
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getListingRequests({ status: statusFilter, limit: 100, offset: 0 });
      setListings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load listings:", err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await updateListingRequestStatus(id, newStatus);
      loadData();
    } catch (err) {
      Alert.alert("错误", "更新状态失败");
    }
  };

  const handleDelete = (id: number, name: string) => {
    const doDelete = async () => {
      try {
        await deleteListingRequest(id);
        loadData();
      } catch (err) {
        Alert.alert("错误", "删除失败");
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`确定删除「${name}」的申请?`)) doDelete();
    } else {
      Alert.alert("确认删除", `确定删除「${name}」的申请?`, [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const statusColors: Record<string, string> = {
    pending: colors.warning,
    contacted: colors.success,
    rejected: colors.error,
  };

  const statusLabels: Record<string, string> = {
    pending: "待处理",
    contacted: "已联系",
    rejected: "已拒绝",
  };

  const filters = [
    { label: "全部", value: undefined },
    { label: "待处理", value: "pending" },
    { label: "已联系", value: "contacted" },
    { label: "已拒绝", value: "rejected" },
  ];

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.eaName}</Text>
        <View style={[styles.badge, { backgroundColor: (statusColors[item.status] || colors.muted) + "20" }]}>
          <Text style={[styles.badgeText, { color: statusColors[item.status] || colors.muted }]}>
            {statusLabels[item.status] || item.status}
          </Text>
        </View>
      </View>
      <Text style={[styles.cardSub, { color: colors.muted }]}>申请人: {item.name}</Text>
      <Text style={[styles.cardSub, { color: colors.muted }]}>联系方式: {item.contact}</Text>
      {item.eaDescription && (
        <Text style={[styles.cardSub, { color: colors.muted }]} numberOfLines={2}>描述: {item.eaDescription}</Text>
      )}
      {item.notes && (
        <Text style={[styles.cardSub, { color: colors.primary }]}>备注: {item.notes}</Text>
      )}
      <Text style={[styles.cardSub, { color: colors.muted, fontSize: 11 }]}>
        提交时间: {new Date(item.createdAt).toLocaleString("zh-CN")}
      </Text>

      <View style={styles.cardActions}>
        {item.status !== "contacted" && (
          <TouchableOpacity
            onPress={() => handleStatusChange(item.id, "contacted")}
            style={[styles.actionBtn, { backgroundColor: colors.success + "20" }]}
          >
            <Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>标记已联系</Text>
          </TouchableOpacity>
        )}
        {item.status !== "rejected" && (
          <TouchableOpacity
            onPress={() => handleStatusChange(item.id, "rejected")}
            style={[styles.actionBtn, { backgroundColor: colors.warning + "20" }]}
          >
            <Text style={{ color: colors.warning, fontSize: 13, fontWeight: "600" }}>拒绝</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => handleDelete(item.id, item.name)}
          style={[styles.actionBtn, { backgroundColor: colors.error + "20" }]}
        >
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>📦 上架申请 ({listings.length})</Text>
      </View>

      {/* 筛选 */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.label}
            onPress={() => setStatusFilter(f.value)}
            style={[
              styles.filterBtn,
              statusFilter === f.value && { backgroundColor: colors.primary + "20", borderColor: colors.primary },
            ]}
          >
            <Text style={{ color: statusFilter === f.value ? colors.primary : colors.muted, fontSize: 13 }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : listings.length === 0 ? (
        <View style={styles.center}><Text style={{ color: colors.muted, fontSize: 16 }}>暂无上架申请</Text></View>
      ) : (
        <FlatList
          data={listings}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, borderBottomWidth: 0.5 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 0 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "transparent" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 0.5 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  cardSub: { fontSize: 13, marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
});
