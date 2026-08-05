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
  return (
    <View style={styles.section}>
      <View style={[styles.actionCard, { backgroundColor: colors.surface }]}>
        <View style={styles.priceRow}>
          <View>
            <Text style={[styles.priceLabel, { color: colors.muted }]}>
              获取方式
            </Text>
            <Text style={[styles.inquiryValue, { color: "#C9A96E" }]}>
              联系咨询
            </Text>
          </View>
          <View style={styles.priceRight}>
            <Text style={[styles.downloadLabel, { color: colors.muted }]}>
              交付服务
            </Text>
            <Text style={[styles.downloadValue, { color: colors.foreground }]}>
              版本确认
            </Text>
          </View>
        </View>

        <PurchaseActions
          saleMode="inquiry"
          productId={strategy.id}
          productKind="strategy"
          price={strategy.price}
          originalPrice={null}
          isFree={false}
          featuredLink={null}
          downloadRequiresContact
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
