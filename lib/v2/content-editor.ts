import type { ContentBlock } from "@/shared/v2/contracts";

export type ContentBlockType = ContentBlock["type"];

export type ContentEditorForm = {
  id: string;
  type: ContentBlockType;
  heading: string;
  body: string;
  items: string;
};

export const CONTENT_TYPE_LABELS: Record<ContentBlockType, string> = {
  rich_text: "图文说明",
  evidence: "证据清单",
  timeline: "时间线",
  risk_notice: "风险说明",
  faq: "常见问题",
  media_gallery: "图片资料库",
};

function joinParts(parts: string[]) {
  return parts.map((part) => part.replace(/\|/g, "／")).join(" | ");
}

function splitLine(line: string, length: number) {
  const parts = line.split("|").map((part) => part.trim());
  return Array.from({ length }, (_, index) => parts[index] ?? "");
}

export function blockToEditorForm(block: ContentBlock): ContentEditorForm {
  if (block.type === "rich_text") {
    return {
      id: block.id,
      type: block.type,
      heading: block.heading,
      body: block.paragraphs.join("\n\n"),
      items: block.bullets.join("\n"),
    };
  }
  if (block.type === "risk_notice") {
    return {
      id: block.id,
      type: block.type,
      heading: block.heading,
      body: block.content,
      items: "",
    };
  }
  if (block.type === "evidence") {
    return {
      id: block.id,
      type: block.type,
      heading: block.heading,
      body: "",
      items: block.items
        .map((item) =>
          joinParts([
            item.title,
            item.detail,
            item.status,
            item.observedAt ?? "",
          ]),
        )
        .join("\n"),
    };
  }
  if (block.type === "timeline") {
    return {
      id: block.id,
      type: block.type,
      heading: block.heading,
      body: "",
      items: block.items
        .map((item) => joinParts([item.date, item.title, item.detail]))
        .join("\n"),
    };
  }
  if (block.type === "media_gallery") {
    return {
      id: block.id,
      type: block.type,
      heading: block.heading,
      body: "",
      items: block.items
        .map((item) => joinParts([
          item.title,
          item.thumbnailUrl,
          item.fullUrl,
          item.caption,
          item.alt,
        ]))
        .join("\n"),
    };
  }
  return {
    id: block.id,
    type: block.type,
    heading: block.heading,
    body: "",
    items: block.items
      .map((item) => joinParts([item.question, item.answer]))
      .join("\n"),
  };
}

export function editorFormToBlock(form: ContentEditorForm): ContentBlock {
  const nonEmptyLines = form.items
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (form.type === "rich_text") {
    return {
      id: form.id,
      type: "rich_text",
      heading: form.heading.trim(),
      paragraphs: form.body
        .split(/\n\s*\n/)
        .map((item) => item.trim())
        .filter(Boolean),
      bullets: nonEmptyLines,
    };
  }
  if (form.type === "risk_notice") {
    return {
      id: form.id,
      type: "risk_notice",
      heading: form.heading.trim(),
      content: form.body.trim(),
    };
  }
  if (form.type === "evidence") {
    return {
      id: form.id,
      type: "evidence",
      heading: form.heading.trim(),
      items: nonEmptyLines.map((line) => {
        const [title, detail, rawStatus, observedAt] = splitLine(line, 4);
        const status = ["VERIFIED", "PENDING", "DEMO"].includes(rawStatus)
          ? (rawStatus as "VERIFIED" | "PENDING" | "DEMO")
          : "PENDING";
        return { title, detail, status, ...(observedAt ? { observedAt } : {}) };
      }),
    };
  }
  if (form.type === "timeline") {
    return {
      id: form.id,
      type: "timeline",
      heading: form.heading.trim(),
      items: nonEmptyLines.map((line) => {
        const [date, title, detail] = splitLine(line, 3);
        return { date, title, detail };
      }),
    };
  }
  if (form.type === "media_gallery") {
    return {
      id: form.id,
      type: "media_gallery",
      heading: form.heading.trim(),
      items: nonEmptyLines.map((line, index) => {
        const [title, thumbnailUrl, rawFullUrl, caption, rawAlt] = splitLine(line, 5);
        return {
          id: `${form.id}-media-${index + 1}`,
          title,
          thumbnailUrl,
          fullUrl: rawFullUrl || thumbnailUrl,
          caption,
          alt: rawAlt || title,
        };
      }),
    };
  }
  return {
    id: form.id,
    type: "faq",
    heading: form.heading.trim(),
    items: nonEmptyLines.map((line) => {
      const [question, answer] = splitLine(line, 2);
      return { question, answer };
    }),
  };
}

export function emptyEditorForm(type: ContentBlockType = "rich_text"): ContentEditorForm {
  return {
    id: `content-${Date.now()}`,
    type,
    heading: "",
    body: "",
    items: "",
  };
}

export function editorItemsHelp(type: ContentBlockType) {
  if (type === "rich_text") return "每行一个要点";
  if (type === "evidence") return "每行：标题 | 说明 | VERIFIED / PENDING / DEMO | 可选观察时间";
  if (type === "timeline") return "每行：阶段或日期 | 标题 | 说明";
  if (type === "faq") return "每行：问题 | 回答";
  if (type === "media_gallery") return "每行：标题 | 缩略图 URL | 大图 URL（可留空） | 说明 | 图片替代文字";
  return "此类型无需列表内容";
}
