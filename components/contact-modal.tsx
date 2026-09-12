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
import {
  INQUIRY_FLOW_STEPS,
  buildInquiryMessage,
  buildTelegramChatLink,
  type InquiryContext,
} from "@/lib/inquiry-message";
import { useLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * 发起咨询的商品上下文。传入后弹窗会把商品名 / 编号 / 商品页写进一段可复制的咨询内容，
   * 客户不用自己组织语言，顾问也不用重新问一遍版本和授权范围。
   */
  context?: InquiryContext;
}

const CONTACT_FALLBACKS = {
  telegram: "@xau6000",
  telegramLink: "https://t.me/xau6000",
  qq: "1226426670 / 3832001817",
  wechat: "oooiniooo0624 / xau6000",
  description: "咨询时请备注策略名称，客服会确认文件版本、部署要求与交付方式。",
};

export function ContactModal({ visible, onClose, context }: ContactModalProps) {
  const { language, text } = useLanguage();
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [copiedMethod, setCopiedMethod] = useState("");
  const [inquiryCopied, setInquiryCopied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCopiedMethod("");
    setInquiryCopied(false);
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
  const inquiryMessage = context ? buildInquiryMessage(context) : "";
  const telegramChatLink = buildTelegramChatLink(telegramLink) || buildTelegramChatLink(telegram);

  const handleCopyInquiry = async () => {
    if (!inquiryMessage) return;
    let copied = false;
    try {
      await globalThis.navigator?.clipboard?.writeText(inquiryMessage);
      copied = true;
    } catch {
      copied = false;
    }
    setInquiryCopied(copied);
    if (copied) setTimeout(() => setInquiryCopied(false), 2400);
    // 复制失败也要放客户走：内容仍在上方可手动选中，链接照常打开。
    if (telegramChatLink) await Linking.openURL(telegramChatLink);
  };

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

            {inquiryMessage ? (
              <View style={styles.inquiryBox}>
                <View style={styles.inquiryHead}>
                  <MaterialIcons name="assignment" size={15} color={V2.gold} />
                  <Text style={styles.inquiryEyebrow}>
                    {text(
                      "已为你写好咨询内容",
                      "Inquiry drafted for you",
                      "نص الاستفسار جاهز",
                    )}
                  </Text>
                </View>
                <Text style={styles.inquiryText} selectable>
                  {inquiryMessage}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={text(
                    "复制咨询内容并打开 Telegram",
                    "Copy the inquiry and open Telegram",
                    "انسخ الاستفسار وافتح تيليجرام",
                  )}
                  onPress={() => void handleCopyInquiry()}
                  style={({ pressed }) => [
                    styles.inquiryAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons
                    name={inquiryCopied ? "check" : "content-copy"}
                    size={16}
                    color={V2.background}
                  />
                  <Text style={styles.inquiryActionText}>
                    {inquiryCopied
                      ? text("已复制", "Copied", "تم النسخ")
                      : telegramChatLink
                        ? text(
                            "复制并打开 Telegram",
                            "Copy & open Telegram",
                            "انسخ وافتح تيليجرام",
                          )
                        : text("复制咨询内容", "Copy inquiry", "انسخ الاستفسار")}
                  </Text>
                </Pressable>
                <View style={styles.flowRow}>
                  {INQUIRY_FLOW_STEPS.map((step, index) => (
                    <View key={step.key} style={styles.flowItem}>
                      <Text style={styles.flowIndex}>{index + 1}</Text>
                      <Text style={styles.flowText}>
                        {text(step.zh, step.en, step.ar)}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.flowNote}>
                  {text(
                    "报价、授权范围与交付清单由顾问在会话内确认。安装问题与后续版本仍走这条会话，不必重新找入口。",
                    "Pricing, licence scope and the delivery list are confirmed by the advisor in that thread. Installation issues and later versions stay in the same thread.",
                    "يؤكد المستشار السعر ونطاق الترخيص وقائمة التسليم داخل المحادثة نفسها، وتبقى مشكلات التثبيت والإصدارات اللاحقة فيها.",
                  )}
                </Text>
              </View>
            ) : null}

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
  inquiryBox: {
    marginBottom: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.36)",
    borderRadius: 5,
    backgroundColor: "rgba(216,188,131,0.06)",
    gap: 10,
  },
  inquiryHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  inquiryEyebrow: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  inquiryText: {
    color: V2.text,
    fontSize: 11,
    lineHeight: 17,
    fontVariant: ["tabular-nums"],
  },
  inquiryAction: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 5,
    backgroundColor: V2.gold,
  },
  inquiryActionText: {
    color: V2.background,
    fontSize: 13,
    fontWeight: "900",
  },
  flowRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 22,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 3,
    backgroundColor: V2.surfaceMuted,
  },
  flowIndex: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  flowText: { color: V2.textMuted, fontSize: 9, fontWeight: "800" },
  flowNote: { color: V2.textMuted, fontSize: 10, lineHeight: 16 },
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
