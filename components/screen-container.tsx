import {
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewProps,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { SchemeColors } from "@/constants/theme";
import { cn } from "@/lib/utils";

export interface ScreenContainerProps extends ViewProps {
  /**
   * SafeArea edges to apply. Defaults to ["top", "left", "right"].
   * Bottom is typically handled by Tab Bar.
   */
  edges?: Edge[];
  /**
   * Tailwind className for the content area.
   */
  className?: string;
  /**
   * Additional className for the outer container (background layer).
   */
  containerClassName?: string;
  /**
   * Additional className for the SafeAreaView (content layer).
   */
  safeAreaClassName?: string;
}

/**
 * A container component that properly handles SafeArea and background colors.
 *
 * The outer View extends to full screen (including status bar area) with the background color,
 * while the inner SafeAreaView ensures content is within safe bounds.
 *
 * Usage:
 * ```tsx
 * <ScreenContainer className="p-4">
 *   <Text className="text-2xl font-bold text-foreground">
 *     Welcome
 *   </Text>
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  style,
  ...props
}: ScreenContainerProps) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;

  return (
    <View
      style={styles.container}
      className={containerClassName ? cn(containerClassName) : undefined}
      {...props}
    >
      {isDesktopWeb && (
        <>
          <View style={styles.desktopGrid} />
          <View style={styles.desktopTopRule} />
          <View style={[styles.desktopRail, styles.desktopRailLeft]} />
          <View style={[styles.desktopRail, styles.desktopRailRight]} />
        </>
      )}
      <SafeAreaView
        edges={edges}
        className={safeAreaClassName ? cn(safeAreaClassName) : undefined}
        style={[styles.safeArea, style]}
      >
        <View
          style={styles.content}
          className={className ? cn(className) : undefined}
        >
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SchemeColors.dark.background,
    position: "relative",
  },
  desktopGrid: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.48,
    pointerEvents: "none",
    ...(Platform.OS === "web"
      ? {
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.050) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.045) 1px, transparent 1px), linear-gradient(rgba(216,188,131,0.028) 1px, transparent 1px)",
          backgroundSize: "72px 72px, 72px 72px, 100% 1px",
        }
      : {}),
  } as any,
  desktopTopRule: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(216,188,131,0.18)",
    pointerEvents: "none",
  },
  desktopRail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(216,188,131,0.06)",
    pointerEvents: "none",
  },
  desktopRailLeft: {
    left: 22,
  },
  desktopRailRight: {
    right: 22,
  },
  safeArea: {
    flex: 1,
    position: "relative",
    zIndex: 1,
  },
  content: {
    flex: 1,
  },
});
