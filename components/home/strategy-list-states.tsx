import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { QuickNav } from "@/components/quick-nav";
import type { ThemeColorPalette } from "@/constants/theme";

type StrategyListEmptyProps = {
  colors: ThemeColorPalette;
  onUploadPress: () => void;
};

export function StrategyListEmpty({ colors, onUploadPress }: StrategyListEmptyProps) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={{ fontSize: 56 }}>📊</Text>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>暂无策略</Text>
      <Text style={[styles.emptyDescription, { color: colors.muted }]}>策略广场正在上架中，敬请期待</Text>
      <TouchableOpacity onPress={onUploadPress} activeOpacity={0.8} style={{ marginTop: 24 }}>
        <LinearGradient colors={["#A8895A", "#C9A96E"]} style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>上架我的EA</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

type StrategyListFooterProps = {
  colors: ThemeColorPalette;
  isLoadingMore: boolean;
  hasMore: boolean;
  itemCount: number;
};

export function StrategyListFooter({
  colors,
  isLoadingMore,
  hasMore,
  itemCount,
}: StrategyListFooterProps) {
  return (
    <View>
      {isLoadingMore && (
        <View style={styles.footerLoading}>
          <ActivityIndicator size="small" color="#A8895A" />
        </View>
      )}
      {!hasMore && itemCount > 0 && (
        <View style={styles.footerDone}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>已展示全部策略</Text>
        </View>
      )}
      <QuickNav />
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: 13,
    marginTop: 8,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: "#0A0E1A",
    fontWeight: "700",
    fontSize: 14,
  },
  footerLoading: {
    paddingVertical: 16,
    alignItems: "center",
  },
  footerDone: {
    paddingVertical: 12,
    alignItems: "center",
  },
});
