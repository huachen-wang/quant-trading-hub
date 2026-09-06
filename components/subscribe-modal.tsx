import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Animated,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { glassStyle } from "@/lib/glass-styles";
import { useLanguage } from "@/lib/language";

interface SubscribeModalProps {
  visible: boolean;
  onClose: () => void;
  strategyTitle?: string;
}

export function SubscribeModal({
  visible,
  onClose,
  strategyTitle,
}: SubscribeModalProps) {
  const colors = useColors();
  const { text } = useLanguage();
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    }
  }, [visible]);

  const subscribeMutation = trpc.subscriptions.subscribe.useMutation();

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedContact = contact.trim();

    if (!trimmedEmail && !trimmedContact) {
      Alert.alert(
        text("提示", "Notice", "تنبيه"),
        text(
          "请至少填写邮箱或联系方式",
          "Enter an email address or contact method.",
          "أدخل بريدا إلكترونيا أو وسيلة تواصل.",
        ),
      );
      return;
    }

    // 如果填了邮箱，校验格式
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        Alert.alert(
          text("提示", "Notice", "تنبيه"),
          text(
            "请输入有效的邮箱地址",
            "Enter a valid email address.",
            "أدخل عنوان بريد إلكتروني صالحا.",
          ),
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 构建提交数据 - 确保所有联系方式都会被持久化
      const payload: { email?: string; contactInfo?: string } = {};
      if (trimmedEmail) payload.email = trimmedEmail;
      if (trimmedContact) payload.contactInfo = trimmedContact;

      // 如果只填了联系方式没填邮箱，也作为 contactInfo 提交
      if (!trimmedEmail && trimmedContact) {
        payload.contactInfo = trimmedContact;
      }

      await subscribeMutation.mutateAsync(payload);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setEmail("");
        setContact("");
        onClose();
      }, 2000);
    } catch (error: any) {
      Alert.alert(
        text("提交失败", "Submission failed", "فشل الإرسال"),
        error?.message ||
          text(
            "网络错误，请稍后重试",
            "Network error. Try again later.",
            "خطأ في الشبكة. حاول مرة أخرى لاحقا.",
          ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setEmail("");
    setContact("");
    onClose();
  };

  // ─── Web 端修复：visible=false 时不渲染 Modal ───

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleClose}
        style={styles.overlay}
      >
        <Animated.View
          style={[
            styles.modalContent,
            {
              backgroundColor:
                Platform.OS === "web"
                  ? "rgba(15,23,42,0.85)"
                  : colors.background,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
            glassStyle("strong") as any,
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{ width: "100%" }}
          >
            {success ? (
              <View style={styles.successBox}>
                <Text style={styles.successCode}>OK</Text>
                <Text
                  style={[styles.successTitle, { color: colors.foreground }]}
                >
                  {text("提交成功", "Submitted", "تم الإرسال")}
                </Text>
                <Text style={[styles.successDesc, { color: colors.muted }]}>
                  {text(
                    "我们会尽快与您联系，感谢您的关注！",
                    "We will contact you shortly. Thank you.",
                    "سنتواصل معك قريبا. شكرا لك.",
                  )}
                </Text>
              </View>
            ) : (
              <>
                {/* 标题 */}
                <View style={styles.headerSection}>
                  <Text style={styles.headerCode}>ACC</Text>
                  <Text
                    style={[styles.modalTitle, { color: colors.foreground }]}
                  >
                    {text(
                      "获取技术支持",
                      "Get technical support",
                      "احصل على الدعم التقني",
                    )}
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
                    {strategyTitle
                      ? text(
                          `关于「${strategyTitle}」的技术咨询`,
                          `Technical consultation for ${strategyTitle}`,
                          `استشارة تقنية حول ${strategyTitle}`,
                        )
                      : text(
                          "留下联系方式，获取专业EA技术支持",
                          "Leave your contact details for professional EA support.",
                          "اترك بيانات التواصل للحصول على دعم احترافي لنظام EA.",
                        )}
                  </Text>
                </View>

                {/* 输入区 */}
                <View style={styles.inputSection}>
                  <TextInput
                    value={contact}
                    onChangeText={setContact}
                    placeholder={text(
                      "微信号 / QQ / Telegram（推荐）",
                      "Telegram / WeChat / QQ (recommended)",
                      "Telegram / WeChat / QQ (موصى به)",
                    )}
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: "rgba(15,23,42,0.6)",
                        borderColor: "rgba(148,163,184,0.12)",
                        color: colors.foreground,
                      },
                    ]}
                  />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder={text(
                      "邮箱地址（可选）",
                      "Email address (optional)",
                      "البريد الإلكتروني (اختياري)",
                    )}
                    placeholderTextColor={colors.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.input,
                      {
                        backgroundColor: "rgba(15,23,42,0.6)",
                        borderColor: "rgba(148,163,184,0.12)",
                        color: colors.foreground,
                      },
                    ]}
                  />
                </View>

                {/* 提示 */}
                <View
                  style={[
                    styles.tipBox,
                    { backgroundColor: "rgba(59,130,246,0.06)" },
                  ]}
                >
                  <Text style={[styles.tipText, { color: colors.muted }]}>
                    {text(
                      "推荐留下微信号，我们的策略顾问将为您提供一对一技术支持和EA部署指导",
                      "Telegram or WeChat is recommended. A strategy advisor will provide one-to-one support and deployment guidance.",
                      "نوصي بترك Telegram أو WeChat. سيقدم مستشار الاستراتيجية دعما فرديا وإرشادات للنشر.",
                    )}
                  </Text>
                </View>

                {/* 按钮 */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: isSubmitting ? 0.7 : 1,
                    },
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {text("提交", "Submit", "إرسال")}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.cancelBtn}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.muted }]}>
                    {text("取消", "Cancel", "إلغاء")}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  headerSection: { alignItems: "center", marginBottom: 20 },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 6,
  },
  modalSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  inputSection: { marginBottom: 12 },
  headerCode: {
    color: "#D8BC83",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  tipBox: { borderRadius: 8, padding: 12, marginBottom: 16 },
  tipText: { fontSize: 13, lineHeight: 20 },
  submitBtn: {
    borderRadius: 7,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelBtnText: { fontSize: 14 },
  successBox: { alignItems: "center", paddingVertical: 20 },
  successCode: {
    color: "#34D399",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 12,
  },
  successTitle: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  successDesc: { fontSize: 14, textAlign: "center" },
});
