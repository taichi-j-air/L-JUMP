// src/pages/FlexMessageDesigner.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MediaSelector } from "@/components/MediaSelector";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Send,
  Plus,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronDown,
  Image as IconImage,
  MessageSquare,
  Copy,
  Layers,
  Eye,
  FileEdit,
} from "lucide-react";

/* ===================== Types ===================== */

type ButtonStyle = "primary" | "secondary" | "link";
type ButtonHeight = "sm" | "md" | "lg";
type TextSize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "3xl" | "4xl" | "5xl";
type FontWeight = "normal" | "bold";
type Align = "start" | "center" | "end";
type ImageSize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "full";
type AspectRatio = "1:1" | "20:13" | "16:9" | "4:3";
type AspectMode = "cover" | "fit";
type PaddingToken = "none" | "xs" | "sm" | "md" | "lg" | "xl";
type MarginToken = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
type SpacingToken = "none" | "xs" | "sm" | "md" | "lg";
type ContainerType = "bubble" | "carousel";
type BubbleSize = "micro" | "deca" | "kilo" | "mega" | "giga";

interface FlexMessageRow {
  id: string;
  name: string;
  content: any;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface ElementAction {
  type: "message" | "uri" | "postback";
  label?: string;
  text?: string;
  uri?: string;
  data?: string;
}

interface ElementProps {
  // common
  margin?: MarginToken;
  padding?: PaddingToken;
  backgroundColor?: string;

  // text
  text?: string;
  size?: TextSize;
  weight?: FontWeight;
  color?: string;
  align?: Align;
  wrap?: boolean;

  // image
  url?: string;
  imgSize?: ImageSize;
  aspectRatio?: AspectRatio;
  aspectMode?: AspectMode;
  isHero?: boolean;
  action?: ElementAction;

