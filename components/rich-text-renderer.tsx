import React from "react";
import { View, Text, Platform, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { sanitizeRichHtml } from "@/components/sanitize-rich-html";

interface RichTextRendererProps {
  /** 富文本 HTML 字符串（来自 strategies.richDescription） */
  html?: string | null;
  /** 当 html 为空时的 fallback 纯文本（来自 strategies.description） */
  fallback?: string | null;
  /** 是否限制最大宽度（详情页常用） */
  maxWidth?: number;
}

/**
 * 富文本渲染器
 *
 * 设计：
 *  - Web 平台先经过严格 allowlist sanitize，再用原生 div 渲染
 *  - 移动端做基础解析（段落、换行、加粗），不引入额外依赖
 *  - 都没有时回退到纯文本
 *
 * 后续如果移动端富文本需求强烈，可以升级到 react-native-render-html
 * （用法：装 `pnpm add react-native-render-html` 然后替换下面的 renderMobile）
 */
export function RichTextRenderer({ html, fallback, maxWidth }: RichTextRendererProps) {
  const colors = useColors();
  const content = sanitizeRichHtml(html).trim();

  // 内容空时回退到纯文本
  if (!content) {
    if (!fallback) return null;
    return (
      <Text style={[styles.fallbackText, { color: colors.muted, maxWidth }]}>
        {fallback}
      </Text>
    );
  }

  if (Platform.OS === "web") {
    // Web 端只接收上方 allowlist sanitizer 的输出；后台内容也不视为可信输入。
    return React.createElement("div", {
      className: "eaxau-rich-content",
      style: {
        color: colors.foreground,
        fontSize: 15,
        lineHeight: "1.7",
        maxWidth: maxWidth || "100%",
      },
      dangerouslySetInnerHTML: { __html: wrapWithStyleScope(content, colors) },
    });
  }

  // 移动端：基础解析（保留段落、换行、加粗）
  return <MobileRichText html={content} colors={colors} />;
}

/**
 * Web 端：把 HTML 包一层带主题 style 的容器
 */
function wrapWithStyleScope(html: string, colors: any): string {
  return `
    <style>
      .eaxau-rich-content { font-family: inherit; }
      .eaxau-rich-content p { margin: 0 0 12px; line-height: 1.7; color: ${colors.foreground}; }
      .eaxau-rich-content h1, .eaxau-rich-content h2, .eaxau-rich-content h3 {
        color: ${colors.foreground}; margin: 20px 0 10px; font-weight: 800; line-height: 1.3;
      }
      .eaxau-rich-content h1 { font-size: 22px; }
      .eaxau-rich-content h2 { font-size: 19px; }
      .eaxau-rich-content h3 { font-size: 17px; }
      .eaxau-rich-content strong, .eaxau-rich-content b { color: #D8BC83; font-weight: 700; }
      .eaxau-rich-content em, .eaxau-rich-content i { color: ${colors.muted}; font-style: italic; }
      .eaxau-rich-content a {
        color: #60A5FA; text-decoration: underline; text-underline-offset: 3px;
        transition: opacity 0.15s;
      }
      .eaxau-rich-content a:hover { opacity: 0.75; }
      .eaxau-rich-content ul, .eaxau-rich-content ol { margin: 0 0 12px; padding-left: 20px; }
      .eaxau-rich-content li { margin-bottom: 6px; line-height: 1.7; color: ${colors.foreground}; }
      .eaxau-rich-content blockquote {
        border-left: 3px solid #A8895A; margin: 12px 0; padding: 8px 14px;
        background: rgba(245, 158, 11, 0.06); color: ${colors.muted}; font-style: italic;
        border-radius: 6px;
      }
      .eaxau-rich-content code {
        background: rgba(59, 130, 246, 0.12); color: #93c5fd;
        padding: 2px 6px; border-radius: 4px; font-size: 13px;
        font-family: 'SF Mono', Menlo, monospace;
      }
      .eaxau-rich-content pre {
        background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(148, 163, 184, 0.12);
        border-radius: 8px; padding: 12px; overflow-x: auto; margin: 12px 0;
      }
      .eaxau-rich-content pre code { background: transparent; padding: 0; color: ${colors.foreground}; }
      .eaxau-rich-content img {
        max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0;
        border: 1px solid rgba(148, 163, 184, 0.12);
      }
      .eaxau-rich-content hr {
        border: none; border-top: 1px solid rgba(148, 163, 184, 0.12); margin: 16px 0;
      }
      .eaxau-rich-content table {
        width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px;
      }
      .eaxau-rich-content th, .eaxau-rich-content td {
        padding: 8px 12px; border: 1px solid rgba(148, 163, 184, 0.12); text-align: left;
      }
      .eaxau-rich-content th {
        background: rgba(245, 158, 11, 0.08); color: #D8BC83; font-weight: 700;
      }
      .eaxau-rich-content td { color: ${colors.foreground}; }
    </style>
    ${html}
  `;
}

/**
 * 移动端富文本：基础解析
 *
 * 把 HTML 转换为带格式的 React Native 节点。支持：
 *  - <p>, <br> → 换行
 *  - <strong>, <b> → 金色加粗
 *  - <em>, <i> → muted 斜体
 *  - <li> → "• " 前缀
 *  - 其他 tag 一律剥离
 */
function MobileRichText({ html, colors }: { html: string; colors: any }) {
  // 先简化 HTML：换行符标准化 + 标签提取
  const blocks = parseToBlocks(html);

  return (
    <View style={{ gap: 10 }}>
      {blocks.map((block, i) => (
        <Text
          key={i}
          style={[
            block.type === "heading" ? styles.mobileHeading : styles.mobileBody,
            { color: block.type === "heading" ? colors.foreground : colors.muted },
          ]}
        >
          {block.parts.map((part, j) => (
            <Text
              key={j}
              style={[
                part.bold && { color: "#D8BC83", fontWeight: "700" as any },
                part.italic && { fontStyle: "italic", color: colors.muted },
                part.code && {
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  backgroundColor: "rgba(59,130,246,0.12)",
                  color: "#93c5fd",
                },
              ]}
            >
              {part.bullet ? "• " : ""}
              {part.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

interface ParsedPart {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  bullet?: boolean;
}
interface ParsedBlock {
  type: "para" | "heading";
  parts: ParsedPart[];
}

function parseToBlocks(html: string): ParsedBlock[] {
  // 把 <br> 转 \n
  let s = html.replace(/<br\s*\/?>/gi, "\n");
  // 用块级标签作为分隔符
  const blockRegex = /<(p|h1|h2|h3|h4|h5|h6|li|blockquote|div)[^>]*>(.*?)<\/\1>/gis;
  const blocks: ParsedBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(s))) {
    const tag = m[1].toLowerCase();
    const inner = m[2];
    const isHeading = /^h[1-6]$/.test(tag);
    const isLi = tag === "li";
    blocks.push({
      type: isHeading ? "heading" : "para",
      parts: parseInline(inner, isLi),
    });
  }
  // 如果没有任何块级标签，直接把整段当一个段落
  if (blocks.length === 0) {
    blocks.push({ type: "para", parts: parseInline(s, false) });
  }
  return blocks;
}

function parseInline(html: string, bullet: boolean): ParsedPart[] {
  const parts: ParsedPart[] = [];
  // 极简 inline 解析：处理 <strong>/<b> <em>/<i> <code>
  // 用 split + tag 标记
  const tokens = html.split(/(<\/?(?:strong|b|em|i|code)[^>]*>)/i);
  let bold = false;
  let italic = false;
  let code = false;
  let firstPart = true;
  for (const tok of tokens) {
    if (!tok) continue;
    if (/<strong|<b\b/i.test(tok)) bold = true;
    else if (/<\/strong|<\/b\b/i.test(tok)) bold = false;
    else if (/<em|<i\b/i.test(tok)) italic = true;
    else if (/<\/em|<\/i\b/i.test(tok)) italic = false;
    else if (/<code/i.test(tok)) code = true;
    else if (/<\/code/i.test(tok)) code = false;
    else {
      // 剥离剩余 tag + 解码 HTML 实体
      const text = tok
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      if (!text) continue;
      parts.push({
        text,
        bold,
        italic,
        code,
        bullet: firstPart && bullet,
      });
      firstPart = false;
    }
  }
  return parts;
}

const styles = StyleSheet.create({
  fallbackText: {
    fontSize: 15,
    lineHeight: 24,
  },
  mobileHeading: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 26,
  },
  mobileBody: {
    fontSize: 15,
    lineHeight: 26,
  },
});
