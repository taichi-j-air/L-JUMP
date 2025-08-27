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
  ArrowLeft, Send, Plus, Trash2, Image as ImageIcon, MessageSquare,
  Save, Eye, GripVertical, ChevronDown, ChevronRight, Star, Link as LinkIcon
} from "lucide-react";
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
type BubbleSize = "micro" | "kilo" | "mega";
type PaddingToken = "none" | "0px" | "sm" | "md" | "lg" | "xl" | "xxl";
type ElementType = "text" | "image" | "button";

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
  backgroundColor?: string;
  paddingAll?: PaddingToken; // 要素個別の内側余白
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

interface FlexMessage {
  id: string;
  name: string;
  content: any;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface FlexDesign {
  name: string;
  altText: string;      // 通知文
  bubbleSize: BubbleSize;
  hero: HeroConfig;
  body: {
    type: 'box';
    layout: 'vertical';
    spacing?: "none" | "sm" | "md" | "lg";
    backgroundColor?: string;
    contents: FlexElement[];
  };
  styles?: {
    body?: {
      backgroundColor?: string;
    };
  };
}

// ---------- Utils ----------
const padPxMap: Record<Exclude<PaddingToken, "none">, number> = {
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
  Object.keys(obj).forEach((k) => {
    const v = (obj as any)[k];
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  });
  return out;
};

// ---------- Sortable Item ----------
const SortableItem = ({
  element,
  onUpdate,
  onDelete,
  onMakeHero
}: {
  element: FlexElement;
  onUpdate: (id: string, properties: ElementProps) => void;
  onDelete: (id: string) => void;
  onMakeHero?: (id: string) => void;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: element.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div className="grid grid-cols-3 gap-2 items-center">{children}</div>
  );

  const renderElementEditor = () => {
    const p = element.properties;

    switch (element.type) {
      case 'text':
        return (
          <div className="space-y-3 text-sm">
            <Row>
              <Label className="text-xs">テキスト</Label>
              <Textarea
                className="col-span-2 h-16 text-xs"
                value={p.text || ''}
                onChange={(e) => onUpdate(element.id, { ...p, text: e.target.value })}
                placeholder="本文テキスト（複数行OK）"
                rows={2}
              />
            </Row>

            <Row>
              <Label className="text-xs">文字サイズ</Label>
              <Select value={p.size || 'md'} onValueChange={(v) => onUpdate(element.id, { ...p, size: v })}>
                <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="xs">小さめ</SelectItem>
                  <SelectItem value="sm">少し小</SelectItem>
                  <SelectItem value="md">ふつう</SelectItem>
                  <SelectItem value="lg">少し大</SelectItem>
                  <SelectItem value="xl">大きめ</SelectItem>
                </SelectContent>
              </Select>
            </Row>

            <Row>
              <Label className="text-xs">太さ</Label>
              <Select value={p.weight || 'normal'} onValueChange={(v) => onUpdate(element.id, { ...p, weight: v })}>
                <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">標準</SelectItem>
                  <SelectItem value="bold">太字</SelectItem>
                </SelectContent>
              </Select>
            </Row>

            <Row>
              <Label className="text-xs">色</Label>
              <div className="col-span-2">
                <ColorPicker color={p.color || '#000000'} onChange={(c) => onUpdate(element.id, { ...p, color: c })} />
              </div>
            </Row>

            <Row>
              <Label className="text-xs">配置</Label>
              <Select value={p.align || 'start'} onValueChange={(v) => onUpdate(element.id, { ...p, align: v })}>
                <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">左寄せ</SelectItem>
                  <SelectItem value="center">中央</SelectItem>
                  <SelectItem value="end">右寄せ</SelectItem>
                </SelectContent>
              </Select>
            </Row>

            {/* 個別余白＋背景 */}
            <Row>
              <Label className="text-xs">内側余白</Label>
              <Select value={p.paddingAll || 'none'} onValueChange={(v: PaddingToken) => onUpdate(element.id, { ...p, paddingAll: v })}>
                <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
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
            </Row>

            <Row>
              <Label className="text-xs">要素背景色</Label>
              <div className="col-span-2 flex items-center gap-2">
                <ColorPicker color={p.backgroundColor || '#ffffff'} onChange={(c) => onUpdate(element.id, { ...p, backgroundColor: c })} />
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => onUpdate(element.id, { ...p, backgroundColor: undefined })}>クリア</Button>
              </div>
            </Row>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-3 text-sm">
            <Row>
              <Label className="text-xs">画像</Label>
              <div className="col-span-2 flex items-center gap-2">
                <MediaSelector
                  onSelect={(url) => onUpdate(element.id, { ...p, url })}
                  selectedUrl={p.url}
                />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {p.url ? (
                    <img src={p.url} alt="thumb" className="w-10 h-10 rounded object-cover border" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted grid place-items-center border">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <Input
                    className="text-xs h-8 truncate flex-1"
                    value={p.url || ''}
                    onChange={(e) => onUpdate(element.id, { ...p, url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>
            </Row>

            <Row>
              <Label className="text-xs">縦横の割合</Label>
              <Select value={p.aspectRatio || '20:13'} onValueChange={(v: any) => onUpdate(element.id, { ...p, aspectRatio: v })}>
                <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="20:13">横長（推奨）</SelectItem>
                  <SelectItem value="16:9">横長（動画風）</SelectItem>
                  <SelectItem value="1:1">正方形</SelectItem>
                  <SelectItem value="4:3">やや横長</SelectItem>
                </SelectContent>
              </Select>
            </Row>

            <Row>
              <Label className="text-xs">表示方法</Label>
              <Select value={p.aspectMode || 'cover'} onValueChange={(v: any) => onUpdate(element.id, { ...p, aspectMode: v })}>
                <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">切り抜いてピッタリ</SelectItem>
                  <SelectItem value="fit">全体を収める</SelectItem>
                </SelectContent>
              </Select>
            </Row>

            <Row>
              <Label className="text-xs flex items-center gap-1"><LinkIcon className="w-3 h-3" /> タップURL</Label>
              <Input
                className="col-span-2 text-xs h-8"
                value={p.action?.uri || ''}
                onChange={(e) => onUpdate(element.id, { ...p, action: { type: "uri", uri: e.target.value, label: p.action?.label || "Open" } })}
                placeholder="https://..."
              />
            </Row>

            <Row>
              <Label className="text-xs">内側余白</Label>
              <Select value={p.paddingAll || 'none'} onValueChange={(v: PaddingToken) => onUpdate(element.id, { ...p, paddingAll: v })}>
                <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
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
            </Row>

            <Row>
              <Label className="text-xs">要素背景色</Label>
              <div className="col-span-2 flex items-center gap-2">
                <ColorPicker color={p.backgroundColor || '#ffffff'} onChange={(c) => onUpdate(element.id, { ...p, backgroundColor: c })} />
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => onUpdate(element.id, { ...p, backgroundColor: undefined })}>クリア</Button>
              </div>
            </Row>

            {onMakeHero && (
              <div className="pt-1">
                <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => onMakeHero(element.id)}>
                  <Star className="w-3 h-3 mr-1" />
                  この画像をヒーローにする
                </Button>
              </div>
            )}
          </div>
        );

      case 'button':
        return (
          <div className="space-y-3 text-sm">
            <Row>
              <Label className="text-xs">表示テキスト</Label>
              <Input
                className="col-span-2 text-xs h-8"
                value={p.action?.label || ''}
                onChange={(e) => onUpdate(element.id, { ...p, action: { ...(p.action || { type: "uri" }), label: e.target.value } })}
                placeholder="ボタン"
              />
            </Row>

            <Row>
              <Label className="text-xs">動作</Label>
              <Select value={p.action?.type || 'uri'} onValueChange={(v: ActionDef["type"]) => onUpdate(element.id, { ...p, action: { ...(p.action || {}), type: v } })}>
                <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uri">リンクを開く</SelectItem>
                  <SelectItem value="message">テキスト送信</SelectItem>
                  <SelectItem value="postback">データ送信</SelectItem>
                </SelectContent>
              </Select>
            </Row>

            {(p.action?.type || "uri") === "uri" && (
              <Row>
                <Label className="text-xs">リンクURL</Label>
                <Input
                  className="col-span-2 text-xs h-8"
                  value={p.action?.uri || ''}
                  onChange={(e) => onUpdate(element.id, { ...p, action: { type: "uri", uri: e.target.value, label: p.action?.label || "Open" } })}
                  placeholder="https://..."
                />
              </Row>
            )}
            {p.action?.type === "message" && (
              <Row>
                <Label className="text-xs">送信テキスト</Label>
                <Input
                  className="col-span-2 text-xs h-8"
                  value={p.action?.text || ''}
                  onChange={(e) => onUpdate(element.id, { ...p, action: { type: "message", text: e.target.value, label: p.action?.label || "Send" } })}
                  placeholder="こんにちは"
                />
              </Row>
            )}
            {p.action?.type === "postback" && (
              <Row>
                <Label className="text-xs">データ</Label>
                <Input
                  className="col-span-2 text-xs h-8"
                  value={p.action?.data || ''}
                  onChange={(e) => onUpdate(element.id, { ...p, action: { type: "postback", data: e.target.value, label: p.action?.label || "PB" } })}
                  placeholder="key=value"
                />
              </Row>
            )}

            <Row>
              <Label className="text-xs">見た目</Label>
              <Select value={p.style || 'primary'} onValueChange={(v) => onUpdate(element.id, { ...p, style: v })}>
                <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">メイン色</SelectItem>
                  <SelectItem value="secondary">薄い色</SelectItem>
                  <SelectItem value="link">枠線リンク</SelectItem>
                </SelectContent>
              </Select>
            </Row>

            <Row>
              <Label className="text-xs">色（背景/枠/文字）</Label>
              <div className="col-span-2">
                <ColorPicker color={p.color || '#0066cc'} onChange={(c) => onUpdate(element.id, { ...p, color: c })} />
              </div>
            </Row>

            <Row>
              <Label className="text-xs">高さ</Label>
              <Select value={p.height || 'md'} onValueChange={(v) => onUpdate(element.id, { ...p, height: v })}>
                <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">小</SelectItem>
                  <SelectItem value="md">中</SelectItem>
                  <SelectItem value="lg">大</SelectItem>
                </SelectContent>
              </Select>
            </Row>

            {/* 個別余白＋背景 */}
            <Row>
              <Label className="text-xs">内側余白</Label>
              <Select value={p.paddingAll || 'none'} onValueChange={(v: PaddingToken) => onUpdate(element.id, { ...p, paddingAll: v })}>
                <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
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
            </Row>

            <Row>
              <Label className="text-xs">要素背景色</Label>
              <div className="col-span-2 flex items-center gap-2">
                <ColorPicker color={p.backgroundColor || '#ffffff'} onChange={(c) => onUpdate(element.id, { ...p, backgroundColor: c })} />
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => onUpdate(element.id, { ...p, backgroundColor: undefined })}>クリア</Button>
              </div>
            </Row>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-background border rounded-lg p-2 mb-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-primary/10 rounded-md border transition-colors"
            title="ドラッグして並び替え"
          >
            <GripVertical className="w-4 h-4 text-primary" />
          </div>
          <Badge variant="outline" className="text-[10px]">
            {element.type === 'text' && 'テキスト'}
            {element.type === 'image' && '画像'}
            {element.type === 'button' && 'ボタン'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-7 px-2"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {element.type === "image" && onMakeHero && (
            <Button
              variant="ghost"
              size="sm"
              title="この画像をヒーローにする（上部の大画像）"
              className="h-7 px-2"
              onClick={() => onMakeHero(element.id)}
            >
              <Star className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(element.id)}
            className="h-7 px-2 text-destructive hover:text-destructive"
            title="削除"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-3">
          {renderElementEditor()}
        </div>
      )}
    </div>
  );
};

// ---------- Main ----------
const FlexMessageDesigner = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [messages, setMessages] = useState<FlexMessage[]>([]);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  const [design, setDesign] = useState<FlexDesign>({
    name: "",
    altText: "",
    bubbleSize: "kilo",
    hero: { enabled: false, aspectRatio: "20:13", aspectMode: "cover" },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: []
    }
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    checkAuthAndLoadMessages();
  }, []);

