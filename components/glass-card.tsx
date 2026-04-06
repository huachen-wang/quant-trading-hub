/**
 * GlassCard - 玻璃拟态卡片组件
 *
 * 在 Web 端使用 CSS backdrop-filter 实现毛玻璃效果，
 * 在 Native 端使用半透明背景 + 边框模拟类似质感。
 *
 * 三种强度等级：
 * - "subtle"  : 最轻微的玻璃感，适合列表项、小卡片
 * - "medium"  : 标准玻璃感，适合内容卡片、表单区域
 * - "strong"  : 最强玻璃感，适合模态框、重点CTA区域
 */
import { View, Platform, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
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

// Web 端 CSS className 映射
const WEB_CLASS_MAP: Record<GlassIntensity, string> = {
  subtle: "glass-subtle",
  medium: "glass-medium",
  strong: "glass-strong",
};

export function GlassCard({
  children,
  intensity = "medium",
  style,
  accentColor,
  highlight = false,
}: GlassCardProps) {
  const colors = useColors();

  // Native 端降级样式
  const nativeStyles: Record<GlassIntensity, ViewStyle> = {
    subtle: {
      backgroundColor: colors.surface + "CC", // 80% opacity
      borderWidth: 1,
      borderColor: colors.border + "80",
    },
    medium: {
      backgroundColor: colors.surface + "E6", // 90% opacity
      borderWidth: 1,
      borderColor: colors.border + "99",
    },
    strong: {
      backgroundColor: colors.surface + "F2", // 95% opacity
      borderWidth: 1,
      borderColor: colors.border + "B3",
    },
  };

  const accentBorder = accentColor
    ? { borderColor: accentColor + "40", borderWidth: 1 }
    : {};

  if (Platform.OS === "web") {
    return (
      <View
        // @ts-ignore - web-only className prop
        className={WEB_CLASS_MAP[intensity]}
        style={[styles.base, accentBorder, style]}
      >
        {highlight && (
          <View style={[styles.highlightLine, { backgroundColor: (accentColor || colors.primary) + "30" }]} />
        )}
        {children}
      </View>
    );
  }

  // Native fallback
  return (
    <View style={[styles.base, nativeStyles[intensity], accentBorder, style]}>
      {highlight && (
        <View style={[styles.highlightLine, { backgroundColor: (accentColor || colors.primary) + "30" }]} />
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
