import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

export default function PublishScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState<"MT4" | "MT5">("MT4");
  const [pairs, setPairs] = useState("");
  const [timeframe, setTimeframe] = useState("");

  const createMutation = trpc.strategies.create.useMutation({
    onSuccess: () => {
      Alert.alert("成功", "策略发布成功!", [
        {
          text: "确定",
          onPress: () => {
            setTitle("");
            setDescription("");
            setPairs("");
            setTimeframe("");
            router.push("/(tabs)/" as any);
          },
        },
      ]);
    },
    onError: (error) => {
      Alert.alert("错误", error.message || "发布失败,请重试");
    },
  });

  const handlePublish = () => {
    if (!title.trim()) {
      Alert.alert("提示", "请输入策略名称");
      return;
    }
    if (!pairs.trim()) {
      Alert.alert("提示", "请输入交易对");
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      platform,
      pairs: pairs.trim(),
      timeframe: timeframe.trim() || undefined,
    });
  };

  if (authLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-2xl font-bold text-foreground mb-4">请先登录</Text>
        <Text className="text-muted text-center mb-6">登录后可以发布您的量化交易策略</Text>
        <TouchableOpacity
          onPress={() => router.push("/login" as any)}
          className="bg-primary px-8 py-3 rounded-full"
          activeOpacity={0.8}
        >
          <Text className="text-background font-semibold text-base">立即登录</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-3xl font-bold text-foreground mb-6">发布策略</Text>

        {/* 策略名称 */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">策略名称 *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="例如:黄金趋势跟踪策略"
            placeholderTextColor={colors.muted}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
            maxLength={255}
          />
        </View>

        {/* 平台选择 */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">交易平台 *</Text>
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => setPlatform("MT4")}
              className={`flex-1 py-3 rounded-xl mr-2 border ${platform === "MT4" ? "bg-primary border-primary" : "bg-surface border-border"}`}
              activeOpacity={0.7}
            >
              <Text className={`text-center font-semibold ${platform === "MT4" ? "text-background" : "text-foreground"}`}>
                MT4
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPlatform("MT5")}
              className={`flex-1 py-3 rounded-xl border ${platform === "MT5" ? "bg-primary border-primary" : "bg-surface border-border"}`}
              activeOpacity={0.7}
            >
              <Text className={`text-center font-semibold ${platform === "MT5" ? "text-background" : "text-foreground"}`}>
                MT5
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 交易对 */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">交易对 *</Text>
          <TextInput
            value={pairs}
            onChangeText={setPairs}
            placeholder="例如:XAUUSD, EURUSD, GBPUSD"
            placeholderTextColor={colors.muted}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
          <Text className="text-xs text-muted mt-1">多个交易对用逗号分隔</Text>
        </View>

        {/* 时间周期 */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">时间周期</Text>
          <TextInput
            value={timeframe}
            onChangeText={setTimeframe}
            placeholder="例如:H1, H4, D1"
            placeholderTextColor={colors.muted}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* 策略描述 */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-foreground mb-2">策略描述</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="介绍您的策略逻辑、特点和适用场景..."
            placeholderTextColor={colors.muted}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text className="text-xs text-muted mt-1">{description.length}/2000</Text>
        </View>

        {/* 发布按钮 */}
        <TouchableOpacity
          onPress={handlePublish}
          disabled={createMutation.isPending}
          className={`py-4 rounded-full items-center ${createMutation.isPending ? "bg-muted" : "bg-primary"}`}
          activeOpacity={0.8}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text className="text-background font-bold text-base">发布策略</Text>
          )}
        </TouchableOpacity>

        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
