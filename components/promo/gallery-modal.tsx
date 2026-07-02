import { Image, Modal, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { PromoStyles } from "@/components/promo/styles";
import type { PromoProduct } from "@/components/promo/types";
import { parseGallery } from "@/components/promo/utils";

type PromoGalleryModalProps = {
  visible: boolean;
  product: PromoProduct | null;
  galleryIndex: number;
  styles: PromoStyles;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export function PromoGalleryModal({
  visible,
  product,
  galleryIndex,
  styles: s,
  onClose,
  onIndexChange,
}: PromoGalleryModalProps) {
  const images = parseGallery(product?.galleryImages);
  const maxIndex = Math.max(0, images.length - 1);
  const safeIndex = Math.min(galleryIndex, maxIndex);
  const currentImage = images[safeIndex];

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={s.galleryModal}>
        <TouchableOpacity style={s.galleryClose} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {currentImage ? (
          <Image source={{ uri: currentImage }} style={s.galleryFullImage} resizeMode="contain" />
        ) : null}

        <View style={s.galleryNav}>
          <TouchableOpacity
            onPress={() => onIndexChange(Math.max(0, safeIndex - 1))}
            disabled={safeIndex === 0}
          >
            <Ionicons name="chevron-back" size={32} color={safeIndex === 0 ? "rgba(255,255,255,0.35)" : "#fff"} />
          </TouchableOpacity>
          <Text style={s.galleryCounter}>{`${safeIndex + 1} / ${images.length}`}</Text>
          <TouchableOpacity
            onPress={() => onIndexChange(Math.min(maxIndex, safeIndex + 1))}
            disabled={safeIndex >= maxIndex}
          >
            <Ionicons name="chevron-forward" size={32} color={safeIndex >= maxIndex ? "rgba(255,255,255,0.35)" : "#fff"} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
