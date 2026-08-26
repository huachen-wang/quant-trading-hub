import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { QuickNav } from "@/components/quick-nav";
import type { ThemeColorPalette } from "@/constants/theme";
import { useResponsive } from "@/hooks/use-responsive";
import { useLanguage } from "@/lib/language";

type StrategyListEmptyProps = {
  colors: ThemeColorPalette;
  onUploadPress: () => void;
};

export function StrategyListEmpty({
  colors,
  onUploadPress,
}: StrategyListEmptyProps) {
  const { isDesktop } = useResponsive();
  const { text } = useLanguage();

  if (isDesktop) {
    return (
      <View style={styles.emptyDesk}>
        <View style={styles.emptyDeskMain}>
          <View style={styles.emptyDeskIcon}>
            <Text style={styles.emptyDeskIconText}>EA</Text>
          </View>
          <View style={styles.emptyDeskCopy}>
            <Text style={[styles.emptyDeskTitle, { color: colors.foreground }]}>
              {text(
                "策略库正在整理入场",
                "The catalog is being curated",
                "يجري إعداد المكتبة",
              )}
            </Text>
            <Text
              style={[styles.emptyDeskDescription, { color: colors.muted }]}
            >
              {text(
                "当前筛选条件下暂无公开策略，可提交 EA 或切换筛选条件查看其他源头资源。",
                "No public strategies match these filters. Submit an EA or change the filters to explore other resources.",
                "لا توجد استراتيجيات عامة تطابق هذه التصفية. أرسل EA أو غيّر عوامل التصفية لاستكشاف موارد أخرى.",
              )}
            </Text>
          </View>
          <TouchableOpacity onPress={onUploadPress} activeOpacity={0.8}>
            <LinearGradient
              colors={["#A8895A", "#C9A96E"]}
              style={styles.emptyDeskButton}
            >
              <Text style={styles.emptyButtonText}>
                {text("上架我的EA", "List my EA", "إدراج EA الخاص بي")}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyDeskSide}>
          {[
            [
              text("源码入库审核", "Source review", "مراجعة المصدر"),
              text("进行中", "In progress", "قيد التنفيذ"),
            ],
            [
              text("实盘报告整理", "Live report", "تقرير مباشر"),
              text("待发布", "Pending", "قيد النشر"),
            ],
            [text("授权条款确认", "License terms", "شروط الترخيص"), "1:1"],
          ].map(([label, value]) => (
            <View key={label} style={styles.pipelineRow}>
              <Text style={styles.pipelineLabel}>{label}</Text>
              <Text style={styles.pipelineValue}>{value}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyMobileIcon}>
        <Text style={styles.emptyMobileIconText}>EA</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {text("暂无策略", "No strategies", "لا توجد استراتيجيات")}
      </Text>
      <Text style={[styles.emptyDescription, { color: colors.muted }]}>
        {text(
          "策略广场正在上架中，敬请期待",
          "The marketplace is being updated.",
          "يجري تحديث السوق.",
        )}
      </Text>
      <TouchableOpacity
        onPress={onUploadPress}
        activeOpacity={0.8}
        style={{ marginTop: 24 }}
      >
        <LinearGradient
          colors={["#A8895A", "#C9A96E"]}
          style={styles.emptyButton}
        >
          <Text style={styles.emptyButtonText}>
            {text("上架我的EA", "List my EA", "إدراج EA الخاص بي")}
          </Text>
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
  const { text } = useLanguage();
  return (
    <View>
      {isLoadingMore && (
        <View style={styles.footerLoading}>
          <ActivityIndicator size="small" color="#A8895A" />
        </View>
      )}
      {!hasMore && itemCount > 0 && (
        <View style={styles.footerDone}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {text(
              "已展示全部策略",
              "All strategies shown",
              "تم عرض كل الاستراتيجيات",
            )}
          </Text>
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
  emptyDesk: {
    marginTop: 4,
    marginBottom: 18,
    minHeight: 188,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    backgroundColor: "rgba(15,23,42,0.62)",
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
  },
  emptyDeskMain: {
    flex: 1,
    minWidth: 0,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  emptyDeskIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(96,165,250,0.10)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.18)",
  },
  emptyDeskIconText: {
    color: "#D8BC83",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0,
  },
  emptyDeskCopy: {
    flex: 1,
    minWidth: 0,
  },
  emptyDeskTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    marginBottom: 8,
  },
  emptyDeskDescription: {
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 520,
  },
  emptyDeskButton: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 6,
  },
  emptyDeskSide: {
    width: 260,
    padding: 16,
    justifyContent: "center",
    backgroundColor: "rgba(2,6,23,0.35)",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(148,163,184,0.12)",
  },
  pipelineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.10)",
  },
  pipelineLabel: {
    color: "rgba(226,232,240,0.72)",
    fontSize: 12,
    fontWeight: "600",
  },
  pipelineValue: {
    color: "#D8BC83",
    fontSize: 12,
    fontWeight: "900",
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
    borderRadius: 7,
  },
  emptyMobileIcon: {
    width: 58,
    height: 58,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(96,165,250,0.10)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.18)",
  },
  emptyMobileIconText: {
    color: "#D8BC83",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0,
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
