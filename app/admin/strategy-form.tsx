import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";

export default function StrategyForm() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams<{ mode: "create" | "edit"; id?: string }>();
  const isEdit = params.mode === "edit";
  const strategyId = params.id ? parseInt(params.id) : undefined;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    platform: "MT4" as "MT4" | "MT5",
    pairs: "",
    timeframe: "",
    coverImage: "",
    totalReturn: "0.00",
    maxDrawdown: "0.00",
    sharpeRatio: "0.00",
    winRate: "0.00",
    downloadUrl: "",
    price: "0.00",
    isFree: true,
    telegramGroup: "",
    qqGroup: "",
    status: "published" as "draft" | "published" | "archived",
  });

  const { data: strategy, isLoading: loadingStrategy } = trpc.strategies.detail.useQuery(
    { id: strategyId! },
    { enabled: isEdit && !!strategyId }
  );

  useEffect(() => {
    if (strategy) {
      setFormData({
        title: strategy.title,
        description: strategy.description || "",
        platform: strategy.platform,
        pairs: strategy.pairs,
        timeframe: strategy.timeframe || "",
        coverImage: strategy.coverImage || "",
        totalReturn: strategy.totalReturn || "0.00",
        maxDrawdown: strategy.maxDrawdown || "0.00",
        sharpeRatio: strategy.sharpeRatio || "0.00",
        winRate: strategy.winRate || "0.00",
        downloadUrl: strategy.downloadUrl || "",
        price: strategy.price || "0.00",
        isFree: strategy.isFree,
        telegramGroup: strategy.telegramGroup || "",
        qqGroup: strategy.qqGroup || "",
        status: strategy.status,
      });
    }
  }, [strategy]);

  const createMutation = trpc.admin.strategies.create.useMutation({
    onSuccess: () => {
      Alert.alert("成功", "策略已创建");
      router.back();
    },
    onError: (error) => {
      Alert.alert("错误", error.message);
    },
  });

  const updateMutation = trpc.admin.strategies.update.useMutation({
    onSuccess: () => {
      Alert.alert("成功", "策略已更新");
      router.back();
    },
    onError: (error) => {
      Alert.alert("错误", error.message);
    },
  });

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      Alert.alert("错误", "请输入策略标题");
      return;
    }

    if (isEdit && strategyId) {
      updateMutation.mutate({ id: strategyId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (loadingStrategy) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-foreground mb-6">
          {isEdit ? "编辑策略" : "添加新策略"}
        </Text>

        {/* 基本信息 */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">基本信息</Text>

          <Text className="text-sm text-foreground mb-1">策略标题 *</Text>
          <TextInput
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
            placeholder="输入策略名称"
            placeholderTextColor={colors.muted}
            className="bg-surface text-foreground px-4 py-3 rounded-xl mb-3"
          />

          <Text className="text-sm text-foreground mb-1">策略描述</Text>
          <TextInput
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="详细描述策略特点和使用方法"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            className="bg-surface text-foreground px-4 py-3 rounded-xl mb-3"
            style={{ minHeight: 100, textAlignVertical: "top" }}
          />

          <Text className="text-sm text-foreground mb-1">平台</Text>
          <View className="flex-row gap-2 mb-3">
            {["MT4", "MT5"].map((platform) => (
              <TouchableOpacity
                key={platform}
                onPress={() => setFormData({ ...formData, platform: platform as "MT4" | "MT5" })}
                className={`flex-1 py-3 rounded-xl ${
                  formData.platform === platform ? "bg-primary" : "bg-surface"
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-center font-semibold ${
                    formData.platform === platform ? "text-background" : "text-foreground"
                  }`}
                >
                  {platform}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-sm text-foreground mb-1">交易对 (逗号分隔)</Text>
          <TextInput
            value={formData.pairs}
            onChangeText={(text) => setFormData({ ...formData, pairs: text })}
            placeholder="例如: EURUSD, GBPUSD, XAUUSD"
            placeholderTextColor={colors.muted}
            className="bg-surface text-foreground px-4 py-3 rounded-xl mb-3"
          />

          <Text className="text-sm text-foreground mb-1">时间周期</Text>
          <TextInput
            value={formData.timeframe}
            onChangeText={(text) => setFormData({ ...formData, timeframe: text })}
            placeholder="例如: H1, H4, D1"
            placeholderTextColor={colors.muted}
            className="bg-surface text-foreground px-4 py-3 rounded-xl mb-3"
          />
        </View>

        {/* 实盘数据 */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">实盘数据</Text>

          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-sm text-foreground mb-1">总收益率 (%)</Text>
              <TextInput
                value={formData.totalReturn}
                onChangeText={(text) => setFormData({ ...formData, totalReturn: text })}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                className="bg-surface text-foreground px-4 py-3 rounded-xl"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-foreground mb-1">胜率 (%)</Text>
              <TextInput
                value={formData.winRate}
                onChangeText={(text) => setFormData({ ...formData, winRate: text })}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                className="bg-surface text-foreground px-4 py-3 rounded-xl"
              />
            </View>
          </View>

          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-sm text-foreground mb-1">最大回撤 (%)</Text>
              <TextInput
                value={formData.maxDrawdown}
                onChangeText={(text) => setFormData({ ...formData, maxDrawdown: text })}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                className="bg-surface text-foreground px-4 py-3 rounded-xl"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-foreground mb-1">夏普比率</Text>
              <TextInput
                value={formData.sharpeRatio}
                onChangeText={(text) => setFormData({ ...formData, sharpeRatio: text })}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                className="bg-surface text-foreground px-4 py-3 rounded-xl"
              />
            </View>
          </View>
        </View>

        {/* 下载和定价 */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">下载和定价</Text>

          <Text className="text-sm text-foreground mb-1">下载链接</Text>
          <TextInput
            value={formData.downloadUrl}
            onChangeText={(text) => setFormData({ ...formData, downloadUrl: text })}
            placeholder="EA文件下载地址"
            placeholderTextColor={colors.muted}
            className="bg-surface text-foreground px-4 py-3 rounded-xl mb-3"
          />

          <Text className="text-sm text-foreground mb-1">封面图片URL</Text>
          <TextInput
            value={formData.coverImage}
            onChangeText={(text) => setFormData({ ...formData, coverImage: text })}
            placeholder="策略封面图片地址"
            placeholderTextColor={colors.muted}
            className="bg-surface text-foreground px-4 py-3 rounded-xl mb-3"
          />

          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-foreground">免费策略</Text>
            <TouchableOpacity
              onPress={() => setFormData({ ...formData, isFree: !formData.isFree })}
              className={`w-12 h-6 rounded-full ${formData.isFree ? "bg-success" : "bg-muted"}`}
              activeOpacity={0.7}
            >
              <View
                className={`w-5 h-5 rounded-full bg-background mt-0.5 ${
                  formData.isFree ? "ml-6" : "ml-0.5"
                }`}
              />
            </TouchableOpacity>
          </View>

          {!formData.isFree && (
            <>
              <Text className="text-sm text-foreground mb-1">价格</Text>
              <TextInput
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                className="bg-surface text-foreground px-4 py-3 rounded-xl mb-3"
              />
            </>
          )}
        </View>

        {/* 联系方式 */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">联系方式</Text>

          <Text className="text-sm text-foreground mb-1">Telegram群组</Text>
          <TextInput
            value={formData.telegramGroup}
            onChangeText={(text) => setFormData({ ...formData, telegramGroup: text })}
            placeholder="Telegram群组链接或ID"
            placeholderTextColor={colors.muted}
            className="bg-surface text-foreground px-4 py-3 rounded-xl mb-3"
          />

          <Text className="text-sm text-foreground mb-1">QQ群号</Text>
          <TextInput
            value={formData.qqGroup}
            onChangeText={(text) => setFormData({ ...formData, qqGroup: text })}
            placeholder="QQ群号"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            className="bg-surface text-foreground px-4 py-3 rounded-xl mb-3"
          />
        </View>

        {/* 发布状态 */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">发布状态</Text>
          <View className="flex-row gap-2">
            {[
              { label: "草稿", value: "draft" },
              { label: "已发布", value: "published" },
              { label: "已归档", value: "archived" },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setFormData({ ...formData, status: option.value as any })}
                className={`flex-1 py-3 rounded-xl ${
                  formData.status === option.value ? "bg-primary" : "bg-surface"
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-center font-semibold ${
                    formData.status === option.value ? "text-background" : "text-foreground"
                  }`}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 提交按钮 */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={createMutation.isPending || updateMutation.isPending}
          className="bg-primary py-4 rounded-xl items-center"
          activeOpacity={0.8}
        >
          {createMutation.isPending || updateMutation.isPending ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text className="text-background font-bold text-base">
              {isEdit ? "保存修改" : "创建策略"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
