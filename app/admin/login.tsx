import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 管理后台登录页面
 * 
 * 访问路径: /admin/login
 * 
 * 这是一个简单的管理员登录页面,使用邮箱密码登录
 * 登录成功后会跳转到管理后台首页
 */
export default function AdminLogin() {
  const router = useRouter();
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("错误", "请输入邮箱和密码");
      return;
    }

    setIsLoading(true);

    try {
      // 这里使用简单的硬编码验证
      // 生产环境应该调用API验证
      if (email === "admin@eaxau.com" && password === "admin123") {
        // 保存登录状态
        await AsyncStorage.setItem("admin_logged_in", "true");
        await AsyncStorage.setItem("admin_email", email);
        
        Alert.alert("成功", "登录成功", [
          {
            text: "确定",
            onPress: () => router.replace("/admin" as any),
          },
        ]);
      } else {
        Alert.alert("错误", "邮箱或密码错误");
      }
    } catch (error) {
      Alert.alert("错误", "登录失败,请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-1 items-center justify-center p-6">
        {/* Logo和标题 */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
            <Text className="text-4xl">⚙️</Text>
          </View>
          <Text className="text-2xl font-bold text-foreground mb-2">管理员登录</Text>
          <Text className="text-sm text-muted">量化军火库 - 后台管理系统</Text>
        </View>

        {/* 登录表单 */}
        <View className="w-full max-w-sm">
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">邮箱</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="admin@eaxau.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
            />
          </View>

          <View className="mb-6">
            <Text className="text-sm font-semibold text-foreground mb-2">密码</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="请输入密码"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
            />
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            className="bg-primary rounded-lg py-3 items-center"
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className="text-background font-bold text-base">登录</Text>
            )}
          </TouchableOpacity>

          {/* 默认账号提示 */}
          <View className="mt-6 p-4 bg-surface/50 rounded-lg">
            <Text className="text-xs text-muted text-center">
              默认账号: admin@eaxau.com{"\n"}
              默认密码: admin123
            </Text>
          </View>
        </View>

        {/* 返回首页 */}
        <TouchableOpacity
          onPress={() => router.push("/" as any)}
          className="mt-8"
          activeOpacity={0.7}
        >
          <Text className="text-sm text-primary">← 返回首页</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
