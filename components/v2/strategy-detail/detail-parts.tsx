import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import { formatDateTime } from "@/components/v2/format";
import { V2 } from "@/components/v2/tokens";
import { detailStyles as styles } from "./styles";

export function DetailMetric({
  label,
  value,
  color = V2.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

export function StrategyFitItem({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.fitItem, wide && styles.fitItemWide]}>
      <Text style={styles.fitLabel}>{label}</Text>
      <Text style={styles.fitValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function AccountSnapshotRow({
  label,
  value,
  color = V2.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.snapshotRow}>
      <Text style={styles.snapshotLabel}>{label}</Text>
      <Text style={[styles.snapshotValue, { color }]}>{value}</Text>
    </View>
  );
}

export function DetailTabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export type StrategyTradeRow = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  volume: string;
  price: string;
  pnl: number;
  time: string;
};

export function StrategyTradeTable({
  rows,
  empty,
  isMobile,
}: {
  rows: StrategyTradeRow[];
  empty: string;
  isMobile: boolean;
}) {
  if (!rows.length) {
    return (
      <View style={styles.empty}>
        <MaterialIcons name="hourglass-empty" size={22} color={V2.textDim} />
        <Text style={styles.emptyText}>{empty}</Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      {!isMobile ? (
        <View style={[styles.tableRow, styles.tableHeader]}>
          <TableCell value="品种 / 方向" flex={1.1} muted />
          <TableCell value="手数" muted />
          <TableCell value="开仓 → 当前/平仓" flex={1.6} muted />
          <TableCell value="盈亏" muted />
          <TableCell value="时间" flex={1.2} muted />
        </View>
      ) : null}
      {rows.map((row) => (
        <View
          key={row.id}
          style={[styles.tableRow, isMobile && styles.tableRowMobile]}
        >
          <TableCell
            value={`${row.symbol} · ${row.side === "BUY" ? "买入" : "卖出"}`}
            flex={1.1}
          />
          <TableCell value={`${row.volume} 手`} />
          <TableCell value={row.price} flex={1.6} />
          <TableCell
            value={`${row.pnl >= 0 ? "+" : ""}${row.pnl.toFixed(2)} USD`}
            color={row.pnl >= 0 ? V2.green : V2.red}
          />
          <TableCell value={formatDateTime(row.time)} flex={1.2} muted />
        </View>
      ))}
    </View>
  );
}

function TableCell({
  value,
  flex = 1,
  muted = false,
  color,
}: {
  value: string;
  flex?: number;
  muted?: boolean;
  color?: string;
}) {
  return (
    <Text
      style={[
        styles.cell,
        { flex, color: color ?? (muted ? V2.textMuted : V2.text) },
      ]}
      numberOfLines={2}
    >
      {value}
    </Text>
  );
}
