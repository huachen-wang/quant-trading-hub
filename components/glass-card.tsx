/**
 * GlassCard - 玻璃拟态卡片组件
 *
 * 完全通过 React Native style 属性实现毛玻璃效果。
 * React Native Web 原生支持 backdropFilter 并自动添加 -webkit- 前缀。
 * 不依赖任何 CSS className，确保跨平台一致性。
 *
 * 三种强度等级：
 * - "subtle"  : 最轻微的玻璃感，适合列表项、小卡片
 * - "medium"  : 标准玻璃感，适合内容卡片、表单区域
 * - "strong"  : 最强玻璃感，适合模态框、重点CTA区域
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

// 玻璃拟态样式配置 - 纯 inline style，不依赖 CSS className
const GLASS_STYLES: Record<GlassIntensity, ViewStyle> = {
  subtle: {
    backgroundColor: "rgba(30, 41, 59, 0.50)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.08)",
  },
  medium: {
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.10)",
  },
  strong: {
    backgroundColor: "rgba(30, 41, 59, 0.70)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
};

// Web 端额外的 backdrop-filter 样式（React Native Web 支持）
const WEB_BLUR: Record<GlassIntensity, any> = {
  subtle: {
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  medium: {
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
  },
  strong: {
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
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

  const glassStyle = GLASS_STYLES[intensity];
  const webBlur = WEB_BLUR[intensity];

  const accentBorder = accentColor
    ? { borderColor: accentColor + "40", borderWidth: 1 }
    : {};

  return (
    <View
      style={[
        styles.base,
        glassStyle,
        webBlur,
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
