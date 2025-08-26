import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Send, Plus, Trash2, Image as ImageIcon,
  MessageSquare, Save, Eye, GripVertical, ChevronDown, ChevronRight, Link as LinkIcon,
  Maximize2, Minimize2, Star
} from "lucide-react";
import { MediaSelector } from "@/components/MediaSelector";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ============ Types ============
interface FlexMessageRow {
  id: string;
  name: string;
  content: any;
  created_at: string;
  updated_at: string;
  user_id: string;
}

type PaddingToken = "none" | "0px" | "sm" | "md" | "lg" | "xl" | "xxl";
type ElementType = "text" | "image" | "button";
type BubbleSize = "micro" | "kilo" | "mega"; // 小/標準/大

interface ActionDef {
  type: "message" | "uri" | "postback";
  label?: string;
  text?: string;
  uri?: string;
  data?: string;
}

interface ElementProps {
  text?: string;
  url?: string;
  size?: string;
  weight?: string;
  color?: string;
  align?: string;
  wrap?: boolean;
  aspectRatio?: "20:13" | "16:9" | "1:1" | "4:3";
  aspectMode?: "cover" | "fit";
  style?: "primary" | "secondary" | "link";
  height?: "sm" | "md" | "lg";
  action?: ActionDef;
  backgroundColor?: string;     // 要素ラッパの背景
  paddingAll?: PaddingToken;    // 要素ラッパの内側余白
}

interface FlexElement {
  id: string;
  type: ElementType;
  properties: ElementProps;
}

interface HeroConfig {
  enabled: boolean;
  url?: string;
  aspectRatio?: "20:13" | "16:9" | "1:1" | "4:3";
  aspectMode?: "cover" | "fit";
  action?: ActionDef;
}

interface FlexDesign {
  name: string;
  altText: string;      // #1 通知文
  bubbleSize: BubbleSize; // 追加：横幅
  hero: HeroConfig;
  body: {
    spacing?: "none" | "sm" | "md" | "lg";
    backgroundColor?: string | undefined;
    contents: FlexElement[];
  };
}

// ============ Utils ============
const padMap: Record<Exclude<PaddingToken,"none">, number> = {
  "0px": 0, sm: 6, md: 12, lg: 16, xl: 20, xxl: 24,
};

const toHex6 = (val?: string) => {
  if (!val) return undefined;
  const v = val.trim();
  if (!v) return undefined;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[1], g = v[2], b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return undefined;
};

const compact = (obj: Record<string, any>) => {
  const out: Record<string, any> = {};
  Object.keys(obj).forEach(k => {
    const v = (obj as any)[k];
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  });
  return out;
};

