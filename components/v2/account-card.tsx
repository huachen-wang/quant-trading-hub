import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceAccount } from "@/shared/v2/contracts";
import { useLanguage } from "@/lib/language";
import { EquityChart } from "./equity-chart";
import { formatMoney, formatPct } from "./format";
import { StatusBadge } from "./status-badge";
import { V2 } from "./tokens";

function AccountCardBase({
  account,
  onPress,
}: {
  account: ServiceAccount;
  onPress: (accountId: string) => void;
}) {
  const { locale, text } = useLanguage();
  const managed = account.serviceMode === "MANAGED_CONTRACT";
  const modeColor = managed ? V2.gold : V2.blue;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={text(
        `查看 ${account.name}`,
        `View ${account.name}`,
        `عرض ${account.name}`,
      )}
      onPress={() => onPress(account.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.heading}>
        <View
          style={[
            styles.modeIcon,
            {
              borderColor: `${modeColor}55`,
              backgroundColor: `${modeColor}12`,
            },
          ]}
        >
          <MaterialIcons
            name={managed ? "description" : "account-tree"}
            size={21}
            color={modeColor}
          />
        </View>
        <View style={styles.titleCopy}>
          <Text style={styles.title} numberOfLines={1}>
            {account.name}
          </Text>
          <Text style={[styles.mode, { color: modeColor }]}>
            {managed
              ? text(
                  "AI量化联盟 · 资管账户",
                  "AI Quant Alliance · Managed account",
                  "تحالف EAXAU الكمي · حساب مُدار",
                )
              : text(
                  "AI量化联盟 · 券商账户投影",
                  "AI Quant Alliance · Broker account view",
                  "تحالف EAXAU الكمي · عرض حساب الوسيط",
                )}
          </Text>
        </View>
        <StatusBadge
          compact
          dataMode={account.source.dataMode}
          freshness={account.source.freshness}
        />
      </View>
      <View style={styles.equityLine}>
        <View>
          <Text style={styles.equityLabel}>
            {text("当前权益", "Current equity", "حقوق الحساب الحالية")}
          </Text>
          <Text style={styles.equityValue}>
            {formatMoney(account.equity, account.currency, false, locale)}
          </Text>
        </View>
        <Text
          style={[
            styles.pnl,
            { color: (account.totalPnlPct ?? 0) >= 0 ? V2.green : V2.red },
          ]}
        >
          {formatPct(account.totalPnlPct, true)}
        </Text>
      </View>
      <EquityChart
        points={account.equitySeries.slice(-30)}
        color={modeColor}
        height={88}
      />
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>
            {text("今日盈亏", "Today P&L", "ربح وخسارة اليوم")}
          </Text>
          <Text style={styles.metricValue}>
            {formatMoney(account.todayPnl, account.currency, true, locale)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>
            {text("最大回撤", "Max drawdown", "أقصى تراجع")}
          </Text>
          <Text style={styles.metricValue}>
            {formatPct(account.maxDrawdownPct)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>
            {text("执行槽", "Execution slots", "حسابات التنفيذ")}
          </Text>
          <Text style={styles.metricValue}>{account.platformIds.length}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.connection}>
          <View
            style={[
              styles.connectionDot,
              {
                backgroundColor:
                  account.connectionStatus === "CONNECTED"
                    ? V2.green
                    : account.connectionStatus === "DISCONNECTED"
                      ? V2.red
                      : V2.amber,
              },
            ]}
          />
          <Text style={styles.connectionText}>
            {account.connectionStatus === "CONNECTED"
              ? text("连接正常", "Connected", "متصل")
              : account.connectionStatus === "DEGRADED"
                ? text("部分延迟", "Partially delayed", "تأخير جزئي")
                : account.connectionStatus === "DISCONNECTED"
                  ? text("连接中断", "Disconnected", "غير متصل")
                  : text("等待连接", "Pending", "قيد الاتصال")}
          </Text>
        </View>
        <View style={styles.open}>
          <Text style={styles.openText}>
            {text("查看账户", "View account", "عرض الحساب")}
          </Text>
          <MaterialIcons name="arrow-forward" size={15} color={V2.text} />
        </View>
      </View>
    </Pressable>
  );
}

export const AccountCard = memo(AccountCardBase);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
  },
  pressed: { opacity: 0.78, transform: [{ translateY: 1 }] },
  heading: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modeIcon: {
    width: 43,
    height: 43,
    borderWidth: 1,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  titleCopy: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: V2.text, fontSize: 15, lineHeight: 20, fontWeight: "900" },
  mode: { fontSize: 10, fontWeight: "900" },
  equityLine: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  equityLabel: { color: V2.textDim, fontSize: 10 },
  equityValue: {
    marginTop: 4,
    color: V2.text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
  },
  pnl: { fontSize: 13, fontWeight: "900" },
  metrics: {
    minHeight: 52,
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
  },
  metric: { flex: 1, justifyContent: "center", gap: 3 },
  metricLabel: { color: V2.textDim, fontSize: 10 },
  metricValue: { color: V2.text, fontSize: 12, fontWeight: "800" },
  footer: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  connection: { flexDirection: "row", alignItems: "center", gap: 6 },
  connectionDot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { color: V2.textMuted, fontSize: 10 },
  open: { flexDirection: "row", alignItems: "center", gap: 4 },
  openText: { color: V2.text, fontSize: 11, fontWeight: "800" },
});
