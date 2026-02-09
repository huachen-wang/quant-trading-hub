import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export default function CreateGroupBuyScreen() {
  const router = useRouter();
  const colors = useColors();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [eaName, setEaName] = useState("");
  const [eaDescription, setEaDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createRequestMutation = trpc.groupBuys.requestGroupBuy.useMutation({
    onSuccess: () => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "提交成功",
        "您的合购申请已提交,我们会尽快审核并上架。审核通过后会通过您留下的联系方式通知您。",
        [
          {
            text: "确定",
            onPress: () => router.back(),
          },
        ]
      );
    },
    onError: (error) => {
      Alert.alert("提交失败", error.message);
    },
  });

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("提示", "请输入您的姓名");
      return;
    }
    if (!contact.trim()) {
      Alert.alert("提示", "请输入联系方式");
      return;
    }
    if (!eaName.trim()) {
      Alert.alert("提示", "请输入EA名称");
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setIsSubmitting(true);
    try {
      await createRequestMutation.mutateAsync({
        name: name.trim(),
        contact: contact.trim(),
        eaName: eaName.trim(),
        eaDescription: eaDescription.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* 返回按钮 */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-surface rounded-full items-center justify-center mb-4"
          activeOpacity={0.7}
        >
          <Text className="text-xl">←</Text>
        </TouchableOpacity>

        {/* 标题 */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-foreground mb-2">🤝 发起合购</Text>
          <Text className="text-sm text-muted leading-relaxed">
            填写以下信息提交合购申请,我们会审核并联系您确认详情后上架。
          </Text>
        </View>

        {/* 平台优势说明 */}
        <View className="bg-primary/10 rounded-2xl p-4 mb-6">
          <Text className="text-base font-semibold text-primary mb-2">🚀 我们的优势</Text>
          <Text className="text-sm text-foreground leading-relaxed mb-1">
            ✓ 覆盖多个社交媒体平台(Telegram、QQ、微信等)
          </Text>
          <Text className="text-sm text-foreground leading-relaxed mb-1">
            ✓ 活跃的EA交易者社群,精准触达目标用户
          </Text>
          <Text className="text-sm text-foreground leading-relaxed mb-1">
            ✓ 专业的合购组织和管理经验
          </Text>
          <Text className="text-sm text-foreground leading-relaxed">
            ✓ 快速审核,高效上架
          </Text>
        </View>

        {/* 表单 */}
        <View className="bg-surface rounded-2xl p-4 mb-6">
          {/* 姓名 */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">您的姓名 *</Text>
            <TextInput
              className="bg-background rounded-xl px-4 py-3 text-base text-foreground"
              placeholder="请输入您的姓名或昵称"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              maxLength={100}
            />
          </View>

          {/* 联系方式 */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">联系方式 *</Text>
            <TextInput
              className="bg-background rounded-xl px-4 py-3 text-base text-foreground"
              placeholder="Telegram/QQ/微信/邮箱"
              placeholderTextColor={colors.muted}
              value={contact}
              onChangeText={setContact}
              maxLength={255}
            />
            <Text className="text-xs text-muted mt-1">
              我们会通过此联系方式与您沟通合购详情
            </Text>
          </View>

          {/* EA名称 */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">EA名称 *</Text>
            <TextInput
              className="bg-background rounded-xl px-4 py-3 text-base text-foreground"
              placeholder="请输入要合购的EA名称"
              placeholderTextColor={colors.muted}
              value={eaName}
              onChangeText={setEaName}
              maxLength={255}
            />
          </View>

          {/* EA描述 */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">EA描述(可选)</Text>
            <TextInput
              className="bg-background rounded-xl px-4 py-3 text-base text-foreground"
              placeholder="简单描述EA的功能、策略类型、预期价格等"
              placeholderTextColor={colors.muted}
              value={eaDescription}
              onChangeText={setEaDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={2000}
            />
          </View>
        </View>

        {/* 提交按钮 */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || !name.trim() || !contact.trim() || !eaName.trim()}
          className={`rounded-2xl py-4 items-center mb-6 ${
            isSubmitting || !name.trim() || !contact.trim() || !eaName.trim()
              ? "bg-muted"
              : "bg-primary"
          }`}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text className="text-background font-semibold text-lg">提交申请</Text>
          )}
        </TouchableOpacity>

        {/* 说明文字 */}
        <View className="mb-6">
          <Text className="text-xs text-muted text-center leading-relaxed">
            提交后我们会在1-2个工作日内审核并联系您{"\n"}
            审核通过后会展示在合购列表中供用户参与
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
