import { memo } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import { CountdownTimer } from "@/components/promo/countdown-timer";
import type { PromoStyles } from "@/components/promo/styles";
import type { PromoProduct } from "@/components/promo/types";
import { calcDiscount, calcSavings, formatMoney, getPromoCardTheme } from "@/components/promo/utils";

type PromoProductCardProps = {
  product: PromoProduct;
  index: number;
  styles: PromoStyles;
  onPress: (product: PromoProduct) => void;
};

export const PromoProductCard = memo(function PromoProductCard({
  product,
  index,
  styles: s,
  onPress,
}: PromoProductCardProps) {
  const discount = calcDiscount(product.originalPrice, product.promoPrice);
  const stock = product.stock || 0;
  const soldCount = product.soldCount || 0;
  const remaining = stock - soldCount;
  const stockPercent = stock ? Math.max(5, (remaining / stock) * 100) : 100;
  const isUrgent = remaining > 0 && remaining <= 5;
  const theme = getPromoCardTheme(index);
  const metrics = product.metrics || {};
  const iconName = product.category === "indicator" ? "analytics" : product.category === "tool" ? "construct" : "cube";
  const hasOriginalPrice = product.originalPrice && (parseFloat(product.originalPrice) || 0) > (parseFloat(product.promoPrice || "0") || 0);

  return (
    <TouchableOpacity
      style={s.productCard}
      onPress={() => onPress(product)}
      activeOpacity={0.92}
    >
      <LinearGradient
        colors={[...theme.gradient] as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.cardHeader}
      >
        {discount > 0 && (
          <View style={s.discountBadge}>
            <Text style={s.discountBadgeText}>{`-${discount}%`}</Text>
          </View>
        )}

        {product.promoLabel && (
          <View style={[s.promoLabel, { backgroundColor: theme.badge }]}>
            <Ionicons name="flash" size={11} color="#fff" />
            <Text style={s.promoLabelText}>{product.promoLabel}</Text>
          </View>
        )}

        <View style={s.cardHeaderContent}>
          {product.coverImage ? (
            <Image source={{ uri: product.coverImage }} style={s.cardCoverImage} resizeMode="cover" />
          ) : (
            <View style={s.cardIconWrap}>
              <Ionicons name={iconName} size={40} color={theme.accent} />
            </View>
          )}

          <View style={s.cardHeaderInfo}>
            <View style={s.cardPlatformBadge}>
              <Text style={s.cardPlatformText}>{product.platform}</Text>
            </View>
            <Text style={s.cardHeaderTitle} numberOfLines={2}>
              {product.title}
            </Text>
          </View>
        </View>

        <View style={s.cardPriceArea}>
          <View style={s.cardPriceLeft}>
            <Text style={s.cardPromoPrice}>{`$${formatMoney(product.promoPrice)}`}</Text>
            {hasOriginalPrice && (
              <Text style={s.cardOriginalPrice}>{`$${formatMoney(product.originalPrice)}`}</Text>
            )}
          </View>
          {discount > 0 && (
            <View style={s.cardSaveBadge}>
              <Text style={s.cardSaveText}>{`省 $${formatMoney(calcSavings(product.originalPrice, product.promoPrice))}`}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <View style={s.cardBody}>
        <Text style={s.cardDesc} numberOfLines={2}>
          {product.description}
        </Text>

        {metrics.winRate && metrics.winRate !== "-" && (
          <View style={s.metricsRow}>
            {[
              { label: "胜率", value: metrics.winRate, color: "#22C55E" },
              { label: "年化", value: metrics.profit, color: "#A8895A" },
              { label: "回撤", value: metrics.drawdown, color: "#EF4444" },
            ].map((metric) => (
              <View key={metric.label} style={s.metricItem}>
                <Text style={[s.metricValue, { color: metric.color }]}>{metric.value}</Text>
                <Text style={s.metricLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.cardFooter}>
          <View style={s.cardFooterLeft}>
            {product.promoEndTime ? <CountdownTimer endTime={product.promoEndTime} styles={s} /> : null}
          </View>
          {stock > 0 && (
            <View style={s.stockInfo}>
              <View style={s.stockBarOuter}>
                <LinearGradient
                  colors={isUrgent ? ["#DC2626", "#EF4444"] : ["#A8895A", "#C9A96E"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.stockBarInner, { width: `${stockPercent}%` }]}
                />
              </View>
              <Text style={[s.stockText, isUrgent && { color: "#EF4444" }]}>
                {isUrgent ? `仅剩${remaining}份!` : `${soldCount}人已购`}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[s.cardBuyBtn, { backgroundColor: theme.badge }]}
          onPress={() => onPress(product)}
        >
          <Ionicons name="cart" size={16} color="#fff" />
          <Text style={s.cardBuyBtnText}>立即抢购</Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});
