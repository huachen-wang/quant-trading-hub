import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Platform, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";
import {
  isSafeRichTextUrl,
  sanitizeRichHtml,
} from "@/components/sanitize-rich-html";

const TIPTAP_REACT_MODULE = "@tiptap/react";
const TIPTAP_STARTER_KIT_MODULE = "@tiptap/starter-kit";
const TIPTAP_LINK_MODULE = "@tiptap/extension-link";
const TIPTAP_IMAGE_MODULE = "@tiptap/extension-image";
const TIPTAP_CORE_MODULE = "@tiptap/core";

/**
 * 富文本编辑器（admin 用）
 *
 * Web 平台：用 @tiptap/react 提供所见即所得编辑
 * 移动端：fallback 到 textarea（admin 通常在 PC 上编辑，移动端只是兜底）
 *
 * 依赖：
 *   pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image
 *
 * 用法：
 *   <TiptapEditor
 *     value={formData.richDescription}
 *     onChange={(html) => setFormData({...formData, richDescription: html})}
 *   />
 */

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function TiptapEditor({ value, onChange, placeholder, minHeight = 280 }: TiptapEditorProps) {
  const colors = useColors();

  // 移动端 fallback: 普通 textarea
  if (Platform.OS !== "web") {
    return (
      <View>
        <View
          style={[
            styles.mobileNotice,
            { borderColor: "rgba(245,158,11,0.3)" },
          ]}
        >
          <Text style={{ color: "#D8BC83", fontSize: 11, fontWeight: "700" }}>
            移动端提示
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
            移动端使用纯文本编辑。如需富文本所见即所得，请在 PC 浏览器打开后台。
          </Text>
        </View>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder || "<p>商品介绍...</p>"}
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={10}
          style={[
            styles.fallbackInput,
            {
              minHeight,
              borderColor: colors.border,
              color: colors.foreground,
              fontFamily: "monospace",
            },
          ]}
        />
      </View>
    );
  }

  // Web 端：使用 tiptap
  return <WebTiptapEditor value={value} onChange={onChange} placeholder={placeholder} minHeight={minHeight} />;
}

