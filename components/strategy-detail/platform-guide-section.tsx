import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { AppColors } from "./types";

type PlatformGuideSectionProps = {
  colors: AppColors;
  onPress: () => void;
};

export function PlatformGuideSection({ colors, onPress }: PlatformGuideSectionProps) {
  return (
    <View style={styles.section}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[styles.platformGuide, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}
      >
        <View style={styles.platformGuideContent}>
          <Text style={styles.platformGuideEmoji}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.platformGuideTitle, { color: colors.foreground }]}>需要交易环境支持？</Text>
            <Text style={[styles.platformGuideDesc, { color: colors.muted }]}>
              量化军火库帮你匹配最适合这款EA的合规交易平台，让策略发挥最大价值
            </Text>
          </View>
          <Text style={[styles.platformGuideArrow, { color: colors.primary }]}>→</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  platformGuide: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  platformGuideContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  platformGuideEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  platformGuideTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  platformGuideDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  platformGuideArrow: {
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 8,
  },
});
