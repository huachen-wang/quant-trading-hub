import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";
import * as SecureStore from "expo-secure-store";
import { EventEmitter } from "@/lib/event-emitter";
import { getApiBaseUrl } from "@/constants/oauth";

/**
 * 管理后台登录页面
 * 访问路径: /admin/login
 * 
 * 安全改进：
 * - 调用服务端API验证密码
 * - 服务端签发JWT token
 * - token存储到SecureStore（移动端）或localStorage（Web端）
 */
export default function AdminLogin() {
  const router = useRouter();
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async () => {
    setErrorMsg("");
    if (!email.trim() || !password.trim()) {
      setErrorMsg("请输入邮箱和密码");
      return;
    }

    setIsLoading(true);

    try {
      // 调用服务端登录API
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/trpc/adminAuth.login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          json: {
            email: email.trim(),
            password: password.trim(),
          },
        }),
      });

      const data = await response.json();

      if (data.error) {
        const errorMsg = data.error?.json?.message || data.error?.message || "登录失败";
        setErrorMsg(errorMsg);
        return;
      }

      // 提取token
      const result = data.result?.data?.json;
      if (!result || !result.token) {
        setErrorMsg("登录失败：未收到token");
        return;
      }

      // 存储token
      if (Platform.OS === "web") {
        sessionStorage.setItem("admin_token", result.token);
        sessionStorage.setItem("admin_email", result.email);
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_email");
      } else {
        await SecureStore.setItemAsync("admin_token", result.token);
        await SecureStore.setItemAsync("admin_email", result.email);
      }

      // 发射事件通知layout更新状态
      EventEmitter.emit("admin_login_success");

      // 跳转到后台首页
      router.replace("/admin" as any);
    } catch (error) {
      console.error("Login error:", error);
      setErrorMsg("登录失败，请检查网络连接");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <View style={styles.container}>
        {/* Logo和标题 */}
        <View style={styles.header}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary + "15" }]}>
            <Text style={styles.logoEmoji}>⚙️</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>管理员登录</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>量化军火库 - 后台管理系统</Text>
        </View>

        {/* 错误提示 */}
        {errorMsg ? (
          <View style={[styles.errorBox, { backgroundColor: colors.error + "15", borderColor: colors.error + "30" }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* 登录表单 */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>邮箱</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="admin@eaxau.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>密码</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="请输入密码"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
            style={[styles.loginBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>登录</Text>
            )}
          </TouchableOpacity>

          {/* 安全提示 */}
          <View style={[styles.hintBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.hintText, { color: colors.muted }]}>
              🔒 安全提示{"\n"}
              密码已加密传输，token存储在安全区域
            </Text>
          </View>
        </View>

        {/* 返回首页 */}
        <TouchableOpacity
          onPress={() => router.push("/" as any)}
          activeOpacity={0.7}
          style={styles.backBtn}
        >
          <Text style={[styles.backBtnText, { color: colors.primary }]}>← 返回首页</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
  },
  errorBox: {
    width: "100%",
    maxWidth: 360,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  form: {
    width: "100%",
    maxWidth: 360,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  loginBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  loginBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  hintBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 10,
  },
  hintText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 20,
  },
  backBtn: {
    marginTop: 32,
  },
  backBtnText: {
    fontSize: 14,
  },
});
