import { useRef, useEffect } from "react";
import { View, Text, Modal, TouchableOpacity, Linking, ActivityIndicator, StyleSheet, Animated, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "./ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { glassStyle } from "@/lib/glass-styles";

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ContactModal({ visible, onClose }: ContactModalProps) {
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
  const { data: contactData, isLoading } = trpc.siteSettings.getContact.useQuery(undefined, {
    enabled: visible,
  });

  const telegram = contactData?.contact_telegram || "";
  const telegramLink = contactData?.contact_telegram_link || "";
  const qq = contactData?.contact_qq || "";
  const wechat = contactData?.contact_wechat || "";
  const description = contactData?.contact_description || "";
  const title = contactData?.contact_title || "联系我们";
  const subtitle = contactData?.contact_subtitle || "上架EA策略 | 代挂合作服务";

  const contactMethods = [
    ...(telegram ? [{
      icon: "paperplane.fill" as const,
      label: "Telegram",
      value: telegram,
      link: telegramLink || null,
    }] : []),
    ...(qq ? [{
      icon: "bubble.left.fill" as const,
      label: "QQ群",
      value: qq,
      link: null,
    }] : []),
    ...(wechat ? [{
      icon: "message.fill" as const,
      label: "微信",
      value: wechat,
      link: null,
    }] : []),
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
            { backgroundColor: Platform.OS === "web" ? "rgba(15,23,42,0.85)" : colors.background, transform: [{ scale: scaleAnim }], opacity: opacityAnim },
            glassStyle("strong") as any,
          ]}
        >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={{ width: "100%" }}
        >
          {/* 标题 */}
          <View style={styles.headerSection}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>{subtitle}</Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {/* 联系方式列表 */}
              <View style={styles.contactList}>
                {contactMethods.map((method, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handlePress(method.link)}
                    style={[styles.contactItem, { backgroundColor: Platform.OS === "web" ? "rgba(30,41,59,0.5)" : colors.surface }, glassStyle("subtle") as any]}
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

              {/* 说明 */}
              {description ? (
                <View style={[styles.descBox, { backgroundColor: colors.primary + "08" }]}>
                  <Text style={[styles.descText, { color: colors.foreground }]}>{description}</Text>
                </View>
              ) : null}
            </>
          )}

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
  loadingBox: { paddingVertical: 40 },
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
  descBox: { borderRadius: 14, padding: 14, marginBottom: 16 },
  descText: { fontSize: 14, lineHeight: 22 },
  closeBtn: { borderRadius: 24, paddingVertical: 14, alignItems: "center" },
  closeBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
