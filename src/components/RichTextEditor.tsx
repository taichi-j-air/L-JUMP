import { useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import Quill from "quill";
import type { RangeStatic } from "quill";
import "react-quill/dist/quill.snow.css";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { MediaSelector } from "./MediaSelector";
import { toast } from "sonner";
import { Link as LinkIcon, Square } from "lucide-react";

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

interface ButtonSettings {
  url: string;
  text: string;
  textColor: string;
  textSize: number;
  backgroundColor: string;
  width: string;
  height: string;
  borderRadius: number;
  shadow: boolean;
  borderEnabled: boolean;
  borderWidth: number;
  borderColor: string;
  hoverEffectEnabled: boolean;
}

const LINK_SELECTION_MESSAGE = "リンクにする文字列を選択してください。";
const BUTTON_URL_MESSAGE = "ボタンのURLを入力してください。";

const BUTTON_DEFAULTS: ButtonSettings = {
  url: "",
  text: "ボタン",
  textColor: "#ffffff",
  textSize: 20,
  backgroundColor: "#2563eb",
  width: "300",
  height: "50",
  borderRadius: 6,
  shadow: true,
  borderEnabled: false,
  borderWidth: 1,
  borderColor: "#2563eb",
  hoverEffectEnabled: true,
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [draftHtml, setDraftHtml] = useState(value);
  const quillRef = useRef<ReactQuill | null>(null);
  const [currentSize, setCurrentSize] = useState<number>(16);
  const [sizeInput, setSizeInput] = useState("16");
  const toolbarId = useRef("rte-toolbar-" + Math.random().toString(36).slice(2)).current;
  const [mediaOpen, setMediaOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [buttonDialogOpen, setButtonDialogOpen] = useState(false);
  const [buttonSettings, setButtonSettings] = useState<ButtonSettings>(BUTTON_DEFAULTS);
  const lastRangeRef = useRef<RangeStatic | null>(null);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);

  const modules = useMemo(
    () => ({
      toolbar: { container: "#" + toolbarId },
      clipboard: { matchVisual: false },
    }),
    [toolbarId]
  );

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

  useEffect(() => {
    if (htmlMode) setDraftHtml(value);
  }, [value, htmlMode]);

  const getQuill = () => quillRef.current?.getEditor();

  const parseSizeValue = (size?: string | null): number | null => {
    if (!size) return null;
    const numeric = parseInt(size, 10);
    return Number.isNaN(numeric) ? null : numeric;
  };

  const parseSizeInput = (input: string): number | null => {
    const trimmed = input.trim().toLowerCase();
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

    if (targetRange && (targetRange.length ?? 0) > 0) {
      editor.formatText(targetRange.index, targetRange.length ?? 0, "size", clamped + "px", "user");
    } else {
      editor.format("size", clamped + "px");
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
    return "https://" + trimmed;
  };

  const ensureSelection = (): { editor: any; range: RangeStatic } | null => {
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

  const handleButtonDialogOpen = () => {
    const editor = getQuill();
    let initialSettings = { ...BUTTON_DEFAULTS };

    if (editor) {
      const selection = editor.getSelection();
      if (selection && (selection.length ?? 0) > 0) {
        const selectedText = editor.getText(selection.index, selection.length ?? 0).trim();
        if (selectedText) {
          initialSettings.text = selectedText;
        }
        lastRangeRef.current = { index: selection.index, length: selection.length ?? 0 };
      } else {
        lastRangeRef.current = selection ? { index: selection.index, length: selection.length ?? 0 } : null;
      }
    }

    setButtonSettings(initialSettings);
    setButtonDialogOpen(true);
  };

  const handleButtonFieldChange = <K extends keyof ButtonSettings>(key: K, value: ButtonSettings[K]) => {
    setButtonSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleButtonSave = () => {
    const editor = getQuill();
    if (!editor) return;

    const url = buttonSettings.url.trim();
    const href = url ? normalizeUrl(url) : "#";
    let targetAttr = url ? ' target="_blank" rel="noopener noreferrer"' : '';

    if (buttonSettings.hoverEffectEnabled) {
      targetAttr += ` onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'"`;
    }

    const textSize = clampNumber(Number(buttonSettings.textSize) || BUTTON_DEFAULTS.textSize, 8, 64);
    const borderRadius = clampNumber(Number(buttonSettings.borderRadius ?? BUTTON_DEFAULTS.borderRadius), 0, 96);
    const borderWidth = clampNumber(Number(buttonSettings.borderWidth) || BUTTON_DEFAULTS.borderWidth, 0, 12);
    const widthValue = buttonSettings.width.trim() ? Number(buttonSettings.width) : NaN;
    const heightValue = buttonSettings.height.trim() ? Number(buttonSettings.height) : NaN;

    const styleParts: string[] = [
      "display:inline-flex",
      "align-items:center",
      "justify-content:center",
      "text-decoration:none",
      "font-weight:600",
      "padding:12px 24px",
      "cursor:pointer",
      "transition:all 0.2s ease",
      "white-space:nowrap",
      "color:" + buttonSettings.textColor,
      "background-color:" + buttonSettings.backgroundColor,
      "font-size:" + textSize + "px",
      "border-radius:" + borderRadius + "px",
      "line-height:1.3",
    ];

    if (!Number.isNaN(widthValue) && widthValue > 0) {
      styleParts.push("width:" + widthValue + "px");
    }
    if (!Number.isNaN(heightValue) && heightValue > 0) {
      styleParts.push("height:" + heightValue + "px");
    }

    if (buttonSettings.borderEnabled && borderWidth > 0) {
      styleParts.push("border:" + borderWidth + "px solid " + buttonSettings.borderColor);
    } else {
      styleParts.push("border:none");
    }

    if (buttonSettings.shadow) {
      styleParts.push("box-shadow:0 6px 16px rgba(0,0,0,0.18)");
    }

    const style = styleParts.join("; ") + ";";
    const buttonHtml = "<a href=\"" + escapeHtml(href) +
      "\"" + targetAttr + " style=\"" + style + "\">" +
      escapeHtml(buttonSettings.text || BUTTON_DEFAULTS.text) + "</a>";

    const range = editor.getSelection(true) ?? lastRangeRef.current ?? { index: editor.getLength(), length: 0 };
    const insertIndex = range.index;

    if (range.length) {
      editor.deleteText(range.index, range.length, "user");
    }

    editor.clipboard.dangerouslyPasteHTML(insertIndex, buttonHtml, "user");
    editor.setSelection(insertIndex + 1, 0, "user");

    setButtonDialogOpen(false);
    setButtonSettings(BUTTON_DEFAULTS);
  };

  const previewStyle = useMemo(() => {
    const style: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      textDecoration: 'none',
      fontWeight: 600,
      padding: '12px 24px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap',
      color: buttonSettings.textColor,
      backgroundColor: buttonSettings.backgroundColor,
      fontSize: `${buttonSettings.textSize || BUTTON_DEFAULTS.textSize}px`,
      borderRadius: `${buttonSettings.borderRadius ?? BUTTON_DEFAULTS.borderRadius}px`,
      lineHeight: 1.3,
      opacity: (isPreviewHovered && buttonSettings.hoverEffectEnabled) ? 0.7 : 1,
    };
    if (buttonSettings.width) {
      style.width = `${buttonSettings.width}px`;
    }
    if (buttonSettings.height) {
      style.height = `${buttonSettings.height}px`;
    }
    if (buttonSettings.borderEnabled && buttonSettings.borderWidth > 0) {
      style.border = `${buttonSettings.borderWidth}px solid ${buttonSettings.borderColor}`;
    } else {
      style.border = 'none';
    }
    if (buttonSettings.shadow) {
      style.boxShadow = '0 6px 16px rgba(0,0,0,0.18)';
    }
    return style;
  }, [buttonSettings, isPreviewHovered]);

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
          <button className="ql-clean" />
        </span>

        <span className="ql-formats">
          <button type="button" onClick={() => applySizeDelta(-2)}>A-</button>
          <button type="button" onClick={() => applySizeDelta(2)}>A+</button>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              className="w-14 rounded border border-input bg-background px-2 py-1 text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              onBlur={(e) => {
                const parsed = parseSizeInput(e.target.value);
                if (parsed === null) {
                  setSizeInput(currentSize.toString());
                  return;
                }
                applySize(parsed, { editor: getQuill(), range: lastRangeRef.current });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              aria-label="文字サイズ"
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

        <span className="ql-formats ml-auto flex gap-2 [&>button]:w-auto [&>button]:min-w-[4.5rem]">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleLinkButton}
            title="リンクを設定"
            className="flex items-center gap-1 text-xs px-2 py-1"
          >
            <LinkIcon className="h-3 w-3" />
            リンク
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleButtonDialogOpen}
            title="ボタンを挿入"
            className="flex items-center gap-1 text-xs px-2 py-1"
          >
            <Square className="h-3 w-3" />
            ボタン
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMediaOpen(true)}
            title="メディアライブラリ"
            className="text-xs px-2 py-1"
          >
            ライブラリ
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={"text-xs px-2 py-1 " + (htmlMode ? "bg-muted" : "")}
            onClick={() => {
              setHtmlMode(!htmlMode);
              if (!htmlMode) setDraftHtml(value);
            }}
            title="HTML表示切り替え"
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

      {/* リンク設定ダイアログ */}
      <Dialog
        open={linkDialogOpen}
        onOpenChange={(open) => {
          setLinkDialogOpen(open);
          if (!open) setLinkInput("");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>リンクを設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://example.com"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">空欄にするとリンクを削除します。</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              キャンセル
            </Button>
            <Button variant="secondary" onClick={removeLink}>
              リンク解除
            </Button>
            <Button onClick={applyLink}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ボタン挿入ダイアログ */}
      <Dialog
        open={buttonDialogOpen}
        onOpenChange={(open) => {
          setButtonDialogOpen(open);
          if (!open) setButtonSettings(BUTTON_DEFAULTS);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ボタンを挿入</DialogTitle>
          </DialogHeader>
          <div className="my-4 p-4 rounded-md bg-muted flex items-center justify-center">
            <a
              style={previewStyle}
              onMouseEnter={() => setIsPreviewHovered(true)}
              onMouseLeave={() => setIsPreviewHovered(false)}
            >
              {buttonSettings.text || BUTTON_DEFAULTS.text}
            </a>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">リンクURL</label>
              <Input
                value={buttonSettings.url}
                onChange={(e) => handleButtonFieldChange("url", e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">ボタンテキスト</label>
              <Input
                value={buttonSettings.text}
                onChange={(e) => handleButtonFieldChange("text", e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">文字色</label>
                <input
                  type="color"
                  className="h-9 w-full rounded border"
                  value={buttonSettings.textColor}
                  onChange={(e) => handleButtonFieldChange("textColor", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">文字サイズ (px)</label>
                <Input
                  type="number"
                  min={8}
                  max={64}
                  value={buttonSettings.textSize}
                  onChange={(e) => handleButtonFieldChange("textSize", Number(e.target.value) || BUTTON_DEFAULTS.textSize)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">ボタンカラー</label>
                <input
                  type="color"
                  className="h-9 w-full rounded border"
                  value={buttonSettings.backgroundColor}
                  onChange={(e) => handleButtonFieldChange("backgroundColor", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">角丸</label>
                <Select
                  value={String(buttonSettings.borderRadius)}
                  onValueChange={(value) => handleButtonFieldChange("borderRadius", Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="角丸を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">通常 (四角)</SelectItem>
                    <SelectItem value="6">角丸</SelectItem>
                    <SelectItem value="50">丸</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">ボタン幅 (px・空欄で自動)</label>
                <Input
                  type="number"
                  min={0}
                  value={buttonSettings.width}
                  onChange={(e) => handleButtonFieldChange("width", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">ボタン高さ (px・空欄で自動)</label>
                <Input
                  type="number"
                  min={0}
                  value={buttonSettings.height}
                  onChange={(e) => handleButtonFieldChange("height", e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor="button-shadow" className="text-xs text-muted-foreground">
                影を付ける
              </label>
              <Switch
                id="button-shadow"
                checked={buttonSettings.shadow}
                onCheckedChange={(checked) => handleButtonFieldChange("shadow", checked)}
                className="transform scale-75 origin-right"
              />
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor="button-hover" className="text-xs text-muted-foreground">
                ホバー効果
              </label>
              <Switch
                id="button-hover"
                checked={buttonSettings.hoverEffectEnabled}
                onCheckedChange={(checked) => handleButtonFieldChange("hoverEffectEnabled", checked)}
                className="transform scale-75 origin-right"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="button-border" className="text-xs text-muted-foreground">
                  枠線を表示
                </label>
                <Switch
                  id="button-border"
                  checked={buttonSettings.borderEnabled}
                  onCheckedChange={(checked) => handleButtonFieldChange("borderEnabled", checked)}
                  className="transform scale-75 origin-right"
                />
              </div>
              {buttonSettings.borderEnabled && (
                <div className="grid gap-3 sm:grid-cols-2 mt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">枠線の太さ (px)</label>
                    <Input
                      type="number"
                      min={0}
                      max={12}
                      value={buttonSettings.borderWidth}
                      onChange={(e) => handleButtonFieldChange("borderWidth", Number(e.target.value) || BUTTON_DEFAULTS.borderWidth)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">枠線のカラー</label>
                    <input
                      type="color"
                      className="h-9 w-full rounded border"
                      value={buttonSettings.borderColor}
                      onChange={(e) => handleButtonFieldChange("borderColor", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setButtonDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleButtonSave}>
              ボタンを挿入
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 本文 */}
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