// ============ Sortable Item ============
const SortableItem = ({
  element, onUpdate, onDelete, onMakeHero, defaultOpen = false,
}: {
  element: FlexElement;
  onUpdate: (id: string, properties: ElementProps) => void;
  onDelete: (id: string) => void;
  onMakeHero?: (id: string) => void; // #2,#4 任意画像→ヒーロー
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: element.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div className="grid grid-cols-3 gap-2 items-center">{children}</div>
  );

  const PaddingPicker = () => (
    <Row>
      <Label className="text-xs">内側余白</Label>
      <div className="col-span-2">
        <Select
          value={element.properties.paddingAll ?? "none"}
          onValueChange={(v: PaddingToken) => onUpdate(element.id, { ...element.properties, paddingAll: v })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="なし" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">なし</SelectItem>
            <SelectItem value="0px">0px</SelectItem>
            <SelectItem value="sm">小さめ</SelectItem>
            <SelectItem value="md">ふつう</SelectItem>
            <SelectItem value="lg">やや広め</SelectItem>
            <SelectItem value="xl">広め</SelectItem>
            <SelectItem value="xxl">最大</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground mt-1">この要素の内側の余白です</p>
      </div>
    </Row>
  );

  const BgPicker = () => (
    <Row>
      <Label className="text-xs">背景色</Label>
      <div className="col-span-2 flex items-center gap-2">
        <ColorPicker
          color={element.properties.backgroundColor ?? "#ffffff"}
          onChange={(c) => onUpdate(element.id, { ...element.properties, backgroundColor: c })}
        />
        <Button variant="ghost" size="sm" className="h-7 text-xs"
          onClick={() => onUpdate(element.id, { ...element.properties, backgroundColor: undefined })}
        >クリア</Button>
      </div>
    </Row>
  );

  const p = element.properties;

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-card p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-muted border">
            <GripVertical className="w-4 h-4" />
          </div>
          <Badge variant="outline" className="text-[10px] capitalize">{element.type}</Badge>
        </div>
        <div className="flex items-center gap-1">
          {element.type === "image" && onMakeHero && (
            <Button variant="ghost" size="icon" className="h-7 w-7" title="この画像をヒーローにする" onClick={() => onMakeHero(element.id)}>
              <Star className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(!open)} title={open ? "閉じる" : "開く"}>
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(element.id)} title="削除">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-2 space-y-2 text-sm">
          {element.type === "text" && (
            <>
              <Row>
                <Label className="text-xs">テキスト</Label>
                <Textarea rows={2} className="col-span-2 h-16 text-xs"
                  value={p.text ?? ""} onChange={(e) => onUpdate(element.id, { ...p, text: e.target.value })}
                  placeholder="本文テキスト。複数行OK" />
              </Row>
              <Row>
                <Label className="text-xs">文字サイズ</Label>
                <Select value={p.size ?? "md"} onValueChange={(v) => onUpdate(element.id, { ...p, size: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xs">小さめ</SelectItem>
                    <SelectItem value="sm">少し小さめ</SelectItem>
                    <SelectItem value="md">ふつう</SelectItem>
                    <SelectItem value="lg">少し大きめ</SelectItem>
                    <SelectItem value="xl">大きめ</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row>
                <Label className="text-xs">太さ</Label>
                <Select value={p.weight ?? "normal"} onValueChange={(v) => onUpdate(element.id, { ...p, weight: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">標準</SelectItem>
                    <SelectItem value="bold">太字</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row>
                <Label className="text-xs">色</Label>
                <ColorPicker color={p.color ?? "#000000"} onChange={(c) => onUpdate(element.id, { ...p, color: c })} />
              </Row>
              <Row>
                <Label className="text-xs">配置</Label>
                <Select value={p.align ?? "start"} onValueChange={(v) => onUpdate(element.id, { ...p, align: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">左寄せ</SelectItem>
                    <SelectItem value="center">中央</SelectItem>
                    <SelectItem value="end">右寄せ</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <PaddingPicker />
              <BgPicker />
            </>
          )}

          {element.type === "image" && (
            <>
              <Row>
                <Label className="text-xs">画像</Label>
                <div className="col-span-2 flex items-center gap-2">
                  <MediaSelector onSelect={(url) => onUpdate(element.id, { ...p, url })} selectedUrl={p.url} />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {p.url ? (
                      <img src={p.url} alt="thumb" className="w-10 h-10 rounded object-cover border" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted grid place-items-center border">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <Input value={p.url ?? ""} onChange={(e) => onUpdate(element.id, { ...p, url: e.target.value })}
                      placeholder="https://..." className="text-xs h-8 truncate flex-1" />
                  </div>
                </div>
              </Row>
              <Row>
                <Label className="text-xs">縦横の割合</Label>
                <Select value={p.aspectRatio ?? "20:13"} onValueChange={(v: any) => onUpdate(element.id, { ...p, aspectRatio: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20:13">横長（おすすめ）</SelectItem>
                    <SelectItem value="16:9">横長（動画っぽい）</SelectItem>
                    <SelectItem value="1:1">正方形</SelectItem>
                    <SelectItem value="4:3">やや横長</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row>
                <Label className="text-xs">表示方法</Label>
                <Select value={p.aspectMode ?? "cover"} onValueChange={(v: any) => onUpdate(element.id, { ...p, aspectMode: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">切り抜いてピッタリ</SelectItem>
                    <SelectItem value="fit">全体を収める</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row>
                <Label className="text-xs flex items-center gap-1"><LinkIcon className="w-3 h-3" /> 画像タップ時</Label>
                <Input value={p.action?.uri ?? ""} className="text-xs h-8"
                  onChange={(e) => onUpdate(element.id, { ...p, action: { type: "uri", uri: e.target.value, label: p.action?.label ?? "Open" } })}
                  placeholder="https://..." />
              </Row>
              <PaddingPicker />
              <BgPicker />
              <p className="text-[10px] text-muted-foreground">※「この画像をヒーローにする」ボタンで上部の大画像に設定できます（1つまで）。</p>
            </>
          )}

          {element.type === "button" && (
            <>
              <Row>
                <Label className="text-xs">ボタン表示名</Label>
                <Input className="text-xs h-8"
                  value={p.action?.label ?? ""} onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action ?? { type: "uri" }), label: e.target.value } })}
                  placeholder="ボタン" />
              </Row>
              <Row>
                <Label className="text-xs">ボタン動作</Label>
                <Select value={p.action?.type ?? "uri"} onValueChange={(v: ActionDef["type"]) => onUpdate(element.id, { ...p, action: { ...(p.action ?? {}), type: v } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uri">リンクを開く</SelectItem>
                    <SelectItem value="message">テキストを送る</SelectItem>
                    <SelectItem value="postback">データを送る</SelectItem>
                  </SelectContent>
                </Select>
              </Row>

              {(p.action?.type ?? "uri") === "uri" && (
                <Row>
                  <Label className="text-xs">リンクURL</Label>
                  <Input className="text-xs h-8" value={p.action?.uri ?? ""} placeholder="https://..."
                    onChange={(e) => onUpdate(element.id, { ...p, action: { type: "uri", uri: e.target.value, label: p.action?.label ?? "Open" } })} />
                </Row>
              )}
              {p.action?.type === "message" && (
                <Row>
                  <Label className="text-xs">送信テキスト</Label>
                  <Input className="text-xs h-8" value={p.action?.text ?? ""} placeholder="こんにちは"
                    onChange={(e) => onUpdate(element.id, { ...p, action: { type: "message", text: e.target.value, label: p.action?.label ?? "Send" } })} />
                </Row>
              )}
              {p.action?.type === "postback" && (
                <Row>
                  <Label className="text-xs">データ</Label>
                  <Input className="text-xs h-8" value={p.action?.data ?? ""} placeholder="key=value"
                    onChange={(e) => onUpdate(element.id, { ...p, action: { type: "postback", data: e.target.value, label: p.action?.label ?? "PB" } })} />
                </Row>
              )}

              <Row>
                <Label className="text-xs">見た目</Label>
                <Select value={p.style ?? "primary"} onValueChange={(v) => onUpdate(element.id, { ...p, style: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">メイン色</SelectItem>
                    <SelectItem value="secondary">薄い色</SelectItem>
                    <SelectItem value="link">枠線リンク</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row>
                <Label className="text-xs">色（背景/枠）</Label>
                <ColorPicker color={p.color ?? "#0066cc"} onChange={(c) => onUpdate(element.id, { ...p, color: c })} />
              </Row>
              <Row>
                <Label className="text-xs">高さ</Label>
                <Select value={p.height ?? "md"} onValueChange={(v) => onUpdate(element.id, { ...p, height: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">小</SelectItem>
                    <SelectItem value="md">中</SelectItem>
                    <SelectItem value="lg">大</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <PaddingPicker />
              <BgPicker />
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ============ Main ============
export default function FlexMessageDesigner() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [messages, setMessages] = useState<FlexMessageRow[]>([]);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false); // #7 一括トグル

  const [design, setDesign] = useState<FlexDesign>({
    name: "",
    altText: "",               // #1
    bubbleSize: "kilo",        // 標準
    hero: { enabled: false, aspectRatio: "20:13", aspectMode: "cover", action: { type: "uri", uri: "https://line.me/", label: "Open" } },
    body: { spacing: "md", backgroundColor: undefined, contents: [] },
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data, error } = await supabase.from("flex_messages").select("*").order("created_at", { ascending: false });
      if (error) console.error(error);
      setMessages(data ?? []);
      setInitialLoading(false);
    })();
  }, []);

  // ---- actions ----
  const addElement = (type: ElementType) => {
    const id = `elm-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const defaults: Record<ElementType, ElementProps> = {
      text: { text: "テキスト", size: "md", weight: "normal", color: "#000000" },
      image: { url: "", aspectRatio: "20:13", aspectMode: "cover" },
      button: { style: "primary", color: "#0066cc", height: "md", action: { type: "uri", label: "Open", uri: "https://line.me/" } },
    };
    setDesign(prev => ({ ...prev, body: { ...prev.body, contents: [...prev.body.contents, { id, type, properties: defaults[type] }] }}));
  };

  const updateElement = (id: string, properties: ElementProps) => {
    setDesign(prev => ({
      ...prev,
      body: { ...prev.body, contents: prev.body.contents.map(e => e.id === id ? { ...e, properties } : e) }
    }));
  };

  const deleteElement = (id: string) => {
    setDesign(prev => ({ ...prev, body: { ...prev.body, contents: prev.body.contents.filter(e => e.id !== id) }}));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setDesign(prev => {
      const oldIndex = prev.body.contents.findIndex(e => e.id === active.id);
      const newIndex = prev.body.contents.findIndex(e => e.id === over.id);
      return { ...prev, body: { ...prev.body, contents: arrayMove(prev.body.contents, oldIndex, newIndex) } };
    });
  };

  // 任意の画像要素をヒーローに昇格（#2,#4）
  const makeHeroFromElement = (id: string) => {
    const el = design.body.contents.find(e => e.id === id);
    if (!el || el.type !== "image") return;
    const p = el.properties;
    setDesign(d => ({
      ...d,
      hero: {
        enabled: true,
        url: p.url,
        aspectRatio: p.aspectRatio ?? "20:13",
        aspectMode: p.aspectMode ?? "cover",
        action: p.action?.uri ? { type: "uri", uri: p.action.uri, label: p.action.label ?? "Open" } : undefined,
      }
    }));
    toast({ title: "ヒーロー設定", description: "この画像を上部の大画像に設定しました" });
  };

  // ---- Flex JSON generation (padding-aware) ----
  const wrapIfNeeded = (node: any, opts: { margin?: string; paddingAll?: PaddingToken; backgroundColor?: string }) => {
    const needsWrap = (opts.paddingAll && opts.paddingAll !== "none") || !!opts.backgroundColor;
    if (!needsWrap) {
      if (opts.margin) node.margin = opts.margin;
      return node;
    }
    const box: any = { type: "box", layout: "vertical", contents: [node] };
    if (opts.margin) box.margin = opts.margin;
    if (opts.paddingAll && opts.paddingAll !== "none") box.paddingAll = opts.paddingAll;
    if (opts.backgroundColor) box.backgroundColor = opts.backgroundColor;
    return box;
  };

  const generateFlexJson = () => {
    const items = design.body.contents.map((el, idx) => {
      const p = el.properties;
      const margin = idx === 0 ? undefined : "md";
      switch (el.type) {
        case "text": {
          const text = (p.text ?? "").toString().trim();
          if (!text) return null;
          const node: any = compact({
            type: "text",
            text,
            wrap: true,
            size: p.size,
            weight: p.weight !== "normal" ? p.weight : undefined,
            align: p.align && p.align !== "start" ? p.align : undefined,
            color: toHex6(p.color),
          });
          return wrapIfNeeded(node, { margin, paddingAll: p.paddingAll, backgroundColor: toHex6(p.backgroundColor) });
        }
        case "image": {
          const url = (p.url ?? "").toString().trim();
          if (!url) return null;
          const node: any = compact({
            type: "image",
            url,
            aspectRatio: p.aspectRatio,
            aspectMode: p.aspectMode,
            action: p.action?.uri ? { type: "uri", uri: p.action.uri, label: p.action.label ?? "Open" } : undefined,
          });
          return wrapIfNeeded(node, { margin, paddingAll: p.paddingAll, backgroundColor: toHex6(p.backgroundColor) });
        }
        case "button": {
          const node: any = compact({
            type: "button",
            style: p.style,
            color: toHex6(p.color),
            height: p.height,
            action:
              p.action?.type === "uri" && p.action.uri ? { type: "uri", uri: p.action.uri, label: p.action.label ?? "Open" }
              : p.action?.type === "message" && p.action.text ? { type: "message", text: p.action.text, label: p.action.label ?? "Send" }
              : p.action?.type === "postback" && p.action.data ? { type: "postback", data: p.action.data, label: p.action.label ?? "PB" }
              : undefined,
          });
          return wrapIfNeeded(node, { margin, paddingAll: p.paddingAll, backgroundColor: toHex6(p.backgroundColor) });
        }
        default:
          return null;
      }
    }).filter(Boolean);

    if (items.length === 0) return null;

    const bubble: any = {
      type: "bubble",
      size: design.bubbleSize, // 追加：横幅
      body: compact({
        type: "box",
        layout: "vertical",
        spacing: design.body.spacing ?? "md",
        backgroundColor: toHex6(design.body.backgroundColor),
        contents: items,
      }),
    };

    if (design.hero.enabled && design.hero.url) {
      bubble.hero = compact({
        type: "image",
        url: design.hero.url,
        size: "full",
        aspectRatio: design.hero.aspectRatio ?? "20:13",
        aspectMode: design.hero.aspectMode ?? "cover",
        action: design.hero.action?.uri ? { type: "uri", uri: design.hero.action.uri, label: design.hero.action.label ?? "Open" } : undefined,
      });
    }

    return {
      type: "flex",
      altText: (design.altText || design.name || "お知らせ").slice(0, 400),
      contents: bubble,
    };
  };

  // ---- Save / Load / Send ----
  const refreshList = async () => {
    const { data, error } = await supabase.from("flex_messages").select("*").order("created_at", { ascending: false });
    if (!error) setMessages(data ?? []);
  };

  const saveMessage = async () => {
    if (!design.name.trim()) {
      toast({ title: "入力エラー", description: "メッセージ名を入力してください", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です");
      const flexJson = generateFlexJson();
      if (!flexJson) throw new Error("要素がありません");

      if (currentMessageId) {
        const { error } = await supabase.from("flex_messages").update({ name: design.name, content: flexJson }).eq("id", currentMessageId);
        if (error) throw error;
        toast({ title: "更新", description: "メッセージを更新しました" });
      } else {
        const { data, error } = await supabase.from("flex_messages").insert({ user_id: user.id, name: design.name, content: flexJson }).select().single();
        if (error) throw error;
        setCurrentMessageId(data.id);
        toast({ title: "保存", description: "メッセージを保存しました" });
      }
      await refreshList();
    } catch (e: any) {
      console.error(e);
      toast({ title: "保存エラー", description: e.message ?? "失敗しました", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const loadMessage = (row: FlexMessageRow) => {
    try {
      const bubble = row.content?.contents;
      const hero = bubble?.hero;
      const body = bubble?.body;

      const unwrap = (node: any): { type: ElementType; props: ElementProps } | null => {
        let paddingAll: PaddingToken | undefined;
        let backgroundColor: string | undefined;
        let inner = node;
        if (inner?.type === "box" && Array.isArray(inner.contents) && inner.layout === "vertical" && inner.contents.length === 1) {
          if (inner.paddingAll || inner.backgroundColor) {
            paddingAll = inner.paddingAll as PaddingToken;
            backgroundColor = inner.backgroundColor;
          }
          inner = inner.contents[0];
        }
        if (inner?.type === "text") {
          return { type: "text", props: {
            text: inner.text, size: inner.size, weight: inner.weight, align: inner.align, color: inner.color, paddingAll, backgroundColor,
          }};
        }
        if (inner?.type === "image") {
          return { type: "image", props: {
            url: inner.url, aspectRatio: inner.aspectRatio, aspectMode: inner.aspectMode, action: inner.action, paddingAll, backgroundColor,
          }};
        }
        if (inner?.type === "button") {
          return { type: "button", props: {
            style: inner.style, color: inner.color, height: inner.height, action: inner.action, paddingAll, backgroundColor,
          }};
        }
        return null;
      };

      const contents: FlexElement[] = (body?.contents ?? [])
        .map((n: any, i: number) => {
          const res = unwrap(n);
          if (!res) return null;
          return { id: `elm-${Date.now()}-${i}`, type: res.type, properties: res.props };
        })
        .filter(Boolean);

      setCurrentMessageId(row.id);
      setDesign({
        name: row.name,
        altText: row.content?.altText ?? "",                 // #1 取込み
        bubbleSize: (bubble?.size as BubbleSize) ?? "kilo",  // 追加：取込み
        hero: {
          enabled: !!hero, url: hero?.url,
          aspectRatio: hero?.aspectRatio ?? "20:13",
          aspectMode: hero?.aspectMode ?? "cover",
          action: hero?.action,
        },
        body: {
          spacing: body?.spacing ?? "md",
          backgroundColor: body?.backgroundColor,
          contents,
        },
      });
      setExpandAll(false); // 読込時は閉じた状態（#7）
      toast({ title: "読み込み", description: `「${row.name}」を読み込みました` });
    } catch (e) {
      console.error(e);
      toast({ title: "読み込み失敗", description: "JSONの解析に失敗しました", variant: "destructive" });
    }
  };

  const sendFlex = async (payload: any) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です");
      const { error } = await supabase.functions.invoke("send-flex-message", { body: { flexMessage: payload, userId: user.id } });
      if (error) throw error;
      toast({ title: "送信完了", description: "Flexメッセージを配信しました" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "送信エラー", description: e.message ?? "送信に失敗しました", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const sendCurrent = async () => {
    const flexJson = generateFlexJson();
    if (!flexJson) { toast({ title: "検証エラー", description: "要素がありません", variant: "destructive" }); return; }
    await sendFlex(flexJson);
  };

  const sendSaved = async (row: FlexMessageRow) => {
    await sendFlex(row.content);
  };

  // ---- UI ----
  if (initialLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <p className="text-muted-foreground text-sm">読み込み中…</p>
      </div>
    );
  }

  const padPx = (t?: PaddingToken) => (t && t !== "none" ? padMap[t as Exclude<PaddingToken,"none">] ?? 0 : 0);

  return (
    <div className="min-h-screen bg-background text-sm">
      <header className="border-b">
        <div className="container mx-auto px-3 py-2 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> ダッシュボードへ
          </Button>
          <h1 className="text-base font-semibold">Flexメッセージデザイナー</h1>
        </div>
      </header>

      <main className="container mx-auto px-3 py-4 max-w-7xl">
        <div className="grid grid-cols-12 gap-4">
          {/* LEFT column: Saved list + Designer controls（#3 左へ移動） */}
          <div className="col-span-12 md:col-span-4 space-y-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">保存済みメッセージ</CardTitle>
                <CardDescription className="text-xs">クリックで読み込み／配信できます</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {messages.length === 0 ? (
                    <div className="text-xs text-muted-foreground">まだありません</div>
                  ) : messages.map(row => (
                    <div key={row.id} className={`rounded border p-2 ${currentMessageId === row.id ? "border-primary/60 bg-primary/5" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm truncate">{row.name}</div>
                        <Badge variant="secondary" className="text-[10px]">{new Date(row.created_at).toLocaleDateString("ja-JP")}</Badge>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => loadMessage(row)}>読込</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => sendSaved(row)}>
                          <Send className="w-3 h-3 mr-1" />配信
                        </Button>
                        <Button
                          size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive"
                          onClick={async () => {
                            if (!confirm(`「${row.name}」を削除します。よろしいですか？`)) return;
                            const { error } = await supabase.from("flex_messages").delete().eq("id", row.id);
                            if (!error) setMessages(prev => prev.filter(r => r.id !== row.id));
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">基本設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Label className="text-xs">メッセージ名</Label>
                  <Input className="col-span-2 h-8 text-xs" value={design.name}
                    onChange={(e) => setDesign(d => ({ ...d, name: e.target.value }))} placeholder="例：新商品お知らせ" />
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Label className="text-xs">通知文（代替）</Label>
                  <Input className="col-span-2 h-8 text-xs" value={design.altText}
                    onChange={(e) => setDesign(d => ({ ...d, altText: e.target.value }))} placeholder="通知に表示される短い文" />
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Label className="text-xs">カード幅</Label>
                  <Select value={design.bubbleSize} onValueChange={(v: BubbleSize) => setDesign(d => ({ ...d, bubbleSize: v }))}>
                    <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="micro">縮小（細め）</SelectItem>
                      <SelectItem value="kilo">標準</SelectItem>
                      <SelectItem value="mega">最大（太め）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Hero */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">上部の大画像（ヒーロー）</div>
                      <p className="text-[10px] text-muted-foreground">カードの一番上に出る大きな画像。1つだけ設定できます。</p>
                    </div>
                    <Select
                      value={design.hero.enabled ? "on" : "off"}
                      onValueChange={(v) => setDesign(d => ({ ...d, hero: { ...d.hero, enabled: v === "on" } }))}
                    >
                      <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">オフ</SelectItem>
                        <SelectItem value="on">オン</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {design.hero.enabled && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <MediaSelector onSelect={(url) => setDesign(d => ({ ...d, hero: { ...d.hero, url } }))} selectedUrl={design.hero.url} />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {design.hero.url ? (
                            <img src={design.hero.url} alt="hero" className="w-10 h-10 rounded object-cover border" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted grid place-items-center border">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <Input className="h-8 text-xs flex-1 truncate" value={design.hero.url ?? ""} placeholder="https://..."
                            onChange={(e) => setDesign(d => ({ ...d, hero: { ...d.hero, url: e.target.value } }))} />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">縦横の割合</Label>
                          <Select value={design.hero.aspectRatio ?? "20:13"} onValueChange={(v: any) => setDesign(d => ({ ...d, hero: { ...d.hero, aspectRatio: v } }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="20:13">横長（おすすめ）</SelectItem>
                              <SelectItem value="16:9">横長（動画っぽい）</SelectItem>
                              <SelectItem value="1:1">正方形</SelectItem>
                              <SelectItem value="4:3">やや横長</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">表示方法</Label>
                          <Select value={design.hero.aspectMode ?? "cover"} onValueChange={(v: any) => setDesign(d => ({ ...d, hero: { ...d.hero, aspectMode: v } }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cover">切り抜いてピッタリ</SelectItem>
                              <SelectItem value="fit">全体を収める</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">タップURL</Label>
                          <Input className="h-8 text-xs" value={design.hero.action?.uri ?? ""} placeholder="https://..."
                            onChange={(e) => setDesign(d => ({ ...d, hero: { ...d.hero, action: { type: "uri", uri: e.target.value, label: "Open" } } }))} />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        ※画像要素の「★ヒーローにする」でも設定できます。
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-3 grid grid-cols-3 gap-2 items-center">
                  <Label className="text-xs">本文の行間</Label>
                  <Select value={design.body.spacing ?? "md"} onValueChange={(v: any) => setDesign(d => ({ ...d, body: { ...d.body, spacing: v } }))}>
                    <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">詰める</SelectItem>
                      <SelectItem value="sm">やや狭め</SelectItem>
                      <SelectItem value="md">ふつう</SelectItem>
                      <SelectItem value="lg">ゆったり</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center">
                  <Label className="text-xs">本文の背景色</Label>
                  <div className="col-span-2 flex items-center gap-2">
                    <ColorPicker color={design.body.backgroundColor ?? "#ffffff"} onChange={(c) => setDesign(d => ({ ...d, body: { ...d.body, backgroundColor: c } }))} />
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDesign(d => ({ ...d, body: { ...d.body, backgroundColor: undefined } }))}>クリア</Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button onClick={saveMessage} disabled={loading} className="flex-1 h-8 text-xs">
                    <Save className="w-4 h-4 mr-1" /> {loading ? "保存中..." : currentMessageId ? "上書き保存" : "保存"}
                  </Button>
                  <Button onClick={sendCurrent} disabled={loading} className="h-8 text-xs bg-[#06c755] hover:bg-[#05b84c] text-white">
                    <Send className="w-4 h-4 mr-1" /> 全体配信
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT column: Elements + Preview */}
          <div className="col-span-12 md:col-span-8 space-y-4">
            {/* Elements */}
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">要素を作る</CardTitle>
                    <CardDescription className="text-xs">テキスト・画像・ボタンを追加できます。ドラッグで順序変更。</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addElement("text")}><Plus className="w-4 h-4 mr-1" />テキスト</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addElement("image")}><ImageIcon className="w-4 h-4 mr-1" />画像</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addElement("button")}><Plus className="w-4 h-4 mr-1" />ボタン</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs"
                      onClick={() => setExpandAll((v) => !v)}
                      title={expandAll ? "全部閉じる" : "全部開く"}
                    >
                      {expandAll ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
                      {expandAll ? "全部閉じる" : "全部開く"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {design.body.contents.length === 0 ? (
                  <div className="border border-dashed rounded-lg py-8 text-center text-xs text-muted-foreground">
                    下のボタンから要素を追加してください
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={design.body.contents.map(e => e.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {design.body.contents.map(el => (
                          <SortableItem
                            key={el.id}
                            element={el}
                            onUpdate={updateElement}
                            onDelete={deleteElement}
                            onMakeHero={makeHeroFromElement}
                            defaultOpen={expandAll}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2"><Eye className="w-5 h-5" /> プレビュー</CardTitle>
                <CardDescription className="text-xs">実機と近い見た目（簡易）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="bg-white rounded-xl border shadow-sm mx-auto overflow-hidden"
                       style={{ maxWidth: design.bubbleSize === "micro" ? 260 : design.bubbleSize === "mega" ? 360 : 320 }}>
                    {design.hero.enabled && design.hero.url && (
                      <img
                        src={design.hero.url}
                        alt="hero"
                        className="w-full"
                        style={{
                          aspectRatio: (design.hero.aspectRatio ?? "20:13").replace(":", "/"),
                          objectFit: design.hero.aspectMode === "fit" ? "contain" : "cover",
                        }}
                      />
                    )}
                    <div className="p-3" style={{ background: toHex6(design.body.backgroundColor) }}>
                      {design.body.contents.map((el, i) => {
                        const p = el.properties;
                        const mt = i === 0 ? 0 : 12;
                        const pad = padPx(p.paddingAll);
                        const bg = toHex6(p.backgroundColor);
                        return (
                          <div key={el.id} style={{ marginTop: mt, padding: pad, background: bg, borderRadius: bg ? 8 : 0 }}>
                            {el.type === "text" && (
                              <div
                                style={{
                                  color: toHex6(p.color) ?? "#000",
                                  fontSize: p.size === "xs" ? 12 : p.size === "sm" ? 14 : p.size === "lg" ? 18 : p.size === "xl" ? 20 : 16,
                                  fontWeight: p.weight === "bold" ? 700 : 400,
                                  textAlign: (p.align as any) ?? "start",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {p.text}
                              </div>
                            )}
                            {el.type === "image" && p.url && (
                              <img
                                src={p.url}
                                alt=""
                                className="w-full rounded"
                                style={{
                                  aspectRatio: (p.aspectRatio ?? "20:13").replace(":", "/"),
                                  objectFit: p.aspectMode === "fit" ? "contain" : "cover"
                                }}
                              />
                            )}
                            {el.type === "button" && (
                              <button
                                className="w-full rounded text-xs font-medium"
                                style={{
                                  backgroundColor: p.style === "link" ? "transparent" : (toHex6(p.color) ?? (p.style === "secondary" ? "#f0f0f0" : "#0066cc")),
                                  color: p.style === "link" ? (toHex6(p.color) ?? "#0066cc") : "#fff",
                                  border: p.style === "link" ? `1px solid ${toHex6(p.color) ?? "#0066cc"}` : "none",
                                  padding: p.height === "sm" ? "8px 10px" : p.height === "lg" ? "14px 14px" : "11px 12px",
                                }}
                              >{p.action?.label ?? "ボタン"}</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    表示は概算です。実際のLINEアプリで若干差が出る場合があります。
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
