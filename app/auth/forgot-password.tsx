import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { UserAuthCard } from "@/components/user-auth-card";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const sendCodeMutation = trpc.auth.sendEmailCode.useMutation();
  const resetMutation = trpc.auth.resetPassword.useMutation();

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  const handleSendCode = async () => {
    if (!email.trim()) return showMsg("请输入邮箱");
    if (cooldown > 0) return;
    setBusy(true);
    try {
      await sendCodeMutation.mutateAsync({
        email: email.trim(),
        purpose: "reset_password",
      });
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((s) => {
          if (s <= 1) {
            clearInterval(timer);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      setStep("reset");
      showMsg("验证码已发送至您的邮箱");
    } catch (e: any) {
      showMsg(e.message || "发送失败");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!code || !newPassword) return showMsg("请填写完整信息");
    if (newPassword.length < 6) return showMsg("新密码至少 6 位");
    setBusy(true);
    try {
      await resetMutation.mutateAsync({
        email: email.trim(),
        code,
        newPassword,
      });
      showMsg("密码重置成功，请使用新密码登录");
      router.replace("/auth/login" as any);
    } catch (e: any) {
      showMsg(e.message || "重置失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <UserAuthCard
          title="找回密码"
          subtitle="输入您注册时使用的邮箱，我们会发送验证码"
          footer={
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
              想起密码了？
              <Link href="/auth/login" style={{ color: colors.primary, fontWeight: "700" }}>
                {" 返回登录"}
              </Link>
            </Text>
          }
        >
          {/* 邮箱 */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>注册邮箱</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={step === "email"}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: "rgba(148,163,184,0.12)",
                  opacity: step === "email" ? 1 : 0.6,
                },
              ]}
            />
          </View>

          {step === "reset" && (
            <>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.muted }]}>验证码</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="6 位验证码"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={[
                    styles.input,
                    { color: colors.foreground, borderColor: "rgba(148,163,184,0.12)" },
                  ]}
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.muted }]}>新密码</Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="至少 6 位"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  style={[
                    styles.input,
                    { color: colors.foreground, borderColor: "rgba(148,163,184,0.12)" },
                  ]}
                />
              </View>
              {cooldown > 0 ? (
                <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
                  {cooldown}s 后可重新发送验证码
                </Text>
              ) : (
                <TouchableOpacity onPress={handleSendCode} style={{ alignSelf: "center" }}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                    重新发送验证码
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity
            onPress={step === "email" ? handleSendCode : handleReset}
            disabled={busy}
            style={styles.cta}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#D97706", "#F59E0B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaInner}
            >
              {busy ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.ctaText}>
                  {step === "email" ? "发送验证码" : "重置密码"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </UserAuthCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "600" },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  cta: { marginTop: 8, borderRadius: 12, overflow: "hidden" },
  ctaInner: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  ctaText: { color: "#0F172A", fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
});
