import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useState, useEffect } from "react";
import { getAdminStats } from "@/lib/admin-api";

export default function AdminDashboard() {
  const router = useRouter();
  const colors = useColors();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then((data) => setStats(data))
      .catch((err) => console.error("Failed to load stats:", err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const menuItems = [
    {
      title: "📊 策略管理",
      route: "/admin/strategies",
      count: stats?.totalStrategies || 0,
      description: "管理所有EA策略",
    },
    {
      title: "💬 评论审核",
      route: "/admin/comments",
      count: stats?.totalComments || 0,
      description: "审核用户匿名留言",
    },
    {
      title: "🤝 合购申请",
      route: "/admin/group-buys",
      count: 0,
      description: "查看和审核合购申请",
    },
    {
      title: "📦 上架申请",
      route: "/admin/listings",
      count: 0,
      description: "查看和审核EA上架申请",
    },
    {
      title: "📢 通知公告",
      route: "/admin/notifications",
      count: 0,
      description: "管理订阅页面通知公告",
    },
    {
      title: "📬 订阅页面管理",
      route: "/admin/page-contents",
      count: 0,
      description: "管理订阅页面展示内容",
    },
    {
      title: "📧 订阅用户",
      route: "/admin/subscribers",
      count: 0,
      description: "查看邮箱订阅用户列表",
    },
    {
      title: "📞 联系方式设置",
      route: "/admin/contact-settings",
      count: 0,
      description: "设置上架EA弹窗的联系方式",
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* 标题 */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">🔧 管理员后台</Text>
          <Text className="text-base text-muted">管理平台内容和数据</Text>
        </View>

        {/* 数据统计 */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">数据概览</Text>
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4">
              <Text className="text-sm text-muted mb-1">总策略数</Text>
              <Text className="text-3xl font-bold text-primary">{stats?.totalStrategies || 0}</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4">
              <Text className="text-sm text-muted mb-1">已发布</Text>
              <Text className="text-3xl font-bold text-success">{stats?.publishedStrategies || 0}</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4">
              <Text className="text-sm text-muted mb-1">总下载</Text>
              <Text className="text-3xl font-bold text-foreground">{stats?.totalDownloads || 0}</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-surface rounded-2xl p-4">
              <Text className="text-sm text-muted mb-1">总购买</Text>
              <Text className="text-3xl font-bold text-warning">{stats?.totalPurchases || 0}</Text>
            </View>
          </View>
        </View>

        {/* 功能菜单 */}
        <View>
          <Text className="text-lg font-semibold text-foreground mb-4">管理功能</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>
                  {item.title}
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>{item.description}</Text>
              </View>
              <Text style={{ fontSize: 18, color: colors.muted }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
