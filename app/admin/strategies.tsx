import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, Platform, Alert, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getAdminStrategies, deleteAdminStrategy } from "@/lib/admin-api";
import { useState, useEffect, useCallback } from "react";

export default function AdminStrategies() {
  const router = useRouter();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;
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
  const publishedCount = strategies.filter((item) => item.status === "published").length;
  const draftCount = strategies.filter((item) => item.status === "draft").length;
  const archivedCount = strategies.filter((item) => item.status === "archived").length;

  return (
    <ScreenContainer>
      <View style={s.pageShell}>
        <View style={[s.filterBar, { borderColor: colors.border }]}>
          <View style={s.filterHeader}>
            <View>
              <Text style={s.kicker}>STRATEGY INVENTORY</Text>
              <Text style={[s.title, { color: colors.foreground }]}>策略列表</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/admin/strategy-form?mode=create" as any)}
              style={[s.addBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={s.addBtnText}>+ 添加策略</Text>
            </TouchableOpacity>
          </View>
          <View style={s.statsRow}>
            {[
              ["TOTAL", strategies.length],
              ["PUBLISHED", publishedCount],
              ["DRAFT", draftCount],
              ["ARCHIVED", archivedCount],
            ].map(([label, value]) => (
              <View key={label} style={[s.statCell, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={s.statLabel}>{label}</Text>
                <Text style={[s.statValue, { color: colors.foreground }]}>{value}</Text>
              </View>
            ))}
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
              <View style={[s.card, isDesktop && s.cardDesktop, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={[s.cardHeader, isDesktop && s.cardHeaderDesktop]}>
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
                <View style={[s.actions, isDesktop && s.actionsDesktop]}>
                  <TouchableOpacity
                    onPress={() => router.push(`/admin/strategy-form?mode=edit&id=${item.id}` as any)}
                    style={[s.actionBtn, isDesktop && s.actionBtnDesktop, { backgroundColor: colors.primary + "12" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>编辑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push(`/admin/backtest-data?strategyId=${item.id}&title=${encodeURIComponent(item.title)}` as any)}
                    style={[s.actionBtn, isDesktop && s.actionBtnDesktop, { backgroundColor: colors.success + "12" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.success, fontWeight: "600", fontSize: 13 }}>回测数据</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id, item.title)}
                    style={[s.actionBtn, isDesktop && s.actionBtnDesktop, { backgroundColor: colors.error + "12" }]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.error, fontWeight: "600", fontSize: 13 }}>删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<View style={s.empty}><Text style={{ color: colors.muted, fontSize: 15 }}>暂无策略</Text></View>}
            contentContainerStyle={s.listContent}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  pageShell: { flex: 1, width: "100%", maxWidth: 1360, alignSelf: "center", paddingHorizontal: 22, paddingTop: 18 },
  filterBar: { padding: 13, borderWidth: 1, borderRadius: 6, marginBottom: 10, backgroundColor: "rgba(9,15,28,0.82)" },
  filterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  kicker: { color: "#D8BC83", fontSize: 11, fontWeight: "900", marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "900" },
  addBtn: { borderRadius: 6, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCell: { flex: 1, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10 },
  statLabel: { color: "rgba(148,163,184,0.72)", fontSize: 10, fontWeight: "900", marginBottom: 4 },
  statValue: { fontSize: 19, fontWeight: "900" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingBottom: 32, gap: 10 },
  card: { padding: 12, borderWidth: 1, borderRadius: 6 },
  cardDesktop: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  cardHeaderDesktop: { flex: 1, marginBottom: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  platformBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  desc: { fontSize: 13, marginBottom: 4 },
  meta: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  actions: { flexDirection: "row", gap: 8 },
  actionsDesktop: { flexShrink: 0, alignItems: "center" },
  actionBtn: { minWidth: 110, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, alignItems: "center" },
  actionBtnDesktop: { minWidth: 0, paddingHorizontal: 12, paddingVertical: 7 },
  empty: { padding: 32, alignItems: "center" },
});
