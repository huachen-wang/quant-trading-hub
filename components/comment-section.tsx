import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

interface CommentSectionProps {
  strategyId: number;
}

export function CommentSection({ strategyId }: CommentSectionProps) {
  const colors = useColors();
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: comments, isLoading, refetch } = trpc.anonymousComments.list.useQuery({
    strategyId,
    limit: 50,
  });

  const createCommentMutation = trpc.anonymousComments.create.useMutation({
    onSuccess: () => {
      setNickname("");
      setContent("");
      refetch();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error) => {
      Alert.alert("提交失败", error.message);
    },
  });

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert("提示", "请输入留言内容");
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setIsSubmitting(true);
    try {
      await createCommentMutation.mutateAsync({
        strategyId,
        nickname: nickname.trim() || undefined,
        content: content.trim(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  return (
    <View className="mt-6">
      {/* 标题 */}
      <Text className="text-xl font-bold text-foreground mb-4">用户评价</Text>

      {/* 发表留言 */}
      <View className="bg-surface rounded-2xl p-4 mb-4">
        <TextInput
          className="bg-background rounded-xl px-4 py-3 text-base text-foreground mb-3"
          placeholder="昵称(可选)"
          placeholderTextColor={colors.muted}
          value={nickname}
          onChangeText={setNickname}
          maxLength={100}
        />
        <TextInput
          className="bg-background rounded-xl px-4 py-3 text-base text-foreground mb-3"
          placeholder="分享你的使用体验..."
          placeholderTextColor={colors.muted}
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={1000}
        />
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || !content.trim()}
          className={`py-3 rounded-xl ${isSubmitting || !content.trim() ? "bg-muted" : "bg-primary"}`}
          activeOpacity={0.8}
        >
          <Text className="text-center text-background font-semibold text-base">
            {isSubmitting ? "提交中..." : "发表评价"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 留言列表 */}
      {isLoading ? (
        <View className="py-8">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : comments && comments.length > 0 ? (
        <FlatList
          data={comments}
          scrollEnabled={false}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View className="bg-surface rounded-2xl p-4 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-semibold text-foreground">
                  {item.nickname || "匿名用户"}
                </Text>
                <Text className="text-sm text-muted">{formatDate(item.createdAt)}</Text>
              </View>
              <Text className="text-base text-foreground leading-relaxed">{item.content}</Text>
            </View>
          )}
        />
      ) : (
        <View className="py-8">
          <Text className="text-center text-muted text-base">暂无评价,快来抢沙发吧~</Text>
        </View>
      )}
    </View>
  );
}
