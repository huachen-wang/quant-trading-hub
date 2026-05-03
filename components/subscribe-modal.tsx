import { useState, useRef, useEffect } from "react";
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Alert, Animated, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { glassStyle } from "@/lib/glass-styles";

interface SubscribeModalProps {
  visible: boolean;
  onClose: () => void;
  strategyTitle?: string;
}

export function SubscribeModal({ visible, onClose, strategyTitle }: SubscribeModalProps) {
  const colors = useColors();
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
        Animated.timing(scaleAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const subscribeMutation = trpc.subscriptions.subscribe.useMutation();

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedContact = contact.trim();

    if (!trimmedEmail && !trimmedContact) {
      Alert.alert("提示", "请至少填写邮箱或联系方式");
      return;
    }

    // 如果填了邮箱，校验格式
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        Alert.alert("提示", "请输入有效的邮箱地址");
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
      Alert.alert("提交失败", error?.message || "网络错误，请稍后重试");
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
            { backgroundColor: Platform.OS === "web" ? "rgba(15,23,42,0.85)" : colors.background, transform: [{ scale: scaleAnim }], opacity: opacityAnim },
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
              <Text style={styles.successEmoji}>🎉</Text>
              <Text style={[styles.successTitle, { color: colors.foreground }]}>提交成功</Text>
              <Text style={[styles.successDesc, { color: colors.muted }]}>
                我们会尽快与您联系，感谢您的关注！
              </Text>
            </View>
          ) : (
            <>
              {/* 标题 */}
              <View style={styles.headerSection}>
                <Text style={{ fontSize: 36 }}>📬</Text>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>获取技术支持</Text>
                <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
                  {strategyTitle
                    ? `关于「${strategyTitle}」的技术咨询`
                    : "留下联系方式，获取专业EA技术支持"}
                </Text>
              </View>

              {/* 输入区 */}
              <View style={styles.inputSection}>
                <TextInput
                  value={contact}
                  onChangeText={setContact}
                  placeholder="微信号 / QQ / Telegram（推荐）"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { backgroundColor: "rgba(15,23,42,0.6)", borderColor: "rgba(148,163,184,0.12)", color: colors.foreground }]}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="邮箱地址（可选）"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, { backgroundColor: "rgba(15,23,42,0.6)", borderColor: "rgba(148,163,184,0.12)", color: colors.foreground }]}
                />
              </View>

              {/* 提示 */}
              <View style={[styles.tipBox, { backgroundColor: "rgba(59,130,246,0.06)" }]}>
                <Text style={[styles.tipText, { color: colors.muted }]}>
                  💡 推荐留下微信号，我们的策略顾问将为您提供一对一技术支持和EA部署指导
                </Text>
              </View>

              {/* 按钮 */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.8}
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>提交</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleClose} style={styles.cancelBtn} activeOpacity={0.7}>
                <Text style={[styles.cancelBtnText, { color: colors.muted }]}>取消</Text>
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
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  headerSection: { alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: "800", marginTop: 8, marginBottom: 6 },
  modalSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  inputSection: { marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  tipBox: { borderRadius: 12, padding: 12, marginBottom: 16 },
  tipText: { fontSize: 13, lineHeight: 20 },
  submitBtn: { borderRadius: 24, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelBtnText: { fontSize: 14 },
  successBox: { alignItems: "center", paddingVertical: 20 },
  successEmoji: { fontSize: 48, marginBottom: 12 },
  successTitle: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  successDesc: { fontSize: 14, textAlign: "center" },
});
