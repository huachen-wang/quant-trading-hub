const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "a",
  "img",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "div",
  "span",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);
const BLOCKED_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "svg",
  "math",
  "template",
  "meta",
  "link",
  "base",
  "video",
  "audio",
  "source",
  "canvas",
] as const;

const GLOBAL_ATTRIBUTES = new Set(["title"]);
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  th: new Set(["colspan", "rowspan"]),
  td: new Set(["colspan", "rowspan"]),
};

/**
 * Strict allowlist sanitizer for stored rich text.
 *
 * It deliberately drops inline styles, classes, ids, event handlers, embedded
 * documents/forms, data URLs and every tag/attribute not listed above. This is
 * kept dependency-free so the same function runs during SSR, Expo web and
 * tests; it is not a general-purpose HTML parser.
 */
export function sanitizeRichHtml(input: string | null | undefined): string {
  if (!input) return "";
  const source = input.replace(/<!--([\s\S]*?)-->/g, "");
  let output = "";
  let cursor = 0;
  const blockedStack: string[] = [];

  while (cursor < source.length) {
    const tagStart = source.indexOf("<", cursor);
    if (tagStart === -1) {
      if (!blockedStack.length) output += escapeStrayAngles(source.slice(cursor));
      break;
    }
    if (!blockedStack.length) {
      output += escapeStrayAngles(source.slice(cursor, tagStart));
    }

    const tagEnd = findTagEnd(source, tagStart);
    if (tagEnd === -1) {
      if (!blockedStack.length) output += escapeStrayAngles(source.slice(tagStart));
      break;
    }

    const rawTag = source.slice(tagStart, tagEnd + 1);
    const identity = identifyTag(rawTag);
    if (identity && BLOCKED_TAGS.includes(identity.name as (typeof BLOCKED_TAGS)[number])) {
      if (identity.closing) {
        const matchingIndex = blockedStack.lastIndexOf(identity.name);
        if (matchingIndex >= 0) blockedStack.splice(matchingIndex);
      } else if (!identity.selfClosing) {
        blockedStack.push(identity.name);
      }
    } else if (!blockedStack.length) {
      output += sanitizeTag(rawTag);
    }
    cursor = tagEnd + 1;
  }
  return output;
}

export function isSafeRichTextUrl(
  value: string,
  kind: "link" | "image" = "link",
): boolean {
  const decoded = decodeForSchemeCheck(value).trim();
  if (!decoded) return false;
  const compact = decoded
    .replace(/[\u0000-\u0020\u007f-\u009f]/g, "")
    .toLowerCase();
  if (
    compact.startsWith("javascript:") ||
    compact.startsWith("data:") ||
    compact.startsWith("vbscript:") ||
    compact.startsWith("file:") ||
    compact.startsWith("blob:") ||
    compact.startsWith("//")
  ) {
    return false;
  }
  if (compact.startsWith("https://") || compact.startsWith("http://")) {
    return true;
  }
  if (compact.startsWith("/") && !compact.startsWith("//")) return true;
  if (kind === "link" && compact.startsWith("#")) return true;
  if (
    kind === "link" &&
    (compact.startsWith("mailto:") || compact.startsWith("tel:"))
  ) {
    return true;
  }
  return false;
}

function sanitizeTag(rawTag: string): string {
  const closing = rawTag.match(/^<\s*\/\s*([a-z0-9]+)\s*>$/i);
  if (closing) {
    const tag = closing[1].toLowerCase();
    return ALLOWED_TAGS.has(tag) && !VOID_TAGS.has(tag) ? `</${tag}>` : "";
  }

  const opening = rawTag.match(/^<\s*([a-z0-9]+)([\s\S]*?)\/?\s*>$/i);
  if (!opening) return "";
  const tag = opening[1].toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return "";

  const attributes: string[] = [];
  let targetBlank = false;
  const attributePattern =
    /([A-Za-z][A-Za-z0-9:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of opening[2].matchAll(attributePattern)) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    const allowed =
      GLOBAL_ATTRIBUTES.has(name) || TAG_ATTRIBUTES[tag]?.has(name);
    if (!allowed || name.startsWith("on") || name === "style") continue;

    if (name === "href" || name === "src") {
      const kind = name === "src" ? "image" : "link";
      if (!isSafeRichTextUrl(value, kind)) continue;
      attributes.push(`${name}="${escapeAttribute(value)}"`);
      continue;
    }
    if (name === "target") {
      if (value === "_blank") targetBlank = true;
      continue;
    }
    if (["width", "height", "colspan", "rowspan"].includes(name)) {
      if (!/^\d{1,4}$/.test(value)) continue;
    }
    attributes.push(`${name}="${escapeAttribute(value)}"`);
  }

  if (tag === "a" && targetBlank) {
    attributes.push('target="_blank"', 'rel="noopener noreferrer"');
  }
  const suffix = attributes.length ? ` ${attributes.join(" ")}` : "";
  return VOID_TAGS.has(tag) ? `<${tag}${suffix}>` : `<${tag}${suffix}>`;
}

function decodeForSchemeCheck(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);?/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&colon;?/gi, ":")
    .replace(/&tab;?/gi, "\t")
    .replace(/&newline;?/gi, "\n");
}

/** Finds a real tag boundary instead of treating a quoted `>` as the end. */
function findTagEnd(source: string, start: number) {
  let quote: '"' | "'" | null = null;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function identifyTag(rawTag: string) {
  const match = rawTag.match(/^<\s*(\/?)\s*([a-z0-9]+)\b[\s\S]*>$/i);
  if (!match) return null;
  return {
    name: match[2].toLowerCase(),
    closing: Boolean(match[1]),
    selfClosing: /\/\s*>$/.test(rawTag),
  };
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeStrayAngles(value: string) {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
