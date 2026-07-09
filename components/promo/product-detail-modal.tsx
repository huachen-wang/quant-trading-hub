import { Image, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { CountdownTimer } from "@/components/promo/countdown-timer";
import { PROMO_CATEGORIES } from "@/components/promo/data";
import type { PromoStyles } from "@/components/promo/styles";
import type { PromoProduct } from "@/components/promo/types";
import { calcSavings, formatMoney, getCategoryName, getPromoCardTheme, parseGallery } from "@/components/promo/utils";

type PromoProductDetailModalProps = {
  product: PromoProduct | null;
  styles: PromoStyles;
  onClose: () => void;
  onBuy: () => void;
  onOpenGallery: (index: number) => void;
};

export function PromoProductDetailModal({
  product,
  styles: s,
  onClose,
  onBuy,
  onOpenGallery,
}: PromoProductDetailModalProps) {
  if (!product) return null;

  const galleryImages = parseGallery(product.galleryImages);
  const hasOriginalPrice = product.originalPrice && (parseFloat(product.originalPrice) || 0) > (parseFloat(product.promoPrice || "0") || 0);
  const categoryLabel = getCategoryName(
    PROMO_CATEGORIES.find((category) => category.key === product.category)?.label,
    product.category,
  );

  return (
    <Modal visible animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={1}>
              {product.title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={28} color="#F1F5F9" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
            {product.coverImage ? (
              <Image source={{ uri: product.coverImage }} style={s.modalCover} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={[...getPromoCardTheme(Math.abs(product.id || 0) % 6).gradient] as [string, string, ...string[]]}
                style={[s.modalCover, { justifyContent: "center", alignItems: "center" }]}
              >
                <Ionicons name="cube" size={56} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            )}

            <LinearGradient colors={["#120D08", "#49351C"]} style={s.modalPriceBox}>
              <View style={s.modalPriceRow}>
                <Text style={s.modalPromoPrice}>{`$${formatMoney(product.promoPrice)}`}</Text>
                {hasOriginalPrice && (
                  <>
                    <Text style={s.modalOriginalPrice}>{`$${formatMoney(product.originalPrice)}`}</Text>
                    <View style={s.modalSaveBadge}>
                      <Text style={s.modalSaveText}>
                        {`省$${formatMoney(calcSavings(product.originalPrice, product.promoPrice))}`}
                      </Text>
                    </View>
                  </>
                )}
              </View>
              {product.promoEndTime ? (
                <View style={{ marginTop: 8 }}>
                  <CountdownTimer endTime={product.promoEndTime} large styles={s} />
                </View>
              ) : null}
            </LinearGradient>

            <View style={s.modalTags}>
              {product.platform ? (
                <View style={[s.modalTag, { backgroundColor: "#1E40AF" }]}>
                  <Text style={s.modalTagText}>{product.platform}</Text>
                </View>
              ) : null}
              {product.category ? (
                <View style={[s.modalTag, { backgroundColor: "#475569" }]}>
                  <Text style={s.modalTagText}>{categoryLabel}</Text>
                </View>
              ) : null}
              {product.promoLabel ? (
                <View style={[s.modalTag, { backgroundColor: "#A8895A" }]}>
                  <Text style={[s.modalTagText, { color: "#0A1628" }]}>{product.promoLabel}</Text>
                </View>
              ) : null}
            </View>

            {product.description ? <Text style={s.modalDesc}>{product.description}</Text> : null}

            {product.detailContent ? (
              <View style={s.modalDetailSection}>
                <Text style={s.modalSectionTitle}>产品详情</Text>
                <Text style={s.modalDetailContent}>{product.detailContent}</Text>
              </View>
            ) : null}

            {galleryImages.length > 0 && (
              <View style={s.modalGallerySection}>
                <Text style={s.modalSectionTitle}>实盘截图</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {galleryImages.map((imageUrl, index) => (
                    <TouchableOpacity key={`${imageUrl}-${index}`} onPress={() => onOpenGallery(index)}>
                      <Image source={{ uri: imageUrl }} style={s.galleryThumb} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={s.buyProcessSection}>
              <Text style={s.modalSectionTitle}>购买流程</Text>
              {[
                { num: "1", text: "点击下方「立即购买」联系客服" },
                { num: "2", text: "备注商品名称，确认库存与版本" },
                { num: "3", text: "支付后即时发货 (USDT / 支付宝 / 微信)" },
              ].map((step) => (
                <View key={step.num} style={s.buyStep}>
                  <View style={s.buyStepNum}>
                    <Text style={s.buyStepNumText}>{step.num}</Text>
                  </View>
                  <Text style={s.buyStepText}>{step.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.buyBtn} onPress={onBuy}>
              <LinearGradient colors={["#DC2626", "#EF4444"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.buyBtnGradient}>
                <Ionicons name="flash" size={20} color="#fff" />
                <Text style={s.buyBtnText}>立即购买</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={s.safetyNote}>
              <Ionicons name="shield-checkmark" size={14} color="#F1F5F9" />
              <Text style={s.safetyNoteText}>源头直供 · 正版授权 · 终身售后</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
