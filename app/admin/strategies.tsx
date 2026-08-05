import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import {
  StrategyInventoryEmpty,
  StrategyInventoryRow,
  StrategyInventoryTableHeader,
} from "@/components/admin/strategy-inventory-row";
import { strategyInventoryStyles as styles } from "@/components/admin/strategy-inventory-styles";
import { StrategyInventoryToolbar } from "@/components/admin/strategy-inventory-toolbar";
import type {
  AdminStrategy,
  StrategyStatus,
} from "@/components/admin/strategy-inventory-types";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { deleteAdminStrategy, getAdminStrategies } from "@/lib/admin-api";
import { filterAdminStrategies } from "@/lib/admin-strategy-search";

export default function AdminStrategies() {
  const router = useRouter();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;
  const [statusFilter, setStatusFilter] = useState<StrategyStatus>();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [strategies, setStrategies] = useState<AdminStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAdminStrategies({ limit: 500, offset: 0 });
      setStrategies(Array.isArray(data) ? (data as AdminStrategy[]) : []);
    } catch (error) {
      console.error("Failed to load strategies:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const openEditor = useCallback(
    (id: number) =>
      router.push(`/admin/strategy-form?mode=edit&id=${id}` as any),
    [router],
  );

  const openBacktest = useCallback(
    (item: AdminStrategy) => {
      router.push(
        `/admin/backtest-data?strategyId=${item.id}&title=${encodeURIComponent(item.title)}` as any,
      );
    },
    [router],
  );

  const handleDelete = useCallback(
    (id: number, title: string) => {
      const doDelete = async () => {
        try {
          await deleteAdminStrategy(id);
          await loadData();
        } catch {
          if (Platform.OS === "web") alert("删除失败");
          else Alert.alert("错误", "删除失败");
        }
      };

      if (Platform.OS === "web") {
        if (confirm(`确定要删除策略“${title}”吗？`)) void doDelete();
      } else {
        Alert.alert("确认删除", `确定要删除策略“${title}”吗？`, [
          { text: "取消", style: "cancel" },
          { text: "删除", style: "destructive", onPress: doDelete },
        ]);
      }
    },
    [loadData],
  );

  const counts = useMemo(
    () => ({
      total: strategies.length,
      published: strategies.filter((item) => item.status === "published")
        .length,
      draft: strategies.filter((item) => item.status === "draft").length,
      archived: strategies.filter((item) => item.status === "archived").length,
    }),
    [strategies],
  );

  const visibleStrategies = useMemo(() => {
    const statusMatched = statusFilter
      ? strategies.filter((item) => item.status === statusFilter)
      : strategies;
    return filterAdminStrategies(statusMatched, deferredSearchQuery);
  }, [deferredSearchQuery, statusFilter, strategies]);

  const renderStrategy = useCallback(
    ({ item }: { item: AdminStrategy }) => (
      <StrategyInventoryRow
        colors={colors}
        isDesktop={isDesktop}
        item={item}
        onBacktest={openBacktest}
        onDelete={handleDelete}
        onEdit={openEditor}
      />
    ),
    [colors, handleDelete, isDesktop, openBacktest, openEditor],
  );

  return (
    <ScreenContainer>
      <View style={[styles.pageShell, isDesktop && styles.pageShellDesktop]}>
        <StrategyInventoryToolbar
          colors={colors}
          counts={counts}
          deferredSearchQuery={deferredSearchQuery}
          isDesktop={isDesktop}
          onAdd={() => router.push("/admin/strategy-form?mode=create" as any)}
          onChangeSearch={setSearchQuery}
          onChangeStatus={setStatusFilter}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          visibleCount={visibleStrategies.length}
        />

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View
            style={[
              styles.listPanel,
              isDesktop && {
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <FlatList
              data={visibleStrategies}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderStrategy}
              ListHeaderComponent={
                isDesktop ? (
                  <StrategyInventoryTableHeader colors={colors} />
                ) : null
              }
              stickyHeaderIndices={isDesktop ? [0] : undefined}
              ListEmptyComponent={<StrategyInventoryEmpty colors={colors} />}
              contentContainerStyle={[
                styles.listContent,
                !isDesktop && styles.listContentMobile,
              ]}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={24}
              maxToRenderPerBatch={24}
              windowSize={9}
              removeClippedSubviews
            />
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
