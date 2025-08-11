import { useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
}

// Minimal, blog-like editor with pixel size +/- and color pickers, plus HTML toggle
export function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [draftHtml, setDraftHtml] = useState(value);
  const quillRef = useRef<ReactQuill | null>(null);

  const modules = useMemo(() => ({
    toolbar: [
      ["bold", "italic", "underline"],
      [{ align: "" }, { align: "center" }, { align: "right" }, { align: "justify" }],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "blockquote"],
      ["clean"],
    ],
  }), []);

  const formats = [
    "bold",
    "italic",
    "underline",
    "align",
    "list",
    "bullet",
    "link",
    "blockquote",
    "size",
    "color",
    "background",
  ];

  const applySizeDelta = (delta: number) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const range = editor.getSelection();
    if (!range) return;
    const current = editor.getFormat(range).size as string | undefined;
    const base = current?.endsWith("px") ? parseInt(current) : 16;
    const next = Math.max(8, Math.min(96, base + delta));
    editor.format("size", `${next}px`);
  };

  const applyColor = (type: "color" | "background", color: string) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const range = editor.getSelection();
    if (!range) return;
    editor.format(type, color);
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => applySizeDelta(-2)}>A-</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => applySizeDelta(2)}>A+</Button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">文字色
            <input type="color" className="ml-2 h-6 w-10 p-0 border rounded" onChange={(e) => applyColor("color", e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">背景色
            <input type="color" className="ml-2 h-6 w-10 p-0 border rounded" onChange={(e) => applyColor("background", e.target.value)} />
          </label>
        </div>
        <div className="ml-auto" />
        <Button type="button" size="sm" onClick={() => { setHtmlMode(!htmlMode); setDraftHtml(value); }}>
          {htmlMode ? "リッチテキストに戻る" : "HTML編集"}
        </Button>
      </div>

      {htmlMode ? (
        <div className="space-y-2">
          <Textarea value={draftHtml} onChange={(e) => setDraftHtml(e.target.value)} rows={8} />
          <div className="flex gap-2">
            <Button type="button" onClick={() => { onChange(draftHtml); setHtmlMode(false); }}>適用</Button>
            <Button type="button" variant="secondary" onClick={() => setHtmlMode(false)}>キャンセル</Button>
          </div>
        </div>
      ) : (
        <ReactQuill ref={quillRef as any} theme="snow" value={value} onChange={onChange} modules={modules} formats={formats} />
      )}
    </div>
  );
}

export default RichTextEditor;
