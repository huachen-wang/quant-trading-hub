/**
 * GlassCard - 暗色卡片组件
 *
 * 使用比页面背景(#0F172A)明显更亮的背景色 + 清晰可见的边框。
 * 不使用 backdrop-filter blur，避免灰蒙蒙效果。
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

// 使用明显区别于页面背景(#0F172A)的卡片背景色
// 边框使用更高透明度，确保卡片边界清晰可见
const CARD_STYLES: Record<GlassIntensity, ViewStyle> = {
  subtle: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.20)",
  },
  medium: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  strong: {
    backgroundColor: "#243247",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.30)",
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
    ? { borderColor: accentColor + "60", borderWidth: 1.5 }
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
            { backgroundColor: (accentColor || colors.primary) + "50" },
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
    height: 2,
    borderRadius: 1,
  },
});
