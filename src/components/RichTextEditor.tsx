import { useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import Quill from "quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

// Enable px-based sizing and color/background via style attributors
const SizeStyle = (Quill as any).import("attributors/style/size");
const ColorStyle = (Quill as any).import("attributors/style/color");
const BackgroundStyle = (Quill as any).import("attributors/style/background");
(Quill as any).register(SizeStyle, true);
(Quill as any).register(ColorStyle, true);
(Quill as any).register(BackgroundStyle, true);

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
  const [currentSize, setCurrentSize] = useState<number>(16);
  const toolbarId = useRef(`rte-toolbar-${Math.random().toString(36).slice(2)}`).current;

  const modules = useMemo(() => ({
    toolbar: { container: `#${toolbarId}` },
  }), [toolbarId]);

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
    let range = editor.getSelection(true);
    if (!range) {
      editor.setSelection(editor.getLength(), 0);
      range = editor.getSelection(true);
      if (!range) return;
    }
    const current = editor.getFormat(range).size as string | undefined;
    const base = current?.endsWith("px") ? parseInt(current) : 16;
    const next = Math.max(8, Math.min(96, base + delta));
    editor.format("size", `${next}px`);
    setCurrentSize(next);
  };

  const applyColor = (type: "color" | "background", color: string) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    let range = editor.getSelection(true);
    if (!range) {
      editor.setSelection(editor.getLength(), 0);
      range = editor.getSelection(true);
      if (!range) return;
    }
    editor.format(type, color);
  };

  return (
    <div className={className}>
      <div id={toolbarId} className="ql-toolbar ql-snow">
        <span className="ql-formats">
          <button className="ql-bold" />
          <button className="ql-italic" />
          <button className="ql-underline" />
        </span>
        <span className="ql-formats">
          <select className="ql-align">
            <option defaultValue="" />
            <option value="center" />
            <option value="right" />
            <option value="justify" />
          </select>
          <button className="ql-list" value="ordered" />
          <button className="ql-list" value="bullet" />
          <button className="ql-blockquote" />
          <button className="ql-link" />
          <button className="ql-clean" />
        </span>
        <span className="ql-formats">
          <button type="button" onClick={() => applySizeDelta(-2)}>A-</button>
          <button type="button" onClick={() => applySizeDelta(2)}>A+</button>
          <span className="text-xs text-muted-foreground tabular-nums">{currentSize}px</span>
        </span>
        <span className="ql-formats">
          <label className="text-xs text-muted-foreground">
            文字色
            <input type="color" className="ml-2 h-6 w-10 p-0 border rounded" onChange={(e) => applyColor("color", e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">
            背景色
            <input type="color" className="ml-2 h-6 w-10 p-0 border rounded" onChange={(e) => applyColor("background", e.target.value)} />
          </label>
        </span>
        <span className="ql-formats ms-auto">
          <button type="button" onClick={() => { setHtmlMode(!htmlMode); setDraftHtml(value); }}>
            {htmlMode ? "リッチテキストに戻る" : "HTML編集"}
          </button>
        </span>
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
        <ReactQuill
          ref={quillRef as any}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          onChangeSelection={(range: any, _source: any, editor: any) => {
            try {
              const fmt = editor?.getFormat(range) || {};
              const s = fmt.size as string | undefined;
              const px = s && s.endsWith("px") ? parseInt(s) : 16;
              setCurrentSize(px);
            } catch {
              // noop
            }
          }}
        />
      )}
    </div>
  );
}

export default RichTextEditor;