  const checkAuthAndLoadMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data: flexMessages, error } = await supabase
        .from('flex_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(flexMessages || []);
    } catch (error) {
      console.error('Error:', error);
      toast({ title: "エラー", description: "データの読み込みに失敗しました", variant: "destructive" });
    } finally {
      setInitialLoading(false);
    }
  };

  const addElement = (type: ElementType) => {
    const id = `element-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const defaults: Record<ElementType, ElementProps> = {
      text:   { text: 'サンプルテキスト', size: 'md', weight: 'normal', color: '#000000' },
      image:  { url: '', aspectRatio: '20:13', aspectMode: 'cover' },
      button: { style: 'primary', color: '#0066cc', height: 'md', action: { type: 'uri', label: 'ボタン', uri: 'https://line.me/' } }
    };
    setDesign(prev => ({
      ...prev,
      body: { ...prev.body, contents: [...prev.body.contents, { id, type, properties: defaults[type] }] }
    }));
  };

  const updateElement = (id: string, properties: ElementProps) => {
    setDesign(prev => ({
      ...prev,
      body: {
        ...prev.body,
        contents: prev.body.contents.map(el => el.id === id ? { ...el, properties } : el)
      }
    }));
  };

  const deleteElement = (id: string) => {
    setDesign(prev => ({
      ...prev,
      body: { ...prev.body, contents: prev.body.contents.filter(el => el.id !== id) }
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDesign(prev => {
      const oldIndex = prev.body.contents.findIndex(i => i.id === active.id);
      const newIndex = prev.body.contents.findIndex(i => i.id === over.id);
      return {
        ...prev,
        body: { ...prev.body, contents: arrayMove(prev.body.contents, oldIndex, newIndex) }
      };
    });
  };

  // 任意の画像要素をヒーロー（上部の大画像）に設定
  const makeHeroFromElement = (id: string) => {
    const el = design.body.contents.find(e => e.id === id);
    if (!el || el.type !== "image") return;
    const p = el.properties;
    setDesign(prev => ({
      ...prev,
      hero: {
        enabled: true,
        url: p.url,
        aspectRatio: p.aspectRatio || "20:13",
        aspectMode: p.aspectMode || "cover",
        action: p.action?.uri ? { type: "uri", uri: p.action.uri, label: p.action.label || "Open" } : undefined,
      }
    }));
    toast({ title: "ヒーロー設定", description: "この画像を上部の大画像に設定しました" });
  };

  // Flex JSON生成（要素個別padding/背景は必要時のみラップ）
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
    const items = design.body.contents.map((element, index) => {
      const p = element.properties;
      const margin = index === 0 ? undefined : "md";

      switch (element.type) {
        case 'text': {
          const text = (p.text || '').trim();
          if (!text) return null;
          const node: any = compact({
            type: 'text',
            text,
            wrap: true,
            size: p.size,
            weight: p.weight !== 'normal' ? p.weight : undefined,
            align: p.align && p.align !== 'start' ? p.align : undefined,
            color: toHex6(p.color),
          });
          return wrapIfNeeded(node, { margin, paddingAll: p.paddingAll, backgroundColor: toHex6(p.backgroundColor) });
        }

        case 'image': {
          const url = (p.url || '').trim();
          if (!url) return null;
          const node: any = compact({
            type: 'image',
            url,
            aspectRatio: p.aspectRatio,
            aspectMode: p.aspectMode,
            action: p.action?.uri ? { type: "uri", uri: p.action.uri, label: p.action.label || "Open" } : undefined
          });
          return wrapIfNeeded(node, { margin, paddingAll: p.paddingAll, backgroundColor: toHex6(p.backgroundColor) });
        }

        case 'button': {
          const action =
            p.action?.type === "uri" && p.action.uri ? { type: "uri", uri: p.action.uri, label: p.action.label || "Open" } :
            p.action?.type === "message" && p.action.text ? { type: "message", text: p.action.text, label: p.action.label || "Send" } :
            p.action?.type === "postback" && p.action.data ? { type: "postback", data: p.action.data, label: p.action.label || "PB" } :
            undefined;

          const node: any = compact({
            type: 'button',
            style: p.style,
            color: toHex6(p.color),
            height: p.height,
            action
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
      size: design.bubbleSize,
      body: compact({
        type: "box",
        layout: "vertical",
        spacing: design.body.spacing || "md",
        backgroundColor: toHex6(design.body.backgroundColor),
        contents: items,
      }),
    };

    if (design.hero.enabled && design.hero.url) {
      bubble.hero = compact({
        type: "image",
        url: design.hero.url,
        size: "full",
        aspectRatio: design.hero.aspectRatio || "20:13",
        aspectMode: design.hero.aspectMode || "cover",
        action: design.hero.action?.uri ? { type: "uri", uri: design.hero.action.uri, label: design.hero.action.label || "Open" } : undefined
      });
    }

    return {
      type: "flex",
      altText: (design.altText || design.name || "お知らせ").slice(0, 400),
      contents: bubble
    };
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
      if (!flexJson) throw new Error("有効な要素がありません");

      if (currentMessageId) {
        const { error } = await supabase
          .from('flex_messages')
          .update({ name: design.name, content: flexJson })
          .eq('id', currentMessageId);
        if (error) throw error;
        toast({ title: "更新成功", description: `「${design.name}」を更新しました` });
      } else {
        const { data, error } = await supabase
          .from('flex_messages')
          .insert({ user_id: user.id, name: design.name, content: flexJson })
          .select()
          .single();
        if (error) throw error;
        setCurrentMessageId(data.id);
        toast({ title: "保存成功", description: `「${design.name}」を保存しました` });
      }

      checkAuthAndLoadMessages();
    } catch (e: any) {
      console.error(e);
      toast({ title: "保存エラー", description: e.message || "メッセージの保存に失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadMessage = (message: FlexMessage) => {
    try {
      const bubble = message.content?.contents;
      const hero = bubble?.hero;
      const body = bubble?.body;

      // 要素が padding/背景のため box でラップされている場合のアンラップ
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
            text: inner.text, size: inner.size, weight: inner.weight, align: inner.align, color: inner.color, paddingAll, backgroundColor
          }};
        }
        if (inner?.type === "image") {
          return { type: "image", props: {
            url: inner.url, aspectRatio: inner.aspectRatio, aspectMode: inner.aspectMode, action: inner.action, paddingAll, backgroundColor
          }};
        }
        if (inner?.type === "button") {
          return { type: "button", props: {
            style: inner.style, color: inner.color, height: inner.height, action: inner.action, paddingAll, backgroundColor
          }};
        }
        return null;
      };

      const contents: FlexElement[] = (body?.contents || [])
        .map((n: any, i: number) => {
          const res = unwrap(n);
          if (!res) return null;
          return { id: `element-${Date.now()}-${i}`, type: res.type, properties: res.props };
        })
        .filter(Boolean) as FlexElement[];

      setCurrentMessageId(message.id);
      setDesign({
        name: message.name,
        altText: message.content?.altText ?? "",
        bubbleSize: (bubble?.size as BubbleSize) || "kilo",
        hero: {
          enabled: !!hero, url: hero?.url,
          aspectRatio: hero?.aspectRatio || "20:13",
          aspectMode: hero?.aspectMode || "cover",
          action: hero?.action
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: body?.spacing || 'md',
          backgroundColor: body?.backgroundColor,
          contents
        }
      });

      toast({ title: "読み込み完了", description: `「${message.name}」を読み込みました` });
    } catch (e) {
      console.error(e);
      toast({ title: "読み込み失敗", description: "内容の解析に失敗しました", variant: "destructive" });
    }
  };

  const sendMessage = async () => {
    if (design.body.contents.length === 0) {
      toast({ title: "入力エラー", description: "少なくとも1つの要素を追加してください", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です");

      const flexJson = generateFlexJson();
      if (!flexJson) throw new Error("空のメッセージは送信できません");

      const { error } = await supabase.functions.invoke('send-flex-message', {
        body: { flexMessage: flexJson, userId: user.id }
      });
      if (error) throw error;

      toast({ title: "送信完了", description: "Flexメッセージを送信しました" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "送信エラー", description: e.message || "メッセージの送信に失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendSavedMessage = async (message: FlexMessage) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です");

      const { error } = await supabase.functions.invoke('send-flex-message', {
        body: { flexMessage: message.content, userId: user.id }
      });
      if (error) throw error;

      toast({ title: "送信完了", description: `「${message.name}」を送信しました` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "送信エラー", description: e.message || "メッセージの送信に失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (messageId: string, messageName: string) => {
    if (!confirm(`「${messageName}」を削除しますか？この操作は取り消せません。`)) return;
    try {
      const { error } = await supabase.from('flex_messages').delete().eq('id', messageId);
      if (error) throw error;
      toast({ title: "削除完了", description: `「${messageName}」を削除しました` });
      checkAuthAndLoadMessages();
      if (currentMessageId === messageId) {
        setCurrentMessageId(null);
        setDesign(d => ({
          ...d,
          name: "",
          altText: "",
          hero: { enabled: false, aspectRatio: "20:13", aspectMode: "cover" },
          body: { ...d.body, contents: [] }
        }));
      }
    } catch (e) {
      console.error(e);
      toast({ title: "削除エラー", description: "削除に失敗しました", variant: "destructive" });
    }
  };

  const newMessage = () => {
    setCurrentMessageId(null);
    setDesign({
      name: "",
      altText: "",
      bubbleSize: "kilo",
      hero: { enabled: false, aspectRatio: "20:13", aspectMode: "cover" },
      body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [] }
    });
    toast({ title: "新規作成", description: "新しいメッセージを作成します" });
  };

  // ---------- UI ----------
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  const padPx = (t?: PaddingToken) => (t && t !== "none" ? (padPxMap[t as Exclude<PaddingToken,"none">] ?? 0) : 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1">
              <ArrowLeft className="w-4 h-4" />
              ダッシュボードに戻る
            </Button>
            <h1 className="text-lg font-semibold">Flexメッセージデザイナー</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 py-6 max-w-7xl">
        <div className="flex gap-0">
          {/* 左：デザイナー */}
          <div className="space-y-6 w-96 flex-shrink-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="w-5 h-5" />
                      メッセージデザイナー
                    </CardTitle>
                    <CardDescription className="text-xs">
                      ドラッグ&ドロップで要素を並び替えできます
                    </CardDescription>
                  </div>
                  <Button onClick={newMessage} variant="outline" size="sm">新規作成</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 基本情報 */}
                <div className="space-y-2">
                  <Label htmlFor="message-name" className="text-xs">メッセージ名</Label>
                  <Input
                    id="message-name"
                    className="h-8 text-xs"
                    value={design.name}
                    onChange={(e) => setDesign(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="メッセージの名前"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alt-text" className="text-xs">通知文（代替テキスト）</Label>
                  <Input
                    id="alt-text"
                    className="h-8 text-xs"
                    value={design.altText}
                    onChange={(e) => setDesign(prev => ({ ...prev, altText: e.target.value }))}
                    placeholder="通知に表示される短い説明"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-xs">カード幅</Label>
                    <Select value={design.bubbleSize} onValueChange={(v: BubbleSize) => setDesign(prev => ({ ...prev, bubbleSize: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="micro">縮小</SelectItem>
                        <SelectItem value="kilo">標準</SelectItem>
                        <SelectItem value="mega">最大</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">本文の行間</Label>
                    <Select value={design.body.spacing || "md"} onValueChange={(v: any) => setDesign(prev => ({ ...prev, body: { ...prev.body, spacing: v } }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">詰める</SelectItem>
                        <SelectItem value="sm">やや狭め</SelectItem>
                        <SelectItem value="md">ふつう</SelectItem>
                        <SelectItem value="lg">ゆったり</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ヒーロー設定 */}
                <div className="space-y-2 border rounded-md p-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">上部の大画像（ヒーロー）</Label>
                    <Select
                      value={design.hero.enabled ? "on" : "off"}
                      onValueChange={(v) => setDesign(prev => ({ ...prev, hero: { ...prev.hero, enabled: v === "on" } }))}
                    >
                      <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">オフ</SelectItem>
                        <SelectItem value="on">オン</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {design.hero.enabled && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MediaSelector onSelect={(url) => setDesign(prev => ({ ...prev, hero: { ...prev.hero, url } }))} selectedUrl={design.hero.url} />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {design.hero.url ? (
                            <img src={design.hero.url} alt="hero" className="w-10 h-10 rounded object-cover border" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted grid place-items-center border">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <Input
                            className="h-8 text-xs flex-1 truncate"
                            value={design.hero.url || ""}
                            onChange={(e) => setDesign(prev => ({ ...prev, hero: { ...prev.hero, url: e.target.value } }))}
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label className="text-xs">縦横の割合</Label>
                          <Select value={design.hero.aspectRatio || "20:13"} onValueChange={(v: any) => setDesign(prev => ({ ...prev, hero: { ...prev.hero, aspectRatio: v } }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="20:13">横長（推奨）</SelectItem>
                              <SelectItem value="16:9">横長（動画風）</SelectItem>
                              <SelectItem value="1:1">正方形</SelectItem>
                              <SelectItem value="4:3">やや横長</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">表示方法</Label>
                          <Select value={design.hero.aspectMode || "cover"} onValueChange={(v: any) => setDesign(prev => ({ ...prev, hero: { ...prev.hero, aspectMode: v } }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cover">切り抜いてピッタリ</SelectItem>
                              <SelectItem value="fit">全体を収める</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">タップURL</Label>
                        <Input
                          className="h-8 text-xs"
                          value={design.hero.action?.uri || ""}
                          onChange={(e) => setDesign(prev => ({ ...prev, hero: { ...prev.hero, action: { type: "uri", uri: e.target.value, label: "Open" } } }))}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 要素操作 */}
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => addElement('text')} size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-1" />
                    テキスト
                  </Button>
                  <Button onClick={() => addElement('image')} size="sm" variant="outline">
                    <ImageIcon className="w-4 h-4 mr-1" />
                    画像
                  </Button>
                  <Button onClick={() => addElement('button')} size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-1" />
                    ボタン
                  </Button>
                </div>

                {/* 並び替えリスト */}
                <div className="space-y-2">
                  <Label className="text-xs">要素の並び替え（ドラッグして順序変更）</Label>
                  <div className="max-h-96 overflow-y-auto">
                    {design.body.contents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs">要素を追加して開始してください</p>
                      </div>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={design.body.contents.map(item => item.id)} strategy={verticalListSortingStrategy}>
                          {design.body.contents.map((element) => (
                            <SortableItem
                              key={element.id}
                              element={element}
                              onUpdate={updateElement}
                              onDelete={deleteElement}
                              onMakeHero={makeHeroFromElement}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                </div>

                {/* 保存＆配信 */}
                <div className="flex gap-3 pt-2">
                  <Button onClick={saveMessage} disabled={loading} className="flex-1 h-8 text-xs">
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? "保存中..." : currentMessageId ? "上書き保存" : "保存する"}
                  </Button>
                  <Button
                    onClick={sendMessage}
                    disabled={loading}
                    className="h-8 text-xs bg-[#06c755] hover:bg-[#05b84c] text-white border-[#06c755]"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {loading ? "送信中..." : "全体配信"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右：プレビュー + 保存一覧 */}
          <div className="space-y-6 border-l border-border pl-4 flex-1">
            {/* プレビュー */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="w-5 h-5" />
                  プレビュー
                </CardTitle>
                <CardDescription className="text-xs">実機と近い見た目（簡易）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded-lg p-3 min-h-[200px]">
                  {design.body.contents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-xs">要素を追加するとプレビューが表示されます</p>
                    </div>
                  ) : (
                    <div
                      className="bg-white rounded-lg shadow-sm border mx-auto overflow-hidden"
                      style={{ maxWidth: design.bubbleSize === "micro" ? 260 : design.bubbleSize === "mega" ? 360 : 320 }}
                    >
                      {/* ヒーロー */}
                      {design.hero.enabled && design.hero.url && (
                        <img
                          src={design.hero.url}
                          alt="hero"
                          className="w-full"
                          style={{
                            aspectRatio: (design.hero.aspectRatio || "20:13").replace(":", "/"),
                            objectFit: design.hero.aspectMode === "fit" ? "contain" : "cover"
                          }}
                        />
                      )}

                      {/* 本文 */}
                      <div className="p-3" style={{ background: toHex6(design.body.backgroundColor) }}>
                        {design.body.contents.map((element, index) => {
                          const p = element.properties;
                          const isFirst = index === 0;
                          const mt = isFirst ? 0 : 12;
                          const pad = padPx(p.paddingAll);
                          const bg = toHex6(p.backgroundColor);

                          return (
                            <div key={element.id} style={{ marginTop: mt, padding: pad, background: bg, borderRadius: bg ? 8 : 0 }}>
                              {element.type === 'text' && (
                                <div
                                  className="flex-1"
                                  style={{
                                    color: toHex6(p.color) || '#000000',
                                    fontSize:
                                      p.size === 'xs' ? 12 :
                                      p.size === 'sm' ? 14 :
                                      p.size === 'lg' ? 18 :
                                      p.size === 'xl' ? 20 : 16,
                                    fontWeight: p.weight === 'bold' ? 700 : 400,
                                    textAlign: (p.align as any) || 'left',
                                    whiteSpace: 'pre-wrap'
                                  }}
                                >
                                  {p.text || 'テキスト'}
                                </div>
                              )}

                              {element.type === 'image' && p.url && (
                                <div className="flex-1">
                                  <img
                                    src={p.url}
                                    alt="プレビュー画像"
                                    className="w-full h-auto rounded"
                                    style={{
                                      aspectRatio: (p.aspectRatio || '20:13').replace(':', '/'),
                                      objectFit: p.aspectMode === "fit" ? "contain" : "cover"
                                    }}
                                  />
                                </div>
                              )}

                              {element.type === 'button' && (
                                <div className="flex-1">
                                  <button
                                    className="w-full rounded text-xs font-medium"
                                    style={{
                                      backgroundColor:
                                        p.style === 'link' ? 'transparent' : (toHex6(p.color) || (p.style === 'secondary' ? '#f0f0f0' : '#0066cc')),
                                      color:
                                        p.style === 'link'
                                          ? (toHex6(p.color) || '#0066cc')
                                          : '#ffffff',
                                      border:
                                        p.style === 'link'
                                          ? `1px solid ${toHex6(p.color) || '#0066cc'}`
                                          : 'none',
                                      padding:
                                        p.height === 'sm' ? '8px 16px' :
                                        p.height === 'lg' ? '16px 16px' : '12px 16px'
                                    }}
                                  >
                                    {p.action?.label || 'ボタン'}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 保存一覧 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">保存済みメッセージ</CardTitle>
                <CardDescription className="text-xs">保存したFlexメッセージの一覧です</CardDescription>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs">保存されたメッセージがありません</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {messages.map((message) => (
                      <div key={message.id} className={`border rounded-lg p-3 ${currentMessageId === message.id ? 'border-primary bg-primary/5' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm truncate">{message.name}</h4>
                          <Badge variant="secondary" className="text-[10px]">
                            {new Date(message.created_at).toLocaleDateString('ja-JP')}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadMessage(message)}
                            className="text-xs h-7 px-2"
                          >
                            読込
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendSavedMessage(message)}
                            disabled={loading}
                            className="text-xs h-7 px-2"
                          >
                            <Send className="w-3 h-3 mr-1" />
                            配信
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteMessage(message.id, message.name)}
                            className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FlexMessageDesigner;
