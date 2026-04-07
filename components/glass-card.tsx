/**
 * GlassCard - 暗色卡片组件
 *
 * 使用纯色半透明暗色背景 + 微妙边框，不使用 backdrop-filter blur。
 * 避免在深色实心背景上叠加 blur 导致的"灰蒙蒙"视觉效果。
 *
 * 三种强度等级：
 * - "subtle"  : 最轻微，适合列表项、小卡片
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

// 纯色暗色背景 - 不使用 backdrop-filter，避免灰蒙蒙效果
const CARD_STYLES: Record<GlassIntensity, ViewStyle> = {
  subtle: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.10)",
  },
  medium: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  strong: {
    backgroundColor: "rgba(30, 41, 59, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
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
    ? { borderColor: accentColor + "40", borderWidth: 1 }
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
            { backgroundColor: (accentColor || colors.primary) + "30" },
          ]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    overflow: "hidden",
  },
  highlightLine: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    borderRadius: 1,
  },
});
