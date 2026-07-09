import { useCallback, useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { GradientColors, StrategyDetailData } from "./types";

type StrategyMediaProps = {
  strategy: StrategyDetailData;
  allImages: string[];
  gradientColors: GradientColors;
  productTypeLabel: string;
  isFeatured: boolean;
  isDesktop: boolean;
  width: number;
};

export function StrategyMedia({
  strategy,
  allImages,
  gradientColors,
  productTypeLabel,
  isFeatured,
  isDesktop,
  width,
}: StrategyMediaProps) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  const hasGalleryImages = allImages.length > 0;
  const galleryWidth = Math.max(1, Math.min(width - 32, 688));
  const fullImageSize = Math.max(1, width - 40);

  useEffect(() => {
    setCoverLoadFailed(false);
  }, [strategy.coverImage]);

  useEffect(() => {
    if (!hasGalleryImages) {
      setShowGalleryModal(false);
      setGalleryIndex(0);
      return;
    }
    if (galleryIndex >= allImages.length) {
      setGalleryIndex(allImages.length - 1);
    }
  }, [allImages.length, galleryIndex, hasGalleryImages]);

  const openGallery = useCallback((index: number) => {
    if (!hasGalleryImages) return;
    setGalleryIndex(Math.min(Math.max(index, 0), allImages.length - 1));
    setShowGalleryModal(true);
  }, [allImages.length, hasGalleryImages]);

  const closeGallery = useCallback(() => setShowGalleryModal(false), []);

  return (
    <>
      {allImages.length > 1 ? (
        <View style={[styles.galleryContainer, isDesktop && styles.galleryContainerDesktop]}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / galleryWidth);
              setGalleryIndex(idx);
            }}
            style={{ width: galleryWidth }}
          >
            {allImages.map((img, i) => (
              <TouchableOpacity
                key={`${img}-${i}`}
                onPress={() => openGallery(i)}
                activeOpacity={0.9}
                style={{ width: galleryWidth }}
              >
                <View style={{ width: galleryWidth, height: isDesktop ? 196 : 180, borderRadius: isDesktop ? 8 : 14, overflow: "hidden" }}>
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  >
                    <View style={styles.placeholderPanel}>
                      <Text style={styles.placeholderKicker}>STRATEGY PROFILE</Text>
                      <Text style={styles.placeholderTitle} numberOfLines={2}>{strategy.title}</Text>
                    </View>
                  </LinearGradient>
                  <Image
                    source={{ uri: img }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                    transition={300}
                    cachePolicy="memory-disk"
                  />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.galleryIndicatorRow}>
            {allImages.map((img, i) => (
              <View
                key={`${img}-${i}`}
                style={[
                  styles.galleryIndicator,
                  {
                    backgroundColor: i === galleryIndex ? "#fff" : "rgba(255,255,255,0.4)",
                    width: i === galleryIndex ? 16 : 6,
                  },
                ]}
              />
            ))}
          </View>

          <PlatformBadge
            label={`${strategy.platform} · ${productTypeLabel}`}
            color={gradientColors[1]}
          />
          {isFeatured && <FeaturedBadge />}
        </View>
      ) : strategy.coverImage && !coverLoadFailed ? (
        <View style={[styles.coverGradient, isDesktop && styles.coverDesktop, { overflow: "hidden" }]}>
          <TouchableOpacity
            onPress={() => openGallery(0)}
            activeOpacity={0.9}
            style={{ width: "100%", height: "100%" }}
          >
            <Image
              source={{ uri: strategy.coverImage }}
              style={{ width: "100%", height: "100%" }}
              placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}
              contentFit="cover"
              transition={300}
              cachePolicy="memory-disk"
              onError={() => setCoverLoadFailed(true)}
            />
          </TouchableOpacity>
          <PlatformBadge
            label={`${strategy.platform} · ${productTypeLabel}`}
            color={gradientColors[1]}
          />
          {isFeatured && <FeaturedBadge />}
        </View>
      ) : (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.coverGradient, isDesktop && styles.coverDesktop]}
        >
          <View style={styles.placeholderPanel}>
            <Text style={styles.placeholderKicker}>STRATEGY PROFILE</Text>
            <Text style={styles.placeholderTitle} numberOfLines={2}>{strategy.title}</Text>
            <View style={styles.placeholderMetrics}>
              <View style={styles.placeholderMetric}>
                <Text style={styles.placeholderMetricLabel}>收益率</Text>
                <Text style={styles.placeholderMetricValue}>{strategy.totalReturn}%</Text>
              </View>
              <View style={styles.placeholderMetric}>
                <Text style={styles.placeholderMetricLabel}>胜率</Text>
                <Text style={styles.placeholderMetricValue}>{strategy.winRate}%</Text>
              </View>
            </View>
          </View>
          <PlatformBadge
            label={`${strategy.platform} · ${productTypeLabel}`}
            color={gradientColors[1]}
          />
        </LinearGradient>
      )}

      <Modal
        visible={showGalleryModal && hasGalleryImages}
        transparent
        animationType="fade"
        onRequestClose={closeGallery}
      >
        <View style={styles.galleryModalOverlay}>
          <TouchableOpacity
            onPress={closeGallery}
            style={styles.galleryCloseBtn}
          >
            <Text style={styles.galleryCloseText}>✕</Text>
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: galleryIndex * width, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setGalleryIndex(idx);
            }}
          >
            {allImages.map((img, i) => (
              <View key={`${img}-modal-${i}`} style={{ width, justifyContent: "center", alignItems: "center" }}>
                <Image
                  source={{ uri: img }}
                  style={{ width: fullImageSize, height: fullImageSize }}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            ))}
          </ScrollView>
          <Text style={styles.galleryCounter}>{galleryIndex + 1} / {allImages.length}</Text>
        </View>
      </Modal>
    </>
  );
}

function PlatformBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.platformBadge, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
      <Text style={[styles.platformText, { color }]}>{label}</Text>
    </View>
  );
}

function FeaturedBadge() {
  return (
    <View style={styles.featuredDetailBadge}>
      <LinearGradient
        colors={["#A8895A", "#C9A96E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.featuredDetailGradient}
      >
        <Text style={styles.featuredDetailText}>官方旗舰</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  coverGradient: {
    marginHorizontal: 16,
    height: 180,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  coverDesktop: {
    height: 196,
    borderRadius: 8,
    marginHorizontal: 0,
    marginBottom: 10,
  },
  placeholderPanel: {
    width: "100%",
    height: "100%",
    padding: 22,
    justifyContent: "flex-end",
    backgroundColor: "rgba(5,8,16,0.24)",
  },
  placeholderKicker: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 8,
  },
  placeholderTitle: {
    color: "#F8FAFC",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    marginBottom: 16,
  },
  placeholderMetrics: {
    flexDirection: "row",
    gap: 10,
  },
  placeholderMetric: {
    minWidth: 108,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(5,8,16,0.34)",
  },
  placeholderMetricLabel: {
    color: "rgba(226,232,240,0.62)",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 3,
  },
  placeholderMetricValue: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "900",
  },
  galleryContainer: {
    marginHorizontal: 16,
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
  },
  galleryContainerDesktop: {
    marginHorizontal: 0,
    height: 196,
    borderRadius: 8,
    marginBottom: 10,
  },
  galleryIndicatorRow: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  galleryIndicator: {
    height: 4,
    borderRadius: 2,
  },
  galleryModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  galleryCloseBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryCloseText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  galleryCounter: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
    color: "rgba(255,255,255,0.95)",
    fontSize: 14,
    fontWeight: "600",
  },
  featuredDetailBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    borderBottomRightRadius: 12,
    overflow: "hidden",
  },
  featuredDetailGradient: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  featuredDetailText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  platformBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  platformText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
