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
import { ArrowLeft, Send, Plus, Trash2, Image, MessageSquare, Save, Eye, GripVertical, ChevronDown, ChevronRight, Link as LinkIcon } from "lucide-react";
import { MediaSelector } from "@/components/MediaSelector";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ---------- Types ----------
interface FlexMessageRow {
  id: string;
  name: string;
  content: any;
  created_at: string;
  updated_at: string;
  user_id: string;
}

type PaddingToken = "none" | "0px" | "sm" | "md" | "lg" | "xl" | "xxl";

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
  aspectRatio?: string;
  aspectMode?: string;
  style?: string;
  height?: string;
  action?: ActionDef;
  backgroundColor?: string;       // wrapper box background
  paddingAll?: PaddingToken;      // wrapper box padding
}

type ElementType = "text" | "image" | "button";

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
  hero: HeroConfig;
  body: {
    spacing?: "none" | "sm" | "md" | "lg";
    backgroundColor?: string | undefined; // bubble.body background
    contents: FlexElement[];
  };
}

// ---------- Utils ----------
const padMap: Record<Exclude<PaddingToken,"none">, number> = {
  "0px": 0,
  sm: 6,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
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
  // allow named colors? Flex spec expects hex,なので弾く
  return undefined;
};

const compact = (obj: Record<string, any>) => {
  const out: Record<string, any> = {};
  Object.keys(obj).forEach(k => {
    const v = (obj as any)[k];
    if (v !== undefined && v !== null) out[k] = v;
  });
  return out;
};

