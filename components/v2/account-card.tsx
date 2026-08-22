import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceAccount } from "@/shared/v2/contracts";
import { EquityChart } from "./equity-chart";
import { formatMoney, formatPct } from "./format";
import { StatusBadge } from "./status-badge";
import { V2 } from "./tokens";

export function AccountCard({ account, onPress }: { account: ServiceAccount; onPress: () => void }) {
  const managed = account.serviceMode === "MANAGED_CONTRACT";
  const modeColor = managed ? V2.gold : V2.blue;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`查看 ${account.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.heading}>
        <View style={[styles.modeIcon, { borderColor: `${modeColor}55`, backgroundColor: `${modeColor}12` }]}>
          <MaterialIcons name={managed ? "description" : "account-tree"} size={21} color={modeColor} />
        </View>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>{account.name}</Text>
          <Text style={[styles.mode, { color: modeColor }]}>{managed ? "签约管理" : "自主分仓"}</Text>
        </View>
        <StatusBadge compact dataMode={account.source.dataMode} freshness={account.source.freshness} />
      </View>
      <View style={styles.equityLine}>
        <View>
          <Text style={styles.equityLabel}>当前权益</Text>
          <Text style={styles.equityValue}>{formatMoney(account.equity, account.currency)}</Text>
        </View>
        <Text style={[styles.pnl, { color: (account.totalPnlPct ?? 0) >= 0 ? V2.green : V2.red }]}>
          {formatPct(account.totalPnlPct, true)}
        </Text>
      </View>
      <EquityChart points={account.equitySeries.slice(-30)} color={modeColor} height={88} />
      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricLabel}>今日盈亏</Text><Text style={styles.metricValue}>{formatMoney(account.todayPnl, account.currency, true)}</Text></View>
        <View style={styles.metric}><Text style={styles.metricLabel}>最大回撤</Text><Text style={styles.metricValue}>{formatPct(account.maxDrawdownPct)}</Text></View>
        <View style={styles.metric}><Text style={styles.metricLabel}>平台</Text><Text style={styles.metricValue}>{account.platformIds.length}</Text></View>
      </View>
      <View style={styles.footer}>
        <View style={styles.connection}>
          <View style={[styles.connectionDot, { backgroundColor: account.connectionStatus === "CONNECTED" ? V2.green : account.connectionStatus === "DISCONNECTED" ? V2.red : V2.amber }]} />
          <Text style={styles.connectionText}>{account.connectionStatus === "CONNECTED" ? "连接正常" : account.connectionStatus === "DEGRADED" ? "部分延迟" : account.connectionStatus === "DISCONNECTED" ? "连接中断" : "等待连接"}</Text>
        </View>
        <View style={styles.open}><Text style={styles.openText}>查看账户</Text><MaterialIcons name="arrow-forward" size={15} color={V2.text} /></View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0, padding: 16, gap: 14, borderWidth: 1, borderColor: V2.border, borderRadius: 6, backgroundColor: V2.backgroundRaised },
  pressed: { opacity: 0.78, transform: [{ translateY: 1 }] },
  heading: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10 },
  modeIcon: { width: 43, height: 43, borderWidth: 1, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  titleCopy: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: V2.text, fontSize: 15, lineHeight: 20, fontWeight: "900" },
  mode: { fontSize: 10, fontWeight: "900" },
  equityLine: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  equityLabel: { color: V2.textDim, fontSize: 10 },
  equityValue: { marginTop: 4, color: V2.text, fontSize: 21, lineHeight: 27, fontWeight: "900" },
  pnl: { fontSize: 13, fontWeight: "900" },
  metrics: { minHeight: 52, flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: V2.border },
  metric: { flex: 1, justifyContent: "center", gap: 3 },
  metricLabel: { color: V2.textDim, fontSize: 10 },
  metricValue: { color: V2.text, fontSize: 12, fontWeight: "800" },
  footer: { minHeight: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  connection: { flexDirection: "row", alignItems: "center", gap: 6 },
  connectionDot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { color: V2.textMuted, fontSize: 10 },
  open: { flexDirection: "row", alignItems: "center", gap: 4 },
  openText: { color: V2.text, fontSize: 11, fontWeight: "800" },
});
