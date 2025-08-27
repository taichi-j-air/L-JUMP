// src/pages/FlexMessageDesigner.tsx
import { useEffect, useState } from "react";
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
  Save,
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
} from "lucide-react";

/* =========================================================
   Types / constants
   ========================================================= */

type ButtonStyle = "primary" | "secondary" | "link";
type ButtonHeight = "sm" | "md"; // ← lg は不可（LINE仕様）
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
  actionBtn?: ElementAction; // UI側だけの名前（出力時は action に詰め替える）
  color?: string; // button用（style=link の時は出力しない）
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
}

/* =========================================================
   Helpers
   ========================================================= */

const padToPx = (p?: PaddingToken): string | undefined => {
  switch (p) {
    case "xs": return "4px";
    case "sm": return "8px";
    case "md": return "12px";
    case "lg": return "16px";
    case "xl": return "20px";
    default: return undefined; // none / undefined
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

const getTextSizePx = (s?: TextSize): string => {
  switch (s) {
    case "xs": return "11px";
    case "sm": return "12px";
    case "md": return "13px";
    case "lg": return "16px";
    case "xl": return "18px";
    default: return "13px";
  }
};

const getButtonHeightPx = (h?: ButtonHeight): string => {
  switch (h) {
    case "sm": return "32px";
    case "md":
    default: return "40px";
  }
};

const getBubbleWidthPx = (size: BubbleSize): string => {
  switch (size) {
    case "micro": return "240px";
    case "kilo": return "300px";
    case "giga": return "360px";
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
  const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  if (type === "text") {
    return {
      id,
      type,
      properties: {
        text: "テキスト",
        size: "md",
        weight: "normal",
        color: "#000000",
        margin: "none", // 既定で余白ゼロ
        padding: "none",
        align: "start",
        wrap: true,
      },
    };
  }
  if (type === "image") {
    return {
      id,
      type,
      properties: {
        url: "",
        imgSize: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
        margin: "none", // 既定で余白ゼロ
        padding: "none",
        isHero: false,
      },
    };
  }
  return {
    id,
    type: "button",
    properties: {
      style: "primary",
      height: "md", // lg は使わない
      color: "#06c755",
      actionBtn: { type: "uri", label: "開く", uri: "https://line.me/" },
      margin: "none",
      padding: "none",
    },
  };
};

// 画像URLかをざっくりチェック（動画排除）
const isImageUrl = (url?: string) => {
  if (!url) return false;
  const u = url.toLowerCase().split("?")[0];
  return /\.(png|jpg|jpeg|gif|webp)$/i.test(u);
};

/* =========================================================
   JSON Builder / Loader
   ========================================================= */

function buildBubbleFromDesign(design: BubbleDesign, errors: string[]) {
  // hero 1枚まで
  const heroCandidate = design.contents.find(
    (c) => c.type === "image" && c.properties.isHero && isImageUrl(c.properties.url)
  );
  const hero = heroCandidate
    ? {
        type: "image",
        url: heroCandidate.properties.url!,
        size: heroCandidate.properties.imgSize || "full",
        aspectRatio: heroCandidate.properties.aspectRatio || "20:13",
        aspectMode: heroCandidate.properties.aspectMode || "cover",
        ...(heroCandidate.properties.action ? { action: heroCandidate.properties.action } : {}),
      }
    : undefined;

  // body.contents
  const bodyContents = design.contents
    .filter((el) => !heroCandidate || el.id !== heroCandidate.id)
    .map((el) => {
      const p = el.properties;

      if (el.type === "text") {
        const text = (p.text || "").trim();
        if (!text) return null;
        const node: any = {
          type: "text",
          text,
          ...(p.size && { size: p.size }),
          ...(p.weight && p.weight !== "normal" && { weight: p.weight }),
          ...(p.color && { color: p.color }),
          ...(p.align && p.align !== "start" && { align: p.align }),
          wrap: true,
          ...(p.backgroundColor ? { backgroundColor: p.backgroundColor } : {}),
          ...(p.margin && p.margin !== "none" ? { margin: p.margin } : {}),
        };
        // padding は wrapper で表現
        const pad = padToPx(p.padding);
        if (pad) {
          return { type: "box", layout: "vertical", paddingAll: pad, contents: [node] };
        }
        return node;
      }

      if (el.type === "image") {
        if (!isImageUrl(p.url)) {
          errors.push("画像に動画/不正URLが指定されています。画像のみ使用できます。");
          return null;
        }
        const node: any = {
          type: "image",
          url: p.url!,
          ...(p.imgSize && { size: p.imgSize }),
          ...(p.aspectRatio && { aspectRatio: p.aspectRatio }),
          ...(p.aspectMode && { aspectMode: p.aspectMode }),
          ...(p.action ? { action: p.action } : {}),
          ...(p.margin && p.margin !== "none" ? { margin: p.margin } : {}),
        };
        const pad = padToPx(p.padding);
        if (pad) {
          return { type: "box", layout: "vertical", paddingAll: pad, contents: [node] };
        }
        return node;
      }

      // button
      const act = p.actionBtn;
      if (!act || !act.type) {
        errors.push("ボタンの動作が未設定です。");
        return null;
      }
      // ラベルは通知 UX 的に必須とする（LINE的には action.label は必須推奨）
      if (!act.label || !act.label.trim()) {
        errors.push("ボタンのラベルが未入力です。");
        return null;
      }
      const btn: any = {
        type: "button",
        ...(p.style && { style: p.style }),
        ...(p.height && { height: p.height }), // sm | md のみ
        action: act,
        ...(p.margin && p.margin !== "none" ? { margin: p.margin } : {}),
      };
      // style=primary だけ color を付ける（link/secondary は付けない方が安全）
      if (p.style === "primary" && p.color) {
        btn.color = p.color;
      }
      const pad = padToPx(p.padding);
      if (pad) {
        return { type: "box", layout: "vertical", paddingAll: pad, contents: [btn] };
      }
      return btn;
    })
    .filter(Boolean);

  const bubble: any = {
    type: "bubble",
    size: design.bubbleSize,
    ...(hero ? { hero } : {}),
    body: {
      type: "box",
      layout: "vertical",
      spacing: design.bodySpacing || "md",
      contents: bodyContents,
      ...(design.bodyBg ? { backgroundColor: design.bodyBg } : {}),
    },
  };

  return bubble;
}

function buildFlexMessage(state: DesignerState) {
  const errors: string[] = [];

  const cur = state.bubbles[state.currentIndex];
  const altText = (cur?.altText || "通知").slice(0, 400);

  const buildAll = () => state.bubbles.map((b) => buildBubbleFromDesign(b, errors)).filter(Boolean);

  const payload =
    state.containerType === "bubble"
      ? {
          type: "flex",
          altText,
          contents: buildBubbleFromDesign(cur, errors),
        }
      : {
          type: "flex",
          altText,
          contents: {
            type: "carousel",
            contents: buildAll(),
          },
        };

  return { payload, errors };
}

/* =========================================================
   Sortable item editor
   ========================================================= */

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

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-background p-3 mb-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing p-1 rounded border hover:bg-muted">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <Badge variant="outline" className="text-[10px]">
            {element.type === "text" && "テキスト"}
            {element.type === "image" && "画像"}
            {element.type === "button" && "ボタン"}
          </Badge>
          {element.type === "image" && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={!!p.isHero}
                onChange={(e) => onHeroToggle?.(element.id, e.target.checked)}
              />
              ヘッダー(ヒーロー)
            </label>
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
          {/* 共通 */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">外側の余白</Label>
              <Select value={p.margin || "none"} onValueChange={(v: MarginToken) => onUpdate(element.id, { ...p, margin: v })}>
                <SelectTrigger className="h-7 text-xs" />
                <SelectContent>
                  {(["none", "xs", "sm", "md", "lg", "xl", "xxl"] as MarginToken[]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">内側の余白</Label>
              <Select value={p.padding || "none"} onValueChange={(v: PaddingToken) => onUpdate(element.id, { ...p, padding: v })}>
                <SelectTrigger className="h-7 text-xs" />
                <SelectContent>
                  {(["none", "xs", "sm", "md", "lg", "xl"] as PaddingToken[]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
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

          {/* テキスト */}
          {element.type === "text" && (
            <div className="grid gap-2">
              <div>
                <Label className="text-xs">本文</Label>
                <Textarea rows={2} className="text-sm" value={p.text || ""} onChange={(e) => onUpdate(element.id, { ...p, text: e.target.value })} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">サイズ</Label>
                  <Select value={p.size || "md"} onValueChange={(v: TextSize) => onUpdate(element.id, { ...p, size: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>
                      {(["xs", "sm", "md", "lg", "xl"] as TextSize[]).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">太さ</Label>
                  <Select value={p.weight || "normal"} onValueChange={(v: FontWeight) => onUpdate(element.id, { ...p, weight: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>
                      <SelectItem value="normal">normal</SelectItem>
                      <SelectItem value="bold">bold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">配置</Label>
                  <Select value={p.align || "start"} onValueChange={(v: Align) => onUpdate(element.id, { ...p, align: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>
                      <SelectItem value="start">左</SelectItem>
                      <SelectItem value="center">中央</SelectItem>
                      <SelectItem value="end">右</SelectItem>
                    </SelectContent>
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
            </div>
          )}

          {/* 画像 */}
          {element.type === "image" && (
            <div className="grid gap-2">
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="col-span-2">
                  <Label className="text-xs">画像URL（画像のみ）</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="https://..."
                    value={p.url || ""}
                    onChange={(e) => onUpdate(element.id, { ...p, url: e.target.value })}
                  />
                  {p.url && (
                    <div className="mt-1">
                      <div className="h-16 w-full overflow-hidden rounded border bg-muted flex items-center justify-center">
                        {isImageUrl(p.url) ? (
                          <img src={p.url} alt="thumb" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <div className="text-xs text-muted-foreground">画像URLではありません</div>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground truncate" title={p.url}>{p.url}</div>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs">メディア</Label>
                  <div className="h-8 flex items-center">
                    <MediaSelector
                      onSelect={(url) => onUpdate(element.id, { ...p, url })}
                      selectedUrl={p.url}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">表示サイズ</Label>
                  <Select value={p.imgSize || "full"} onValueChange={(v: ImageSize) => onUpdate(element.id, { ...p, imgSize: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>
                      {(["xxs", "xs", "sm", "md", "lg", "xl", "xxl", "full"] as ImageSize[]).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">アスペクト比</Label>
                  <Select value={p.aspectRatio || "20:13"} onValueChange={(v: AspectRatio) => onUpdate(element.id, { ...p, aspectRatio: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>
                      {(["1:1", "20:13", "16:9", "4:3"] as AspectRatio[]).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">切り抜き</Label>
                  <Select value={p.aspectMode || "cover"} onValueChange={(v: AspectMode) => onUpdate(element.id, { ...p, aspectMode: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>
                      <SelectItem value="cover">カバー(トリミング)</SelectItem>
                      <SelectItem value="fit">フィット(余白優先)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">※ 動画URLは使えません（画像のみ）。</p>
            </div>
          )}

          {/* ボタン */}
          {element.type === "button" && (
            <div className="grid gap-2">
              <div className="grid grid-cols-3 gap-2 items-end">
                <div>
                  <Label className="text-xs">見た目</Label>
                  <Select value={p.style || "primary"} onValueChange={(v: ButtonStyle) => onUpdate(element.id, { ...p, style: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>
                      <SelectItem value="primary">塗り(背景色)</SelectItem>
                      <SelectItem value="secondary">淡色</SelectItem>
                      <SelectItem value="link">リンク風</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">高さ</Label>
                  <Select value={p.height || "md"} onValueChange={(v: ButtonHeight) => onUpdate(element.id, { ...p, height: v })}>
                    <SelectTrigger className="h-7 text-xs" />
                    <SelectContent>
                      <SelectItem value="sm">小</SelectItem>
                      <SelectItem value="md">中</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">色（primaryのみ）</Label>
                  <div className="h-7 flex items-center opacity-100">
                    <ColorPicker
                      color={p.color || "#06c755"}
                      onChange={(c) => onUpdate(element.id, { ...p, color: c })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 items-end">
                <div>
                  <Label className="text-xs">ラベル（必須）</Label>
                  <Input
                    className="h-8 text-xs"
                    value={p.actionBtn?.label || ""}
                    onChange={(e) =>
                      onUpdate(element.id, { ...p, actionBtn: { ...(p.actionBtn || { type: "uri" }), label: e.target.value } })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">動作</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value={p.actionBtn?.type || "uri"}
                      onValueChange={(v: ElementAction["type"]) =>
                        onUpdate(element.id, { ...p, actionBtn: { ...(p.actionBtn || {}), type: v } })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs" />
                      <SelectContent>
                        <SelectItem value="uri">URL</SelectItem>
                        <SelectItem value="message">定型文</SelectItem>
                        <SelectItem value="postback">ポストバック</SelectItem>
                      </SelectContent>
                    </Select>
                    {p.actionBtn?.type === "uri" && (
                      <Input
                        className="h-8 text-xs col-span-2"
                        placeholder="https://..."
                        value={p.actionBtn?.uri || ""}
                        onChange={(e) =>
                          onUpdate(element.id, { ...p, actionBtn: { ...(p.actionBtn || { type: "uri" }), uri: e.target.value } })
                        }
                      />
                    )}
                    {p.actionBtn?.type === "message" && (
                      <Input
                        className="h-8 text-xs col-span-2"
                        placeholder="送信するテキスト"
                        value={p.actionBtn?.text || ""}
                        onChange={(e) =>
                          onUpdate(element.id, { ...p, actionBtn: { ...(p.actionBtn || { type: "message" }), text: e.target.value } })
                        }
                      />
                    )}
                    {p.actionBtn?.type === "postback" && (
                      <Input
                        className="h-8 text-xs col-span-2"
                        placeholder="data=xxx"
                        value={p.actionBtn?.data || ""}
                        onChange={(e) =>
                          onUpdate(element.id, { ...p, actionBtn: { ...(p.actionBtn || { type: "postback" }), data: e.target.value } })
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ※ `height` は `sm|md` のみ。`link/secondary` では背景色は送られません（仕様）。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* =========================================================
   Main
   ========================================================= */

export default function FlexMessageDesigner() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<FlexMessageRow[]>([]);

  const [state, setState] = useState<DesignerState>({
    containerType: "bubble",
    bubbles: [defaultBubble()],
    currentIndex: 0,
  });

  const current = state.bubbles[state.currentIndex];

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
        const { data, error } = await supabase
          .from("flex_messages")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setMessages(data || []);
      } catch (e) {
        console.error(e);
        toast({ title: "読み込みエラー", description: "保存済みメッセージの取得に失敗しました", variant: "destructive" });
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [navigate, toast]);

  // Handlers
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
      next.bubbles[next.currentIndex].contents = next.bubbles[next.currentIndex].contents.map((el) =>
        el.id === id ? { ...el, properties: props } : el
      );
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
  const handleHeroToggle = (id: string, checked: boolean) => {
    setState((prev) => {
      const next = { ...prev };
      const list = next.bubbles[next.currentIndex].contents.map((el) =>
        el.type === "image" ? { ...el, properties: { ...el.properties, isHero: false } } : el
      );
      next.bubbles[next.currentIndex].contents = list.map((el) =>
        el.id === id ? { ...el, properties: { ...el.properties, isHero: checked } } : el
      );
      return next;
    });
  };
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
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

  // Validate before save / send
  const validateBeforeExport = (): string[] => {
    const { payload, errors } = buildFlexMessage(state);
    // 要素有無
    const hasBody =
      state.containerType === "bubble"
        ? (payload.contents?.body?.contents?.length || 0) > 0 || !!payload.contents?.hero
        : (payload.contents?.contents?.some((b: any) => (b.body?.contents?.length || 0) > 0 || !!b.hero) ?? false);
    if (!hasBody) errors.push("要素がありません。");
    // 画像URLの最終チェック
    state.bubbles.forEach((b, bi) => {
      b.contents.forEach((el, ei) => {
        if (el.type === "image" && !isImageUrl(el.properties.url)) {
          errors.push(`画像(${bi + 1}-${ei + 1})に画像以外のURLが指定されています。`);
        }
      });
    });
    // ボタン高さチェック（念のため）
    state.bubbles.forEach((b) =>
      b.contents.forEach((el) => {
        if (el.type === "button" && el.properties.height && !["sm", "md"].includes(el.properties.height)) {
          errors.push("ボタンの高さは sm|md のみです。");
        }
      })
    );
    return errors;
  };

  // 追加保存（常に insert）
  const saveAsNew = async () => {
    const errs = validateBeforeExport();
    if (errs.length) {
      toast({ title: "保存できません", description: errs[0], variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "認証エラー", description: "ログインしてください", variant: "destructive" });
        return;
      }
      const { payload } = buildFlexMessage(state);
      const title = current?.name || "Flexメッセージ";
      const { error } = await supabase.from("flex_messages").insert({ user_id: user.id, name: title, content: payload });
      if (error) throw error;
      toast({ title: "追加保存", description: `「${title}」を新規保存しました` });

      // 再取得
      const { data, error: fetchErr } = await supabase.from("flex_messages").select("*").order("created_at", { ascending: false });
      if (fetchErr) throw fetchErr;
      setMessages(data || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: "保存失敗", description: e.message || "保存に失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadMessage = (row: FlexMessageRow) => {
    try {
      const c = row.content?.contents;
      if (!c) throw new Error("不正なデータ形式");

      // carousel
      if (c.type === "carousel") {
        const bubbles: BubbleDesign[] = (c.contents || []).map((b: any, idx: number) => {
          const items: FlexElement[] = [];

          if (b.hero?.url) {
            items.push({
              id: `el-h-${idx}`,
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

          (b.body?.contents || []).forEach((node: any, i: number) => {
            // wrapper (padding) の復元
            const unwrap = (n: any) => (n?.type === "box" && Array.isArray(n.contents) && n.contents.length === 1 ? n.contents[0] : n);
            const inner = unwrap(node);
            const padding: PaddingToken =
              node.type === "box" && node.paddingAll
                ? node.paddingAll === "4px"
                  ? "xs"
                  : node.paddingAll === "8px"
                  ? "sm"
                  : node.paddingAll === "12px"
                  ? "md"
                  : node.paddingAll === "16px"
                  ? "lg"
                  : node.paddingAll === "20px"
                  ? "xl"
                  : "none"
                : "none";

            if (inner.type === "text") {
              items.push({
                id: `el-${idx}-${i}`,
                type: "text",
                properties: {
                  text: inner.text,
                  size: inner.size || "md",
                  weight: inner.weight || "normal",
                  color: inner.color || "#000000",
                  align: inner.align || "start",
                  margin: inner.margin || "none",
                  padding,
                  backgroundColor: inner.backgroundColor,
                  wrap: true,
                },
              });
            } else if (inner.type === "image") {
              items.push({
                id: `el-${idx}-${i}`,
                type: "image",
                properties: {
                  url: inner.url,
                  imgSize: inner.size || "full",
                  aspectRatio: inner.aspectRatio || "20:13",
                  aspectMode: inner.aspectMode || "cover",
                  action: inner.action,
                  margin: inner.margin || "none",
                  padding,
                },
              });
            } else if (inner.type === "button") {
              items.push({
                id: `el-${idx}-${i}`,
                type: "button",
                properties: {
                  style: inner.style || "primary",
                  color: inner.color,
                  height: (inner.height as ButtonHeight) || "md",
                  actionBtn: inner.action,
                  margin: inner.margin || "none",
                  padding,
                },
              });
            }
          });

          return {
            name: row.name,
            altText: row.content?.altText || `${row.name}のお知らせ`,
            bubbleSize: (b.size as BubbleSize) || "kilo",
            bodyBg: b.body?.backgroundColor,
            bodySpacing: (b.body?.spacing as SpacingToken) || "md",
            contents: items,
          } as BubbleDesign;
        });

        setState({ containerType: "carousel", bubbles, currentIndex: 0 });
      } else {
        // bubble
        const b = c;
        const items: FlexElement[] = [];
        if (b.hero?.url) {
          items.push({
            id: `el-h-0`,
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
        (b.body?.contents || []).forEach((node: any, i: number) => {
          const unwrap = (n: any) => (n?.type === "box" && Array.isArray(n.contents) && n.contents.length === 1 ? n.contents[0] : n);
          const inner = unwrap(node);
          const padding: PaddingToken =
            node.type === "box" && node.paddingAll
              ? node.paddingAll === "4px"
                ? "xs"
                : node.paddingAll === "8px"
                ? "sm"
                : node.paddingAll === "12px"
                ? "md"
                : node.paddingAll === "16px"
                ? "lg"
                : node.paddingAll === "20px"
                ? "xl"
                : "none"
              : "none";

          if (inner.type === "text") {
            items.push({
              id: `el-${i}`,
              type: "text",
              properties: {
                text: inner.text,
                size: inner.size || "md",
                weight: inner.weight || "normal",
                color: inner.color || "#000000",
                align: inner.align || "start",
                margin: inner.margin || "none",
                padding,
                backgroundColor: inner.backgroundColor,
                wrap: true,
              },
            });
          } else if (inner.type === "image") {
            items.push({
              id: `el-${i}`,
              type: "image",
              properties: {
                url: inner.url,
                imgSize: inner.size || "full",
                aspectRatio: inner.aspectRatio || "20:13",
                aspectMode: inner.aspectMode || "cover",
                action: inner.action,
                margin: inner.margin || "none",
                padding,
              },
            });
          } else if (inner.type === "button") {
            items.push({
              id: `el-${i}`,
              type: "button",
              properties: {
                style: inner.style || "primary",
                color: inner.color,
                height: (inner.height as ButtonHeight) || "md",
                actionBtn: inner.action,
                margin: inner.margin || "none",
                padding,
              },
            });
          }
        });

        setState({
          containerType: "bubble",
          bubbles: [
            {
              name: row.name,
              altText: row.content?.altText || `${row.name}のお知らせ`,
              bubbleSize: (b.size as BubbleSize) || "kilo",
              bodyBg: b.body?.backgroundColor,
              bodySpacing: (b.body?.spacing as SpacingToken) || "md",
              contents: items,
            },
          ],
          currentIndex: 0,
        });
      }

      toast({ title: "読み込み完了", description: `「${row.name}」を読み込みました` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "読込エラー", description: e.message || "メッセージの読込に失敗しました", variant: "destructive" });
    }
  };

  const deleteMessage = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    try {
      const { error } = await supabase.from("flex_messages").delete().eq("id", id);
      if (error) throw error;
      setMessages((prev) => prev.filter((m) => m.id !== id));
      toast({ title: "削除", description: `「${name}」を削除しました` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "削除失敗", description: e.message || "削除でエラーが発生しました", variant: "destructive" });
    }
  };

  const sendNow = async () => {
    const errs = validateBeforeExport();
    if (errs.length) {
      toast({ title: "送信できません", description: errs[0], variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "認証エラー", description: "ログインしてください", variant: "destructive" });
        return;
      }
      const { payload } = buildFlexMessage(state);
      const { error } = await supabase.functions.invoke("send-flex-message", {
        body: { flexMessage: payload, userId: user.id },
      });
      if (error) throw error;
      toast({
        title: "送信しました",
        description: state.containerType === "bubble" ? "単体バブルを配信" : "カルーセルを配信",
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: "送信エラー", description: e.message || "送信に失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // UI
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
          {/* 左: 保存済み */}
          <Card className="h-[calc(100vh-140px)] lg:sticky top-3 overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">保存済みメッセージ</CardTitle>
              <CardDescription className="text-xs">クリックで読込 / 右のボタンで配信</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 overflow-auto h-full">
              {messages.length === 0 ? (
                <div className="text-xs text-muted-foreground">まだありません</div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div key={m.id} className="border rounded-md p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate" title={m.name}>{m.name}</div>
                          <div className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString("ja-JP")}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => loadMessage(m)}>
                            読込
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={async () => {
                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) {
                                  toast({ title: "認証エラー", description: "ログインしてください", variant: "destructive" });
                                  return;
                                }
                                const { error } = await supabase.functions.invoke("send-flex-message", {
                                  body: { flexMessage: m.content, userId: user.id },
                                });
                                if (error) throw error;
                                toast({ title: "送信完了", description: "保存済みメッセージを配信しました" });
                              } catch (e: any) {
                                toast({ title: "送信エラー", description: e.message || "送信に失敗", variant: "destructive" });
                              }
                            }}
                          >
                            配信
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive" onClick={() => deleteMessage(m.id, m.name)}>
                            削除
                          </Button>
                        </div>
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
                      <MessageSquare className="w-4 h-4" />
                      デザイン
                    </CardTitle>
                    <CardDescription className="text-xs">
                      余白はデフォルトでゼロ。必要な要素だけ個別に設定できます。
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setState({ containerType: "bubble", bubbles: [defaultBubble()], currentIndex: 0 })}>
                      新規
                    </Button>
                    <Button size="sm" className="h-8 text-xs" onClick={saveAsNew} disabled={loading}>
                      <Save className="w-4 h-4 mr-1" />
                      追加保存
                    </Button>
                    <Button size="sm" className="h-8 text-xs bg-[#06c755] hover:bg-[#05b84c]" onClick={sendNow} disabled={loading}>
                      <Send className="w-4 h-4 mr-1" />
                      配信
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">メッセージ名</Label>
                    <Input
                      className="h-8 text-xs"
                      value={current.name}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          bubbles: prev.bubbles.map((b, i) => (i === prev.currentIndex ? { ...b, name: e.target.value } : b)),
                        }))
                      }
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
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          bubbles: prev.bubbles.map((b, i) => (i === prev.currentIndex ? { ...b, altText: e.target.value } : b)),
                        }))
                      }
                      placeholder="例) クーポン配布中！"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">コンテナ</Label>
                    <Select
                      value={state.containerType}
                      onValueChange={(v: ContainerType) => setState((prev) => ({ ...prev, containerType: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs" />
                      <SelectContent>
                        <SelectItem value="bubble">単体バブル</SelectItem>
                        <SelectItem value="carousel">カルーセル</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">カルーセルは最大10枚</p>
                  </div>
                  <div>
                    <Label className="text-xs">バブル幅</Label>
                    <Select
                      value={current.bubbleSize}
                      onValueChange={(v: BubbleSize) =>
                        setState((prev) => ({
                          ...prev,
                          bubbles: prev.bubbles.map((b, i) => (i === prev.currentIndex ? { ...b, bubbleSize: v } : b)),
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs" />
                      <SelectContent>
                        <SelectItem value="micro">縮小</SelectItem>
                        <SelectItem value="kilo">通常</SelectItem>
                        <SelectItem value="giga">最大</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">バブル背景色</Label>
                    <div className="h-8 flex items-center">
                      <ColorPicker
                        color={current.bodyBg || "#ffffff"}
                        onChange={(c) =>
                          setState((prev) => ({
                            ...prev,
                            bubbles: prev.bubbles.map((b, i) => (i === prev.currentIndex ? { ...b, bodyBg: c } : b)),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">要素間隔</Label>
                    <Select
                      value={current.bodySpacing || "md"}
                      onValueChange={(v: SpacingToken) =>
                        setState((prev) => ({
                          ...prev,
                          bubbles: prev.bubbles.map((b, i) => (i === prev.currentIndex ? { ...b, bodySpacing: v } : b)),
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs" />
                      <SelectContent>
                        <SelectItem value="none">なし</SelectItem>
                        <SelectItem value="xs">最小</SelectItem>
                        <SelectItem value="sm">小</SelectItem>
                        <SelectItem value="md">中</SelectItem>
                        <SelectItem value="lg">大</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {state.containerType === "carousel" && (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {state.bubbles.map((b, i) => (
                        <Button
                          key={i}
                          size="sm"
                          variant={i === state.currentIndex ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => setState((prev) => ({ ...prev, currentIndex: i }))}
                        >
                          <Layers className="w-3.5 h-3.5 mr-1" /> {i + 1}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            bubbles: [...prev.bubbles, defaultBubble(`バブル ${prev.bubbles.length + 1}`)].slice(0, 10),
                            currentIndex: Math.min(prev.bubbles.length, 9),
                          }))
                        }
                      >
                        <Plus className="w-4 h-4 mr-1" /> 追加
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            bubbles:
                              prev.bubbles.length < 10
                                ? [...prev.bubbles, JSON.parse(JSON.stringify(prev.bubbles[prev.currentIndex]))]
                                : prev.bubbles,
                            currentIndex: Math.min(prev.bubbles.length, 9),
                          }))
                        }
                      >
                        <Copy className="w-4 h-4 mr-1" /> 複製
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-destructive"
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            bubbles: prev.bubbles.length > 1 ? prev.bubbles.filter((_, i) => i !== prev.currentIndex) : prev.bubbles,
                            currentIndex: 0,
                          }))
                        }
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> 削除
                      </Button>
                    </div>
                  </div>
                )}

                {/* 要素ツールバー */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addElement("text")}>
                    + テキスト
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addElement("image")}>
                    <IconImage className="w-4 h-4 mr-1" />
                    画像
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addElement("button")}>
                    + ボタン
                  </Button>
                </div>

                {/* 要素リスト */}
                <div className="max-h-[380px] overflow-auto rounded-md border p-2 bg-muted/30">
                  {current.contents.length === 0 ? (
                    <div className="text-xs text-muted-foreground grid place-items-center h-40">要素を追加してください</div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={current.contents.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                        {current.contents.map((el) => (
                          <SortableItem
                            key={el.id}
                            element={el}
                            onUpdate={updateElement}
                            onDelete={deleteElement}
                            onHeroToggle={handleHeroToggle}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右: プレビュー（固定パディング無し） */}
          <Card className="h-[calc(100vh-140px)] lg:sticky top-3 overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4" />
                プレビュー
              </CardTitle>
              <CardDescription className="text-xs">実機と多少の差があります</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 overflow-auto h-full">
              <div style={{ width: getBubbleWidthPx(current.bubbleSize) }} className="mx-auto">
                {/* hero */}
                {current.contents.find((c) => c.type === "image" && c.properties.isHero && isImageUrl(c.properties.url)) && (
                  <img
                    src={current.contents.find((c) => c.type === "image" && c.properties.isHero)?.properties.url}
                    alt="hero"
                    className="w-full rounded-t-lg"
                    style={{
                      aspectRatio:
                        current.contents.find((c) => c.type === "image" && c.properties.isHero)?.properties.aspectRatio?.replace(":", "/") ||
                        "auto",
                      objectFit:
                        current.contents.find((c) => c.type === "image" && c.properties.isHero)?.properties.aspectMode === "fit"
                          ? "contain"
                          : "cover",
                    }}
                  />
                )}
                {/* body */}
                <div
                  className={`${current.contents.some((c) => c.type === "image" && c.properties.isHero) ? "rounded-b-lg" : "rounded-lg"} border border-t-0`}
                  style={{
                    backgroundColor: current.bodyBg && current.bodyBg !== "#ffffff" ? current.bodyBg : "#ffffff",
                  }}
                >
                  <div className="p-0">
                    {current.contents
                      .filter((c) => !(c.type === "image" && c.properties.isHero))
                      .map((el, i, arr) => (
                        <div
                          key={el.id}
                          className="last:mb-0 px-3"
                          style={{
                            marginTop: i === 0 ? "0" : getMarginPx((current.bodySpacing || "md") as MarginToken),
                          }}
                        >
                          {el.type === "text" && (
                            <div
                              style={{
                                color: el.properties.color || "#000",
                                textAlign: (el.properties.align || "start") as any,
                                backgroundColor:
                                  el.properties.backgroundColor && el.properties.backgroundColor !== "#ffffff"
                                    ? el.properties.backgroundColor
                                    : undefined,
                                padding: el.properties.padding && el.properties.padding !== "none" ? padToPx(el.properties.padding) : undefined,
                                margin:
                                  el.properties.margin && el.properties.margin !== "none"
                                    ? `${getMarginPx(el.properties.margin)} 0`
                                    : undefined,
                                borderRadius:
                                  el.properties.backgroundColor && el.properties.backgroundColor !== "#ffffff" ? "4px" : undefined,
                                fontSize: getTextSizePx(el.properties.size),
                                fontWeight: el.properties.weight === "bold" ? "bold" : "normal",
                              }}
                            >
                              {(el.properties.text || "").split("\n").map((line, idx) => (
                                <div key={idx}>{line}</div>
                              ))}
                            </div>
                          )}

                          {el.type === "image" && isImageUrl(el.properties.url) && (
                            <div
                              style={{
                                margin:
                                  el.properties.margin && el.properties.margin !== "none"
                                    ? `${getMarginPx(el.properties.margin)} 0`
                                    : undefined,
                                padding:
                                  el.properties.padding && el.properties.padding !== "none"
                                    ? padToPx(el.properties.padding)
                                    : undefined,
                              }}
                            >
                              <img
                                src={el.properties.url}
                                alt="img"
                                className="w-full rounded"
                                style={{
                                  aspectRatio: el.properties.aspectRatio?.replace(":", "/") || "auto",
                                  objectFit: el.properties.aspectMode === "fit" ? "contain" : "cover",
                                }}
                                onError={(e) => {
                                  e.currentTarget.src =
                                    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmMWYxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yPC90ZXh0Pjwvc3ZnPg==";
                                }}
                              />
                            </div>
                          )}

                          {el.type === "button" && (
                            <button
                              className="w-full rounded text-[13px] px-3"
                              style={{
                                backgroundColor:
                                  el.properties.style === "primary"
                                    ? el.properties.color || "#06c755"
                                    : el.properties.style === "secondary"
                                    ? "#f4f4f4"
                                    : "transparent",
                                color: el.properties.style === "primary" ? "#ffffff" : "#0066cc",
                                border:
                                  el.properties.style === "link" ? `1px solid ${el.properties.color || "#06c755"}` : "1px solid transparent",
                                height: getButtonHeightPx(el.properties.height),
                                margin:
                                  el.properties.margin && el.properties.margin !== "none"
                                    ? `${getMarginPx(el.properties.margin)} 0`
                                    : undefined,
                                padding:
                                  el.properties.padding && el.properties.padding !== "none"
                                    ? padToPx(el.properties.padding)
                                    : undefined,
                              }}
                            >
                              {el.properties.actionBtn?.label || "ボタン"}
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
