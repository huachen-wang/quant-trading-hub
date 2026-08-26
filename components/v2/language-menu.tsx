import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LANGUAGE_OPTIONS, useLanguage } from "@/lib/language";
import { V2 } from "./tokens";

export function LanguageMenu({ compact = false }: { compact?: boolean }) {
  const [visible, setVisible] = useState(false);
  const { language, setLanguage, text } = useLanguage();
  const selected = LANGUAGE_OPTIONS.find((option) => option.id === language)!;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text(
          `当前语言：${selected.nativeLabel}`,
          `Current language: ${selected.nativeLabel}`,
          `اللغة الحالية: ${selected.nativeLabel}`,
        )}
        accessibilityHint={text(
          "打开语言菜单",
          "Open language menu",
          "فتح قائمة اللغات",
        )}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.trigger,
          compact && styles.triggerCompact,
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons name="language" size={18} color={V2.textMuted} />
        <Text style={styles.triggerText}>{selected.shortLabel}</Text>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel={text(
              "关闭语言菜单",
              "Close language menu",
              "إغلاق قائمة اللغات",
            )}
            onPress={() => setVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.panel}>
            <View style={styles.heading}>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>EAXAU · GLOBAL</Text>
                <Text style={styles.title}>
                  {text("选择语言", "Choose language", "اختر اللغة")}
                </Text>
                <Text style={styles.detail}>
                  {text(
                    "语言选择会保存在当前设备。",
                    "Your selection is saved on this device.",
                    "سيتم حفظ اختيارك على هذا الجهاز.",
                  )}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text("关闭", "Close", "إغلاق")}
                onPress={() => setVisible(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="close" size={20} color={V2.textMuted} />
              </Pressable>
            </View>

            <View style={styles.options}>
              {LANGUAGE_OPTIONS.map((option) => {
                const active = option.id === language;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => {
                      setLanguage(option.id);
                      setVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      active && styles.optionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.optionCode}>
                      <Text style={styles.optionCodeText}>
                        {option.shortLabel}
                      </Text>
                    </View>
                    <View style={styles.optionCopy}>
                      <Text
                        style={[
                          styles.optionLabel,
                          active && styles.optionLabelActive,
                        ]}
                      >
                        {option.nativeLabel}
                      </Text>
                      <Text style={styles.optionMeta}>
                        {option.id === "zh"
                          ? text(
                              "默认语言",
                              "Default language",
                              "اللغة الافتراضية",
                            )
                          : option.id === "ar"
                            ? "MENA · RTL"
                            : "GLOBAL · LTR"}
                      </Text>
                    </View>
                    <MaterialIcons
                      name={active ? "check-circle" : "radio-button-unchecked"}
                      size={20}
                      color={active ? V2.gold : V2.textDim}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 58,
    height: 38,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    backgroundColor: V2.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  triggerCompact: { minWidth: 42, paddingHorizontal: 7 },
  triggerText: {
    minWidth: 15,
    color: V2.text,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  overlay: {
    flex: 1,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2,5,10,0.84)",
  },
  panel: {
    width: "100%",
    maxWidth: 410,
    padding: 20,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
    gap: 18,
  },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  headingCopy: { flex: 1, minWidth: 0, gap: 4 },
  eyebrow: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  title: { color: V2.text, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  detail: { color: V2.textMuted, fontSize: 11, lineHeight: 17 },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  options: { gap: 8 },
  option: {
    minHeight: 64,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    backgroundColor: V2.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  optionActive: {
    borderColor: "rgba(216,188,131,0.72)",
    backgroundColor: "rgba(216,188,131,0.08)",
  },
  optionCode: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: V2.background,
  },
  optionCodeText: { color: V2.gold, fontSize: 12, fontWeight: "900" },
  optionCopy: { flex: 1, minWidth: 0, gap: 2 },
  optionLabel: { color: V2.textMuted, fontSize: 14, fontWeight: "800" },
  optionLabelActive: { color: V2.text },
  optionMeta: { color: V2.textDim, fontSize: 8, fontWeight: "800" },
  pressed: { opacity: 0.72 },
});
