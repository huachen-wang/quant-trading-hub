import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { V2 } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import {
  buildCommunityEntries,
  type CommunityEntry,
  type CommunityGroupKey,
} from "@/shared/community-contacts";

/**
 * 交流群 + 客服列表：联系方式弹窗、页脚、商品详情页购买区共用这一份行样式。
 * 号码与链接统一来自 shared/community-contacts.ts；客服三项优先读后台联系设置。
 */
export function useCommunityEntries(enabled = true): CommunityEntry[] {
  const { data } = trpc.siteSettings.getContact.useQuery(undefined, {
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  return buildCommunityEntries(data as Record<string, string> | undefined);
}

const ICONS: Record<CommunityEntry["icon"], keyof typeof MaterialIcons.glyphMap> = {
  telegram: "send",
  qq: "forum",
  wechat: "chat",
};

const GROUP_ORDER: CommunityGroupKey[] = ["community", "support"];

type CommunityContactListProps = {
  entries: CommunityEntry[];
  /** 紧凑行：用在商品详情页购买区这类窄位置。 */
  compact?: boolean;
  /** 多列排布（页脚桌面端）。 */
  columns?: 1 | 2;
};

export function CommunityContactList({
  entries,
  compact = false,
  columns = 1,
}: CommunityContactListProps) {
  const { text } = useLanguage();
  const [copiedId, setCopiedId] = useState("");

  const groupTitle = (group: CommunityGroupKey) =>
    group === "community"
      ? text("交流群", "Groups", "المجموعات")
      : text("客服", "Support", "الدعم");

  const handlePress = async (entry: CommunityEntry) => {
    if (entry.href) {
      await Linking.openURL(entry.href);
      return;
    }
    try {
      await globalThis.navigator?.clipboard?.writeText(entry.value);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(""), 1600);
    } catch {
      setCopiedId("");
    }
  };

  return (
    <View style={[styles.groups, columns === 2 && styles.groupsTwoColumns]}>
      {GROUP_ORDER.map((group) => {
        const rows = entries.filter((entry) => entry.group === group);
        if (rows.length === 0) return null;
        return (
          <View key={group} style={[styles.group, columns === 2 && styles.groupColumn]}>
            <Text style={styles.groupTitle}>{groupTitle(group)}</Text>
            {rows.map((entry) => {
              const copied = copiedId === entry.id;
              const label = text(entry.label.zh, entry.label.en, entry.label.ar);
              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole={entry.href ? "link" : "button"}
                  accessibilityLabel={`${label} ${entry.value}`}
                  onPress={() => void handlePress(entry)}
                  style={({ pressed }) => [
                    styles.row,
                    compact && styles.rowCompact,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={[styles.icon, compact && styles.iconCompact]}>
                    <MaterialIcons
                      name={ICONS[entry.icon]}
                      size={compact ? 16 : 19}
                      color={V2.gold}
                    />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.label}>{label}</Text>
                    <Text
                      style={[styles.value, compact && styles.valueCompact]}
                      numberOfLines={1}
                      selectable
                    >
                      {entry.value}
                    </Text>
                  </View>
                  <View style={styles.action}>
                    <Text style={[styles.actionText, copied && styles.actionTextSuccess]}>
                      {copied
                        ? text("已复制", "Copied", "تم النسخ")
                        : entry.href
                          ? text("打开", "Open", "فتح")
                          : text("复制", "Copy", "نسخ")}
                    </Text>
                    <MaterialIcons
                      name={copied ? "check" : entry.href ? "open-in-new" : "content-copy"}
                      size={14}
                      color={copied ? V2.green : V2.textMuted}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: 12 },
  groupsTwoColumns: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  group: { gap: 7 },
  groupColumn: { flexGrow: 1, flexBasis: 300, minWidth: 0 },
  groupTitle: { color: V2.gold, fontSize: 11, fontWeight: "900" },
  row: {
    minHeight: 54,
    padding: 9,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 5,
    backgroundColor: V2.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowCompact: { minHeight: 44, paddingVertical: 6, gap: 8 },
  rowPressed: {
    borderColor: "rgba(216,188,131,0.64)",
    backgroundColor: "rgba(216,188,131,0.07)",
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 4,
    backgroundColor: "rgba(216,188,131,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCompact: { width: 28, height: 28 },
  info: { flex: 1, minWidth: 0, gap: 2 },
  label: { color: V2.textMuted, fontSize: 10, fontWeight: "800" },
  value: { color: V2.text, fontSize: 13, fontWeight: "900" },
  valueCompact: { fontSize: 12 },
  action: {
    minWidth: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  actionText: { color: V2.textMuted, fontSize: 10, fontWeight: "900" },
  actionTextSuccess: { color: V2.green },
});
