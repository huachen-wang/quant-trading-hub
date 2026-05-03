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
import { setSessionToken, setUserInfo } from "@/lib/_core/auth";
import { getApiBaseUrl } from "@/constants/oauth";

type Mode = "password" | "code";

export default function UserLoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0); // 验证码冷却秒数

  const sendCodeMutation = trpc.auth.sendEmailCode.useMutation();
  const loginWithCodeMutation = trpc.auth.loginWithCode.useMutation();

  const showError = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  // 邮箱+密码登录（走现有的 /api/auth/login）
  const handlePasswordLogin = async () => {
    if (!email.trim() || !password) return showError("请输入邮箱和密码");
    setBusy(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "登录失败");

      if (data.app_session_id) {
        await setSessionToken(data.app_session_id);
      }
      if (data.user) {
        await setUserInfo({
          id: data.user.id,
          openId: data.user.openId,
          name: data.user.name,
          email: data.user.email,
          avatar: null,
          bio: null,
          loginMethod: data.user.loginMethod,
          role: "user",
          lastSignedIn: new Date(),
        });
      }
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = "/";  // 硬刷新，确保 useAuth 立即读取新 cookie
      } else {
        router.replace("/(tabs)" as any);
      }
    } catch (e: any) {
      showError(e.message || "登录失败");
    } finally {
      setBusy(false);
    }
  };

  // 邮箱+验证码登录
  const handleCodeLogin = async () => {
    if (!email.trim() || !code) return showError("请输入邮箱和验证码");
    setBusy(true);
    try {
      const result = await loginWithCodeMutation.mutateAsync({
        email: email.trim(),
        code,
      });
      if (result.sessionToken) {
        await setSessionToken(result.sessionToken);
      }
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = "/";  // 硬刷新，确保 useAuth 立即读取新 cookie
      } else {
        router.replace("/(tabs)" as any);
      }
    } catch (e: any) {
      showError(e.message || "登录失败");
    } finally {
      setBusy(false);
    }
  };

  // 发送验证码
  const handleSendCode = async () => {
    if (!email.trim()) return showError("请先输入邮箱");
    if (cooldown > 0) return;
    try {
      await sendCodeMutation.mutateAsync({
        email: email.trim(),
        purpose: "login",
      });
      // 启动 60 秒冷却
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
      showError("验证码已发送至您的邮箱");
    } catch (e: any) {
      showError(e.message || "发送失败");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <UserAuthCard
          title="登录"
          subtitle="登录后享受完整功能与会员福利"
          footer={
            <View style={{ alignItems: "center", gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                还没有账号？
                <Link href="/auth/register" style={{ color: colors.primary, fontWeight: "700" }}>
                  {" 立即注册"}
                </Link>
              </Text>
              <Link href="/auth/forgot-password" style={{ color: colors.muted, fontSize: 12 }}>
                忘记密码？
              </Link>
            </View>
          }
        >
          {/* 模式切换 */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              onPress={() => setMode("password")}
              style={[
                styles.tab,
                mode === "password" && {
                  backgroundColor: colors.primary + "20",
                  borderColor: colors.primary + "60",
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: mode === "password" ? colors.primary : colors.muted },
                ]}
              >
                密码登录
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode("code")}
              style={[
                styles.tab,
                mode === "code" && {
                  backgroundColor: colors.primary + "20",
                  borderColor: colors.primary + "60",
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: mode === "code" ? colors.primary : colors.muted },
                ]}
              >
                验证码登录
              </Text>
            </TouchableOpacity>
          </View>

          {/* 邮箱 */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>邮箱</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[
                styles.input,
                { color: colors.foreground, borderColor: "rgba(148,163,184,0.12)" },
              ]}
            />
          </View>

          {/* 密码 OR 验证码 */}
          {mode === "password" ? (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.muted }]}>密码</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="请输入密码"
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={[
                  styles.input,
                  { color: colors.foreground, borderColor: "rgba(148,163,184,0.12)" },
                ]}
              />
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.muted }]}>验证码</Text>
              <View style={styles.codeRow}>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="6 位验证码"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      color: colors.foreground,
                      borderColor: "rgba(148,163,184,0.12)",
                    },
                  ]}
                />
                <TouchableOpacity
                  onPress={handleSendCode}
                  disabled={cooldown > 0 || sendCodeMutation.isPending}
                  style={[
                    styles.sendBtn,
                    {
                      borderColor: colors.primary + "40",
                      opacity: cooldown > 0 ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                    {cooldown > 0 ? `${cooldown}s 后重试` : "获取验证码"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 登录按钮 */}
          <TouchableOpacity
            onPress={mode === "password" ? handlePasswordLogin : handleCodeLogin}
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
                <Text style={styles.ctaText}>登录</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </UserAuthCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    alignItems: "center",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.04 * 12,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  codeRow: {
    flexDirection: "row",
    gap: 8,
  },
  sendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cta: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  ctaInner: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  ctaText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
