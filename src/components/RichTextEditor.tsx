import { useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import Quill from "quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { MediaSelector } from "./MediaSelector";
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
  const [mediaOpen, setMediaOpen] = useState(false);

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

  const insertMedia = (url: string) => {
    if (!url) return;
    const editor = quillRef.current?.getEditor();
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
      editor.insertEmbed(range.index, 'image', url, 'user');
      editor.setSelection(range.index + 1, 0);
    } else if (isVideo) {
      editor.insertEmbed(range.index, 'video', url, 'user');
      editor.setSelection(range.index + 1, 0);
    } else {
      editor.insertText(range.index, url, 'link', url);
      editor.setSelection(range.index + url.length, 0);
    }
  };

  const applySizeDelta = (delta: number) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    
    let range = editor.getSelection(true);
    if (!range || range.length === 0) {
      // If no selection, select all text to apply formatting
      editor.setSelection(0, editor.getLength());
      range = editor.getSelection(true);
      if (!range) return;
    }
    
    // Get current format at selection
    const format = editor.getFormat(range);
    const currentSizeStr = format.size as string | undefined;
    let currentSize = 16; // default size
    
    if (currentSizeStr) {
      if (currentSizeStr.endsWith('px')) {
        currentSize = parseInt(currentSizeStr.replace('px', ''));
      } else {
        // Handle cases where size might be in other units or just a number
        currentSize = parseInt(currentSizeStr) || 16;
      }
    }
    
    const newSize = Math.max(8, Math.min(96, currentSize + delta));
    
    // Apply the new size
    editor.format("size", `${newSize}px`);
    setCurrentSize(newSize);
    
    // Update selection to show current size
    setTimeout(() => {
      const updatedFormat = editor.getFormat(range);
      const updatedSizeStr = updatedFormat.size as string | undefined;
      if (updatedSizeStr && updatedSizeStr.endsWith('px')) {
        setCurrentSize(parseInt(updatedSizeStr.replace('px', '')));
      }
    }, 100);
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
            文字色
            <input type="color" className="ml-2 h-6 w-6 p-0 border rounded-none aspect-square" onChange={(e) => applyColor("color", e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">
            背景色
            <input type="color" className="ml-2 h-6 w-6 p-0 border rounded-none aspect-square" onChange={(e) => applyColor("background", e.target.value)} />
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
            onClick={() => { setHtmlMode(!htmlMode); if (!htmlMode) setDraftHtml(value); }}
            title="HTML"
          >
            HTML
          </Button>
        </span>
      </div>

      <Dialog open={mediaOpen} onOpenChange={setMediaOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>メディアライブラリ</DialogTitle>
          </DialogHeader>
          <MediaSelector onSelect={(url) => { insertMedia(url); setMediaOpen(false); }} />
        </DialogContent>
      </Dialog>

      {htmlMode ? (
        <div className="space-y-2">
          <Textarea value={draftHtml} onChange={(e) => { setDraftHtml(e.target.value); onChange(e.target.value); }} rows={10} />
        </div>
      ) : (
        <ReactQuill
          ref={quillRef as any}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          style={{ minHeight: '200px' }}
          className="[&_.ql-editor]:min-h-[180px] [&_.ql-toolbar]:flex [&_.ql-toolbar]:flex-wrap [&_.ql-toolbar]:gap-1 [&_.ql-toolbar_.ql-formats]:mr-2"
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
