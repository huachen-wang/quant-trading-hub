import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getAdminStrategies, deleteAdminStrategy } from "@/lib/admin-api";
import { useState, useEffect, useCallback } from "react";

export default function AdminStrategies() {
  const router = useRouter();
  const colors = useColors();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAdminStrategies({ status: statusFilter, limit: 100, offset: 0 });
      setStrategies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load strategies:", err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // 页面重新聚焦时自动刷新（从编辑页返回时）
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = (id: number, title: string) => {
    const doDelete = async () => {
      try {
        await deleteAdminStrategy(id);
        loadData();
      } catch { 
        if (Platform.OS === "web") alert("删除失败"); else Alert.alert("错误", "删除失败");
      }
    };
    if (Platform.OS === "web") {
      if (confirm(`确定要删除策略"${title}"吗?`)) doDelete();
    } else {
      Alert.alert("确认删除", `确定要删除策略"${title}"吗?`, [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const statusOptions = [
    { label: "全部", value: undefined },
    { label: "草稿", value: "draft" },
    { label: "已发布", value: "published" },
    { label: "已归档", value: "archived" },
  ];

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <View style={[s.filterBar, { borderBottomColor: colors.border }]}>
          <View style={s.filterHeader}>
            <Text style={[s.title, { color: colors.foreground }]}>策略列表</Text>
            <TouchableOpacity
              onPress={() => router.push("/admin/strategy-form?mode=create" as any)}
              style={[s.addBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={s.addBtnText}>+ 添加策略</Text>
            </TouchableOpacity>
          </View>
          <View style={s.filterRow}>
            {statusOptions.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                onPress={() => setStatusFilter(opt.value)}
                style={[s.filterChip, { backgroundColor: statusFilter === opt.value ? colors.primary : colors.surface }]}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: statusFilter === opt.value ? "#fff" : colors.foreground }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <FlatList
            data={strategies}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={[s.card, { borderBottomColor: colors.border }]}>
                <View style={s.cardHeader}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <View style={s.titleRow}>
                      <Text style={[s.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
                      <View style={[s.platformBadge, { backgroundColor: colors.primary + "20" }]}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>{item.platform}</Text>
                      </View>
                    </View>
                    <Text style={[s.desc, { color: colors.muted }]} numberOfLines={2}>{item.description || "无描述"}</Text>
                    <Text style={[s.meta, { color: colors.muted }]}>
                      收益: {item.totalReturn}% | 胜率: {item.winRate}% | 下载: {item.downloadCount}(+{item.virtualDownloads || 0}) | 订阅: +{item.virtualSubscribers || 0}
                    </Text>
                  </View>
                  <View style={[s.statusBadge, {
                    backgroundColor: item.status === "published" ? colors.success + "20" : item.status === "draft" ? colors.warning + "20" : colors.muted + "20"
                  }]}>
                    <Text style={{
                      fontSize: 11, fontWeight: "600",
                      color: item.status === "published" ? colors.success : item.status === "draft" ? colors.warning : colors.muted
                    }}>
                      {item.status === "published" ? "已发布" : item.status === "draft" ? "草稿" : "已归档"}
                    </Text>
                  </View>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity
                    onPress={() => router.push(`/admin/strategy-form?mode=edit&id=${item.id}` as any)}
                    style={[s.actionBtn, { backgroundColor: colors.primary + "12" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>编辑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push(`/admin/backtest-data?strategyId=${item.id}` as any)}
                    style={[s.actionBtn, { backgroundColor: colors.warning + "12" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.warning || "#f59e0b", fontWeight: "600", fontSize: 13 }}>回测数据</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id, item.title)}
                    style={[s.actionBtn, { backgroundColor: colors.error + "12" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.error, fontWeight: "600", fontSize: 13 }}>删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<View style={s.empty}><Text style={{ color: colors.muted, fontSize: 15 }}>暂无策略</Text></View>}
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  filterBar: { padding: 16, borderBottomWidth: 0.5 },
  filterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700" },
  addBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { padding: 16, borderBottomWidth: 0.5 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  platformBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  desc: { fontSize: 13, marginBottom: 4 },
  meta: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  empty: { padding: 32, alignItems: "center" },
});
