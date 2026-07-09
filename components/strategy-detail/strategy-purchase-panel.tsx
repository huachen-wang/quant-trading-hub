import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PurchaseActions } from "@/components/purchase-actions";
import type { AppColors, StrategyDetailData } from "./types";

type StrategyPurchasePanelProps = {
  strategy: StrategyDetailData;
  colors: AppColors;
  originalPrice?: string | number | null;
  hasDiscount: boolean;
  discountPercent: number;
  downloadRequiresContact: boolean;
  isFeatured: boolean;
  featuredLink?: string | null;
  onDownload: () => void;
  onContact: () => void;
};

export function StrategyPurchasePanel({
  strategy,
  colors,
  originalPrice,
  hasDiscount,
  discountPercent,
  downloadRequiresContact,
  isFeatured,
  featuredLink,
  onDownload,
  onContact,
}: StrategyPurchasePanelProps) {
  return (
    <View style={styles.section}>
      <View style={[styles.actionCard, { backgroundColor: colors.surface }]}>
        <View style={styles.priceRow}>
          <View>
            <Text style={[styles.priceLabel, { color: colors.muted }]}>价格</Text>
            {strategy.isFree ? (
              <Text style={[styles.priceValue, { color: colors.success }]}>免费</Text>
            ) : (
              <View style={styles.priceDisplayRow}>
                <Text style={[styles.priceValue, { color: "#C9A96E" }]}>¥{strategy.price}</Text>
                {hasDiscount && (
                  <View style={styles.priceAnchor}>
                    <Text style={[styles.originalPriceText, { color: colors.muted }]}>¥{originalPrice}</Text>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>-{discountPercent}%</Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
          <View style={styles.priceRight}>
            <Text style={[styles.downloadLabel, { color: colors.muted }]}>下载量</Text>
            <Text style={[styles.downloadValue, { color: colors.foreground }]}>
              DL {(strategy.downloadCount || 0) + (strategy.virtualDownloads || 0)}
            </Text>
          </View>
        </View>

        {strategy.saleMode === "direct" && strategy.isFree ? (
          <TouchableOpacity
            onPress={downloadRequiresContact ? onContact : onDownload}
            style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.downloadBtnText, { color: "#fff" }]}>
              {downloadRequiresContact ? "联系获取 EA" : "立即下载"}
            </Text>
          </TouchableOpacity>
        ) : (
          <PurchaseActions
            saleMode={strategy.saleMode || "inquiry"}
            productId={strategy.id}
            productKind="strategy"
            price={strategy.price}
            originalPrice={strategy.originalPrice}
            isFree={strategy.isFree}
            featuredLink={isFeatured ? featuredLink || null : null}
            downloadRequiresContact={downloadRequiresContact}
            onContact={onContact}
          />
        )}
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
  priceValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  priceDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceAnchor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  originalPriceText: {
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  discountBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: "#fff",
    fontSize: 11,
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
  downloadBtn: {
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  downloadBtnText: {
    fontWeight: "700",
    fontSize: 16,
    color: "#fff",
  },
});
