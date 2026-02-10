import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * 通用空状态组件
 * 用于列表为空时显示友好的提示信息
 */
export function EmptyState({
  emoji = "📭",
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.8}
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  actionBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
