import { StyleSheet, Text, View } from "react-native";
import { PurchaseActions } from "@/components/purchase-actions";
import type { AppColors, StrategyDetailData } from "./types";

type StrategyPurchasePanelProps = {
  strategy: StrategyDetailData;
  colors: AppColors;
  onContact: () => void;
};

export function StrategyPurchasePanel({
  strategy,
  colors,
  onContact,
}: StrategyPurchasePanelProps) {
  const isDirect = strategy.saleMode === "direct";
  const isFree = Boolean(strategy.isFree);
  const acquisitionLabel = isDirect ? (isFree ? "免费获取" : `¥ ${strategy.price}`) : "联系咨询";
  return (
    <View style={styles.section}>
      <View style={[styles.actionCard, { backgroundColor: colors.surface }]}>
        <View style={styles.priceRow}>
          <View>
            <Text style={[styles.priceLabel, { color: colors.muted }]}>
              获取方式
            </Text>
            <Text style={[styles.inquiryValue, { color: "#C9A96E" }]}>
              {acquisitionLabel}
            </Text>
          </View>
          <View style={styles.priceRight}>
            <Text style={[styles.downloadLabel, { color: colors.muted }]}>
              交付服务
            </Text>
            <Text style={[styles.downloadValue, { color: colors.foreground }]}>
              {isDirect && strategy.downloadAvailable ? "付款后解锁" : "版本确认"}
            </Text>
          </View>
        </View>

        <PurchaseActions
          saleMode={strategy.saleMode === "direct" ? "direct" : "inquiry"}
          productId={strategy.id}
          productKind="strategy"
          price={strategy.price}
          originalPrice={strategy.originalPrice}
          isFree={isFree}
          featuredLink={strategy.featuredLink}
          downloadRequiresContact={!strategy.downloadAvailable}
          onContact={onContact}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionCard: {
    borderRadius: 8,
    padding: 14,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  priceLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  inquiryValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  priceRight: {
    alignItems: "flex-end",
  },
  downloadLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  downloadValue: {
    fontSize: 15,
  },
});
