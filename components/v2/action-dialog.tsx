import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "@/lib/language";
import { V2 } from "./tokens";

type DialogTone = "info" | "warning" | "danger" | "success";

const TONE = {
  info: { color: V2.blue, icon: "info-outline" },
  warning: { color: V2.amber, icon: "warning-amber" },
  danger: { color: V2.red, icon: "delete-outline" },
  success: { color: V2.green, icon: "check-circle-outline" },
} as const;

export function ActionDialog({
  visible,
  title,
  message,
  tone = "info",
  confirmLabel,
  cancelLabel,
  confirmOnly = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  tone?: DialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmOnly?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { text } = useLanguage();
  const toneStyle = TONE[tone];
  const resolvedConfirmLabel = confirmLabel ?? text("确认", "Confirm", "تأكيد");
  const resolvedCancelLabel = cancelLabel ?? text("取消", "Cancel", "إلغاء");
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          accessibilityRole="alert"
          style={styles.dialog}
          onPress={(event) => event.stopPropagation()}
        >
          <View
            style={[
              styles.icon,
              {
                borderColor: `${toneStyle.color}55`,
                backgroundColor: `${toneStyle.color}12`,
              },
            ]}
          >
            <MaterialIcons
              name={toneStyle.icon}
              size={24}
              color={toneStyle.color}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            {!confirmOnly ? (
              <Pressable
                accessibilityRole="button"
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancelText}>{resolvedCancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                { backgroundColor: toneStyle.color },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>{resolvedConfirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.76)",
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    padding: 22,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
  },
  icon: {
    width: 46,
    height: 46,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: V2.text, fontSize: 19, lineHeight: 25, fontWeight: "900" },
  message: {
    marginTop: 8,
    color: V2.textMuted,
    fontSize: 13,
    lineHeight: 21,
  },
  actions: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  cancelButton: {
    minWidth: 88,
    minHeight: 42,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: V2.textMuted, fontSize: 12, fontWeight: "800" },
  confirmButton: {
    minWidth: 104,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { color: V2.background, fontSize: 12, fontWeight: "900" },
  pressed: { opacity: 0.72 },
});
