import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { usePathname } from "expo-router";
import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ContactModal } from "@/components/contact-modal";
import { V2 } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
import { CommunityContactList, useCommunityEntries } from "./community-contacts";

/**
 * 全站四处入口：顶栏「加入交流群」、页脚、商品详情页购买区（见 strategy-purchase-panel）、手机悬浮按钮。
 * 点开的都是同一个联系方式弹窗（community 模式，直接停在「交流群 · 客服」页签）。
 */

/** 顶栏按钮：桌面写「加入交流群」，窄屏只写「交流群」。 */
export function CommunityHeaderButton({
  compact = false,
  iconOnly = false,
}: {
  compact?: boolean;
  /** 特别窄的屏（顶栏右侧还有导航和咨询两个悬浮按钮）只留图标，文字入口交给右下角悬浮按钮。 */
  iconOnly?: boolean;
}) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text("加入交流群", "Join the group", "انضم إلى المجموعة")}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.headerButton,
          compact && styles.headerButtonCompact,
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons name="groups" size={compact ? 16 : 18} color={V2.gold} />
        {iconOnly ? null : (
          <Text style={[styles.headerText, compact && styles.headerTextCompact]} numberOfLines={1}>
            {compact
              ? text("交流群", "Group", "المجموعة")
              : text("加入交流群", "Join the group", "انضم إلى المجموعة")}
          </Text>
        )}
      </Pressable>
      <ContactModal visible={open} onClose={() => setOpen(false)} variant="community" />
    </>
  );
}

/** 页脚：交流群 + 客服，全部可点（打开或复制）。 */
export function CommunityFooter() {
  const { text } = useLanguage();
  const { width } = useWindowDimensions();
  const entries = useCommunityEntries();
  const wide = width >= 900;
  return (
    <View style={[styles.footer, width < 768 && styles.footerWithFab]}>
      <View style={[styles.footerInner, wide && styles.footerInnerWide]}>
        <Text style={styles.footerTitle}>{text("交流群 · 客服", "Groups · Support", "المجموعات · الدعم")}</Text>
        <CommunityContactList entries={entries} columns={wide ? 2 : 1} />
      </View>
    </View>
  );
}

/** 商品详情页购买 / 咨询按钮下面的一块（紧凑行）。 */
export function CommunityInlineCard() {
  const entries = useCommunityEntries();
  return (
    <View style={styles.inline}>
      <CommunityContactList entries={entries} compact />
    </View>
  );
}

const HIDDEN_PREFIXES = ["/admin", "/auth", "/checkout", "/oauth", "/dev"];

/** 手机端（窄屏 Web）右下角悬浮按钮。后台、登录、结账页不显示。 */
export function CommunityFab() {
  const { text } = useLanguage();
  const pathname = usePathname() || "/";
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  if (Platform.OS !== "web" || width === 0 || width >= 768) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
    return null;
  }
  return (
    <>
      <View pointerEvents="box-none" style={styles.fabWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text("加入交流群", "Join the group", "انضم إلى المجموعة")}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        >
          <MaterialIcons name="groups" size={18} color={V2.background} />
          <Text style={styles.fabText}>{text("交流群", "Group", "المجموعة")}</Text>
        </Pressable>
      </View>
      <ContactModal visible={open} onClose={() => setOpen(false)} variant="community" />
    </>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    height: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.66)",
    borderRadius: 4,
    backgroundColor: "rgba(216,188,131,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexShrink: 0,
  },
  headerButtonCompact: { height: 34, paddingHorizontal: 8, gap: 4 },
  headerText: { color: V2.gold, fontSize: 12, fontWeight: "900" },
  headerTextCompact: { fontSize: 11 },
  footer: {
    marginTop: 28,
    paddingTop: 22,
    paddingBottom: 28,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    backgroundColor: V2.backgroundRaised,
  },
  /* 手机端右下角有悬浮按钮，给最后一行留出位置 */
  footerWithFab: { paddingBottom: 84 },
  footerInner: { width: "100%", maxWidth: 1360, alignSelf: "center", gap: 12 },
  footerInnerWide: { paddingHorizontal: 12 },
  footerTitle: { color: V2.text, fontSize: 15, fontWeight: "900" },
  inline: { marginTop: 12 },
  fabWrap: {
    position: "absolute",
    right: 14,
    bottom: 18,
    zIndex: 998,
  },
  fab: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: V2.gold,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    ...(Platform.OS === "web" ? { boxShadow: "0 6px 18px rgba(0,0,0,0.45)" } : {}),
  },
  fabText: { color: V2.background, fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.72 },
});
