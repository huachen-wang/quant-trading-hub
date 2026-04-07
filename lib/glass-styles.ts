/**
 * 玻璃拟态 inline 样式工具
 *
 * 只提供 backdropFilter 和微妙边框，不覆盖 backgroundColor。
 * 各组件自己控制背景色（colors.surface 等），避免双层灰色叠加。
 *
 * React Native Web 原生支持 backdropFilter 并自动添加 -webkit- 前缀。
 */

type GlassLevel = "subtle" | "medium" | "strong" | "input" | "btn" | "nav";

const GLASS_MAP: Record<GlassLevel, any> = {
  subtle: {
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.06)",
  },
  medium: {
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.08)",
  },
  strong: {
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.10)",
  },
  input: {
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.08)",
  },
  btn: {
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  nav: {
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.06)",
  },
};

/**
 * 获取玻璃拟态 inline 样式（不含背景色）
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
  return GLASS_MAP[level] || GLASS_MAP.medium;
}
