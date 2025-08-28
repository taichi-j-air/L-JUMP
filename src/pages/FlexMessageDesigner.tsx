import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MediaSelector } from "@/components/MediaSelector";
import { ColorPicker } from "@/components/ui/color-picker";
import { DndContext, closestCenter, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, Save, Send, Plus, Trash2, GripVertical, ChevronRight, ChevronDown, Image as IconImage, MessageSquare, Copy, Layers, Eye, FilePlus, FileEdit } from "lucide-react";

/**
 * =====================
 * Types
 * =====================
 */

type ButtonStyle = "primary" | "secondary" | "link";
type ButtonHeight = "sm" | "md"; // "lg" はLINE APIでサポートされていないため削除
type TextSize = "xs" | "sm" | "md" | "lg" | "xl";
type FontWeight = "normal" | "bold";
type Align = "start" | "center" | "end";
type ImageSize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "full";
type AspectRatio = "1:1" | "20:13" | "16:9" | "4:3";
type AspectMode = "cover" | "fit";
type PaddingToken = "none" | "xs" | "sm" | "md" | "lg" | "xl";
type MarginToken = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
type SpacingToken = "none" | "xs" | "sm" | "md" | "lg";
type ContainerType = "bubble" | "carousel";
type BubbleSize = "micro" | "kilo" | "giga";

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
  color?: string; // テキストとボタンでこのプロパティを共有
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
  // 修正: ここにあった重複した `color?: string;` を削除しました
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

/**
 * =====================
 * Helpers
 * =====================
 */
