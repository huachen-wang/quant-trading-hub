import { useRef, useEffect } from "react";
import { View, Text, Modal, TouchableOpacity, Linking, StyleSheet, Animated } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "./ui/icon-symbol";

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

// 固定联系方式常量 - 全站统一
export const FIXED_CONTACTS = {
  telegram: "XAU9876",
  telegramLink: "https://t.me/XAU9876",
  wechat: "XAU9876",
  qq: "1079091794",
};

export function ContactModal({ visible, onClose, title, subtitle }: ContactModalProps) {
  const colors = useColors();
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const contactMethods = [
    {
      icon: "paperplane.fill" as const,
      label: "Telegram",
      value: `@${FIXED_CONTACTS.telegram}`,
      link: FIXED_CONTACTS.telegramLink,
    },
    {
      icon: "message.fill" as const,
      label: "微信",
      value: FIXED_CONTACTS.wechat,
      link: null,
    },
    {
      icon: "bubble.left.fill" as const,
      label: "QQ群",
      value: FIXED_CONTACTS.qq,
      link: null,
    },
  ];

  const handlePress = (link: string | null) => {
    if (link) {
      Linking.openURL(link);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={styles.overlay}
      >
        <Animated.View
          style={[
            styles.modalContent,
            { backgroundColor: colors.background, transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={{ width: "100%" }}
        >
          {/* 标题 */}
          <View style={styles.headerSection}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title || "联系我们"}</Text>
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>{subtitle || "上架EA策略 | 代挂合作服务"}</Text>
          </View>

          {/* 联系方式列表 */}
          <View style={styles.contactList}>
            {contactMethods.map((method, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handlePress(method.link)}
                style={[styles.contactItem, { backgroundColor: colors.surface }]}
                activeOpacity={0.7}
              >
                <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
                  <IconSymbol name={method.icon} size={24} color={colors.primary} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactLabel, { color: colors.muted }]}>{method.label}</Text>
                  <Text style={[styles.contactValue, { color: colors.foreground }]}>{method.value}</Text>
                </View>
                {method.link && (
                  <IconSymbol name="chevron.right" size={20} color={colors.muted} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* 关闭按钮 */}
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={styles.closeBtnText}>关闭</Text>
          </TouchableOpacity>
        </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
  },
  headerSection: { alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: "800", marginBottom: 6 },
  modalSubtitle: { fontSize: 14 },
  contactList: { marginBottom: 16 },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 12, marginBottom: 2 },
  contactValue: { fontSize: 16, fontWeight: "700" },
  closeBtn: { borderRadius: 24, paddingVertical: 14, alignItems: "center" },
  closeBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
