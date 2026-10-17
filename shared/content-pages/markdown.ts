/**
 * 内容页（合作页、指南页）用的极简 Markdown 子集解析器（2026-10-18）。
 *
 * 只认稿件里实际用到的写法：# / ## / ### 标题、段落（段内每行一行）、`- ` 列表、`1. ` 有序列表、
 * `|` 表格、`> ` 引用（可复制模板，每行一行）、行内 **加粗** 与 [文字](链接)。
 * 只包含链接（用 · 隔开）的段落当作按钮行（cta）。
 *
 * 服务端预渲染（server/_core/seo-content-pages.ts）和前端页面（components/content/）
 * 用同一份解析结果，保证不跑 JS 看到的正文和页面上看到的正文是同一份。
 */

export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "break" };

export type ContentLink = { text: string; href: string };

export type ContentBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; inlines: InlineNode[] }
  | { type: "cta"; links: ContentLink[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "table"; header: InlineNode[][]; rows: InlineNode[][][] }
  | { type: "quote"; lines: InlineNode[][] };

const INLINE_PATTERN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** 一行文字里的加粗与链接。 */
export function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  INLINE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_PATTERN.exec(source)) !== null) {
    if (match.index > last) nodes.push({ kind: "text", text: source.slice(last, match.index) });
    if (match[1] !== undefined) nodes.push({ kind: "strong", text: match[1] });
    else nodes.push({ kind: "link", text: match[2], href: match[3] });
    last = match.index + match[0].length;
  }
  if (last < source.length) nodes.push({ kind: "text", text: source.slice(last) });
  return nodes;
}

/**
 * 多行段落：源文件里的每一行都是一行（问答的「问」和「答」就是这样写的）。
 * 不依赖行尾两个空格——编辑器保存时常把行尾空格删掉。
 */
function parseLines(lines: string[]): InlineNode[] {
  const nodes: InlineNode[] = [];
  lines.forEach((line, index) => {
    nodes.push(...parseInline(line.trim()));
    if (index < lines.length - 1) nodes.push({ kind: "break" });
  });
  return nodes;
}

/** 段落只由链接组成（中间只有 · 或空白）时当按钮行。 */
function asCta(nodes: InlineNode[]): ContentLink[] | null {
  const links: ContentLink[] = [];
  for (const node of nodes) {
    if (node.kind === "link") links.push({ text: node.text, href: node.href });
    else if (node.kind === "text" && /^[\s·]*$/.test(node.text)) continue;
    else return null;
  }
  return links.length > 0 ? links : null;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseContentMarkdown(source: string): ContentBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ContentBlock[] = [];
  let i = 0;

  const isBlockStart = (line: string) =>
    /^#{1,3} /.test(line) || /^\|/.test(line) || /^> ?/.test(line) || /^- /.test(line) || /^\d+\. /.test(line);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (/^\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      const [header, separator, ...body] = rows;
      if (!header || !separator || !separator.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        throw new Error(`表格格式不对：${line}`);
      }
      blocks.push({
        type: "table",
        header: header.map(parseInline),
        rows: body.map((row) => {
          if (row.length !== header.length) throw new Error(`表格列数不一致：${row.join(" | ")}`);
          return row.map(parseInline);
        }),
      });
      continue;
    }

    if (/^> ?/.test(line)) {
      const quoteLines: InlineNode[][] = [];
      while (i < lines.length && /^> ?/.test(lines[i])) {
        quoteLines.push(parseInline(lines[i].replace(/^> ?/, "").trim()));
        i += 1;
      }
      blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }

    const listMatch = /^(- |\d+\. )/.exec(line);
    if (listMatch) {
      const ordered = listMatch[1] !== "- ";
      const itemPattern = ordered ? /^\d+\. / : /^- /;
      const items: InlineNode[][] = [];
      while (i < lines.length && itemPattern.test(lines[i])) {
        items.push(parseInline(lines[i].replace(itemPattern, "").trim()));
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !(paragraph.length > 0 && isBlockStart(lines[i]))) {
      paragraph.push(lines[i]);
      i += 1;
    }
    const inlines = parseLines(paragraph);
    const cta = asCta(inlines);
    blocks.push(cta ? { type: "cta", links: cta } : { type: "paragraph", inlines });
  }

  return blocks;
}

/** 去掉格式后的纯文字（复制模板、描述摘要用）。 */
export function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => (node.kind === "break" ? "\n" : node.text))
    .join("");
}
