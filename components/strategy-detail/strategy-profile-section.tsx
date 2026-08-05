import { StyleSheet, Text, View } from "react-native";
import type { StrategyProfile } from "@/lib/strategy-profile";
import type { AppColors } from "./types";

type StrategyProfileSectionProps = {
  profile: StrategyProfile;
  colors: AppColors;
  accent: string;
  isDesktop: boolean;
};

export function StrategyProfileSection({
  profile,
  colors,
  accent,
  isDesktop,
}: StrategyProfileSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          执行档案
        </Text>
        <Text style={[styles.headingMeta, { color: colors.muted }]}>
          STRATEGY PROFILE
        </Text>
      </View>

      <View style={[styles.profileGrid, { borderColor: colors.border }]}>
        {profile.items.map((item, index) => (
          <View
            key={item.label}
            style={[
              styles.profileItem,
              { borderColor: colors.border },
              isDesktop && styles.profileItemDesktop,
              isDesktop && index % 2 === 1 && styles.profileItemDesktopRight,
            ]}
          >
            <View style={[styles.accentRule, { backgroundColor: accent }]} />
            <Text style={[styles.itemLabel, { color: colors.muted }]}>
              {item.label}
            </Text>
            <Text style={[styles.itemValue, { color: colors.foreground }]}>
              {item.value}
            </Text>
            <Text style={[styles.itemNote, { color: colors.muted }]}>
              {item.note}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.profileNote, { color: colors.muted }]}>
        {profile.note}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 9,
  },
  heading: {
    fontSize: 17,
    fontWeight: "800",
  },
  headingMeta: {
    fontSize: 9,
    fontWeight: "800",
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
  },
  profileItem: {
    width: "100%",
    minWidth: 0,
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  profileItemDesktop: {
    width: "50%",
    paddingHorizontal: 12,
  },
  profileItemDesktopRight: {
    borderLeftWidth: 1,
  },
  accentRule: {
    width: 22,
    height: 2,
    marginBottom: 8,
  },
  itemLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  itemValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  itemNote: {
    fontSize: 11,
    lineHeight: 17,
  },
  profileNote: {
    fontSize: 10,
    lineHeight: 16,
    marginTop: 9,
  },
});
