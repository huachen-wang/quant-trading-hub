import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { V2 } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
}

const CONTACT_FALLBACKS = {
  telegram: "@xau6000",
  telegramLink: "https://t.me/xau6000",
  qq: "1226426670 / 3832001817",
  wechat: "oooiniooo0624 / xau6000",
  description: "咨询时请备注策略名称，客服会确认文件版本、部署要求与交付方式。",
};

export function ContactModal({ visible, onClose }: ContactModalProps) {
  const { language, text } = useLanguage();
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [copiedMethod, setCopiedMethod] = useState("");

  useEffect(() => {
    if (!visible) return;
    setCopiedMethod("");
    scaleAnim.setValue(0.96);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [opacityAnim, scaleAnim, visible]);

  const { data: contactData, isLoading } =
    trpc.siteSettings.getContact.useQuery(undefined, {
      enabled: visible,
    });

  const telegram =
    contactData?.contact_telegram?.trim() || CONTACT_FALLBACKS.telegram;
  const telegramLink =
    contactData?.contact_telegram_link?.trim() ||
    CONTACT_FALLBACKS.telegramLink;
  const qq = contactData?.contact_qq?.trim() || CONTACT_FALLBACKS.qq;
  const wechat =
    contactData?.contact_wechat?.trim() || CONTACT_FALLBACKS.wechat;
  const localizedTitle = text(
    "联系量化顾问",
    "Talk to a quant advisor",
    "تواصل مع مستشار كمي",
  );
  const localizedSubtitle = text(
    "策略选配 · EA 版本 · 部署与授权",
    "Strategy selection · EA versions · Deployment & licensing",
    "اختيار الاستراتيجية · إصدارات EA · النشر والترخيص",
  );
  const localizedDescription = text(
    CONTACT_FALLBACKS.description,
    "Include the strategy or EA name in your message so the advisor can confirm the version, environment and delivery terms.",
    "اذكر اسم الاستراتيجية أو نظام EA في رسالتك لتأكيد الإصدار وبيئة التشغيل وشروط التسليم.",
  );
  const title =
    language === "zh"
      ? contactData?.contact_title?.trim() || localizedTitle
      : localizedTitle;
  const subtitle =
    language === "zh"
      ? contactData?.contact_subtitle?.trim() || localizedSubtitle
      : localizedSubtitle;
  const description =
    language === "zh"
      ? contactData?.contact_description?.trim() || localizedDescription
      : localizedDescription;

  const contactMethods = [
    ...(telegram
      ? [
          {
            id: "telegram",
            icon: "send" as const,
            label: "Telegram",
            value: telegram,
            link: telegramLink || null,
          },
        ]
      : []),
    ...(wechat
      ? [
          {
            id: "wechat",
            icon: "chat" as const,
            label: "WeChat",
            value: wechat,
            link: null,
          },
        ]
      : []),
    ...(qq
      ? [
          {
            id: "qq",
            icon: "forum" as const,
            label: text("QQ / QQ 群", "QQ / QQ Group", "QQ / مجموعة QQ"),
            value: qq,
            link: null,
          },
        ]
      : []),
  ];

  const handleMethodPress = async (method: (typeof contactMethods)[number]) => {
    if (method.link) {
      await Linking.openURL(method.link);
      return;
    }
    try {
      await globalThis.navigator?.clipboard?.writeText(method.value);
      setCopiedMethod(method.id);
      setTimeout(() => setCopiedMethod(""), 1600);
    } catch {
      setCopiedMethod("");
    }
  };

  if (!visible) return null;

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
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(event) => event.stopPropagation()}
            style={styles.modalInner}
          >
            <View style={styles.headingRow}>
              <View style={styles.headingIcon}>
                <MaterialIcons name="support-agent" size={24} color={V2.gold} />
              </View>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>CONTACT DESK</Text>
                <Text style={styles.modalTitle}>{title}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text("关闭", "Close", "إغلاق")}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeIcon,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="close" size={20} color={V2.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>{subtitle}</Text>
            <View style={styles.scopeRow}>
              {[
                text("策略选配", "Strategy mix", "مزيج الاستراتيجيات"),
                text("EA 商城", "EA market", "سوق EA"),
                text("部署支持", "Deployment", "دعم النشر"),
              ].map((scope) => (
                <View key={scope} style={styles.scopeItem}>
                  <Text style={styles.scopeText}>{scope}</Text>
                </View>
              ))}
            </View>

            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={V2.gold} />
              </View>
            ) : (
              <View style={styles.contactList}>
                {contactMethods.map((method) => {
                  const copied = copiedMethod === method.id;
                  return (
                    <Pressable
                      key={method.id}
                      accessibilityRole={method.link ? "link" : "button"}
                      accessibilityLabel={text(
                        `${method.label} 联系方式 ${method.value}`,
                        `${method.label} contact ${method.value}`,
                        `بيانات ${method.label}: ${method.value}`,
                      )}
                      onPress={() => void handleMethodPress(method)}
                      style={({ pressed }) => [
                        styles.contactItem,
                        pressed && styles.contactItemPressed,
                      ]}
                    >
                      <View style={styles.contactIcon}>
                        <MaterialIcons
                          name={method.icon}
                          size={21}
                          color={V2.gold}
                        />
                      </View>
                      <View style={styles.contactInfo}>
                        <Text style={styles.contactLabel}>{method.label}</Text>
                        <Text style={styles.contactValue} numberOfLines={1}>
                          {method.value}
                        </Text>
                      </View>
                      <View style={styles.contactAction}>
                        <Text
                          style={[
                            styles.contactActionText,
                            copied && styles.contactActionTextSuccess,
                          ]}
                        >
                          {copied
                            ? text("已复制", "Copied", "تم النسخ")
                            : method.link
                              ? text("打开", "Open", "فتح")
                              : text("复制", "Copy", "نسخ")}
                        </Text>
                        <MaterialIcons
                          name={
                            copied
                              ? "check"
                              : method.link
                                ? "open-in-new"
                                : "content-copy"
                          }
                          size={15}
                          color={copied ? V2.green : V2.textMuted}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {description ? (
              <View style={styles.descBox}>
                <MaterialIcons name="info-outline" size={17} color={V2.blue} />
                <Text style={styles.descText}>{description}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 18,
    backgroundColor: "rgba(2,5,10,0.84)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    width: "100%",
    maxWidth: 480,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 7,
    backgroundColor: V2.backgroundRaised,
  },
  modalInner: { width: "100%", padding: 20 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  headingIcon: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.42)",
    borderRadius: 5,
    backgroundColor: "rgba(216,188,131,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  headingCopy: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { color: V2.gold, fontSize: 8, fontWeight: "900" },
  modalTitle: {
    color: V2.text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
  },
  closeIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubtitle: {
    marginTop: 13,
    color: V2.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  scopeRow: {
    marginTop: 11,
    marginBottom: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  scopeItem: {
    minHeight: 23,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 3,
    backgroundColor: V2.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  scopeText: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  loadingBox: { paddingVertical: 48 },
  contactList: { gap: 8 },
  contactItem: {
    minHeight: 64,
    padding: 10,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 5,
    backgroundColor: V2.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  contactItemPressed: {
    borderColor: "rgba(216,188,131,0.64)",
    backgroundColor: "rgba(216,188,131,0.07)",
  },
  contactIcon: {
    width: 38,
    height: 38,
    borderRadius: 4,
    backgroundColor: "rgba(216,188,131,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  contactInfo: { flex: 1, minWidth: 0, gap: 3 },
  contactLabel: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  contactValue: { color: V2.text, fontSize: 13, fontWeight: "900" },
  contactAction: {
    minWidth: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  contactActionText: { color: V2.textMuted, fontSize: 9, fontWeight: "900" },
  contactActionTextSuccess: { color: V2.green },
  descBox: {
    marginTop: 14,
    padding: 11,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  descText: { flex: 1, color: V2.textMuted, fontSize: 10, lineHeight: 16 },
  pressed: { opacity: 0.7 },
});
