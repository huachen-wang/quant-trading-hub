import { Link, type Href } from "expo-router";
import { Fragment, useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextStyle,
} from "react-native";
import { V2 } from "@/components/v2/tokens";
import {
  inlineText,
  type ContentBlock,
  type ContentLang,
  type ContentLink,
  type InlineNode,
} from "@/shared/content-pages";

/**
 * 内容页正文渲染（2026-10-18）：和服务端预渲染用同一份解析结果（shared/content-pages）。
 * 标题用 role="heading" + aria-level，网页端渲染成真正的 h1/h2/h3；链接是真正的 <a href>。
 * 表格：宽屏是表格；窄屏每行变成一张卡片，每一列都带列名，不会截掉「检查方法」这类列。
 */

const COLORS = {
  text: "#E2E8F0",
  strong: "#FFFFFF",
  muted: "#94A3B8",
  gold: V2.gold,
  goldDeep: "#A8895A",
  border: "rgba(148,163,184,0.24)",
  surface: "rgba(15,23,42,0.72)",
  tint: "rgba(216,188,131,0.06)",
};

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** 站外链接新开标签页；站内链接用 push，和站内其它导航（router.push）一致。 */
export function linkTargetProps(external: boolean): Record<string, unknown> {
  return external ? { target: "_blank", rel: "noopener noreferrer" } : { push: true };
}

/** 标题语义：网页端 role=heading + aria-level → h1/h2/h3。RN 的类型里没有 aria-level，单独展开。 */
function headingProps(level: number): Record<string, unknown> {
  return { role: "heading", "aria-level": level };
}

/** 网页端渲染成 <p>。RN 的 Role 类型里没有 paragraph，单独展开。 */
const PARAGRAPH_PROPS: Record<string, unknown> = { role: "paragraph" };

function InlineLink({ link, style }: { link: ContentLink; style?: TextStyle }) {
  const external = isExternal(link.href);
  return (
    <Link
      href={link.href as Href}
      style={[styles.link, style]}
      {...linkTargetProps(external)}
    >
      {link.text}
    </Link>
  );
}

export function InlineNodes({ nodes, strongStyle }: { nodes: InlineNode[]; strongStyle?: TextStyle }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.kind === "text") return <Fragment key={index}>{node.text}</Fragment>;
        if (node.kind === "strong") {
          return (
            <Text key={index} style={[styles.strong, strongStyle]}>
              {node.text}
            </Text>
          );
        }
        if (node.kind === "link") return <InlineLink key={index} link={node} />;
        return <Fragment key={index}>{"\n"}</Fragment>;
      })}
    </>
  );
}

/**
 * 按钮行：直接用 Link（网页端是带 target/rel 的 <a>）套按钮样式。
 * 不用 asChild：expo-router 的 Link 在 asChild 时会用自己的 style 覆盖子元素样式，也不传 target/rel。
 */
function CtaRow({ links, align }: { links: ContentLink[]; align: "left" | "center" }) {
  return (
    <View style={[styles.ctaRow, align === "center" && styles.ctaRowCenter]}>
      {links.map((link, index) => {
        const primary = index === 0;
        const external = isExternal(link.href);
        return (
          <Link
            key={link.href + index}
            href={link.href as Href}
            style={[styles.ctaButton, primary ? styles.ctaPrimary : styles.ctaSecondary]}
            {...linkTargetProps(external)}
          >
            {link.text}
          </Link>
        );
      })}
    </View>
  );
}