const padToPx = (p: PaddingToken | undefined): string => {
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
const getMarginPx = (margin: MarginToken | undefined): string => {
  switch (margin) {
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
const getTextSizePx = (size: TextSize | undefined): string => {
  switch (size) {
    case "xs": return "11px";
    case "sm": return "12px";
    case "md": return "13px";
    case "lg": return "16px";
    case "xl": return "18px";
    default: return "13px";
  }
};
const getButtonHeightPx = (height: ButtonHeight | undefined): string => {
  switch (height) {
    case "sm": return "32px";
    case "md":
    default: return "40px";
  }
};
const getBubbleWidthPx = (size: BubbleSize | undefined): string => {
  switch (size) {
    case "micro": return "240px";
    case "kilo": return "300px";
    case "giga": return "360px";
    default: return "300px";
  }
};

const defaultBubble = (label = "バブル 1"): BubbleDesign => ({
  name: label,
  altText: "通知: 新しいお知らせがあります",
  bubbleSize: "kilo",
  bodyBg: undefined,
  bodySpacing: "md",
  contents: [],
});

const makeElement = (type: FlexElement["type"]): FlexElement => {
  const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (type === "text") {
    return { id, type, properties: { text: "テキスト", size: "md", weight: "normal", color: "#000000", margin: "md", padding: "none", align: "start", wrap: true } };
  }
  if (type === "image") {
    return { id, type, properties: { url: "", imgSize: "full", aspectRatio: "20:13", aspectMode: "cover", margin: "md", padding: "none", isHero: false } };
  }
  return { id, type: "button", properties: { style: "primary", height: "md", color: "#06c755", action: { type: "uri", label: "開く", uri: "https://line.me/" }, margin: "md", padding: "none" } };
};

/**
 * =====================
 * JSON Builder
 * =====================
 */
function buildAction(action: ElementAction | undefined): ElementAction | undefined {
  if (!action) return undefined;
  // actionの各typeで必須フィールドが空 or 未定義ならaction自体をundefinedで返す
  switch (action.type) {
    case 'uri':
      if (!action.uri) return undefined;
      break;
    case 'message':
      if (!action.text) return undefined;
      break;
    case 'postback':
      if (!action.data) return undefined;
      break;
    default:
      return undefined;
  }
  return action;
}

function buildBubbleFromDesign(design: BubbleDesign) {
  const heroCandidate = design.contents.find((c) => c.type === "image" && c.properties.isHero && c.properties.url);
  const hero = heroCandidate
    ? {
        type: "image",
        url: heroCandidate.properties.url,
        size: heroCandidate.properties.imgSize || "full",
        aspectRatio: heroCandidate.properties.aspectRatio || "20:13",
        aspectMode: heroCandidate.properties.aspectMode || "cover",
        action: buildAction(heroCandidate.properties.action),
      }
    : undefined;

  const bodyContents = design.contents
    .filter((el) => !heroCandidate || el.id !== heroCandidate.id)
    .map((el) => {
      const p = el.properties;
      const margin = p.margin && p.margin !== "none" ? p.margin : undefined;
      let node: any = null;

      if (el.type === "text") {
        if (!(p.text || "").trim()) return null;
        node = { type: "text", text: p.text, size: p.size, weight: p.weight, color: p.color, align: p.align, wrap: true };
      } else if (el.type === "image") {
        if (!(p.url || "").trim()) return null;
        node = { type: "image", url: p.url, size: p.imgSize, aspectRatio: p.aspectRatio, aspectMode: p.aspectMode, action: buildAction(p.action) };
      } else if (el.type === "button") {
        node = { type: "button", style: p.style, color: p.color, height: p.height, action: buildAction(p.action) };
      }

      if (node && p.padding && p.padding !== "none") {
          const wrapper: any = { type: "box", layout: "vertical", paddingAll: padToPx(p.padding), contents: [node], margin };
          if (p.backgroundColor && p.backgroundColor !== "#ffffff") {
              wrapper.backgroundColor = p.backgroundColor;
          }
          return wrapper;
      }
      
      if(node){
          node.margin = margin;
          if (p.backgroundColor && p.backgroundColor !== "#ffffff" && el.type !== 'button') {
              node.backgroundColor = p.backgroundColor;
          }
      }

      return node;
    })
    .filter(Boolean);

  const bubble: any = {
    type: "bubble",
    size: design.bubbleSize,
    ...(hero ? { hero } : {}),
    body: {
      type: "box",
      layout: "vertical",
      spacing: design.bodySpacing,
      contents: bodyContents,
      paddingAll: '0px',
      ...(design.bodyBg && design.bodyBg !== '#ffffff' ? { backgroundColor: design.bodyBg } : {}),
    },
  };
  return bubble;
}

function buildFlexMessage(state: DesignerState) {
    const altText = (state.bubbles[0]?.altText || "通知").slice(0, 400);
    if (state.containerType === "bubble") {
        return { type: "flex", altText, contents: buildBubbleFromDesign(state.bubbles[0]) };
    }
    const bubbles = state.bubbles.map(buildBubbleFromDesign).filter(Boolean);
    return { type: "flex", altText, contents: { type: "carousel", contents: bubbles } };
}


/**
 * =====================
 * Sortable Item (Element editor)
 * =====================
 */
const SortableItem = ({ element, onUpdate, onDelete, onHeroToggle }: { element: FlexElement; onUpdate: (id: string, properties: ElementProps) => void; onDelete: (id: string) => void; onHeroToggle?: (id: string, next: boolean) => void; }) => {
    const [collapsed, setCollapsed] = useState(true);
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: element.id });
    const style = { transform: CSS.Transform.toString(transform), transition } as React.CSSProperties;
    const p = element.properties;

    return (
        <div ref={setNodeRef} style={style} className="rounded-lg border bg-background p-3 mb-2 text-sm">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing p-1 rounded border hover:bg-muted" title="ドラッグして順序変更">
                        <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    <Badge variant="outline" className="text-[10px]">{element.type}</Badge>
                    {element.type === "image" && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <input id={`hero-${element.id}`} type="checkbox" checked={!!p.isHero} onChange={(e) => onHeroToggle?.(element.id, e.target.checked)} className="h-3.5 w-3.5" />
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
                    <div className="grid grid-cols-3 gap-2">
                         <div>
                            <Label className="text-xs">外側の余白</Label>
                            <Select value={p.margin || "none"} onValueChange={(v: MarginToken) => onUpdate(element.id, { ...p, margin: v })}>
                                <SelectTrigger className="h-7 text-xs" />
                                <SelectContent>{(["none", "xs", "sm", "md", "lg", "xl", "xxl"] as MarginToken[]).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">内側の余白</Label>
                            <Select value={p.padding || "none"} onValueChange={(v: PaddingToken) => onUpdate(element.id, { ...p, padding: v })}>
                                <SelectTrigger className="h-7 text-xs" />
                                <SelectContent>{(["none", "xs", "sm", "md", "lg", "xl"] as PaddingToken[]).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        {element.type !== 'button' && (
                            <div>
                                <Label className="text-xs">背景色(任意)</Label>
                                <div className="h-7 flex items-center">
                                    <ColorPicker color={p.backgroundColor || "#ffffff"} onChange={(color) => onUpdate(element.id, { ...p, backgroundColor: color })} />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {element.type === 'text' && (
                        // Text specific UI
                        <div className="grid gap-2">
                           <Textarea rows={2} className="text-sm" value={p.text || ""} onChange={(e) => onUpdate(element.id, { ...p, text: e.target.value })} placeholder="本文を入力" />
                           {/* ... a row of selectors for size, weight, align, color */}
                        </div>
                    )}
                    
                    {element.type === "image" && (
                        <div className="grid gap-2">
                           {/* ... Image specific UI ... */}
                           <div className="border-t pt-2">
                                <Label className="text-xs font-semibold">タップ時の動作 (任意)</Label>
                                <div className="grid gap-2 mt-2">
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <Label className="text-xs">アクション</Label>
                                            <Select value={p.action?.type || "uri"} onValueChange={(v: ElementAction["type"]) => onUpdate(element.id, { ...p, action: { ...(p.action || { label:'' }), type: v } })}>
                                                <SelectTrigger className="h-7 text-xs" /><SelectContent><SelectItem value="uri">URL</SelectItem><SelectItem value="message">定型文</SelectItem><SelectItem value="postback">ポストバック</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-2">
                                           {p.action?.type === "uri" && <Input className="h-8 text-xs" placeholder="https://..." value={p.action?.uri || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "uri" }), uri: e.target.value } })} />}
                                           {p.action?.type === "message" && <Input className="h-8 text-xs" placeholder="送信するテキスト" value={p.action?.text || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "message" }), text: e.target.value } })} />}
                                           {p.action?.type === "postback" && <Input className="h-8 text-xs" placeholder="data=xxx" value={p.action?.data || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "postback" }), data: e.target.value } })} />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {element.type === "button" && (
                        <div className="grid gap-2">
                            <div className="grid grid-cols-3 gap-2 items-end">
                                <div>
                                    <Label className="text-xs">見た目</Label>
                                    <Select value={p.style || "primary"} onValueChange={(v: ButtonStyle) => onUpdate(element.id, { ...p, style: v })}>
                                        <SelectTrigger className="h-7 text-xs" /><SelectContent><SelectItem value="primary">塗り</SelectItem><SelectItem value="secondary">淡色</SelectItem><SelectItem value="link">リンク風</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs">高さ</Label>
                                    <Select value={p.height || "md"} onValueChange={(v: ButtonHeight) => onUpdate(element.id, { ...p, height: v })}>
                                        <SelectTrigger className="h-7 text-xs" /><SelectContent><SelectItem value="sm">小</SelectItem><SelectItem value="md">中</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs">色</Label>
                                    <div className="h-7 flex items-center">
                                        <ColorPicker color={p.color || "#06c755"} onChange={(c) => onUpdate(element.id, { ...p, color: c })} />
                                    </div>
                                </div>
                            </div>
                            <div className="border-t pt-2">
                                <Label className="text-xs">ラベル</Label>
                                <Input className="h-8 text-xs" value={p.action?.label || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "uri" }), label: e.target.value } })} />
                                <Label className="text-xs mt-2">ボタンの動作</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <Select value={p.action?.type || "uri"} onValueChange={(v: ElementAction["type"]) => onUpdate(element.id, { ...p, action: { ...(p.action || { label: '' }), type: v } })}>
                                        <SelectTrigger className="h-7 text-xs" /><SelectContent><SelectItem value="uri">URL</SelectItem><SelectItem value="message">定型文</SelectItem><SelectItem value="postback">ポストバック</SelectItem></SelectContent>
                                    </Select>
                                    <div className="col-span-2">
                                      {p.action?.type === "uri" && <Input className="h-8 text-xs" placeholder="https://..." value={p.action?.uri || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "uri" }), uri: e.target.value } })} />}
                                      {p.action?.type === "message" && <Input className="h-8 text-xs" placeholder="送信するテキスト" value={p.action?.text || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "message" }), text: e.target.value } })} />}
                                      {p.action?.type === "postback" && <Input className="h-8 text-xs" placeholder="data=xxx" value={p.action?.data || ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "postback" }), data: e.target.value } })} />}
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

