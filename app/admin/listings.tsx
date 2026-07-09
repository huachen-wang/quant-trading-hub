import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { AdminPageChrome, AdminSection } from "@/components/admin/page-chrome";
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
    <View style={[styles.card, { borderBottomColor: colors.border }]}>
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
    <AdminPageChrome
      eyebrow="LISTING INBOX"
      title="上架申请"
      subtitle="审核外部 EA 源、沟通联系方式和上架进度"
      metrics={[
        { label: "当前列表", value: listings.length, tone: colors.primary },
        { label: "待处理", value: listings.filter((item) => item.status === "pending").length, tone: colors.warning },
        { label: "已联系", value: listings.filter((item) => item.status === "contacted").length, tone: colors.success },
      ]}
      maxWidth={1280}
    >
      <AdminSection title="申请记录" meta="REVIEW QUEUE">
        <View style={styles.filterRow}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.label}
              onPress={() => setStatusFilter(f.value)}
              style={[
                styles.filterBtn,
                { borderColor: statusFilter === f.value ? colors.primary : colors.border, backgroundColor: statusFilter === f.value ? colors.primary + "20" : colors.surface },
              ]}
            >
              <Text style={{ color: statusFilter === f.value ? colors.primary : colors.muted, fontSize: 13, fontWeight: "700" }}>
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
          <View style={[styles.tablePanel, { borderColor: colors.border }]}>
            {listings.map((item) => renderItem({ item }))}
          </View>
        )}
      </AdminSection>
    </AdminPageChrome>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "transparent" },
  center: { minHeight: 220, justifyContent: "center", alignItems: "center" },
  tablePanel: { borderWidth: 1, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(15,23,42,0.56)" },
  card: { padding: 16, borderBottomWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  cardSub: { fontSize: 13, marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
});