function ContentTable({ block, narrow }: { block: Extract<ContentBlock, { type: "table" }>; narrow: boolean }) {
  const columns = block.header.length;
  const flexFor = (index: number) => (index === 0 ? 1 : columns >= 3 ? 1.6 : 2.2);

  if (narrow) {
    return (
      <View style={styles.cardTable} role="list">
        {block.rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.cardRow} role="listitem">
            {row.map((cell, cellIndex) => (
              <View key={cellIndex} style={[styles.cardCell, cellIndex === 0 && styles.cardCellFirst]}>
                <Text style={styles.cardLabel}>{inlineText(block.header[cellIndex])}</Text>
                <Text style={cellIndex === 0 ? styles.cardValueFirst : styles.cardValue}>
                  <InlineNodes nodes={cell} />
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.table} role="table">
      <View style={[styles.tableRow, styles.tableHead]} role="row">
        {block.header.map((cell, index) => (
          <View key={index} style={[styles.tableCell, { flex: flexFor(index) }]} role="columnheader">
            <Text style={styles.tableHeadText}>
              <InlineNodes nodes={cell} />
            </Text>
          </View>
        ))}
      </View>
      {block.rows.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.tableRow, rowIndex === block.rows.length - 1 && styles.tableRowLast]} role="row">
          {row.map((cell, cellIndex) => (
            <View key={cellIndex} style={[styles.tableCell, { flex: flexFor(cellIndex) }]} role="cell">
              <Text style={cellIndex === 0 ? styles.tableFirstText : styles.tableText}>
                <InlineNodes nodes={cell} />
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function CopyableTemplate({ lines, lang }: { lines: InlineNode[][]; lang: ContentLang }) {
  const [copied, setCopied] = useState(false);
  const canCopy =
    Platform.OS === "web" && typeof globalThis.navigator !== "undefined" && !!globalThis.navigator.clipboard;
  const copy = async () => {
    try {
      await globalThis.navigator.clipboard.writeText(lines.map(inlineText).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <View style={styles.template}>
      {lines.map((line, index) => (
        <Text key={index} style={styles.templateLine} selectable>
          <InlineNodes nodes={line} />
        </Text>
      ))}
      {canCopy ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void copy()}
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
        >
          <Text style={styles.copyText}>
            {copied ? (lang === "en" ? "Copied" : "已复制") : lang === "en" ? "Copy" : "复制"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export type ContentBlocksProps = {
  blocks: ContentBlock[];
  lang: ContentLang;
  /** hero：合作页首屏（居中、字号更大）；body：正文。 */
  variant?: "hero" | "body";
};

export function ContentBlocks({ blocks, lang, variant = "body" }: ContentBlocksProps) {
  const { width } = useWindowDimensions();
  const narrow = width < 720;
  const hero = variant === "hero";
  const align = hero ? "center" : "left";

  const nodes: ReactNode[] = blocks.map((block, index) => {
    switch (block.type) {
      case "heading": {
        const style =
          block.level === 1
            ? [styles.h1, hero && styles.h1Hero, narrow && styles.h1Narrow]
            : block.level === 2
              ? [styles.h2, index === 0 && styles.firstHeading]
              : styles.h3;
        return (
          <Text key={index} style={style} {...headingProps(block.level)}>
            {block.text}
          </Text>
        );
      }
      case "paragraph":
        return (
          <Text key={index} style={[styles.paragraph, hero && styles.paragraphHero]} {...PARAGRAPH_PROPS}>
            <InlineNodes nodes={block.inlines} />
          </Text>
        );
      case "cta":
        return <CtaRow key={index} links={block.links} align={align} />;
      case "list":
        return (
          <View key={index} style={styles.list} role="list">
            {block.items.map((item, itemIndex) => (
              <View key={itemIndex} style={styles.listItem} role="listitem">
                <Text style={[styles.listMarker, block.ordered && styles.listMarkerOrdered]}>
                  {block.ordered ? `${itemIndex + 1}.` : "•"}
                </Text>
                <Text style={styles.listText}>
                  <InlineNodes nodes={item} />
                </Text>
              </View>
            ))}
          </View>
        );
      case "table":
        return <ContentTable key={index} block={block} narrow={narrow} />;
      case "quote":
        return <CopyableTemplate key={index} lines={block.lines} lang={lang} />;
    }
  });

  return <View style={hero ? styles.heroBlocks : styles.blocks}>{nodes}</View>;
}

const styles = StyleSheet.create({
  blocks: { width: "100%" },
  heroBlocks: { width: "100%", alignItems: "center" },
  h1: { color: COLORS.strong, fontSize: 30, lineHeight: 40, fontWeight: "900", marginBottom: 14, letterSpacing: 0 },
  h1Hero: { textAlign: "center", maxWidth: 820 },
  h1Narrow: { fontSize: 24, lineHeight: 32 },
  h2: { color: COLORS.strong, fontSize: 21, lineHeight: 30, fontWeight: "900", marginTop: 34, marginBottom: 12 },
  firstHeading: { marginTop: 8 },
  h3: { color: COLORS.gold, fontSize: 16, lineHeight: 24, fontWeight: "800", marginTop: 20, marginBottom: 8 },
  paragraph: { color: COLORS.text, fontSize: 15, lineHeight: 26, marginBottom: 12 },
  paragraphHero: { textAlign: "center", maxWidth: 760, color: "#CBD5E1" },
  strong: { color: COLORS.strong, fontWeight: "800" },
  link: { color: COLORS.gold, textDecorationLine: "underline" },
  ctaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4, marginBottom: 16 },
  ctaRowCenter: { justifyContent: "center" },
  ctaButton: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 7,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center",
    textDecorationLine: "none",
  },
  ctaPrimary: { backgroundColor: COLORS.goldDeep, borderColor: COLORS.goldDeep, color: "#0A0E1A" },
  ctaSecondary: { borderColor: "rgba(216,188,131,0.55)", color: COLORS.gold },
  pressed: { opacity: 0.82 },
  list: { marginBottom: 12, gap: 8 },
  listItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  listMarker: { color: COLORS.gold, fontSize: 15, lineHeight: 26, width: 14, fontWeight: "900" },
  listMarkerOrdered: { width: 22 },
  listText: { flex: 1, color: COLORS.text, fontSize: 15, lineHeight: 26 },
  table: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, overflow: "hidden", marginTop: 4, marginBottom: 14 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableRowLast: { borderBottomWidth: 0 },
  tableHead: { backgroundColor: COLORS.tint },
  tableCell: { paddingHorizontal: 12, paddingVertical: 10, minWidth: 0 },
  tableHeadText: { color: COLORS.gold, fontSize: 14, fontWeight: "800" },
  tableFirstText: { color: COLORS.strong, fontSize: 14, lineHeight: 22, fontWeight: "700" },
  tableText: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  cardTable: { gap: 10, marginTop: 4, marginBottom: 14 },
  cardRow: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 4 },
  cardCell: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(148,163,184,0.14)" },
  cardCellFirst: { borderTopWidth: 0 },
  cardLabel: { color: COLORS.gold, fontSize: 12, fontWeight: "800", marginBottom: 3 },
  cardValueFirst: { color: COLORS.strong, fontSize: 15, lineHeight: 23, fontWeight: "800" },
  cardValue: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  template: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
    backgroundColor: COLORS.tint,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 14,
    gap: 6,
  },
  templateLine: { color: COLORS.text, fontSize: 14, lineHeight: 23 },
  copyButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.55)",
  },
  copyText: { color: COLORS.gold, fontSize: 13, fontWeight: "800" },
});