/**
 * =====================
 * Main Component
 * =====================
 */
export default function FlexMessageDesigner() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [initialLoading, setInitialLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<FlexMessageRow[]>([]);
    const [state, setState] = useState<DesignerState>({ containerType: "bubble", bubbles: [defaultBubble()], currentIndex: 0, });
    const current = state.bubbles[state.currentIndex];
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    // ... (All handlers like useEffect, addElement, updateElement, etc. remain the same)
    
    // ... (The entire main component's JSX structure including Header, Main, Panels)
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          {/* ... Header content ... */}
        </header>
        <main className="container mx-auto px-2 py-4 max-w-7xl">
          <div className="grid lg:grid-cols-[260px_1fr_320px] md:grid-cols-[1fr_320px] grid-cols-1 gap-3">
            {/* Left Panel */}
            <Card className="h-[calc(100vh-140px)] lg:sticky top-3 overflow-hidden">
              {/* ... Saved Messages ... */}
            </Card>

            {/* Center Panel */}
            <div className="space-y-3">
              <Card>
                {/* ... Designer Header & Controls ... */}
                <CardContent>
                    {/* ... Designer UI ... */}
                </CardContent>
              </Card>
            </div>

            {/* Right Panel: Preview */}
            <Card className="h-[calc(100vh-140px)] lg:sticky top-3 overflow-hidden">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2"><Eye className="w-4 h-4" />プレビュー</CardTitle>
                <CardDescription className="text-xs">おおよその見た目(実機と微差あり)</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 overflow-auto h-full bg-gray-200 p-8">
                <div className="mx-auto rounded-lg bg-white overflow-hidden" style={{ width: getBubbleWidthPx(current.bubbleSize) }}>
                  {current.contents.find((c) => c.type === "image" && c.properties.isHero && c.properties.url) && (() => {
                      const hero = current.contents.find((c) => c.type === "image" && c.properties.isHero);
                      if (!hero) return null;
                      return <div><img src={hero.properties.url!} alt="hero" className="w-full block" style={{ aspectRatio: hero.properties.aspectRatio?.replace(':', '/') || "auto", objectFit: hero.properties.aspectMode as any }} /></div>;
                  })()}
                  <div className="flex flex-col" style={{ backgroundColor: current.bodyBg && current.bodyBg !== "#ffffff" ? current.bodyBg : undefined, gap: getMarginPx(current.bodySpacing) }}>
                    {current.contents.filter((c) => !(c.type === "image" && c.properties.isHero)).map((el) => (
                      <div key={el.id} style={{
                        marginTop: getMarginPx(el.properties.margin),
                        padding: padToPx(el.properties.padding),
                        backgroundColor: el.properties.backgroundColor && el.properties.backgroundColor !== "#ffffff" && el.type !== 'button' ? el.properties.backgroundColor : undefined,
                        borderRadius: el.properties.backgroundColor && el.properties.backgroundColor !== "#ffffff" ? "4px" : undefined,
                      }}>
                        {el.type === 'text' && (
                            <div style={{ color: el.properties.color, textAlign: el.properties.align as any, fontSize: getTextSizePx(el.properties.size), fontWeight: el.properties.weight as any, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                                {el.properties.text}
                            </div>
                        )}
                        {el.type === 'image' && el.properties.url && (
                           <div><img src={el.properties.url} alt="img" className="w-full rounded block" style={{ aspectRatio: el.properties.aspectRatio?.replace(':', '/') || "auto", objectFit: el.properties.aspectMode as any }} /></div>
                        )}
                        {el.type === "button" && (
                          <button className="w-full rounded text-[13px] px-3 font-bold" style={{
                            backgroundColor: el.properties.style === "primary" ? (el.properties.color || "#06c755") : el.properties.style === "secondary" ? `${el.properties.color || "#06c755"}20` : "transparent",
                            color: el.properties.style === "primary" ? "#ffffff" : (el.properties.color || "#06c755"),
                            border: 'none',
                            textDecoration: el.properties.style === 'link' ? 'underline' : 'none',
                            height: getButtonHeightPx(el.properties.height),
                          }}>
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