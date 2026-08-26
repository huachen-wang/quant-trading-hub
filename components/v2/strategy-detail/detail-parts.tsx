import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import { formatDateTime } from "@/components/v2/format";
import { V2 } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
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
  const { locale, text } = useLanguage();
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
          <TableCell
            value={text("品种 / 方向", "Instrument / Side", "الأصل / الاتجاه")}
            flex={1.1}
            muted
          />
          <TableCell value={text("手数", "Volume", "الحجم")} muted />
          <TableCell
            value={text(
              "开仓 → 当前/平仓",
              "Open → Current/Close",
              "الفتح ← الحالي/الإغلاق",
            )}
            flex={1.6}
            muted
          />
          <TableCell value={text("盈亏", "P&L", "الربح والخسارة")} muted />
          <TableCell value={text("时间", "Time", "الوقت")} flex={1.2} muted />
        </View>
      ) : null}
      {rows.map((row) => (
        <View
          key={row.id}
          style={[styles.tableRow, isMobile && styles.tableRowMobile]}
        >
          <TableCell
            value={`${row.symbol} · ${
              row.side === "BUY"
                ? text("买入", "Buy", "شراء")
                : text("卖出", "Sell", "بيع")
            }`}
            flex={1.1}
          />
          <TableCell value={`${row.volume} ${text("手", "lots", "لوت")}`} />
          <TableCell value={row.price} flex={1.6} />
          <TableCell
            value={`${row.pnl >= 0 ? "+" : ""}${row.pnl.toFixed(2)} USD`}
            color={row.pnl >= 0 ? V2.green : V2.red}
          />
          <TableCell
            value={formatDateTime(row.time, locale)}
            flex={1.2}
            muted
          />
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