  // button
  style?: ButtonStyle;
  height?: ButtonHeight;
  /** primary/secondary: 背景色, link: 文字色 */
  buttonColor?: string;
}

interface FlexElement {
  id: string;
  type: "text" | "image" | "button";
  properties: ElementProps;
}

interface BubbleDesign {
  name: string;
  altText: string;
  bubbleSize: BubbleSize;
  bodyBg?: string;
  bodySpacing?: SpacingToken;
  contents: FlexElement[];
}

interface DesignerState {
  containerType: ContainerType;
  bubbles: BubbleDesign[];
  currentIndex: number;
  loadedMessageId?: string;
}

/* ===================== Helpers ===================== */

const padToPx = (p: PaddingToken | undefined): string | undefined => {
  switch (p) {
    case "xs": return "4px";
    case "sm": return "8px";
    case "md": return "12px";
    case "lg": return "16px";
    case "xl": return "20px";
    case "none":
    default: return "0px";
  }
};

const getMarginPx = (m?: MarginToken): string => {
  switch (m) {
    case "xs": return "4px";
    case "sm": return "8px";
    case "md": return "12px";
    case "lg": return "16px";
    case "xl": return "20px";
    case "xxl": return "24px";
    case "none":
    default: return "0px";
  }
};

const getTextSizePx = (s: TextSize): string => {
  switch (s) {
    case "xxs": return "10px";
    case "xs": return "11px";
    case "sm": return "12px";
    case "md": return "13px";
    case "lg": return "16px";
    case "xl": return "18px";
    case "xxl": return "22px";
    case "3xl": return "26px";
    case "4xl": return "30px";
    case "5xl": return "34px";
    default: return "13px";
  }
};

const getButtonHeightPx = (h: ButtonHeight): string => {
  switch (h) {
    case "sm": return "32px";
    case "md": return "40px";
    case "lg": return "48px";
    default: return "40px";
  }
};

const getBubbleWidthPx = (size: BubbleSize, containerWidth: number): string => {
    // 右側プレビューエリアのp-4 (1rem = 16px) のパディングを考慮
    const maxWidth = containerWidth - 32;
    if (maxWidth <= 0) return "250px"; // コンテナ幅が取得できない場合のフォールバック

    switch (size) {
        case "giga":  return `${maxWidth}px`;
        case "mega":  return `${Math.floor(maxWidth * 0.9)}px`;
        case "kilo":  return `${Math.floor(maxWidth * 0.8)}px`;
        case "deca":  return `${Math.floor(maxWidth * 0.7)}px`;
        case "micro": return `${Math.floor(maxWidth * 0.6)}px`;
        default:      return `${Math.floor(maxWidth * 0.8)}px`;
    }
};

const defaultBubble = (label = "バブル 1"): BubbleDesign => ({
  name: label,
  altText: "通知: 新しいお知らせがあります",
  bubbleSize: "kilo",
  bodyBg: undefined,
  bodySpacing: "none",
  contents: [],
});

const generateElementId = () => {
  const cryptoObj = typeof globalThis !== "undefined" ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (cryptoObj?.randomUUID) {
    return `el-${cryptoObj.randomUUID()}`;
  }
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
};

const makeElement = (type: FlexElement["type"]): FlexElement => {
  const id = generateElementId();
  if (type === "text") {
    return {
      id, type,
      properties: {
        text: "テキスト",
        size: "md",
        weight: "normal",
        color: "#000000",
        margin: "none",
        padding: "none",
        align: "start",
        wrap: true,
      },
    };
  }
  if (type === "image") {
    return {
      id, type,
      properties: {
        url: "",
        imgSize: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
        margin: "none",
        padding: "none",
        isHero: false,
      },
    };
  }
  return {
    id, type: "button",
    properties: {
      style: "primary",
      height: "md",
      buttonColor: "#06c755", // 初期背景
      action: { type: "uri", label: "開く", uri: "https://line.me/" },
      margin: "none",
      padding: "none",
    },
  };
};

/* ===================== JSON Builder ===================== */

function buildBubbleFromDesign(design: BubbleDesign) {
  const heroCandidate = design.contents.find((c) => c.type === "image" && c.properties.isHero && c.properties.url);
  const hero = heroCandidate
    ? {
        type: "image",
        url: heroCandidate.properties.url,
        size: heroCandidate.properties.imgSize || "full",
        aspectRatio: heroCandidate.properties.aspectRatio || "20:13",
        aspectMode: heroCandidate.properties.aspectMode || "cover",
        ...(heroCandidate.properties.action ? { action: (({ type, text, uri, data }) => {
          if (type === 'message') return { type, text };
          if (type === 'uri') return { type, uri };
          if (type === 'postback') return { type, data };
          return { type };
        })(heroCandidate.properties.action) } : {}),
      }
    : undefined;

  // 保存時の順序を維持したまま要素を組み立てる
  const orderedElements: any[] = [];

  design.contents
    .filter((el) => !heroCandidate || el.id !== heroCandidate.id)
    .forEach((el) => {
      const p = el.properties;
      const margin = p.margin && p.margin !== "none" ? p.margin : undefined;

      let node: any = null;

      // 1. Create the base node (without backgroundColor for text)
      if (el.type === "text") {
        const text = (p.text || "").trim();
        if (!text) return;
        node = {
          type: "text",
          text,
          ...(p.size && { size: p.size }),
          ...(p.weight && p.weight !== "normal" && { weight: p.weight }),
          ...(p.color && { color: p.color }),
          ...(p.align && p.align !== "start" && { align: p.align }),
          wrap: true,
          // backgroundColor is handled below
          ...(margin ? { margin } : {}),
        };
      } else if (el.type === "image") {
        const url = (p.url || "").trim();
        if (!url) return;
        node = {
          type: "image",
          url,
          ...(p.imgSize && { size: p.imgSize }),
          ...(p.aspectRatio && { aspectRatio: p.aspectRatio }),
          ...(p.aspectMode && { aspectMode: p.aspectMode }),
          ...(p.action ? { action: (({type, text, uri, data}) => {
            if (type === 'message') return { type, text };
            if (type === 'uri') return { type, uri };
            if (type === 'postback') return { type, data };
            return { type };
          })(p.action) } : {}),
          ...(margin ? { margin } : {}),
        };
      } else if (el.type === "button") {
        const defaultColor = p.style === "link" ? "#0f83ff" : "#06c755";
        node = {
          type: "button",
          style: p.style || "primary",
          color: p.buttonColor || defaultColor,
          ...(p.height && p.height !== "md" ? { height: p.height } : {}),
          ...(p.action ? { action: (({type, label, text, uri, data}) => {
            if (type === 'message') return { type, label, text };
            if (type === 'uri') return { type, label, uri };
            if (type === 'postback') return { type, label, data };
            return { type, label };
          })(p.action) } : {}),
          ...(margin ? { margin } : {}),
        };
      }

      if (!node) return;

      // 2. Wrap the node in a box if padding or (for text) a background color is needed
      const pad = padToPx(p.padding);
      const needsWrapper = (pad && pad !== "0px") || (el.type === "text" && p.backgroundColor);

      if (needsWrapper) {
        // Move margin from the inner node to the outer wrapper box
        const innerNode = { ...node };
        if (innerNode.margin) {
          delete innerNode.margin;
        }
        
        node = {
          type: "box",
          layout: "vertical",
          contents: [innerNode],
          ...(margin && { margin }), // Apply margin to the wrapper
          ...(pad && pad !== "0px" && { paddingAll: pad }),
          ...(el.type === "text" && p.backgroundColor && { backgroundColor: p.backgroundColor }),
        };
      }

      orderedElements.push(node);
    });

  const bubble: any = {
    type: "bubble",
    size: design.bubbleSize,
    ...(hero ? { hero } : {}),
  };

  // bodyに要素がある場合のみbodyを追加
  if (orderedElements.length > 0) {
    bubble.body = {
      type: "box",
      layout: "vertical",
      spacing: design.bodySpacing || "none",
      contents: orderedElements,
      ...(design.bodyBg ? { backgroundColor: design.bodyBg } : {}),
      paddingAll: "0px",
    };
  }

  return bubble;
}

function buildFlexMessage(state: DesignerState) {
  const altText = (state.bubbles[state.currentIndex]?.altText || "通知").slice(0, 400);
  if (state.containerType === "bubble") {
    return { type: "flex", altText, contents: buildBubbleFromDesign(state.bubbles[0]) };
  }
  const bubbles = state.bubbles.map(buildBubbleFromDesign).filter(Boolean) as any[];
  return { type: "flex", altText, contents: { type: "carousel", contents: bubbles } };
}

/* ===== MediaSelector の「選択されたファイル」非表示 ===== */
const useHideSelectedLabel = (containerRef: React.RefObject<HTMLElement>) => {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const hide = () => {
      const nodes = root.querySelectorAll<HTMLElement>("*");
      nodes.forEach((el) => {
        const t = (el.innerText || "").trim();
        if (t.includes("選択されたファイル") || t.includes("選択中のファイル") || t.toLowerCase().includes("selected file")) {
          el.style.display = "none";
        }
      });
    };
    hide();
    const mo = new MutationObserver(hide);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [containerRef]);
};

/* ===================== Sortable Item ===================== */