// ---------- Sortable item ----------
const SortableItem = ({
  element,
  onUpdate,
  onDelete,
}: {
  element: FlexElement;
  onUpdate: (id: string, properties: ElementProps) => void;
  onDelete: (id: string) => void;
}) => {
  const [open, setOpen] = useState(true);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: element.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  // tidy 2-column form row
  const Row = ({ children }: { children: React.ReactNode }) => (
    <div className="grid grid-cols-2 gap-3 items-center">{children}</div>
  );

  const PaddingPicker = () => (
    <Row>
      <Label>内側余白（padding）</Label>
      <Select
        value={element.properties.paddingAll ?? "none"}
        onValueChange={(v: PaddingToken) => onUpdate(element.id, { ...element.properties, paddingAll: v })}
      >
        <SelectTrigger><SelectValue placeholder="なし" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">なし</SelectItem>
          <SelectItem value="0px">0px</SelectItem>
          <SelectItem value="sm">sm</SelectItem>
          <SelectItem value="md">md</SelectItem>
          <SelectItem value="lg">lg</SelectItem>
          <SelectItem value="xl">xl</SelectItem>
          <SelectItem value="xxl">xxl</SelectItem>
        </SelectContent>
      </Select>
    </Row>
  );

  const BgPicker = () => (
    <Row>
      <Label>背景色（要素の箱）</Label>
      <div className="flex items-center justify-between gap-3">
        <ColorPicker
          color={element.properties.backgroundColor ?? "#ffffff"}
          onChange={(c) => onUpdate(element.id, { ...element.properties, backgroundColor: c })}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUpdate(element.id, { ...element.properties, backgroundColor: undefined })}
        >
          クリア
        </Button>
      </div>
    </Row>
  );

  const renderEditor = () => {
    const p = element.properties;
    switch (element.type) {
      case "text":
        return (
          <div className="space-y-3">
            <Row>
              <Label>テキスト</Label>
              <Textarea
                rows={2}
                value={p.text ?? ""}
                onChange={(e) => onUpdate(element.id, { ...p, text: e.target.value })}
                placeholder="テキストを入力"
              />
            </Row>
            <Row>
              <Label>サイズ</Label>
              <Select value={p.size ?? "md"} onValueChange={(v) => onUpdate(element.id, { ...p, size: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="xs">xs</SelectItem>
                  <SelectItem value="sm">sm</SelectItem>
                  <SelectItem value="md">md</SelectItem>
                  <SelectItem value="lg">lg</SelectItem>
                  <SelectItem value="xl">xl</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row>
              <Label>太さ</Label>
              <Select value={p.weight ?? "normal"} onValueChange={(v) => onUpdate(element.id, { ...p, weight: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">normal</SelectItem>
                  <SelectItem value="bold">bold</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row>
              <Label>色</Label>
              <ColorPicker color={p.color ?? "#000000"} onChange={(c) => onUpdate(element.id, { ...p, color: c })} />
            </Row>
            <Row>
              <Label>揃え</Label>
              <Select value={p.align ?? "start"} onValueChange={(v) => onUpdate(element.id, { ...p, align: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">左</SelectItem>
                  <SelectItem value="center">中央</SelectItem>
                  <SelectItem value="end">右</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <PaddingPicker />
            <BgPicker />
          </div>
        );
      case "image":
        return (
          <div className="space-y-3">
            <Row>
              <Label>画像</Label>
              <div className="flex items-center gap-2">
                <MediaSelector
                  onSelect={(url) => onUpdate(element.id, { ...p, url })}
                  selectedUrl={p.url}
                  // ここは小さめのトリガーだけにして大画像を出さない
                />
                <Input
                  value={p.url ?? ""}
                  onChange={(e) => onUpdate(element.id, { ...p, url: e.target.value })}
                  placeholder="https://example.com/img.jpg"
                />
              </div>
            </Row>
            <Row>
              <Label>アスペクト比</Label>
              <Select value={p.aspectRatio ?? "20:13"} onValueChange={(v) => onUpdate(element.id, { ...p, aspectRatio: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="20:13">20:13</SelectItem>
                  <SelectItem value="16:9">16:9</SelectItem>
                  <SelectItem value="1:1">1:1</SelectItem>
                  <SelectItem value="4:3">4:3</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row>
              <Label>表示モード</Label>
              <Select value={p.aspectMode ?? "cover"} onValueChange={(v) => onUpdate(element.id, { ...p, aspectMode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">cover</SelectItem>
                  <SelectItem value="fit">fit</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row>
              <Label className="flex items-center gap-1"><LinkIcon className="w-3 h-3" /> 画像タップ</Label>
              <Input
                value={p.action?.uri ?? ""}
                onChange={(e) => onUpdate(element.id, { ...p, action: { type: "uri", uri: e.target.value, label: p.action?.label ?? "open" } })}
                placeholder="https://..."
              />
            </Row>
            <PaddingPicker />
            <BgPicker />
          </div>
        );
      case "button":
        return (
          <div className="space-y-3">
            <Row>
              <Label>ラベル</Label>
              <Input
                value={p.action?.label ?? ""}
                onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action ?? { type: "uri" }), label: e.target.value } })}
                placeholder="ボタン"
              />
            </Row>
            <Row>
              <Label>タイプ</Label>
              <Select
                value={p.action?.type ?? "uri"}
                onValueChange={(v: ActionDef["type"]) => onUpdate(element.id, { ...p, action: { ...(p.action ?? {}), type: v } })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uri">URLを開く</SelectItem>
                  <SelectItem value="message">メッセージ送信</SelectItem>
                  <SelectItem value="postback">ポストバック</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            { (p.action?.type ?? "uri") === "uri" && (
              <Row>
                <Label>URL</Label>
                <Input
                  value={p.action?.uri ?? ""}
                  onChange={(e) => onUpdate(element.id, { ...p, action: { type: "uri", uri: e.target.value, label: p.action?.label ?? "Open" } })}
                  placeholder="https://..."
                />
              </Row>
            )}
            { p.action?.type === "message" && (
              <Row>
                <Label>送信テキスト</Label>
                <Input
                  value={p.action?.text ?? ""}
                  onChange={(e) => onUpdate(element.id, { ...p, action: { type: "message", text: e.target.value, label: p.action?.label ?? "Send" } })}
                  placeholder="こんにちは など"
                />
              </Row>
            )}
            { p.action?.type === "postback" && (
              <Row>
                <Label>data</Label>
                <Input
                  value={p.action?.data ?? ""}
                  onChange={(e) => onUpdate(element.id, { ...p, action: { type: "postback", data: e.target.value, label: p.action?.label ?? "PB" } })}
                  placeholder="key=value"
                />
              </Row>
            )}
            <Row>
              <Label>スタイル</Label>
              <Select value={p.style ?? "primary"} onValueChange={(v) => onUpdate(element.id, { ...p, style: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">primary</SelectItem>
                  <SelectItem value="secondary">secondary</SelectItem>
                  <SelectItem value="link">link</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row>
              <Label>色</Label>
              <ColorPicker color={p.color ?? "#0066cc"} onChange={(c) => onUpdate(element.id, { ...p, color: c })} />
            </Row>
            <Row>
              <Label>高さ</Label>
              <Select value={p.height ?? "md"} onValueChange={(v) => onUpdate(element.id, { ...p, height: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">sm</SelectItem>
                  <SelectItem value="md">md</SelectItem>
                  <SelectItem value="lg">lg</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <PaddingPicker />
            <BgPicker />
          </div>
        );
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border bg-card shadow-sm p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 rounded-md hover:bg-muted border">
            <GripVertical className="w-4 h-4" />
          </div>
          <Badge variant="outline" className="text-xs">
            {element.type}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(element.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {open && <div className="mt-3 space-y-3">{renderEditor()}</div>}
    </div>
  );
};

// ---------- Main ----------
export default function FlexMessageDesigner() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [messages, setMessages] = useState<FlexMessageRow[]>([]);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  const [design, setDesign] = useState<FlexDesign>({
    name: "",
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
      altText: (design.name || "Flex Message").slice(0, 400),
      contents: bubble,
    };
  };

  // ---- Save / Load / Send ----
  const saveMessage = async () => {
    if (!design.name.trim()) { toast({ title: "入力エラー", description: "メッセージ名を入力してください", variant: "destructive" }); return; }
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

      const { data, error } = await supabase.from("flex_messages").select("*").order("created_at", { ascending: false });
      if (!error) setMessages(data ?? []);
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

      // unwrap padding wrapper: box(vertical) with single contents
      const unwrap = (node: any): { type: ElementType; props: ElementProps } | null => {
        let paddingAll: PaddingToken | undefined;
        let backgroundColor: string | undefined;
        let inner = node;

        // padding用boxなら剥がす
        if (inner?.type === "box" && Array.isArray(inner.contents) && inner.layout === "vertical" && inner.contents.length === 1) {
          if (inner.paddingAll || inner.backgroundColor) {
            paddingAll = inner.paddingAll as PaddingToken;
            backgroundColor = inner.backgroundColor;
          }
          inner = inner.contents[0];
        }

        if (inner?.type === "text") {
          return {
            type: "text",
            props: {
              text: inner.text,
              size: inner.size,
              weight: inner.weight,
              align: inner.align,
              color: inner.color,
              paddingAll,
              backgroundColor,
            },
          };
        }
        if (inner?.type === "image") {
          return {
            type: "image",
            props: {
              url: inner.url,
              aspectRatio: inner.aspectRatio,
              aspectMode: inner.aspectMode,
              action: inner.action,
              paddingAll,
              backgroundColor,
            },
          };
        }
        if (inner?.type === "button") {
          return {
            type: "button",
            props: {
              style: inner.style,
              color: inner.color,
              height: inner.height,
              action: inner.action,
              paddingAll,
              backgroundColor,
            },
          };
        }
        return null;
      };

      const contents: FlexElement[] = (body?.contents ?? [])
        .map((n: any, i: number) => {
          const res = unwrap(n);
          if (!res) return null;
          return {
            id: `elm-${Date.now()}-${i}`,
            type: res.type,
            properties: res.props,
          };
        })
        .filter(Boolean);

      setCurrentMessageId(row.id);
      setDesign({
        name: row.name,
        hero: {
          enabled: !!hero,
          url: hero?.url,
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
      const { error } = await supabase.functions.invoke("send-flex-message", {
        body: { flexMessage: payload, userId: user.id },
      });
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
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  const padPx = (t?: PaddingToken) => (t && t !== "none" ? padMap[t as Exclude<PaddingToken,"none">] ?? 0 : 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> ダッシュボードへ
          </Button>
          <h1 className="text-xl font-bold">Flexメッセージデザイナー</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Designer */}
          <div className="col-span-12 md:col-span-5 space-y-6">
            {/* Basic / Hero */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">基本設定 / ヒーロー</CardTitle>
                <CardDescription>ヒーロー画像はカード上部の大きな画像です</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-3 items-center">
                  <Label className="col-span-1">メッセージ名</Label>
                  <Input className="col-span-3" value={design.name} onChange={(e) => setDesign(d => ({ ...d, name: e.target.value }))} />
                </div>

                <div className="grid grid-cols-4 gap-3 items-start">
                  <Label className="col-span-1">ヒーロー</Label>
                  <div className="col-span-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <Select
                        value={design.hero.enabled ? "on" : "off"}
                        onValueChange={(v) => setDesign(d => ({ ...d, hero: { ...d.hero, enabled: v === "on" } }))}
                      >
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">オフ</SelectItem>
                          <SelectItem value="on">オン</SelectItem>
                        </SelectContent>
                      </Select>
                      {design.hero.enabled && (
                        <div className="flex items-center gap-2">
                          <MediaSelector onSelect={(url) => setDesign(d => ({ ...d, hero: { ...d.hero, url } }))} selectedUrl={design.hero.url} />
                          <Input
                            className="w-full"
                            placeholder="https://..."
                            value={design.hero.url ?? ""}
                            onChange={(e) => setDesign(d => ({ ...d, hero: { ...d.hero, url: e.target.value } }))}
                          />
                        </div>
                      )}
                    </div>

                    {design.hero.enabled && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>比率</Label>
                          <Select
                            value={design.hero.aspectRatio ?? "20:13"}
                            onValueChange={(v: any) => setDesign(d => ({ ...d, hero: { ...d.hero, aspectRatio: v } }))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="20:13">20:13</SelectItem>
                              <SelectItem value="16:9">16:9</SelectItem>
                              <SelectItem value="1:1">1:1</SelectItem>
                              <SelectItem value="4:3">4:3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>モード</Label>
                          <Select
                            value={design.hero.aspectMode ?? "cover"}
                            onValueChange={(v: any) => setDesign(d => ({ ...d, hero: { ...d.hero, aspectMode: v } }))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cover">cover</SelectItem>
                              <SelectItem value="fit">fit</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>タップURL</Label>
                          <Input
                            value={design.hero.action?.uri ?? ""}
                            onChange={(e) => setDesign(d => ({ ...d, hero: { ...d.hero, action: { type: "uri", uri: e.target.value, label: "Open" } } }))}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 items-center">
                  <Label className="col-span-1">本文スペーシング</Label>
                  <Select
                    value={design.body.spacing ?? "md"}
                    onValueChange={(v: any) => setDesign(d => ({ ...d, body: { ...d.body, spacing: v } }))}
                  >
                    <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">none</SelectItem>
                      <SelectItem value="sm">sm</SelectItem>
                      <SelectItem value="md">md</SelectItem>
                      <SelectItem value="lg">lg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 gap-3 items-center">
                  <Label className="col-span-1">本文背景色</Label>
                  <div className="col-span-3 flex items-center gap-3">
                    <ColorPicker
                      color={design.body.backgroundColor ?? "#ffffff"}
                      onChange={(c) => setDesign(d => ({ ...d, body: { ...d.body, backgroundColor: c } }))}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setDesign(d => ({ ...d, body: { ...d.body, backgroundColor: undefined } }))}>クリア</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Elements */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">要素</CardTitle>
                    <CardDescription>ドラッグで並べ替えできます</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => addElement("text")}><Plus className="w-4 h-4 mr-1" />テキスト</Button>
                    <Button size="sm" variant="outline" onClick={() => addElement("image")}><Image className="w-4 h-4 mr-1" />画像</Button>
                    <Button size="sm" variant="outline" onClick={() => addElement("button")}><Plus className="w-4 h-4 mr-1" />ボタン</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {design.body.contents.length === 0 ? (
                  <div className="border border-dashed rounded-lg py-8 text-center text-muted-foreground">
                    要素を追加してください
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={design.body.contents.map(e => e.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3">
                        {design.body.contents.map(el => (
                          <SortableItem key={el.id} element={el} onUpdate={updateElement} onDelete={deleteElement} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>

            {/* actions */}
            <div className="flex gap-3">
              <Button onClick={saveMessage} disabled={loading} className="flex-1">
                <Save className="w-4 h-4 mr-2" /> {loading ? "保存中..." : currentMessageId ? "上書き保存" : "保存"}
              </Button>
              <Button onClick={sendCurrent} disabled={loading} className="bg-[#06c755] hover:bg-[#05b84c] text-white">
                <Send className="w-4 h-4 mr-2" /> 全体配信
              </Button>
            </div>
          </div>

          {/* Right: Preview & Saved */}
          <div className="col-span-12 md:col-span-7 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Eye className="w-5 h-5" /> プレビュー</CardTitle>
                <CardDescription>実機と近い見た目（簡易）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-muted/40 rounded-xl p-4">
                    <div className="bg-white rounded-xl border shadow-sm max-w-[320px] mx-auto overflow-hidden">
                      {design.hero.enabled && design.hero.url && (
                        <div className="w-full">
                          <img
                            src={design.hero.url}
                            alt="hero"
                            className="w-full object-cover"
                            style={{
                              aspectRatio: (design.hero.aspectRatio ?? "20:13").replace(":", "/"),
                              objectFit: design.hero.aspectMode === "fit" ? "contain" : "cover",
                            }}
                          />
                        </div>
                      )}
                      <div
                        className="p-4"
                        style={{
                          background: toHex6(design.body.backgroundColor),
                        }}
                      >
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
                                  style={{ aspectRatio: (p.aspectRatio ?? "20:13").replace(":", "/"), objectFit: p.aspectMode === "fit" ? "contain" : "cover" }}
                                />
                              )}
                              {el.type === "button" && (
                                <button
                                  className="w-full rounded text-sm font-medium"
                                  style={{
                                    backgroundColor: p.style === "link" ? "transparent" : (toHex6(p.color) ?? (p.style === "secondary" ? "#f0f0f0" : "#0066cc")),
                                    color: p.style === "link" ? (toHex6(p.color) ?? "#0066cc") : "#fff",
                                    border: p.style === "link" ? `1px solid ${toHex6(p.color) ?? "#0066cc"}` : "none",
                                    padding: p.height === "sm" ? "8px 12px" : p.height === "lg" ? "14px 16px" : "12px 14px",
                                  }}
                                >
                                  {p.action?.label ?? "Button"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* saved list */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">保存済みメッセージ</h4>
                    </div>
                    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                      {messages.length === 0 ? (
                        <div className="text-sm text-muted-foreground">まだありません</div>
                      ) : messages.map(row => (
                        <div key={row.id} className={`rounded-lg border p-3 ${currentMessageId === row.id ? "border-primary/60 bg-primary/5" : ""}`}>
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{row.name}</div>
                            <Badge variant="secondary" className="text-xs">{new Date(row.created_at).toLocaleDateString("ja-JP")}</Badge>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => loadMessage(row)}>読込</Button>
                            <Button size="sm" variant="outline" onClick={() => sendSaved(row)}><Send className="w-3 h-3 mr-1" />配信</Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
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
                  </div>

                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
