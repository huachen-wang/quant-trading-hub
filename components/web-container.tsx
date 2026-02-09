import { View, type ViewProps } from "react-native";
import { Platform } from "react-native";
import { cn } from "@/lib/utils";

export interface WebContainerProps extends ViewProps {
  /**
   * 最大宽度(桌面端)
   */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  /**
   * 是否居中显示
   */
  centered?: boolean;
  /**
   * Tailwind className
   */
  className?: string;
}

/**
 * Web端响应式容器组件
 * 
 * 在桌面端限制最大宽度并居中显示
 * 在移动端全屏显示
 */
export function WebContainer({
  children,
  maxWidth = "2xl",
  centered = true,
  className,
  style,
  ...props
}: WebContainerProps) {
  // 只在Web端应用容器样式
  if (Platform.OS !== "web") {
    return <View className={className} style={style} {...props}>{children}</View>;
  }

  const maxWidthClass = {
    sm: "max-w-screen-sm",
    md: "max-w-screen-md",
    lg: "max-w-screen-lg",
    xl: "max-w-screen-xl",
    "2xl": "max-w-screen-2xl",
    full: "max-w-full",
  }[maxWidth];

  return (
    <View
      className={cn(
        "w-full",
        maxWidthClass,
        centered && "mx-auto",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
}
