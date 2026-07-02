import { StyleSheet, Text, View } from "react-native";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import type { AppColors, StrategyDetailData } from "./types";

type StrategyHeaderProps = {
  strategy: StrategyDetailData;
  colors: AppColors;
  isFeatured: boolean;
  tagList: string[];
};

export function StrategyHeader({ strategy, colors, isFeatured, tagList }: StrategyHeaderProps) {
  return (
    <View style={styles.titleSection}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: isFeatured ? "#A8895A" : colors.foreground, flex: 1 }]}>
          {strategy.title}
        </Text>
      </View>

      {tagList.length > 0 && (
        <View style={styles.tagRow}>
          {tagList.map((tag) => (
            <View key={tag} style={[styles.tagChip, { backgroundColor: colors.primary + "15" }]}>
              <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <RichTextRenderer
        html={strategy.richDescription}
        fallback={strategy.description}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  titleSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 32,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
