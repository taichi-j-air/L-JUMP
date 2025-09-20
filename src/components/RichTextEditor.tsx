import { useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import Quill from "quill";
import type { RangeStatic } from "quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { MediaSelector } from "./MediaSelector";
import { toast } from "sonner";
import { Link as LinkIcon } from "lucide-react";

// Allow px-based size/color/background styles to be used via inline styles
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

const LINK_SELECTION_MESSAGE = "Select the text you want to link.";

export function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [draftHtml, setDraftHtml] = useState(value);
  const quillRef = useRef<ReactQuill | null>(null);
  const [currentSize, setCurrentSize] = useState<number>(16);
  const [sizeInput, setSizeInput] = useState("16");
  const toolbarId = useRef(`rte-toolbar-${Math.random().toString(36).slice(2)}`).current;
  const [mediaOpen, setMediaOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const lastRangeRef = useRef<RangeStatic | null>(null);

  // ReactQuill modules configuration
  const modules = useMemo(
    () => ({
      toolbar: { container: `#${toolbarId}` },
      clipboard: { matchVisual: false },
    }),
    [toolbarId]
  );

  // Whitelist of formats handled by Quill
  const formats = [
    "bold",
    "italic",
    "underline",
    "align",
    "list",
    "link",
    "size",
    "color",
    "background",
    "image",
    "video",
  ];

  // Keep draftHtml in sync while HTML mode is open
  useEffect(() => {
    if (htmlMode) setDraftHtml(value);
  }, [value, htmlMode]);

  const getQuill = () => quillRef.current?.getEditor();

  const parseSizeValue = (size?: string | null): number | null => {
    if (!size) return null;
    const numeric = parseInt(size, 10);
    return Number.isNaN(numeric) ? null : numeric;
  };

  const parseSizeInput = (value: string): number | null => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    const normalized = trimmed.endsWith("px") ? trimmed.slice(0, -2) : trimmed;
    if (!/^\\d+$/.test(normalized)) return null;
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

    if (targetRange && (targetRange.length ?? 0) > 0) {
      editor.formatText(targetRange.index, targetRange.length ?? 0, "size", `${clamped}px`, "user");
    } else {
      editor.format("size", `${clamped}px`);
    }

    lastRangeRef.current = targetRange
      ? { index: targetRange.index, length: targetRange.length ?? 0 }
      : null;

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
      editor.insertEmbed(range.index, "video", url, "user");
      editor.setSelection(range.index + 1, 0);
    } else {
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

  const normalizeUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const ensureSelection = () => {
    const editor = getQuill();
    if (!editor) return null;

    const selection = editor.getSelection() ?? lastRangeRef.current;
    if (!selection || (selection.length ?? 0) === 0) {
      toast.warning(LINK_SELECTION_MESSAGE);
      return null;
    }

    const normalizedRange: RangeStatic = {
      index: selection.index,
      length: selection.length ?? 0,
    };

    lastRangeRef.current = normalizedRange;
    return { editor, range: normalizedRange };
  };

  const handleLinkButton = () => {
    const context = ensureSelection();
    if (!context) return;

    const currentFormat = context.editor.getFormat(context.range);
    const currentLink = (currentFormat.link as string | undefined) ?? "";
    setLinkInput(currentLink);
    setLinkDialogOpen(true);
  };

  const applyLink = () => {
    const context = ensureSelection();
    if (!context) {
      setLinkDialogOpen(false);
      return;
    }

    context.editor.setSelection(context.range.index, context.range.length ?? 0);
    const value = normalizeUrl(linkInput);

    if (!value) {
      context.editor.formatText(context.range.index, context.range.length ?? 0, "link", false, "user");
    } else {
      context.editor.formatText(context.range.index, context.range.length ?? 0, "link", value, "user");
    }

    setLinkDialogOpen(false);
  };

  const removeLink = () => {
    const context = ensureSelection();
    if (!context) {
      setLinkDialogOpen(false);
      return;
    }

    context.editor.setSelection(context.range.index, context.range.length ?? 0);
    context.editor.formatText(context.range.index, context.range.length ?? 0, "link", false, "user");
    setLinkDialogOpen(false);
  };

  const applyColor = (type: "color" | "background", color: string) => {
    const editor = getQuill();
    if (!editor) return;

    editor.format(type, color);
  };

  useEffect(() => {
    setSizeInput(currentSize.toString());
  }, [currentSize]);

  return (
    <div className={className}>
      {/* Custom toolbar */}
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
                applySize(parsed);
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
            Text color
            <input
              type="color"
              className="ml-2 h-6 w-6 p-0 border rounded-none aspect-square"
              onChange={(e) => applyColor("color", e.target.value)}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Background color
            <input
              type="color"
              className="ml-2 h-6 w-6 p-0 border rounded-none aspect-square"
              onChange={(e) => applyColor("background", e.target.value)}
            />
          </label>
        </span>

        <span className="ql-formats ml-auto flex gap-2 [&>button]:w-auto [&>button]:min-w-[4.5rem]">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleLinkButton}
            title="Add link"
            className="flex items-center gap-1 text-xs px-2 py-1"
          >
            <LinkIcon className="h-3 w-3" />
            Link
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMediaOpen(true)}
            title="Media library"
            className="text-xs px-2 py-1"
          >
            Library
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
            title="Toggle HTML"
          >
            HTML
          </Button>
        </span>
      </div>

      {/* Media selection dialog */}
      <Dialog open={mediaOpen} onOpenChange={setMediaOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Media library</DialogTitle>
          </DialogHeader>
          <MediaSelector
            onSelect={(url) => {
              insertMedia(url);
              setMediaOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={linkDialogOpen}
        onOpenChange={(open) => {
          setLinkDialogOpen(open);
          if (!open) setLinkInput("");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add link</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://example.com"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Leave blank to remove the link.</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={removeLink}>
              Remove link
            </Button>
            <Button onClick={applyLink}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor body */}
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
