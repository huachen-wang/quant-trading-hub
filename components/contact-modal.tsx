import { View, Text, Modal, TouchableOpacity, Linking } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "./ui/icon-symbol";

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ContactModal({ visible, onClose }: ContactModalProps) {
  const colors = useColors();

  const contactMethods = [
    {
      icon: "paperplane.fill" as const,
      label: "Telegram",
      value: "@YourTelegramChannel",
      link: "https://t.me/YourTelegramChannel",
    },
    {
      icon: "bubble.left.fill" as const,
      label: "QQ群",
      value: "123456789",
      link: null,
    },
    {
      icon: "message.fill" as const,
      label: "微信",
      value: "YourWeChatID",
      link: null,
    },
  ];

  const handlePress = (link: string | null, value: string) => {
    if (link) {
      Linking.openURL(link);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/50 items-center justify-center p-6"
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-background rounded-3xl p-6"
        >
          {/* 标题 */}
          <View className="items-center mb-6">
            <Text className="text-2xl font-bold text-foreground mb-2">联系我们</Text>
            <Text className="text-sm text-muted text-center">
              上架EA策略 | 代挂合作服务
            </Text>
          </View>

          {/* 联系方式列表 */}
          <View className="mb-6">
            {contactMethods.map((method, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handlePress(method.link, method.value)}
                className="flex-row items-center bg-surface rounded-2xl p-4 mb-3"
                activeOpacity={0.7}
              >
                <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mr-4">
                  <IconSymbol name={method.icon} size={24} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-muted mb-1">{method.label}</Text>
                  <Text className="text-base font-semibold text-foreground">{method.value}</Text>
                </View>
                {method.link && (
                  <IconSymbol name="chevron.right" size={20} color={colors.muted} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* 说明 */}
          <View className="bg-primary/5 rounded-2xl p-4 mb-6">
            <Text className="text-sm text-foreground leading-relaxed">
              我们提供专业的EA策略代挂服务,帮助您的策略获得更多曝光和下载。欢迎通过以上方式联系我们洽谈合作。
            </Text>
          </View>

          {/* 关闭按钮 */}
          <TouchableOpacity
            onPress={onClose}
            className="bg-primary rounded-full py-3 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-background font-semibold text-base">关闭</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
