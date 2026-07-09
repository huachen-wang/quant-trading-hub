/**
 * GlassCard - 暗色卡片组件
 *
 * 使用克制的深色层级和清晰边框，不使用 backdrop-filter blur。
 *
 * 三种强度等级：
 * - "subtle"  : 适合列表项、小卡片
 * - "medium"  : 标准，适合内容卡片、表单区域
 * - "strong"  : 最强，适合重点CTA区域
 */
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { useColors } from "@/hooks/use-colors";

type GlassIntensity = "subtle" | "medium" | "strong";

interface GlassCardProps {
  children: React.ReactNode;
  intensity?: GlassIntensity;
  style?: StyleProp<ViewStyle>;
  /** 自定义强调色边框（如 colors.primary），不传则使用默认边框 */
  accentColor?: string;
  /** 是否显示顶部高光线 */
  highlight?: boolean;
}

// 保持终端式深色层级，避免大面积灰蓝卡片抢走正文注意力。
const CARD_STYLES: Record<GlassIntensity, ViewStyle> = {
  subtle: {
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.20)",
  },
  medium: {
    backgroundColor: "rgba(18, 29, 48, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.26)",
  },
  strong: {
    backgroundColor: "rgba(21, 36, 59, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.32)",
  },
};

export function GlassCard({
  children,
  intensity = "medium",
  style,
  accentColor,
  highlight = false,
}: GlassCardProps) {
  const colors = useColors();

  const cardStyle = CARD_STYLES[intensity];

  const accentBorder = accentColor
    ? { borderColor: accentColor + "70", borderWidth: 1.5 }
    : {};

  return (
    <View
      style={[
        styles.base,
        cardStyle,
        accentBorder,
        style,
      ]}
    >
      {highlight && (
        <View
          style={[
            styles.highlightLine,
            { backgroundColor: (accentColor || colors.primary) + "60" },
          ]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    overflow: "hidden",
  },
  highlightLine: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 1,
  },
});