const SortableItem = ({
  element,
  onUpdate,
  onDelete,
  onHeroToggle,
}: {
  element: FlexElement;
  onUpdate: (id: string, properties: ElementProps) => void;
  onDelete: (id: string) => void;
  onHeroToggle?: (id: string, next: boolean) => void;
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: element.id });
  const style = { transform: CSS.Transform.toString(transform), transition } as React.CSSProperties;
  const p = element.properties;

  const mediaWrapRef = useRef<HTMLDivElement>(null);
  useHideSelectedLabel(mediaWrapRef);

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-background p-3 mb-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing p-1 rounded border hover:bg-muted" title="ドラッグして順序変更">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <Badge variant="outline" className="text-[10px]">
            {element.type === "text" && "テキスト"}
            {element.type === "image" && "画像"}
            {element.type === "button" && "ボタン"}
          </Badge>
          {element.type === "image" && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                id={`hero-${element.id}`}
                type="checkbox"
                checked={!!p.isHero}
                onChange={(e) => onHeroToggle?.(element.id, e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <label htmlFor={`hero-${element.id}`}>ヘッダー(ヒーロー)</label>
            </div>
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2 ml-1" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive" onClick={() => onDelete(element.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {!collapsed && (
        <div className="mt-3 grid gap-3">
          {/* 共通: 余白 */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">外側の余白</Label>
              <Select value={p.margin || "none"} onValueChange={(v: MarginToken) => onUpdate(element.id, { ...p, margin: v })}>
                <SelectTrigger className="h-7 text-xs" />
                <SelectContent>
                  {(["none","xs","sm","md","lg","xl","xxl"] as MarginToken[]).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">内側の余白</Label>
              <Select value={p.padding || "none"} onValueChange={(v: PaddingToken) => onUpdate(element.id, { ...p, padding: v })}>
                <SelectTrigger className="h-7 text-xs" />
                <SelectContent>
                  {(["none","xs","sm","md","lg","xl"] as PaddingToken[]).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">背景色(任意)</Label>
              <div className="h-7 flex items-center">
                <ColorPicker color={p.backgroundColor || "#ffffff"} onChange={(c) => onUpdate(element.id, { ...p, backgroundColor: c })} />
              </div>
            </div>
          </div>

          {/* テキスト要素 */}
          {element.type === "text" && (
            <div className="grid gap-2">
              <div>
                <Label className="text-xs">テキスト</Label>
                <Textarea rows={2} className="text-sm" value={p.text || ""} onChange={(e) => onUpdate(element.id, { ...p, text: e.target.value })} placeholder="本文を入力" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">サイズ</Label>
                  <Select value={p.size || "md"} onValueChange={(v: TextSize) => onUpdate(element.id, { ...p, size: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>{(["xxs", "xs", "sm", "md", "lg", "xl", "xxl", "3xl", "4xl", "5xl"] as TextSize[]).map((t) => (<SelectItem key={t} value={t}>{`${getTextSizePx(t)} (${t})`}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">太さ</Label>
                  <Select value={p.weight || "normal"} onValueChange={(v: FontWeight) => onUpdate(element.id, { ...p, weight: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent><SelectItem value="normal">normal</SelectItem><SelectItem value="bold">bold</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">配置</Label>
                  <Select value={p.align || "start"} onValueChange={(v: Align) => onUpdate(element.id, { ...p, align: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent><SelectItem value="start">左</SelectItem><SelectItem value="center">中央</SelectItem><SelectItem value="end">右</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="w-full">
                    <Label className="text-xs">文字色</Label>
                    <div className="h-7 flex items-center">
                      <ColorPicker color={p.color || "#000000"} onChange={(c) => onUpdate(element.id, { ...p, color: c })} />
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">※ 改行はそのまま表示されます。長文は自動で折り返し。</p>
            </div>
          )}

          {/* 画像要素 */}
          {element.type === "image" && (
            <div className="grid gap-2" ref={mediaWrapRef}>
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="col-span-2">
                  <Label className="text-xs">画像URL</Label>
                  <Input className="h-8 text-xs" placeholder="https://..." value={p.url || ""} onChange={(e) => onUpdate(element.id, { ...p, url: e.target.value })} />
                  {p.url && (
                    <div className="mt-1">
                      <div className="h-16 w-full overflow-hidden rounded border bg-muted flex items-center justify-center">
                        <img
                          src={p.url}
                          alt="thumb"
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => { e.currentTarget.style.display = "none"; const err = e.currentTarget.nextElementSibling as HTMLElement; if (err) err.style.display = "block"; }}
                        />
                        <div className="text-xs text-muted-foreground" style={{ display: "none" }}>画像エラー</div>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground truncate" title={p.url}>{p.url}</div>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs">メディア</Label>
                  <div className="h-8 flex items-center">
                    <MediaSelector onSelect={(url) => onUpdate(element.id, { ...p, url })} selectedUrl={p.url} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">表示サイズ</Label>
                  <Select value={p.imgSize || "full"} onValueChange={(v: ImageSize) => onUpdate(element.id, { ...p, imgSize: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>{(["xxs","xs","sm","md","lg","xl","xxl","full"] as ImageSize[]).map((t)=>(<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">アスペクト比</Label>
                  <Select value={p.aspectRatio || "20:13"} onValueChange={(v: AspectRatio) => onUpdate(element.id, { ...p, aspectRatio: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>{(["1:1","20:13","16:9","4:3"] as AspectRatio[]).map((t)=>(<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">切り抜き</Label>
                  <Select value={p.aspectMode || "cover"} onValueChange={(v: AspectMode) => onUpdate(element.id, { ...p, aspectMode: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent><SelectItem value="cover">カバー</SelectItem><SelectItem value="fit">フィット</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-2">
                <Label className="text-xs font-semibold">タップ時の動作 (任意)</Label>
                <div className="grid gap-2 mt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">アクションタイプ</Label>
                      <Select value={p.action?.type || "uri"} onValueChange={(v: ElementAction["type"]) => onUpdate(element.id, { ...p, action: { ...(p.action || {}), type: v } })}>
                        <SelectTrigger className="h-7 text-xs" />
                        <SelectContent><SelectItem value="uri">URLを開く</SelectItem><SelectItem value="message">メッセージ送信</SelectItem><SelectItem value="postback">ポストバック</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      {p.action?.type === "uri" && (
                        <div>
                          <Label className="text-xs">URL</Label>
                          <Input className="h-7 text-xs" placeholder="https://..." value={p.action?.uri || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "uri" }), uri: e.target.value } })} />
                        </div>
                      )}
                      {p.action?.type === "message" && (
                        <div>
                          <Label className="text-xs">送信テキスト</Label>
                          <Input className="h-7 text-xs" placeholder="送信するテキスト" value={p.action?.text || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "message" }), text: e.target.value } })} />
                        </div>
                      )}
                      {p.action?.type === "postback" && (
                        <div>
                          <Label className="text-xs">ポストバックデータ</Label>
                          <Input className="h-7 text-xs" placeholder="data=xxx" value={p.action?.data || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "postback" }), data: e.target.value } })} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">※ ヒーロー: バブル上部に大きく表示（余白なし）</div>
                </div>
              </div>
            </div>
          )}

          {/* ボタン要素 */}
          {element.type === "button" && (
            <div className="grid gap-2">
              <div className="grid grid-cols-3 gap-2 items-end">
                <div>
                  <Label className="text-xs">見た目</Label>
                  <Select value={p.style || "primary"} onValueChange={(v: ButtonStyle) => onUpdate(element.id, { ...p, style: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>
                      <SelectItem value="primary">塗り（背景色・白文字）</SelectItem>
                      <SelectItem value="secondary">塗り（背景色・黒文字）</SelectItem>
                      <SelectItem value="link">リンク（背景なし・文字色）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">高さ</Label>
                  <Select value={p.height || "md"} onValueChange={(v: ButtonHeight) => onUpdate(element.id, { ...p, height: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent><SelectItem value="sm">小</SelectItem><SelectItem value="md">中</SelectItem><SelectItem value="lg">大</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              {/* 色設定：primary/secondary=背景色, link=文字色 */}
              {p.style !== "link" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">背景色</Label>
                    <div className="h-7 flex items-center">
                      <ColorPicker color={p.buttonColor || "#06c755"} onChange={(c) => onUpdate(element.id, { ...p, buttonColor: c })} />
                    </div>
                  </div>
                  <div className="flex items-end text-[12px] text-muted-foreground">
                    文字色：{p.style === "primary" ? "白(固定)" : "黒(固定)"}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">文字色</Label>
                    <div className="h-7 flex items-center">
                      <ColorPicker color={p.buttonColor || "#0f83ff"} onChange={(c) => onUpdate(element.id, { ...p, buttonColor: c })} />
                    </div>
                  </div>
                  <div className="flex items-end text-[12px] text-muted-foreground">背景色：なし（リンク）</div>
                </div>
              )}

              <div className="border-t pt-2">
                <Label className="text-xs font-semibold">ボタンの動作</Label>
                <div className="grid gap-2 mt-2">
                  <div>
                    <Label className="text-xs">ラベル</Label>
                    <Input className="h-7 text-xs" value={p.action?.label || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "uri" }), label: e.target.value } })} placeholder="ボタンに表示するテキスト" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">アクションタイプ</Label>
                      <Select value={p.action?.type || "uri"} onValueChange={(v: ElementAction["type"]) => onUpdate(element.id, { ...p, action: { ...(p.action || {}), type: v } })}>
                        <SelectTrigger className="h-7 text-xs" />
                        <SelectContent><SelectItem value="uri">URLを開く</SelectItem><SelectItem value="message">メッセージ送信</SelectItem><SelectItem value="postback">ポストバック</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      {p.action?.type === "uri" && (
                        <div>
                          <Label className="text-xs">URL</Label>
                          <Input className="h-7 text-xs" placeholder="https://..." value={p.action?.uri || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "uri" }), uri: e.target.value } })} />
                        </div>
                      )}
                      {p.action?.type === "message" && (
                        <div>
                          <Label className="text-xs">送信するテキスト</Label>
                          <Input className="h-7 text-xs" placeholder="送信するテキスト" value={p.action?.text || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "message" }), text: e.target.value } })} />
                        </div>
                      )}
                      {p.action?.type === "postback" && (
                        <div>
                          <Label className="text-xs">ポストバックデータ</Label>
                          <Input className="h-7 text-xs" placeholder="data=xxx" value={p.action?.data || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "postback" }), data: e.target.value } })} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ===================== Main Component ===================== */

export default function FlexMessageDesigner() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<FlexMessageRow[]>([]);
  const [planName, setPlanName] = useState<string | null>(null);

  const [state, setState] = useState<DesignerState>({
    containerType: "bubble",
    bubbles: [defaultBubble()],
    currentIndex: 0,
  });

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(300);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        setPreviewWidth(entries[0].contentRect.width);
      }
    });

    resizeObserver.observe(container);
    // 初期幅を設定
    setPreviewWidth(container.getBoundingClientRect().width);

    return () => resizeObserver.disconnect();
  }, []);

  const current = state.bubbles[state.currentIndex];
  const flexPlanLimit = useMemo(() => {
    if (!planName) return null;
    const lower = planName.toLowerCase();
    if (lower.includes("free") || planName.includes("フリー")) return 2;
    if (lower.includes("silver") || planName.includes("シルバー")) return 10;
    if (lower.includes("gold") || planName.includes("ゴールド")) return -1;
    return null;
  }, [planName]);
  const flexLimitReached = typeof flexPlanLimit === "number" && flexPlanLimit !== -1 && messages.length >= flexPlanLimit;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }
        const [messagesResult, planResult] = await Promise.all([
          supabase.from("flex_messages").select("*").order("created_at", { ascending: false }),
          supabase.rpc('get_user_plan_and_step_stats', { p_user_id: user.id }),
        ]);

        if (messagesResult.error) throw messagesResult.error;
        setMessages(messagesResult.data || []);

        if (planResult.error) {
          console.error("Failed to load plan info:", planResult.error);
        } else if (planResult.data) {
          const planRow = planResult.data[0];
          setPlanName(planRow?.plan_name ?? null);
        }
      } catch (e) {
        console.error(e);
        toast({ title: "読み込みエラー", description: "保存済みメッセージの取得に失敗しました", variant: "destructive" });
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [navigate, toast]);

  /* Handlers */
  const addElement = (type: FlexElement["type"]) => {
    setState((prev) => {
      const next = { ...prev };
      next.bubbles[next.currentIndex].contents = [...next.bubbles[next.currentIndex].contents, makeElement(type)];
      return next;
    });
  };

  const updateElement = (id: string, props: ElementProps) => {
    setState((prev) => {
      const next = { ...prev };
      const list = next.bubbles[next.currentIndex].contents.map((el) => (el.id === id ? { ...el, properties: props } : el));
      next.bubbles[next.currentIndex].contents = list;
      return next;
    });
  };

  const deleteElement = (id: string) => {
    setState((prev) => {
      const next = { ...prev };
      next.bubbles[next.currentIndex].contents = next.bubbles[next.currentIndex].contents.filter((el) => el.id !== id);
      return next;
    });
  };

  const handleHeroToggle = (id: string, nextChecked: boolean) => {
    setState((prev) => {
      const next = { ...prev };
      const contents = next.bubbles[next.currentIndex].contents;
      const cleared = contents.map((el) => (el.type === "image" ? { ...el, properties: { ...el.properties, isHero: false } } : el));
      next.bubbles[next.currentIndex].contents = cleared.map((el) => (el.id === id ? { ...el, properties: { ...el.properties, isHero: nextChecked } } : el));
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setState((prev) => {
      const next = { ...prev };
      const arr = next.bubbles[next.currentIndex].contents;
      const oldIndex = arr.findIndex((i) => i.id === active.id);
      const newIndex = arr.findIndex((i) => i.id === over.id);
      next.bubbles[next.currentIndex].contents = arrayMove(arr, oldIndex, newIndex);
      return next;
    });
  };

  const newMessage = () => {
    setState({ containerType: "bubble", bubbles: [defaultBubble()], currentIndex: 0, loadedMessageId: undefined });
  };

  const handleAddMessage = async () => {
    if (flexPlanLimit === null) {
      toast({ title: "確認中です", description: "プラン情報の取得をお待ちください" });
      return;
    }
    if (typeof flexPlanLimit === "number" && flexPlanLimit !== -1 && messages.length >= flexPlanLimit) {
      toast({
        title: "保存上限に達しました",
        description: `Flexメッセージは${flexPlanLimit.toLocaleString()}件まで保存できます。`,
        variant: "destructive",
      });
      return;
    }

    const initialBubble = defaultBubble("新しいFlexメッセージ");
    const baseState: DesignerState = {
      containerType: "bubble",
      bubbles: [initialBubble],
      currentIndex: 0,
    };

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "認証エラー", description: "ログインしてください", variant: "destructive" });
        return;
      }

      const payload = buildFlexMessage(baseState);
      const { data: inserted, error } = await supabase
        .from("flex_messages")
        .insert({ user_id: user.id, name: initialBubble.name, content: payload as any })
        .select()
        .single();
      if (error) throw error;
      if (!inserted) throw new Error("新規作成されたデータを取得できませんでした");

      setState({
        ...baseState,
        bubbles: [{ ...initialBubble, name: inserted.name }],
        loadedMessageId: inserted.id,
      });
      setMessages((prev) => [inserted, ...prev]);
      toast({ title: "作成しました", description: `「${inserted.name}」を追加しました` });

      try {
        const { data: refreshed, error: fetchErr } = await supabase
          .from("flex_messages")
          .select("*")
          .order("created_at", { ascending: false });
        if (fetchErr) throw fetchErr;
        setMessages(refreshed || []);
      } catch (refreshError: any) {
        console.error("Failed to refresh Flex message list:", refreshError);
        toast({
          title: "リスト更新に失敗しました",
          description: "ページを再読み込みすると最新の一覧になります",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "作成失敗", description: e.message || "新規作成でエラーが発生しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Save / Load / Send
  const saveMessage = async () => {
    const activeId = state.loadedMessageId;
    if (!activeId) {
      toast({ title: "保存できません", description: "左の一覧からメッセージを選択するか、追加ボタンで作成してください", variant: "destructive" });
      return;
    }
    const alt = (current?.altText || "").trim();
    if (!alt) {
      toast({ title: "入力エラー", description: "代替テキスト(通知文)を入力してください", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "認証エラー", description: "ログインしてください", variant: "destructive" });
        return;
      }

      const content = buildFlexMessage(state);
      const title = current?.name || "Flexメッセージ";
      const { error: updateError } = await supabase
        .from("flex_messages")
        .update({ name: title, content: content as any })
        .eq("id", activeId);
      if (updateError) throw updateError;
      toast({ title: "保存しました", description: `「${title}」を更新しました` });

      const { data, error: fetchErr } = await supabase
        .from("flex_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (fetchErr) throw fetchErr;
      setMessages(data || []);
      setState((prev) => ({ ...prev, loadedMessageId: activeId }));
    } catch (e: any) {
      console.error(e);
      toast({ title: "保存失敗", description: e.message || "保存でエラーが発生しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadMessage = (row: FlexMessageRow) => {
    try {
      const c = row.content?.contents;
      if (!c) throw new Error("不正なデータ形式");

      const toItems = (b: any, idxBase = 0): FlexElement[] => {
        const items: FlexElement[] = [];

        const processNodes = (nodes: any[]) => {
          (nodes || []).forEach((node: any, i: number) => {
            const paddingMap = (px?: string): PaddingToken =>
              px === "4px" ? "xs" : px === "8px" ? "sm" : px === "12px" ? "md" : px === "16px" ? "lg" : px === "20px" ? "xl" : "none";

            const isWrapperBox = node.type === "box" && Array.isArray(node.contents) && node.contents.length === 1;
            const innerNode = isWrapperBox ? node.contents[0] : node;

            if (!["text", "image", "button"].includes(innerNode.type)) return;

            let properties: ElementProps = { ...innerNode };

            // Handle properties from the wrapper box
            if (isWrapperBox) {
              properties.padding = paddingMap(node.paddingAll);
              properties.margin = node.margin || innerNode.margin; 
              if (innerNode.type === 'text' && node.backgroundColor) {
                properties.backgroundColor = node.backgroundColor;
              }
            }
            
            const finalProps: ElementProps = {
              margin: properties.margin || "none",
              padding: properties.padding || "none",
              backgroundColor: properties.backgroundColor,
            };

            if (innerNode.type === 'text') {
              Object.assign(finalProps, {
                text: innerNode.text,
                size: innerNode.size || "md",
                weight: innerNode.weight || "normal",
                color: innerNode.color || "#000000",
                align: innerNode.align || "start",
                wrap: true,
              });
            } else if (innerNode.type === 'image') {
              Object.assign(finalProps, {
                url: innerNode.url,
                imgSize: innerNode.size || "full",
                aspectRatio: innerNode.aspectRatio || "20:13",
                aspectMode: innerNode.aspectMode || "cover",
                action: innerNode.action,
              });
            } else if (innerNode.type === 'button') {
              Object.assign(finalProps, {
                style: innerNode.style || "primary",
                buttonColor: innerNode.color,
                height: innerNode.height || "md",
                action: innerNode.action,
              });
            }

            items.push({
              id: generateElementId(),
              type: innerNode.type,
              properties: finalProps,
            });
          });
        }

        if (b.hero?.url) {
          items.push({
            id: generateElementId(),
            type: "image",
            properties: {
              url: b.hero.url,
              imgSize: b.hero.size || "full",
              aspectRatio: b.hero.aspectRatio || "20:13",
              aspectMode: b.hero.aspectMode || "cover",
              isHero: true,
              margin: "none",
              padding: "none",
              action: b.hero.action,
            },
          });
        }
        
        processNodes(b.body?.contents);
        processNodes(b.footer?.contents);
        
        return items;
      };

      if (c.type === "carousel") {
        const bubbles = (c.contents || []).map((b: any, idx: number) => ({
          name: row.name,
          altText: row.content?.altText || `${row.name}のお知らせ`,
          bubbleSize: (b.size as BubbleSize) || "kilo",
          bodyBg: b.body?.backgroundColor,
          bodySpacing: (b.body?.spacing as SpacingToken) || "none",
          contents: toItems(b, idx),
        }));
        setState({ containerType: "carousel", bubbles, currentIndex: 0, loadedMessageId: row.id });
      } else {
        const b = c;
        const bubble = {
          name: row.name,
          altText: row.content?.altText || `${row.name}のお知らせ`,
          bubbleSize: (b.size as BubbleSize) || "kilo",
          bodyBg: b.body?.backgroundColor,
          bodySpacing: (b.body?.spacing as SpacingToken) || "none",
          contents: toItems(b, 0),
        };
        setState({ containerType: "bubble", bubbles: [bubble], currentIndex: 0, loadedMessageId: row.id });
      }

      toast({ title: "読み込み完了", description: `「${row.name}」を読み込みました` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "読込エラー", description: e.message || "メッセージの読込に失敗しました", variant: "destructive" });
    }
  };

  const deleteMessage = async (item: FlexMessageRow) => {
    if (!confirm(`「${item.name}」を削除しますか？`)) return;

    try {
      const { error } = await supabase.from("flex_messages").delete().eq("id", item.id);
      if (error) throw error;
      setMessages((prev) => prev.filter((m) => m.id !== item.id));
      if (state.loadedMessageId === item.id) newMessage();
      toast({ title: "削除", description: `「${item.name}」を削除しました` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "削除失敗", description: e.message || "削除でエラーが発生しました", variant: "destructive" });
    }
  };

  const sendNow = async () => {
    if (!current) return;
    if (!current.altText?.trim()) {
      toast({ title: "入力エラー", description: "代替テキスト(通知文)を入力してください", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "認証エラー", description: "ログインしてください", variant: "destructive" });
        return;
      }
      const payload = buildFlexMessage(state);
      const { error } = await supabase.functions.invoke("send-flex-message", { body: { flexMessage: payload, userId: user.id } });
      if (error) throw error;
      toast({ title: "送信しました", description: state.containerType === "bubble" ? "単体バブルを配信" : "カルーセルを配信" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "送信エラー", description: e.message || "送信に失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendSavedMessage = async (item: FlexMessageRow) => {
    if (!item.content) {
      toast({ title: "送信エラー", description: "Flexメッセージの内容が見つかりませんでした", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: "認証エラー", description: "ログインしてください", variant: "destructive" }); return; }
      const { error } = await supabase.functions.invoke("send-flex-message", { body: { flexMessage: item.content, userId: user.id } });
      if (error) throw error;
      toast({ title: "送信完了", description: "保存済みメッセージを配信しました" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "送信エラー", description: e.message || "送信に失敗", variant: "destructive" });
    }
  };

  /* ===================== UI ===================== */

  if (initialLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-muted-foreground text-sm">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-3 py-2 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base font-semibold">Flexメッセージデザイナー</h1>
        </div>
      </header>

      <main className="container mx-auto px-2 py-4 max-w-7xl">
        <div className="grid lg:grid-cols-[260px_1fr_320px] md:grid-cols-[1fr_320px] grid-cols-1 gap-3">
          {/* 左: 保存済み（コンパクト化） */}
          <Card className="h-[calc(100vh-140px)] lg:sticky top-3 overflow-hidden">
            <CardHeader className="py-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">Flexメッセージ</CardTitle>
                  <CardDescription className="text-xs">追加で新規作成 / 項目を選ぶと読込</CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Button
                    size="sm"
                    className="h-7 px-2 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={handleAddMessage}
                    disabled={loading || flexPlanLimit === null || flexLimitReached}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    追加
                  </Button>
                  <div className="text-[10px] text-muted-foreground">
                    Flex保存 {messages.length.toLocaleString()}
                    {flexPlanLimit === null
                      ? " / 取得中..."
                      : flexPlanLimit === -1
                        ? " / 無制限"
                        : ` / ${flexPlanLimit.toLocaleString()}件`}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 overflow-auto h-full">
              {messages.length === 0 ? (
                <div className="text-xs text-muted-foreground">まだありません</div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`border rounded-md px-2 py-1.5 ${
                        state.loadedMessageId === m.id ? "border-primary bg-primary/10" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium whitespace-normal break-words">
                          {m.name || "無題のFlexメッセージ"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(m.created_at).toLocaleString("ja-JP")}
                        </div>
                        {state.loadedMessageId === m.id && (
                          <div className="text-[10px] text-primary">現在編集中</div>
                        )}
                      </div>
                      <div className="mt-1.5 flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => loadMessage(m)}
                        >
                          読込
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => sendSavedMessage(m)}
                        >
                          配信
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px] text-destructive"
                          onClick={() => deleteMessage(m)}
                        >
                          削除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 中央: デザイナー */}
          <div className="space-y-3">
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />デザイン
                    </CardTitle>
                    <CardDescription className="text-xs">最小の入力で作成。詳細は各要素を開いて調整。</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={saveMessage}
                      disabled={loading || !state.loadedMessageId}
                    >
                      <FileEdit className="w-4 h-4 mr-1" />上書き保存
                    </Button>
                    <Button size="sm" className="h-8 text-xs bg-[#06c755] hover:bg-[#05b84c]" onClick={sendNow} disabled={loading}>
                      <Send className="w-4 h-4 mr-1" />配信
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3 text-sm">
                {/* 基本情報 */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">メッセージ名</Label>
                    <Input
                      className="h-8 text-xs"
                      value={current.name}
                      onChange={(e) => setState((prev) => ({ ...prev, bubbles: prev.bubbles.map((b, i) => (i === prev.currentIndex ? { ...b, name: e.target.value } : b)) }))}
                      placeholder="例) 新商品お知らせ"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">
                      代替テキスト(通知文) <span className="text-[10px] text-muted-foreground">* 400文字まで</span>
                    </Label>
                    <Input
                      className="h-8 text-xs"
                      value={current.altText}
                      maxLength={400}
                      onChange={(e) => setState((prev) => ({ ...prev, bubbles: prev.bubbles.map((b, i) => (i === prev.currentIndex ? { ...b, altText: e.target.value } : b)) }))}
                      placeholder="例) クーポンを配布中！"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">コンテナ</Label>
                    <Select value={state.containerType} onValueChange={(v: ContainerType) => setState((prev) => ({ ...prev, containerType: v }))}>
                      <SelectTrigger className="h-8 text-xs" />
                      <SelectContent><SelectItem value="bubble">単体バブル</SelectItem><SelectItem value="carousel">カルーセル</SelectItem></SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">※ カルーセルは最大10枚</p>
                  </div>
                  <div>
                    <Label className="text-xs">バブル幅</Label>
                    <Select value={current.bubbleSize} onValueChange={(v: BubbleSize) => setState((prev) => ({ ...prev, bubbles: prev.bubbles.map((b, i) => (i === prev.currentIndex ? { ...b, bubbleSize: v } : b)) }))}>
                      <SelectTrigger className="h-8 text-xs" />
                      <SelectContent><SelectItem value="micro">縮小</SelectItem><SelectItem value="deca">中間</SelectItem><SelectItem value="kilo">通常</SelectItem><SelectItem value="mega">拡大</SelectItem><SelectItem value="giga">最大</SelectItem></SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">プレビュー幅に反映</p>
                  </div>
                  <div>
                    <Label className="text-xs">バブル背景色</Label>
                    <div className="h-8 flex items-center">
                      <ColorPicker color={current.bodyBg || "#ffffff"} onChange={(c) => setState((prev) => ({ ...prev, bubbles: prev.bubbles.map((b, i) => (i === prev.currentIndex ? { ...b, bodyBg: c } : b)) }))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">要素間隔</Label>
                    <Select value={current.bodySpacing || "none"} onValueChange={(v: SpacingToken) => setState((prev) => ({ ...prev, bubbles: prev.bubbles.map((b, i) => (i === prev.currentIndex ? { ...b, bodySpacing: v } : b)) }))}>
                      <SelectTrigger className="h-8 text-xs" />
                      <SelectContent><SelectItem value="none">なし</SelectItem><SelectItem value="xs">最小</SelectItem><SelectItem value="sm">小</SelectItem><SelectItem value="md">中</SelectItem><SelectItem value="lg">大</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>

                {state.containerType === "carousel" && (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {state.bubbles.map((_, i) => (
                        <Button key={i} size="sm" variant={i === state.currentIndex ? "default" : "outline"} className="h-7 text-xs" onClick={() => setState((prev) => ({ ...prev, currentIndex: i }))}>
                          <Layers className="w-3.5 h-3.5 mr-1" /> {i + 1}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setState((prev) => ({ ...prev, bubbles: [...prev.bubbles, defaultBubble(`バブル ${prev.bubbles.length + 1}`)].slice(0, 10), currentIndex: Math.min(prev.bubbles.length, 9) }))}>
                        <Plus className="w-4 h-4 mr-1" /> 追加
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setState((prev) => ({ ...prev, bubbles: prev.bubbles.length < 10 ? [...prev.bubbles, JSON.parse(JSON.stringify(prev.bubbles[prev.currentIndex]))] : prev.bubbles, currentIndex: Math.min(prev.bubbles.length, 9) }))}>
                        <Copy className="w-4 h-4 mr-1" /> 複製
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs text-destructive" onClick={() => setState((prev) => ({ ...prev, bubbles: prev.bubbles.length > 1 ? prev.bubbles.filter((_, i) => i !== prev.currentIndex) : prev.bubbles, currentIndex: 0 }))}>
                        <Trash2 className="w-4 h-4 mr-1" /> 削除
                      </Button>
                    </div>
                  </div>
                )}

                {/* 要素ツールバー */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addElement("text")}>+ テキスト</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addElement("image")}><IconImage className="w-4 h-4 mr-1" /> 画像</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addElement("button")}>+ ボタン</Button>
                </div>

                {/* 並べ替えリスト */}
                <div className="max-h-[380px] overflow-auto rounded-md border p-2 bg-muted/30">
                  {current.contents.length === 0 ? (
                    <div className="text-xs text-muted-foreground grid place-items-center h-40">要素を追加してください</div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={current.contents.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                        {current.contents.map((el) => (
                          <SortableItem key={el.id} element={el} onUpdate={updateElement} onDelete={deleteElement} onHeroToggle={handleHeroToggle} />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右: プレビュー */}
          <Card className="h-[calc(100vh-140px)] lg:sticky top-3 overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2"><Eye className="w-4 h-4" />プレビュー</CardTitle>
              <CardDescription className="text-xs">
                おおよその見た目（実機と微差あり）。<br />
                実際に配信のテストを行いデザインを確認してください。
              </CardDescription>
            </CardHeader>
            <CardContent ref={previewContainerRef} className="pt-0 overflow-auto h-full p-4" style={{ backgroundColor: "#8cabd8" }}>
              <div
                className="mx-auto rounded-lg bg-white overflow-hidden"
                style={{ width: getBubbleWidthPx(current.bubbleSize, previewWidth) }}
              >
                {/* hero */}
                {current.contents.find((c) => c.type === "image" && c.properties.isHero && c.properties.url) && (() => {
                  const hero = current.contents.find((c) => c.type === "image" && c.properties.isHero)!;
                  return (
                    <div>
                      <img
                        src={hero.properties.url}
                        alt="hero"
                        className="w-full block"
                        style={{
                          aspectRatio: hero.properties.aspectRatio?.replace(":", "/") || "auto",
                          objectFit: hero.properties.aspectMode === "fit" ? "contain" : "cover",
                        }}
                      />
                    </div>
                  );
                })()}

                {/* body */}
                <div
                  className="flex flex-col"
                  style={{
                    backgroundColor: current.bodyBg && current.bodyBg !== "#ffffff" ? current.bodyBg : undefined,
                    gap: getMarginPx(current.bodySpacing),
                  }}
                >
                  {current.contents.filter((c) => !(c.type === "image" && c.properties.isHero)).map((el) => (
                    <div
                      key={el.id}
                      style={{
                        marginTop: getMarginPx(el.properties.margin),
                        padding: padToPx(el.properties.padding),
                        backgroundColor: el.properties.backgroundColor && el.properties.backgroundColor !== "#ffffff" ? el.properties.backgroundColor : undefined,
                        borderRadius: el.properties.backgroundColor && el.properties.backgroundColor !== "#ffffff" ? "4px" : undefined,
                      }}
                    >
                      {el.type === "text" && (
                        <div
                          style={{
                            color: el.properties.color || "#000",
                            textAlign: (el.properties.align || "start") as any,
                            fontSize: getTextSizePx(el.properties.size || "md"),
                            fontWeight: el.properties.weight === "bold" ? "bold" : "normal",
                            whiteSpace: "pre-wrap",
                            overflowWrap: "break-word",
                          }}
                        >
                          {el.properties.text || ""}
                        </div>
                      )}
                      {el.type === "image" && el.properties.url && (
                        <div>
                          <img
                            src={el.properties.url}
                            alt="img"
                            className="w-full rounded block"
                            style={{
                              aspectRatio: el.properties.aspectRatio?.replace(":", "/") || "auto",
                              objectFit: el.properties.aspectMode === "fit" ? "contain" : "cover",
                            }}
                            onError={(e) => {
                              e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmMWYxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yPC90ZXh0Pjwvc3ZnPg==";
                            }}
                          />
                        </div>
                      )}
                      {el.type === "button" && (
                        <button
                          className="w-full rounded text-[13px] px-3 font-bold"
                          style={{
                            backgroundColor:
                              el.properties.style === "link"
                                ? "transparent"
                                : (el.properties.buttonColor || "#06c755"),
                            color:
                              el.properties.style === "primary"
                                ? "#ffffff"
                                : el.properties.style === "secondary"
                                ? "#000000"
                                : (el.properties.buttonColor || "#0f83ff"),
                            textDecoration: el.properties.style === "link" ? "underline" : "none",
                            border: "none",
                            height: getButtonHeightPx(el.properties.height || "md"),
                          }}
                        >
                          {el.properties.action?.label || "ボタン"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