// ─── Web 端实现 ───
function WebTiptapEditor({
  value,
  onChange,
  placeholder,
  minHeight,
}: TiptapEditorProps) {
  const colors = useColors();
  const [editor, setEditor] = useState<any>(null);
  const [EditorContentComp, setEditorContentComp] = useState<any>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import(TIPTAP_REACT_MODULE)
      .then((m) => {
        if (!cancelled) setEditorContentComp(() => m.EditorContent);
      })
      .catch((err) => {
        console.error("[TiptapEditor] failed to load editor content:", err);
        if (!cancelled) setHasError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let createdEditor: any = null;
    (async () => {
      try {
        const StarterKit = (await import(TIPTAP_STARTER_KIT_MODULE)).default;
        const Link = (await import(TIPTAP_LINK_MODULE)).default;
        const Image = (await import(TIPTAP_IMAGE_MODULE)).default;

        // 注：useEditor 是 hook，不能在这里调用，需要用 EditorContent 渲染
        // 改用 Editor class 直接 new
        const { Editor } = await import(TIPTAP_CORE_MODULE);

        const ed = new Editor({
          extensions: [
            StarterKit,
            Link.configure({ openOnClick: false }),
            Image,
          ],
          content: sanitizeRichHtml(value) || "<p></p>",
          onUpdate: ({ editor }: { editor: any }) => {
            onChange(sanitizeRichHtml(editor.getHTML()));
          },
        });

        if (cancelled) {
          ed.destroy();
          return;
        }

        createdEditor = ed;
        setEditor(ed);
      } catch (err) {
        console.error("[TiptapEditor] failed to load tiptap:", err);
        setHasError(true);
      }
    })();

    return () => {
      cancelled = true;
      createdEditor?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步外部 value 变化（仅当 editor 创建后）
  useEffect(() => {
    if (!editor) return;
    const safeValue = sanitizeRichHtml(value) || "<p></p>";
    if (safeValue !== editor.getHTML()) {
      editor.commands.setContent(safeValue, false);
    }
  }, [value, editor]);

  // tiptap 加载失败 → fallback textarea
  if (hasError) {
    return (
      <View>
        <Text style={{ color: "#F87171", fontSize: 11, marginBottom: 6 }}>
          富文本编辑器加载失败，已降级为纯文本编辑器。请确认已安装 @tiptap/* 依赖。
        </Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.fallbackInput, { minHeight, color: colors.foreground }]}
        />
      </View>
    );
  }

  if (!editor) {
    return (
      <View
        style={[
          styles.tiptapWrap,
          { minHeight, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
        ]}
      >
        <Text style={{ color: colors.muted, fontSize: 12 }}>加载编辑器中...</Text>
      </View>
    );
  }

  // ─── 工具栏 ───
  const Toolbar = () => (
    <View style={styles.toolbar}>
      <ToolbarBtn label="B" tooltip="加粗" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} bold />
      <ToolbarBtn label="I" tooltip="斜体" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} italic />
      <ToolbarBtn label="S" tooltip="删除线" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <View style={styles.toolbarSep} />
      <ToolbarBtn label="H1" tooltip="标题 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
      <ToolbarBtn label="H2" tooltip="标题 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <ToolbarBtn label="H3" tooltip="标题 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <View style={styles.toolbarSep} />
      <ToolbarBtn label="• 列表" tooltip="无序列表" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolbarBtn label="1. 列表" tooltip="有序列表" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolbarBtn label="❝" tooltip="引用" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <ToolbarBtn label="</>" tooltip="代码块" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      <View style={styles.toolbarSep} />
      <ToolbarBtn
        label="LINK"
        tooltip="链接"
        onClick={() => {
          const url = window.prompt("输入链接地址");
          if (url && isSafeRichTextUrl(url, "link")) {
            editor.chain().focus().setLink({ href: url }).run();
          } else if (url) {
            window.alert("只允许 http(s)、站内路径、锚点、mailto 或 tel 链接");
          }
          else editor.chain().focus().unsetLink().run();
        }}
      />
      <ToolbarBtn
        label="IMG"
        tooltip="插入图片"
        onClick={() => {
          const url = window.prompt("输入图片 URL");
          if (url && isSafeRichTextUrl(url, "image")) {
            editor.chain().focus().setImage({ src: url }).run();
          } else if (url) {
            window.alert("图片只允许 http(s) 或站内绝对路径；禁止 data/blob URL");
          }
        }}
      />
      <View style={{ flex: 1 }} />
      <ToolbarBtn label="↶" tooltip="撤销" onClick={() => editor.chain().focus().undo().run()} />
      <ToolbarBtn label="↷" tooltip="重做" onClick={() => editor.chain().focus().redo().run()} />
    </View>
  );

  if (!EditorContentComp) {
    return (
      <View style={[styles.tiptapWrap, { minHeight }]}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.tiptapWrap, { borderColor: colors.border }]}>
      <Toolbar />
      <View style={[styles.tiptapBody, { minHeight }]}>
        <EditorContentComp editor={editor} />
        {React.createElement(
          "style",
          null,
          `
              .ProseMirror {
                outline: none;
                color: #F1F5F9;
                font-size: 14px;
                line-height: 1.7;
                padding: 12px 14px;
                min-height: ${minHeight}px;
              }
              .ProseMirror p { margin: 0 0 12px; }
              .ProseMirror h1 { font-size: 22px; font-weight: 800; margin: 16px 0 10px; }
              .ProseMirror h2 { font-size: 19px; font-weight: 800; margin: 14px 0 8px; }
              .ProseMirror h3 { font-size: 17px; font-weight: 800; margin: 12px 0 8px; }
              .ProseMirror strong { color: #D8BC83; font-weight: 700; }
              .ProseMirror em { color: #94A3B8; font-style: italic; }
              .ProseMirror a { color: #60A5FA; text-decoration: underline; }
              .ProseMirror ul, .ProseMirror ol { margin: 0 0 12px; padding-left: 20px; }
              .ProseMirror li { margin-bottom: 4px; }
              .ProseMirror blockquote {
                border-left: 3px solid #A8895A;
                padding: 6px 12px;
                margin: 12px 0;
                background: rgba(245, 158, 11, 0.06);
                color: #94A3B8;
                font-style: italic;
                border-radius: 6px;
              }
              .ProseMirror code {
                background: rgba(59, 130, 246, 0.12);
                color: #93c5fd;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 13px;
              }
              .ProseMirror pre {
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(148, 163, 184, 0.12);
                border-radius: 8px;
                padding: 12px;
                margin: 12px 0;
              }
              .ProseMirror pre code { background: transparent; padding: 0; color: #F1F5F9; }
              .ProseMirror img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }
            `,
        )}
      </View>
    </View>
  );
}

function ToolbarBtn({
  label,
  tooltip,
  active,
  onClick,
  bold,
  italic,
}: {
  label: string;
  tooltip?: string;
  active?: boolean;
  onClick: () => void;
  bold?: boolean;
  italic?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      style={{
        background: active ? "rgba(245,158,11,0.15)" : "transparent",
        color: active ? "#D8BC83" : "#94A3B8",
        border: "1px solid " + (active ? "rgba(245,158,11,0.4)" : "transparent"),
        padding: "6px 10px",
        margin: "0 1px",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: bold ? 800 : 600,
        fontStyle: italic ? "italic" : "normal",
        minWidth: 28,
      } as any}
    >
      {label}
    </button>
  );
}

const styles = StyleSheet.create({
  mobileNotice: {
    backgroundColor: "rgba(245,158,11,0.05)",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  fallbackInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    textAlignVertical: "top",
  },
  tiptapWrap: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 2,
    padding: 6,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
  },
  toolbarSep: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(148,163,184,0.2)",
    marginHorizontal: 4,
  },
  tiptapBody: { flex: 1 },
});
