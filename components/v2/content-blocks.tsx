import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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

  return <FaqBlock block={block} />;
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
  rowMeta: { color: V2.textDim, fontSize: 9, marginTop: 2 },
  stateChip: { minHeight: 24, paddingHorizontal: 8, borderWidth: 1, borderRadius: 3, alignItems: "center", justifyContent: "center" },
  stateText: { fontSize: 9, fontWeight: "900" },
  timeline: { gap: 0 },
  timelineRow: { minHeight: 90, flexDirection: "row", gap: 14 },
  timelineRail: { width: 14, alignItems: "center" },
  timelineDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: V2.gold, backgroundColor: V2.background },
  timelineLine: { flex: 1, width: 1, marginVertical: 4, backgroundColor: V2.borderStrong },
  timelineCopy: { flex: 1, gap: 4, paddingBottom: 20 },
  timelineDate: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  riskBlock: { padding: 18, borderWidth: 1, borderColor: "rgba(231,183,95,0.38)", borderRadius: 5, backgroundColor: "rgba(231,183,95,0.06)", flexDirection: "row", gap: 13 },
  riskCopy: { flex: 1, gap: 5 },
  riskHeading: { color: V2.text, fontSize: 14, fontWeight: "900" },
  riskText: { color: V2.textMuted, fontSize: 12, lineHeight: 20 },
  faqList: { borderTopWidth: 1, borderTopColor: V2.border },
  faqItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: V2.border },
  faqQuestionRow: { minHeight: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  faqQuestion: { flex: 1, color: V2.text, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  faqAnswer: { marginTop: 9, paddingRight: 30, color: V2.textMuted, fontSize: 12, lineHeight: 20 },
});
