import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { SourceMeta } from "@/shared/v2/contracts";
import { formatMoney, formatPct } from "./format";
import { V2 } from "./tokens";

export type LiveFeedItem = {
  id: string;
  name: string;
  accent: string;
  changePct: number | null;
  changeLabel: string;
  equity: number | null;
  equityLabel: string;
  href?: string;
};

type LiveFeedStripProps = {
  items: LiveFeedItem[];
  source: SourceMeta;
  isFetching: boolean;
  refreshKey: number;
  isMobile: boolean;
  onOpen: (item: LiveFeedItem) => void;
};

function timeOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function sourceName(source: SourceMeta) {
  if (source.dataMode === "DEMO") return "DEMO FEED";
  if (/niubang/i.test(`${source.provider} ${source.label}`)) {
    if (source.freshness === "FRESH") return "NIUBANG LIVE";
    if (source.freshness === "STALE") return "NIUBANG 延迟";
    return "NIUBANG 离线";
  }
  return source.dataMode;
}

function displayItemName(item: LiveFeedItem, source: SourceMeta) {
  const neutralName = item.name.replace(/稳定盈利[！!]*/g, "公开观察");
  return source.dataMode === "DEMO"
    ? neutralName.replace(/实盘/g, "演示")
    : neutralName;
}

export function LiveFeedStrip({
  items,
  source,
  isFetching,
  refreshKey,
  isMobile,
  onOpen,
}: LiveFeedStripProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 680,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulse, refreshKey]);

  const label = sourceName(source);
  const statusText =
    source.dataMode === "DEMO"
      ? isFetching
        ? "刷新演示"
        : "模拟演示"
      : source.freshness === "OFFLINE"
        ? "链路离线"
        : isFetching
          ? "正在同步"
          : source.freshness === "STALE"
            ? "数据延迟"
            : "链路已同步";
  const tickerNodes = useMemo(
    () =>
      items.map((item) => {
        const positive = item.changePct !== null && item.changePct >= 0;
        const displayName = displayItemName(item, source);
        return (
          <Pressable
            key={item.id}
            accessibilityRole="link"
            accessibilityLabel={`查看 ${displayName} ${item.changeLabel}数据`}
            onPress={() => onOpen(item)}
            style={({ pressed }) => [
              styles.ticker,
              isMobile && styles.tickerMobile,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.tickerTop}>
              <View
                style={[styles.strategyDot, { backgroundColor: item.accent }]}
              />
              <Text style={styles.tickerName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.changeLabel}>{item.changeLabel}</Text>
              <Text
                style={[
                  styles.todayValue,
                  { color: positive ? V2.green : V2.red },
                ]}
              >
                {formatPct(item.changePct, true)}
              </Text>
            </View>
            <View style={styles.tickerBottom}>
              <Text style={styles.tickerMeta}>{item.equityLabel}</Text>
              <Text style={styles.equityValue} numberOfLines={1}>
                {formatMoney(item.equity, "USD", true)}
              </Text>
            </View>
          </Pressable>
        );
      }),
    [isMobile, items, onOpen, source],
  );

  return (
    <View style={[styles.strip, isMobile && styles.stripMobile]}>
      <View style={[styles.feedState, isMobile && styles.feedStateMobile]}>
        <Animated.View
          style={[
            styles.refreshRail,
            {
              backgroundColor:
                source.freshness === "OFFLINE" ? V2.red : V2.green,
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 1],
              }),
              transform: [
                {
                  scaleY: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.55, 1],
                  }),
                },
              ],
            },
          ]}
        />
        <View style={styles.feedHeading}>
          <MaterialIcons
            name={isFetching ? "sync" : "sensors"}
            size={16}
            color={source.freshness === "OFFLINE" ? V2.red : V2.green}
          />
          <Text style={styles.feedProvider} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <View style={styles.feedMetaRow}>
          <Text style={styles.feedStatus}>{statusText}</Text>
          <Text style={styles.feedTime}>RX {timeOnly(source.receivedAt)}</Text>
        </View>
      </View>

      {isMobile ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tickerScroller}
          contentContainerStyle={styles.tickerScrollerContent}
        >
          {tickerNodes}
        </ScrollView>
      ) : (
        <View style={styles.tickerRow}>{tickerNodes}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: 58,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
    flexDirection: "row",
    backgroundColor: V2.backgroundRaised,
  },
  stripMobile: { minHeight: 62 },
  feedState: {
    width: 164,
    paddingHorizontal: 12,
    justifyContent: "center",
    gap: 5,
    position: "relative",
  },
  feedStateMobile: { width: 124, paddingHorizontal: 10 },
  refreshRail: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 2,
  },
  feedHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  feedProvider: {
    minWidth: 0,
    flexShrink: 1,
    color: V2.text,
    fontSize: 10,
    fontWeight: "900",
  },
  feedMetaRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  feedStatus: { color: V2.textMuted, fontSize: 8, fontWeight: "700" },
  feedTime: { color: V2.textDim, fontSize: 8 },
  tickerRow: { flex: 1, minWidth: 0, flexDirection: "row" },
  tickerScroller: { flex: 1 },
  tickerScrollerContent: { paddingRight: 6 },
  ticker: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    justifyContent: "center",
    gap: 5,
    borderLeftWidth: 1,
    borderLeftColor: V2.border,
  },
  tickerMobile: {
    width: 148,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 148,
  },
  tickerTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  strategyDot: { width: 4, height: 12, borderRadius: 2 },
  tickerName: {
    flex: 1,
    minWidth: 0,
    color: V2.text,
    fontSize: 9,
    fontWeight: "900",
  },
  changeLabel: { color: V2.textDim, fontSize: 7 },
  todayValue: { fontSize: 9, fontWeight: "900" },
  tickerBottom: { flexDirection: "row", alignItems: "center", gap: 5 },
  tickerMeta: { color: V2.textDim, fontSize: 7 },
  equityValue: { color: V2.textMuted, fontSize: 8, fontWeight: "800" },
  pressed: { opacity: 0.68 },
});
