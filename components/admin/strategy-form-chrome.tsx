import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { ThemeColorPalette } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";

export const STRATEGY_FORM_SECTIONS = [
  { id: "basic", label: "基本信息" },
  { id: "display", label: "展示设置" },
  { id: "data", label: "策略数据" },
  { id: "delivery", label: "交付与定价" },
  { id: "publish", label: "联系与发布" },
] as const;

export type StrategyFormSectionId =
  (typeof STRATEGY_FORM_SECTIONS)[number]["id"];

type HeaderProps = {
  colors: ThemeColorPalette;
  isDesktop: boolean;
  isEdit: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

export function StrategyFormHeader({
  colors,
  isDesktop,
  isEdit,
  isSubmitting,
  onBack,
  onSubmit,
}: HeaderProps) {
  return (
    <View style={[styles.headerPanel, isDesktop && styles.headerPanelDesktop]}>
      <View style={styles.headerCopy}>
        <Text style={styles.kicker}>STRATEGY RECORD EDITOR</Text>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>
          {isEdit ? "编辑策略" : "添加新策略"}
        </Text>
        <Text style={[styles.headerMeta, { color: colors.muted }]}>
          统一维护策略展示、价格、实盘指标、交付入口和前台运营数据。
        </Text>
      </View>
      <View
        style={[styles.headerActions, isDesktop && styles.headerActionsDesktop]}
      >
        <TouchableOpacity
          onPress={onBack}
          style={[styles.headerButton, { borderColor: colors.border }]}
          activeOpacity={0.75}
        >
          <IconSymbol name="chevron.left" size={17} color={colors.foreground} />
          <Text style={[styles.headerButtonText, { color: colors.foreground }]}>
            返回列表
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSubmit}
          disabled={isSubmitting}
          style={[
            styles.headerButton,
            styles.headerSaveButton,
            {
              backgroundColor: colors.primary,
              opacity: isSubmitting ? 0.65 : 1,
            },
          ]}
          activeOpacity={0.78}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.headerSaveText}>
              {isEdit ? "保存修改" : "创建策略"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function StrategyFormSectionNav({
  colors,
  onSelect,
}: {
  colors: ThemeColorPalette;
  onSelect: (sectionId: StrategyFormSectionId) => void;
}) {
  return (
    <View
      style={[
        styles.sectionNavShell,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sectionNavContent}
      >
        {STRATEGY_FORM_SECTIONS.map((section, index) => (
          <TouchableOpacity
            key={section.id}
            onPress={() => onSelect(section.id)}
            style={[
              styles.sectionNavButton,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            activeOpacity={0.75}
          >
            <Text style={styles.sectionNavIndex}>
              {String(index + 1).padStart(2, "0")}
            </Text>
            <Text
              style={[styles.sectionNavLabel, { color: colors.foreground }]}
            >
              {section.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerPanel: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    borderRadius: 8,
    padding: 18,
    marginBottom: 14,
    backgroundColor: "rgba(15,23,42,0.68)",
  },
  headerPanelDesktop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  headerActionsDesktop: {
    marginTop: 0,
  },
  headerButton: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  headerSaveButton: {
    minWidth: 104,
    borderWidth: 0,
  },
  headerButtonText: { fontSize: 13, fontWeight: "700" },
  headerSaveText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  kicker: {
    color: "#D8BC83",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 6,
  },
  pageTitle: { fontSize: 24, fontWeight: "900", marginBottom: 6 },
  headerMeta: { fontSize: 13, lineHeight: 20 },
  sectionNavShell: {
    borderBottomWidth: 1,
    paddingVertical: 8,
    marginBottom: 10,
    zIndex: 10,
  },
  sectionNavContent: {
    gap: 7,
    paddingHorizontal: 1,
  },
  sectionNavButton: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionNavIndex: { color: "#D8BC83", fontSize: 9, fontWeight: "900" },
  sectionNavLabel: { fontSize: 12, fontWeight: "700" },
});
