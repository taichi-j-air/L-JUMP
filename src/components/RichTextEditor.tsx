import { useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import Quill from "quill";
import type { RangeStatic } from "quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { MediaSelector } from "./MediaSelector";

// pxベースの size / color / background をstyleで使えるように
const SizeStyle = (Quill as any).import("attributors/style/size");
SizeStyle.whitelist = null;
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

export function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [draftHtml, setDraftHtml] = useState(value);
  const quillRef = useRef<ReactQuill | null>(null);
  const [currentSize, setCurrentSize] = useState<number>(16);
  const [sizeInput, setSizeInput] = useState("16");
  const toolbarId = useRef(`rte-toolbar-${Math.random().toString(36).slice(2)}`).current;
  const [mediaOpen, setMediaOpen] = useState(false);
  const lastRangeRef = useRef<RangeStatic | null>(null);

  // ReactQuill に渡すモジュール
  const modules = useMemo(
    () => ({
      toolbar: { container: `#${toolbarId}` },
      clipboard: { matchVisual: false },
    }),
    [toolbarId]
  );

  // Quill が扱うフォーマットの whitelist
  const formats = [
    "bold",
    "italic",
    "underline",
    "align",
    "list",
    "blockquote",
    "link",
    "size",
    "color",
    "background",
    "image",   // 追加入
    "video",   // 追加入
  ];

  // 親の value 更新をHTML モード時にも追従
  useEffect(() => {
    if (htmlMode) setDraftHtml(value);
  }, [value, htmlMode]);

  const getQuill = () => quillRef.current?.getEditor();

  const parseSizeValue = (value?: string | null): number | null => {
    if (!value) return null;
    const numeric = parseInt(value, 10);
    return Number.isNaN(numeric) ? null : numeric;
  };

  const parseSizeInput = (value: string): number | null => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    const normalized = trimmed.endsWith("px") ? trimmed.slice(0, -2) : trimmed;
    if (!/^\d+$/.test(normalized)) return null;
    const parsed = parseInt(normalized, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const clampSize = (value: number) => Math.max(8, Math.min(96, value));

  const applySize = (size: number, context?: { editor?: any; range?: RangeStatic | null }) => {
    const editor = context?.editor ?? getQuill();
    const clamped = clampSize(size);

    if (!editor) {
      setCurrentSize(clamped);
      setSizeInput(clamped.toString());
      return;
    }

    const targetRange = context?.range ?? lastRangeRef.current ?? editor.getSelection();

    if (targetRange) {
      const length = targetRange.length ?? 0;

      if (length > 0) {
        editor.formatText(targetRange.index, length, "size", `${clamped}px`, "user");
      } else {
        editor.format("size", `${clamped}px`);
      }

      lastRangeRef.current = { index: targetRange.index, length };
    } else {
      editor.format("size", `${clamped}px`);
      lastRangeRef.current = null;
    }

    setCurrentSize(clamped);
    setSizeInput(clamped.toString());
  };

  const insertMedia = (url: string) => {
    if (!url) return;
    const editor = getQuill();
    if (!editor) return;

    let range = editor.getSelection(true);
    if (!range) {
      editor.setSelection(editor.getLength(), 0);
      range = editor.getSelection(true);
      if (!range) return;
    }

    const lower = url.toLowerCase();
    const isImage = /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg)(\?.*)?$/.test(lower);
    const isVideo = /(\.mp4|\.webm|\.mov|\.m4v)(\?.*)?$/.test(lower);

    if (isImage) {
      editor.insertEmbed(range.index, "image", url, "user");
      editor.setSelection(range.index + 1, 0);
    } else if (isVideo) {
      // 注意: Quill標準は <iframe> ベース。直リンクmp4はテーマによって表示されないことがあります。
      editor.insertEmbed(range.index, "video", url, "user");
      editor.setSelection(range.index + 1, 0);
    } else {
      // 正しいAPIシグネチャに修正。Formats はオブジェクト、source は 'user'。
      editor.insertText(range.index, url, { link: url }, "user");
      editor.setSelection(range.index + url.length, 0);
    }
  };

  const applySizeDelta = (delta: number) => {
    const editor = getQuill();
    if (!editor) return;

    const range = editor.getSelection(true);
    const fmt = range ? editor.getFormat(range) : editor.getFormat();
    const parsedCurrent = parseSizeValue(fmt.size as string | undefined);
    const baseSize = parsedCurrent ?? currentSize ?? 16;

    applySize(baseSize + delta, { editor, range });
  };

  const applyColor = (type: "color" | "background", color: string) => {
    const editor = getQuill();
    if (!editor) return;

    // 選択が無くてもカーソル位置のフォーマットに適用される
    editor.format(type, color);
  };

  useEffect(() => {
    setSizeInput(currentSize.toString());
  }, [currentSize]);

  return (
    <div className={className}>
      {/* カスタムツールバー */}
      <div id={toolbarId} className="ql-toolbar ql-snow flex flex-wrap items-center gap-2">
        <span className="ql-formats">
          <button className="ql-bold" />
          <button className="ql-italic" />
          <button className="ql-underline" />
        </span>

        <span className="ql-formats">
          <button className="ql-align" value="" />
          <button className="ql-align" value="center" />
          <button className="ql-align" value="right" />
          <button className="ql-align" value="justify" />
          <button className="ql-list" value="ordered" />
          <button className="ql-list" value="bullet" />
          <button className="ql-blockquote" />
          <button className="ql-link" />
          <button className="ql-clean" />
        </span>

        <span className="ql-formats">
          <button type="button" onClick={() => applySizeDelta(-2)}>A-</button>
          <button type="button" onClick={() => applySizeDelta(2)}>A+</button>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              pattern="\\d*"
              className="w-14 rounded border border-input bg-background px-2 py-1 text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              onBlur={(e) => {
                const parsed = parseSizeInput(e.target.value);
                if (parsed === null) {
                  setSizeInput(currentSize.toString());
                  return;
                }
                const editor = getQuill();
                const storedRange = lastRangeRef.current ? { ...lastRangeRef.current } : null;
                applySize(parsed, { editor, range: storedRange });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              aria-label="Font size"
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </span>

        <span className="ql-formats">
          <label className="text-xs text-muted-foreground">
            文字色
            <input
              type="color"
              className="ml-2 h-6 w-6 p-0 border rounded-none aspect-square"
              onChange={(e) => applyColor("color", e.target.value)}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            背景色
            <input
              type="color"
              className="ml-2 h-6 w-6 p-0 border rounded-none aspect-square"
              onChange={(e) => applyColor("background", e.target.value)}
            />
          </label>
        </span>

        <span className="ql-formats ml-auto flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMediaOpen(true)}
            title="ライブラリ"
            className="text-xs px-2 py-1"
          >
            ライブラリ
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`text-xs px-2 py-1 ${htmlMode ? "bg-muted" : ""}`}
            onClick={() => {
              setHtmlMode(!htmlMode);
              if (!htmlMode) setDraftHtml(value);
            }}
            title="HTML"
          >
            HTML
          </Button>
        </span>
      </div>

      {/* メディア選択ダイアログ */}
      <Dialog open={mediaOpen} onOpenChange={setMediaOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>メディアライブラリ</DialogTitle>
          </DialogHeader>
          <MediaSelector
            onSelect={(url) => {
              insertMedia(url);
              setMediaOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* 本体 */}
      {htmlMode ? (
        <div className="space-y-2">
          <Textarea
            value={draftHtml}
            onChange={(e) => {
              setDraftHtml(e.target.value);
              onChange(e.target.value);
            }}
            rows={10}
          />
        </div>
      ) : (
        <ReactQuill
          ref={quillRef as any}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          style={{ minHeight: "200px" }}
          className="[&_.ql-editor]:min-h-[180px] [&>.ql-toolbar]:hidden"
          onChangeSelection={(range: any) => {
            try {
              const q = getQuill();
              if (!q) return;
              if (range) {
                lastRangeRef.current = { index: range.index, length: range.length ?? 0 };
              }

              const fmt = range ? q.getFormat(range) : q.getFormat();
              const parsed = parseSizeValue(fmt.size as string | undefined);
              setCurrentSize(parsed ?? 16);
            } catch {
              /* noop */
            }
          }}
        />
      )}
    </div>
  );
}

export default RichTextEditor;