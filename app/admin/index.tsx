import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function AdminDashboard() {
  const router = useRouter();
  const colors = useColors();
  const { data: stats, isLoading } = trpc.admin.stats.overview.useQuery();

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
      icon: "chart.line.uptrend.xyaxis" as const,
      route: "/admin/strategies",
      count: stats?.totalStrategies || 0,
      description: "管理所有EA策略",
    },
    {
      title: "💬 评论审核",
      icon: "ellipsis.circle" as const,
      route: "/admin/comments",
      count: stats?.totalComments || 0,
      description: "审核用户匿名留言",
    },
    {
      title: "🤝 合购申请",
      icon: "paperplane.fill" as const,
      route: "/admin/group-buys",
      count: 0,
      description: "查看和审核合购申请",
    },
    {
      title: "📦 上架申请",
      icon: "tray.full" as const,
      route: "/admin/listings",
      count: 0,
      description: "查看和审核EA上架申请",
    },
    {
      title: "📢 通知公告",
      icon: "bell.fill" as const,
      route: "/admin/notifications",
      count: 0,
      description: "管理订阅页面通知公告",
    },
    {
      title: "📬 订阅页面管理",
      icon: "paperplane.fill" as const,
      route: "/admin/page-contents",
      count: 0,
      description: "管理订阅页面展示内容",
    },
    {
      title: "📧 订阅用户",
      icon: "paperplane.fill" as const,
      route: "/admin/subscribers",
      count: 0,
      description: "查看邮箱订阅用户列表",
    },
    {
      title: "📞 联系方式设置",
      icon: "message.fill" as const,
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
              <Text className="text-3xl font-bold text-accent">{stats?.totalDownloads || 0}</Text>
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
              className="bg-surface rounded-2xl p-4 mb-3 flex-row items-center"
              activeOpacity={0.7}
            >
              <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-4">
                <IconSymbol name={item.icon} size={24} color={colors.primary} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Text className="text-lg font-semibold text-foreground mr-2">{item.title}</Text>
                </View>
                <Text className="text-sm text-muted">{item.description}</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
