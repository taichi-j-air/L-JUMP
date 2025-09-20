import { useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import Quill from "quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { MediaSelector } from "./MediaSelector";

// pxベ�Eスの size / color / background めEstyle で使えるように
const SizeStyle = (Quill as any).import("attributors/style/size");
SizeStyle.whitelist = null;
const ColorStyle = (Quill as any).import("attributors/style/color");
const BackgroundStyle = (Quill as any).import("attributors/style/background");
(Quill as any).register(SizeStyle, true);
(Quill as any).register({ "formats/size": SizeStyle }, true);
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
  const toolbarId = useRef(`rte-toolbar-${Math.random().toString(36).slice(2)}`).current;
  const [mediaOpen, setMediaOpen] = useState(false);

  // ReactQuill に渡すモジュール
  const modules = useMemo(
    () => ({
      toolbar: { container: `#${toolbarId}` },
      clipboard: { matchVisual: false },
    }),
    [toolbarId]
  );

  // Quill が扱ぁE��ォーマット�E whitelist
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
    "image",   // ☁E追加
    "video",   // ☁E追加
  ];

  // 親の value 更新めEHTML モード�Eにも追征E
  useEffect(() => {
    if (htmlMode) setDraftHtml(value);
  }, [value, htmlMode]);

  const getQuill = () => quillRef.current?.getEditor();

  const parseSizeValue = (value?: string | null): number | null => {
    if (!value) return null;
    const numeric = parseInt(value, 10);
    return Number.isNaN(numeric) ? null : numeric;
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
      // 注愁E Quill標準�E <iframe> ベ�Eス。直リンクmp4はチE�Eマによって表示されなぁE��とがあります、E
      editor.insertEmbed(range.index, "video", url, "user");
      editor.setSelection(range.index + 1, 0);
    } else {
      // ☁E正しいAPIシグネチャに修正�E�Eormats はオブジェクト、source は 'user'�E�E
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

    const newSize = Math.max(8, Math.min(96, baseSize + delta));
    editor.format("size", `${newSize}px`);

    const fmtAfter = range ? editor.getFormat(range) : editor.getFormat();
    const appliedSize = parseSizeValue(fmtAfter.size as string | undefined) ?? newSize;
    setCurrentSize(appliedSize);
  };

  const applyColor = (type: "color" | "background", color: string) => {
    const editor = getQuill();
    if (!editor) return;

    // 選択が無くてもカーソル位置の封E��書式に適用されめE
    editor.format(type, color);
  };

  return (
    <div className={className}>
      {/* カスタムチE�Eルバ�E */}
      <div id={toolbarId} className="ql-toolbar ql-snow">
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
          <span className="text-xs text-muted-foreground tabular-nums">{currentSize}px</span>
        </span>

        <span className="ql-formats">
          <label className="text-xs text-muted-foreground">
            斁E��色
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

      {/* メチE��ア選択ダイアログ */}
      <Dialog open={mediaOpen} onOpenChange={setMediaOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>メチE��アライブラリ</DialogTitle>
          </DialogHeader>
          <MediaSelector
            onSelect={(url) => {
              insertMedia(url);
              setMediaOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* 本佁E*/}
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
          className="[&_.ql-editor]:min-h-[180px] [&_.ql-toolbar]:flex [&_.ql-toolbar]:flex-wrap [&_.ql-toolbar]:gap-1 [&_.ql-toolbar_.ql-formats]:mr-2"
          onChangeSelection={(range: any) => {
            try {
              const q = getQuill();
              if (!q) return;
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
