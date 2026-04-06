/**
 * 玻璃拟态 inline 样式工具
 *
 * 提供纯 style 对象用于直接注入到 View/TouchableOpacity 等组件，
 * 不依赖 CSS className，确保在 React Native Web 上 100% 生效。
 *
 * React Native Web 原生支持 backdropFilter 并自动添加 -webkit- 前缀。
 */

type GlassLevel = "subtle" | "medium" | "strong" | "input" | "btn" | "nav";

const GLASS_MAP: Record<GlassLevel, any> = {
  subtle: {
    backgroundColor: "rgba(30, 41, 59, 0.50)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.08)",
  },
  medium: {
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.10)",
  },
  strong: {
    backgroundColor: "rgba(30, 41, 59, 0.70)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  input: {
    backgroundColor: "rgba(15, 23, 42, 0.80)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.10)",
  },
  btn: {
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
  nav: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.08)",
  },
};

/**
 * 获取玻璃拟态 inline 样式
 * 用法: style={[myStyles, glassStyle("medium")]}
 */
export function glassStyle(level: GlassLevel): any {
  return GLASS_MAP[level] || GLASS_MAP.medium;
}

/**
 * 获取玻璃拟态样式（仅在 Web 端生效）
 * 用法: style={[myStyles, webGlass("medium")]}
 */
export function webGlass(level: GlassLevel): any {
  // 在所有平台都返回样式，因为 backdropFilter 在 native 端会被忽略
  return GLASS_MAP[level] || GLASS_MAP.medium;
}
