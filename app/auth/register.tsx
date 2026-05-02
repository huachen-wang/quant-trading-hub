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
import { setSessionToken } from "@/lib/_core/auth";
import { getApiBaseUrl } from "@/constants/oauth";

type Mode = "password" | "code";

export default function UserRegisterScreen() {
  const colors = useColors();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("code"); // 默认推荐验证码注册（更安全）
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState(""); // 选填
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const sendCodeMutation = trpc.auth.sendEmailCode.useMutation();
  const registerWithCodeMutation = trpc.auth.registerWithCode.useMutation();

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  const handleSendCode = async () => {
    if (!email.trim()) return showMsg("请先输入邮箱");
    if (cooldown > 0) return;
    try {
      await sendCodeMutation.mutateAsync({
        email: email.trim(),
        purpose: "register",
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
      showMsg("验证码已发送至您的邮箱");
    } catch (e: any) {
      showMsg(e.message || "发送失败");
    }
  };

  // 验证码注册
  const handleCodeRegister = async () => {
    if (!email.trim() || !code) return showMsg("请填写邮箱和验证码");
    setBusy(true);
    try {
      const result = await registerWithCodeMutation.mutateAsync({
        email: email.trim(),
        code,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        password: password || undefined,
      });
      if (result.sessionToken) {
        await setSessionToken(result.sessionToken);
      }
      showMsg("注册成功！");
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      showMsg(e.message || "注册失败");
    } finally {
      setBusy(false);
    }
  };

  // 密码注册（走现有的 /api/auth/register）
  const handlePasswordRegister = async () => {
    if (!email.trim() || !password) return showMsg("请填写邮箱和密码");
    if (password.length < 6) return showMsg("密码至少 6 位");
    setBusy(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          password,
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "注册失败");

      if (data.app_session_id) {
        await setSessionToken(data.app_session_id);
      }
      showMsg("注册成功！可在用户中心验证邮箱解锁完整福利。");
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      showMsg(e.message || "注册失败");
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
          title="注册"
          subtitle="加入 EAXAU · 验证邮箱后解锁完整功能与 EA 福利"
          footer={
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
              已有账号？
              <Link href="/auth/login" style={{ color: colors.primary, fontWeight: "700" }}>
                {" 立即登录"}
              </Link>
            </Text>
          }
        >
          {/* 模式切换 */}
          <View style={styles.tabRow}>
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
                验证码注册（推荐）
              </Text>
            </TouchableOpacity>
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
                密码注册
              </Text>
            </TouchableOpacity>
          </View>

          {/* 邮箱 */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>
              邮箱 <Text style={{ color: "#F87171" }}>*</Text>
            </Text>
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

          {/* 昵称（选填） */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>昵称（选填）</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="不填将用邮箱前缀"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                { color: colors.foreground, borderColor: "rgba(148,163,184,0.12)" },
              ]}
            />
          </View>

          {/* 验证码 OR 密码 */}
          {mode === "code" ? (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.muted }]}>
                邮箱验证码 <Text style={{ color: "#F87171" }}>*</Text>
              </Text>
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
                    { borderColor: colors.primary + "40", opacity: cooldown > 0 ? 0.5 : 1 },
                  ]}
                >
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                    {cooldown > 0 ? `${cooldown}s` : "获取验证码"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.muted }]}>
                密码 <Text style={{ color: "#F87171" }}>*</Text>
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="至少 6 位"
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={[
                  styles.input,
                  { color: colors.foreground, borderColor: "rgba(148,163,184,0.12)" },
                ]}
              />
            </View>
          )}

          {/* 选填密码（仅验证码模式下显示） */}
          {mode === "code" && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.muted }]}>设置密码（选填）</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="不填将自动生成，可在用户中心修改"
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={[
                  styles.input,
                  { color: colors.foreground, borderColor: "rgba(148,163,184,0.12)" },
                ]}
              />
            </View>
          )}

          {/* 手机号（选填，强烈推荐） */}
          <View style={styles.field}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.label, { color: colors.muted }]}>手机号</Text>
              <View style={styles.recommendBadge}>
                <Text style={styles.recommendText}>建议填写 · 解锁定期福利</Text>
              </View>
            </View>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="选填，用于接收 EA 更新与活动通知"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              maxLength={20}
              style={[
                styles.input,
                { color: colors.foreground, borderColor: "rgba(148,163,184,0.12)" },
              ]}
            />
          </View>

          {/* 注册按钮 */}
          <TouchableOpacity
            onPress={mode === "code" ? handleCodeRegister : handlePasswordRegister}
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
                <Text style={styles.ctaText}>立即注册</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.disclaimer, { color: colors.muted }]}>
            注册即表示同意《服务条款》与《隐私政策》
          </Text>
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
    fontSize: 12,
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
  recommendBadge: {
    backgroundColor: "rgba(245,158,11,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendText: {
    fontSize: 10,
    color: "#FBBF24",
    fontWeight: "700",
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
  disclaimer: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
});
