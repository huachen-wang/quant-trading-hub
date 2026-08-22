import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { ContentBlock } from "@/shared/v2/contracts";
import { formatDateTime } from "./format";
import { V2 } from "./tokens";

export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <View style={styles.blocks}>
      {blocks.map((block) => (
        <ContentBlockView key={block.id} block={block} />
      ))}
    </View>
  );
}

function ContentBlockView({ block }: { block: ContentBlock }) {
  if (block.type === "rich_text") {
    return (
      <BlockFrame heading={block.heading} icon="subject">
        {block.paragraphs.map((paragraph, index) => (
          <Text key={index} style={styles.paragraph}>{paragraph}</Text>
        ))}
        {block.bullets.length ? (
          <View style={styles.bullets}>
            {block.bullets.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </BlockFrame>
    );
  }

  if (block.type === "evidence") {
    return (
      <BlockFrame heading={block.heading} icon="fact-check">
        <View style={styles.rows}>
          {block.items.map((item) => {
            const color = item.status === "VERIFIED" ? V2.green : item.status === "DEMO" ? V2.amber : V2.blue;
            const label = item.status === "VERIFIED" ? "已核验" : item.status === "DEMO" ? "模拟占位" : "待补充";
            return (
              <View key={item.title} style={styles.evidenceRow}>
                <View style={styles.evidenceCopy}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowDetail}>{item.detail}</Text>
                  {item.observedAt ? (
                    <Text style={styles.rowMeta}>观察时间 {formatDateTime(item.observedAt)}</Text>
                  ) : null}
                </View>
                <View style={[styles.stateChip, { borderColor: `${color}66`, backgroundColor: `${color}12` }]}>
                  <Text style={[styles.stateText, { color }]}>{label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </BlockFrame>
    );
  }

  if (block.type === "timeline") {
    return (
      <BlockFrame heading={block.heading} icon="timeline">
        <View style={styles.timeline}>
          {block.items.map((item, index) => (
            <View key={`${item.date}-${item.title}`} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={styles.timelineDot} />
                {index < block.items.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.timelineCopy}>
                <Text style={styles.timelineDate}>{item.date}</Text>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </BlockFrame>
    );
  }

  if (block.type === "risk_notice") {
    return (
      <View style={styles.riskBlock}>
        <MaterialIcons name="gpp-maybe" size={23} color={V2.amber} />
        <View style={styles.riskCopy}>
          <Text style={styles.riskHeading}>{block.heading}</Text>
          <Text style={styles.riskText}>{block.content}</Text>
        </View>
      </View>
    );
  }

  if (block.type === "media_gallery") {
    return <MediaGalleryBlock block={block} />;
  }

  return <FaqBlock block={block} />;
}

function MediaGalleryBlock({ block }: { block: Extract<ContentBlock, { type: "media_gallery" }> }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const [hovered, setHovered] = useState<string>();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex == null ? null : block.items[selectedIndex];

  const move = (direction: -1 | 1) => {
    if (selectedIndex == null || !block.items.length) return;
    setSelectedIndex((selectedIndex + direction + block.items.length) % block.items.length);
  };

  return (
    <>
      <BlockFrame heading={block.heading} icon="photo-library">
        <View style={styles.galleryGrid}>
          {block.items.map((item, index) => {
            const active = hovered === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`查看图片：${item.title}`}
                onHoverIn={() => Platform.OS === "web" && setHovered(item.id)}
                onHoverOut={() => Platform.OS === "web" && setHovered(undefined)}
                onPress={() => setSelectedIndex(index)}
                style={({ pressed }) => [
                  styles.galleryItem,
                  isMobile && styles.galleryItemMobile,
                  pressed && styles.galleryPressed,
                ]}
              >
                <Image
                  accessibilityLabel={item.alt}
                  source={{ uri: item.thumbnailUrl }}
                  style={styles.galleryImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={120}
                />
                <View style={[styles.galleryCaption, (active || isMobile) && styles.galleryCaptionActive]}>
                  <View style={styles.galleryCaptionCopy}>
                    <Text style={styles.galleryTitle} numberOfLines={1}>{item.title}</Text>
                    {(active || isMobile) && item.caption ? (
                      <Text style={styles.galleryDetail} numberOfLines={2}>{item.caption}</Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="open-in-full" size={16} color={V2.text} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </BlockFrame>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelectedIndex(null)}>
        <View style={styles.lightboxBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭图片" onPress={() => setSelectedIndex(null)} style={styles.lightboxClose}>
            <MaterialIcons name="close" size={22} color={V2.text} />
          </Pressable>
          {selected ? (
            <View style={styles.lightboxPanel}>
              <Image
                accessibilityLabel={selected.alt}
                source={{ uri: selected.fullUrl }}
                style={styles.lightboxImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
              <View style={styles.lightboxFooter}>
                <Pressable accessibilityRole="button" accessibilityLabel="上一张" onPress={() => move(-1)} style={styles.lightboxArrow}>
                  <MaterialIcons name="arrow-back" size={20} color={V2.text} />
                </Pressable>
                <View style={styles.lightboxCopy}>
                  <Text style={styles.lightboxTitle}>{selected.title}</Text>
                  <Text style={styles.lightboxDetail}>{selected.caption}</Text>
                  <Text style={styles.lightboxCount}>{(selectedIndex ?? 0) + 1} / {block.items.length}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="下一张" onPress={() => move(1)} style={styles.lightboxArrow}>
                  <MaterialIcons name="arrow-forward" size={20} color={V2.text} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function FaqBlock({ block }: { block: Extract<ContentBlock, { type: "faq" }> }) {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <BlockFrame heading={block.heading} icon="help-outline">
      <View style={styles.faqList}>
        {block.items.map((item, index) => {
          const open = index === openIndex;
          return (
            <Pressable
              key={item.question}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => setOpenIndex(open ? -1 : index)}
              style={styles.faqItem}
            >
              <View style={styles.faqQuestionRow}>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <MaterialIcons name={open ? "remove" : "add"} size={19} color={V2.textMuted} />
              </View>
              {open ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </BlockFrame>
  );
}

function BlockFrame({
  heading,
  icon,
  children,
}: {
  heading: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  return (
    <View style={[styles.block, isMobile && styles.blockMobile]}>
      <View style={[styles.blockHeading, isMobile && styles.blockHeadingMobile]}>
        <MaterialIcons name={icon} size={18} color={V2.gold} />
        <Text style={styles.blockHeadingText}>{heading}</Text>
      </View>
      <View style={styles.blockBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: 0, borderTopWidth: 1, borderTopColor: V2.border },
  block: { paddingVertical: 26, borderBottomWidth: 1, borderBottomColor: V2.border, flexDirection: "row", gap: 28 },
  blockMobile: { flexDirection: "column", gap: 16, paddingVertical: 22 },
  blockHeading: { width: 190, flexDirection: "row", alignItems: "center", gap: 9, alignSelf: "flex-start" },
  blockHeadingMobile: { width: "100%" },
  blockHeadingText: { color: V2.text, fontSize: 15, lineHeight: 20, fontWeight: "900" },
  blockBody: { flex: 1, minWidth: 0, gap: 12 },
  paragraph: { color: V2.textMuted, fontSize: 13, lineHeight: 22 },
  bullets: { marginTop: 4, gap: 9 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bullet: { width: 5, height: 5, marginTop: 7, borderRadius: 3, backgroundColor: V2.gold },
  bulletText: { flex: 1, color: V2.text, fontSize: 12, lineHeight: 19 },
  rows: { borderTopWidth: 1, borderTopColor: V2.border },
  evidenceRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: V2.border, flexDirection: "row", gap: 16, alignItems: "flex-start" },
  evidenceCopy: { flex: 1, minWidth: 0, gap: 5 },
  rowTitle: { color: V2.text, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  rowDetail: { color: V2.textMuted, fontSize: 12, lineHeight: 19 },
  rowMeta: { color: V2.textDim, fontSize: 10, marginTop: 2 },
  stateChip: { minHeight: 24, paddingHorizontal: 8, borderWidth: 1, borderRadius: 3, alignItems: "center", justifyContent: "center" },
  stateText: { fontSize: 10, fontWeight: "900" },
  timeline: { gap: 0 },
  timelineRow: { minHeight: 90, flexDirection: "row", gap: 14 },
  timelineRail: { width: 14, alignItems: "center" },
  timelineDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: V2.gold, backgroundColor: V2.background },
  timelineLine: { flex: 1, width: 1, marginVertical: 4, backgroundColor: V2.borderStrong },
  timelineCopy: { flex: 1, gap: 4, paddingBottom: 20 },
  timelineDate: { color: V2.gold, fontSize: 10, fontWeight: "900" },
  riskBlock: { padding: 18, borderWidth: 1, borderColor: "rgba(231,183,95,0.38)", borderRadius: 5, backgroundColor: "rgba(231,183,95,0.06)", flexDirection: "row", gap: 13 },
  riskCopy: { flex: 1, gap: 5 },
  riskHeading: { color: V2.text, fontSize: 14, fontWeight: "900" },
  riskText: { color: V2.textMuted, fontSize: 12, lineHeight: 20 },
  faqList: { borderTopWidth: 1, borderTopColor: V2.border },
  faqItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: V2.border },
  faqQuestionRow: { minHeight: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  faqQuestion: { flex: 1, color: V2.text, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  faqAnswer: { marginTop: 9, paddingRight: 30, color: V2.textMuted, fontSize: 12, lineHeight: 20 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  galleryItem: { width: "31.8%", minWidth: 190, aspectRatio: 1.55, overflow: "hidden", borderWidth: 1, borderColor: V2.border, borderRadius: 5, backgroundColor: V2.surfaceMuted },
  galleryItemMobile: { width: "100%", minWidth: 0 },
  galleryImage: { width: "100%", height: "100%" },
  galleryPressed: { opacity: 0.8 },
  galleryCaption: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(7,11,18,0.78)" },
  galleryCaptionActive: { minHeight: 67, backgroundColor: "rgba(7,11,18,0.92)" },
  galleryCaptionCopy: { flex: 1, minWidth: 0, gap: 3 },
  galleryTitle: { color: V2.text, fontSize: 11, lineHeight: 15, fontWeight: "900" },
  galleryDetail: { color: V2.textMuted, fontSize: 9, lineHeight: 13 },
  lightboxBackdrop: { flex: 1, padding: 22, backgroundColor: "rgba(2,5,10,0.96)", alignItems: "center", justifyContent: "center" },
  lightboxPanel: { width: "100%", maxWidth: 1120, height: "88%", minHeight: 420, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 6, overflow: "hidden", backgroundColor: V2.backgroundRaised },
  lightboxImage: { flex: 1, width: "100%", backgroundColor: "#02050A" },
  lightboxClose: { position: "absolute", top: 20, right: 20, zIndex: 5, width: 40, height: 40, borderWidth: 1, borderColor: V2.borderStrong, borderRadius: 4, backgroundColor: V2.backgroundRaised, alignItems: "center", justifyContent: "center" },
  lightboxFooter: { minHeight: 88, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: V2.border, flexDirection: "row", alignItems: "center", gap: 12 },
  lightboxArrow: { width: 40, height: 40, borderWidth: 1, borderColor: V2.border, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  lightboxCopy: { flex: 1, minWidth: 0, gap: 3, alignItems: "center" },
  lightboxTitle: { color: V2.text, fontSize: 13, fontWeight: "900", textAlign: "center" },
  lightboxDetail: { color: V2.textMuted, fontSize: 10, lineHeight: 14, textAlign: "center" },
  lightboxCount: { color: V2.textDim, fontSize: 9 },
});
