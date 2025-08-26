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
import { ArrowLeft, Send, Plus, Trash2, Image, MessageSquare, Save, Eye, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
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

// ---------- 型 ----------

interface FlexMessage {
  id: string;
  name: string;
  content: any;
  created_at: string;
  updated_at: string;
  user_id: string;
}

type ActionType = 'message' | 'uri' | 'postback';

interface BaseAction {
  type: ActionType;
  label?: string;
}
interface UriAction extends BaseAction {
  type: 'uri';
  uri?: string;
}
interface MessageAction extends BaseAction {
  type: 'message';
  text?: string;
}
interface PostbackAction extends BaseAction {
  type: 'postback';
  data?: string;
}
type AnyAction = UriAction | MessageAction | PostbackAction;

type ElementType = 'text' | 'image' | 'button';

interface FlexElement {
  id: string;
  type: ElementType;
  properties: {
    // text
    text?: string;
    size?: string;            // xs/sm/md/lg/xl/xxl...
    weight?: string;          // normal/bold
    color?: string;
    align?: string;           // start/center/end
    backgroundColor?: string;

    // image
    url?: string;
    aspectRatio?: string;     // "20:13" など
    aspectMode?: string;      // cover/fit
    edgeToEdge?: boolean;     // ← 先頭に来たら hero に昇格してフチなしで表示

    // button
    style?: string;           // primary/secondary/link
    height?: string;          // sm/md/lg
    action?: AnyAction;
  };
}

interface FlexDesign {
  name: string;
  body: {
    type: 'box';
    layout: 'vertical';
    spacing?: string;
    backgroundColor?: string;
    paddingAll?: string;      // ← 追加: 全体パディング (0px/sm/md/lg/xl)
    contents: FlexElement[];
  };
  styles?: {
    body?: {
      backgroundColor?: string;
    };
  };
}

// ---------- ユーティリティ ----------

const paddingPreviewPx: Record<string, number> = {
  '0px': 0,
  'none': 0,
  'xs': 6,
  'sm': 8,
  'md': 12,
  'lg': 16,
  'xl': 20,
};

// ---------- 並び替えアイテム ----------

const SortableItem = ({ element, onUpdate, onDelete }: {
  element: FlexElement;
  onUpdate: (id: string, properties: any) => void;
  onDelete: (id: string) => void;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const renderElementEditor = () => {
    switch (element.type) {
      case 'text':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>テキスト内容</Label>
              <Textarea
                value={element.properties.text || ''}
                onChange={(e) => onUpdate(element.id, { ...element.properties, text: e.target.value })}
                placeholder="テキストを入力してください"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>サイズ</Label>
                <Select
                  value={element.properties.size || 'md'}
                  onValueChange={(value) => onUpdate(element.id, { ...element.properties, size: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xs">XS</SelectItem>
                    <SelectItem value="sm">SM</SelectItem>
                    <SelectItem value="md">MD</SelectItem>
                    <SelectItem value="lg">LG</SelectItem>
                    <SelectItem value="xl">XL</SelectItem>
                    <SelectItem value="xxl">XXL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>太さ</Label>
                <Select
                  value={element.properties.weight || 'normal'}
                  onValueChange={(value) => onUpdate(element.id, { ...element.properties, weight: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">標準</SelectItem>
                    <SelectItem value="bold">太字</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>文字色</Label>
                <ColorPicker
                  color={element.properties.color || '#000000'}
                  onChange={(color) => onUpdate(element.id, { ...element.properties, color })}
                />
              </div>
              <div className="space-y-2">
                <Label>配置</Label>
                <Select
                  value={element.properties.align || 'start'}
                  onValueChange={(value) => onUpdate(element.id, { ...element.properties, align: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">左</SelectItem>
                    <SelectItem value="center">中央</SelectItem>
                    <SelectItem value="end">右</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>背景色</Label>
              <ColorPicker
                color={element.properties.backgroundColor || '#ffffff'}
                onChange={(backgroundColor) => onUpdate(element.id, { ...element.properties, backgroundColor })}
              />
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>画像選択</Label>
              <MediaSelector
                onSelect={(url) => onUpdate(element.id, { ...element.properties, url })}
                selectedUrl={element.properties.url}
              />
            </div>

            <div className="space-y-2">
              <Label>画像URL（直接入力）</Label>
              <Input
                value={element.properties.url || ''}
                onChange={(e) => onUpdate(element.id, { ...element.properties, url: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>サイズ</Label>
                <Select
                  value={element.properties.size || 'full'}
                  onValueChange={(value) => onUpdate(element.id, { ...element.properties, size: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xxs">XXS</SelectItem>
                    <SelectItem value="xs">XS</SelectItem>
                    <SelectItem value="sm">SM</SelectItem>
                    <SelectItem value="md">MD</SelectItem>
                    <SelectItem value="lg">LG</SelectItem>
                    <SelectItem value="xl">XL</SelectItem>
                    <SelectItem value="xxl">XXL</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>アスペクト比</Label>
                <Select
                  value={element.properties.aspectRatio || '20:13'}
                  onValueChange={(value) => onUpdate(element.id, { ...element.properties, aspectRatio: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="20:13">20:13</SelectItem>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="4:3">4:3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!element.properties.edgeToEdge}
                  onChange={(e) => onUpdate(element.id, { ...element.properties, edgeToEdge: e.target.checked })}
                />
                先頭に置いたら「フチなし（hero）」で表示する
              </label>
            </div>
          </div>
        );

      case 'button':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>ボタンラベル</Label>
              <Input
                value={element.properties.action?.label || ''}
                onChange={(e) =>
                  onUpdate(element.id, {
                    ...element.properties,
                    action: { ...(element.properties.action || { type: 'uri' as ActionType }), label: e.target.value }
                  })
                }
                placeholder="ボタンに表示するテキスト"
              />
            </div>

            <div className="space-y-2">
              <Label>ボタンタイプ</Label>
              <Select
                value={element.properties.action?.type || 'uri'}
                onValueChange={(value) =>
                  onUpdate(element.id, {
                    ...element.properties,
                    action: { ...(element.properties.action || {}), type: value as ActionType }
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">メッセージ送信</SelectItem>
                  <SelectItem value="uri">URLを開く</SelectItem>
                  <SelectItem value="postback">ポストバック</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {element.properties.action?.type === 'uri' && (
              <div className="space-y-2">
                <Label>リンクURL</Label>
                <Input
                  value={(element.properties.action as UriAction)?.uri || ''}
                  onChange={(e) =>
                    onUpdate(element.id, {
                      ...element.properties,
                      action: { ...(element.properties.action as UriAction), type: 'uri', uri: e.target.value }
                    })
                  }
                  placeholder="https://example.com"
                />
              </div>
            )}

            {element.properties.action?.type === 'message' && (
              <div className="space-y-2">
                <Label>送信メッセージ</Label>
                <Input
                  value={(element.properties.action as MessageAction)?.text || ''}
                  onChange={(e) =>
                    onUpdate(element.id, {
                      ...element.properties,
                      action: { ...(element.properties.action as MessageAction), type: 'message', text: e.target.value }
                    })
                  }
                  placeholder="送信するメッセージ"
                />
              </div>
            )}

            {element.properties.action?.type === 'postback' && (
              <div className="space-y-2">
                <Label>データ（postback）</Label>
                <Input
                  value={(element.properties.action as PostbackAction)?.data || ''}
                  onChange={(e) =>
                    onUpdate(element.id, {
                      ...element.properties,
                      action: { ...(element.properties.action as PostbackAction), type: 'postback', data: e.target.value }
                    })
                  }
                  placeholder="key=value&foo=bar"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>スタイル</Label>
                <Select
                  value={element.properties.style || 'primary'}
                  onValueChange={(value) => onUpdate(element.id, { ...element.properties, style: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">メイン（濃い色）</SelectItem>
                    <SelectItem value="secondary">サブ（薄い色）</SelectItem>
                    <SelectItem value="link">リンク（枠線）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ボタン色</Label>
                <ColorPicker
                  color={element.properties.color || '#0066cc'}
                  onChange={(color) => onUpdate(element.id, { ...element.properties, color })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>ボタン高さ</Label>
              <Select
                value={element.properties.height || 'md'}
                onValueChange={(value) => onUpdate(element.id, { ...element.properties, height: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">小</SelectItem>
                  <SelectItem value="md">中</SelectItem>
                  <SelectItem value="lg">大</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-background border-2 border-dashed border-muted hover:border-primary/50 rounded-lg p-4 mb-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-2 hover:bg-primary/10 rounded-md border border-primary/20 transition-colors"
            title="ドラッグして並び替え"
          >
            <GripVertical className="w-4 h-4 text-primary" />
          </div>
          <Badge variant="outline" className="text-xs">
            {element.type === 'text' && 'テキスト'}
            {element.type === 'image' && '画像'}
            {element.type === 'button' && 'ボタン'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setIsCollapsed(!isCollapsed)} className="p-1">
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onDelete(element.id)} className="text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {!isCollapsed && <div className="mt-3">{renderElementEditor()}</div>}
    </div>
  );
};

// ---------- 本体 ----------

const FlexMessageDesigner = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [messages, setMessages] = useState<FlexMessage[]>([]);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  const [design, setDesign] = useState<FlexDesign>({
    name: "",
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '0px',     // ← 既定で余白ゼロ
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
    const newElement: FlexElement = {
      id: `element-${Date.now()}`,
      type,
      properties:
        type === 'text'
          ? { text: 'サンプルテキスト', size: 'md', weight: 'normal', color: '#000000' }
          : type === 'image'
          ? { url: '', size: 'full', aspectRatio: '20:13', aspectMode: 'cover', edgeToEdge: true }
          : { style: 'primary', action: { type: 'uri', label: 'ボタン', uri: 'https://line.me/' } as UriAction }
    };

    setDesign(prev => ({
      ...prev,
      body: {
        ...prev.body,
        contents: [...prev.body.contents, newElement]
      }
    }));
  };

  const updateElement = (id: string, properties: any) => {
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
      const oldIndex = prev.body.contents.findIndex(i => i.id === String(active.id));
      const newIndex = prev.body.contents.findIndex(i => i.id === String(over.id));
      return {
        ...prev,
        body: { ...prev.body, contents: arrayMove(prev.body.contents, oldIndex, newIndex) }
      };
    });
  };

  // --------- ここが配信される JSON を組み立てる中核 ---------
  const generateFlexJson = () => {
    const rawContents = design.body.contents
      .map((element, index) => {
        const p = element.properties || {};
        const notFirst = index > 0;
        const margin = notFirst ? "md" : undefined; // トークンで安全に

        switch (element.type) {
          case "text": {
            const text = (p.text || "").trim();
            if (!text) return null;
            return {
              type: "text",
              text,
              wrap: true,
              ...(p.size && { size: p.size }),
              ...(p.weight && p.weight !== "normal" && { weight: p.weight }),
              ...(p.color && { color: p.color }),
              ...(p.align && { align: p.align }),
              ...(p.backgroundColor && { backgroundColor: p.backgroundColor }),
              ...(margin && { margin })
            };
          }
          case "image": {
            const url = (p.url || "").trim();
            if (!url) return null;
            return {
              type: "image",
              url,
              ...(p.size && { size: p.size }),
              ...(p.aspectRatio && { aspectRatio: p.aspectRatio }),
              ...(p.aspectMode && { aspectMode: p.aspectMode }),
              ...(p.action && { action: p.action }),
              ...(margin && { margin }),
              ...(typeof p.edgeToEdge === 'boolean' && { edgeToEdge: p.edgeToEdge }) // preview 用の目印（LINE には送らない）
            };
          }
          case "button": {
            const action = (p.action || { type: 'uri', uri: 'https://line.me/' }) as AnyAction;
            return {
              type: "button",
              action,
              ...(p.style && { style: p.style }),
              ...(p.color && { color: p.color }),
              ...(p.height && { height: p.height }),
              ...(margin && { margin })
            };
          }
          default:
            return null;
        }
      })
      .filter(Boolean) as any[];

    if (rawContents.length === 0) return null;

    // 先頭が画像かつ edgeToEdge=true なら hero へ昇格（フチなし）
    let hero: any | undefined;
    let bodyContents = rawContents;
    const first = rawContents[0];
    if (first?.type === "image" && design.body.contents[0]?.properties?.edgeToEdge) {
      hero = { ...first };
      // LINE の hero は margin 等不要
      delete hero.margin;
      delete hero.edgeToEdge; // 送信不要
      bodyContents = rawContents.slice(1);
    }

    // body box：既定で paddingAll: 0px（余白ゼロ）
    const paddingAll = design.body.paddingAll || '0px';
    const bodyBox: any = {
      type: "box",
      layout: "vertical",
      spacing: "none",
      paddingAll,
      contents: bodyContents
    };

    // bubble styles（背景色）
    const bubbleStyles = design.styles?.body?.backgroundColor
      ? { body: { backgroundColor: design.styles.body.backgroundColor } }
      : undefined;

    const altText = (design.name || "Flexメッセージ").slice(0, 400);

    return {
      type: "flex",
      altText,
      contents: {
        type: "bubble",
        ...(hero && { hero }),
        body: bodyBox,
        ...(bubbleStyles && { styles: bubbleStyles })
      }
    };
  };
  // ---------------------------------------------------------

  const saveMessage = async () => {
    if (!design.name.trim()) {
      toast({ title: "入力エラー", description: "メッセージ名を入力してください", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "認証エラー", description: "ログインが必要です", variant: "destructive" });
        return;
      }
      const flexJson = generateFlexJson();
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
    } catch (error) {
      console.error('Error saving message:', error);
      toast({ title: "保存エラー", description: "メッセージの保存に失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadMessage = (message: FlexMessage) => {
    // 保存済み JSON から UI 状態へ復元（hero を先頭 image に戻す）
    const contents = message.content?.contents;
    const body = contents?.body || {};
    const hero = contents?.hero;

    const bodyItems: any[] = (body?.contents || []).map((item: any, idx: number) => ({
      id: `element-${Date.now()}-${idx}`,
      type: item.type as ElementType,
      properties: { ...item } // action 等は中に入っている
    }));

    if (hero && hero.type === 'image') {
      // 先頭に hero を edgeToEdge=true の image として戻す
      bodyItems.unshift({
        id: `element-${Date.now()}-hero`,
        type: 'image' as ElementType,
        properties: { ...hero, edgeToEdge: true }
      });
    }

    setCurrentMessageId(message.id);
    setDesign({
      name: message.name,
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        backgroundColor: body?.backgroundColor,
        paddingAll: body?.paddingAll || '0px',
        contents: bodyItems
      },
      styles: contents?.styles
    });

    toast({ title: "読み込み完了", description: `「${message.name}」を読み込みました` });
  };

  const sendMessage = async () => {
    if (design.body.contents.length === 0) {
      toast({ title: "入力エラー", description: "少なくとも1つの要素を追加してください", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "認証エラー", description: "ログインが必要です", variant: "destructive" });
        return;
      }
      const flexJson = generateFlexJson();
      if (!flexJson) {
        toast({ title: "検証エラー", description: "空の要素は送信できません", variant: "destructive" });
        return;
      }

      // 送信前に中身を確認したい時はこのログを見る
      console.log("送信予定の Flex JSON:", JSON.stringify(flexJson, null, 2));

      const { error } = await supabase.functions.invoke('send-flex-message', {
        body: { flexMessage: flexJson, userId: user.id }
      });
      if (error) throw error;

      toast({ title: "送信完了", description: "Flexメッセージを送信しました" });
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({ title: "送信エラー", description: error.message || "メッセージの送信に失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendSavedMessage = async (message: FlexMessage) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "認証エラー", description: "ログインが必要です", variant: "destructive" });
        return;
      }
      // 保存済み JSON をそのまま送る
      const { error } = await supabase.functions.invoke('send-flex-message', {
        body: { flexMessage: message.content, userId: user.id }
      });
      if (error) throw error;

      toast({ title: "送信完了", description: `「${message.name}」を送信しました` });
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({ title: "送信エラー", description: error.message || "メッセージの送信に失敗しました", variant: "destructive" });
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
        setDesign({
          name: "",
          body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '0px', contents: [] }
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({ title: "削除エラー", description: "メッセージの削除に失敗しました", variant: "destructive" });
    }
  };

  const newMessage = () => {
    setCurrentMessageId(null);
    setDesign({
      name: "",
      body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '0px', contents: [] }
    });
    toast({ title: "新規作成", description: "新しいメッセージを作成します" });
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  // hero/ body をプレビュー用に分割
  const previewFirst = design.body.contents[0];
  const previewHasHero = previewFirst?.type === 'image' && previewFirst.properties?.edgeToEdge;
  const previewBodyList = previewHasHero ? design.body.contents.slice(1) : design.body.contents;
  const previewPadding = paddingPreviewPx[design.body.paddingAll || '0px'] ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              ダッシュボードに戻る
            </Button>
            <h1 className="text-2xl font-bold">Flexメッセージデザイナー</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 py-8 max-w-7xl">
        <div className="flex gap-0">
          {/* 左：デザイナー */}
          <div className="space-y-6 w-96 flex-shrink-0">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      メッセージデザイナー
                    </CardTitle>
                    <CardDescription>ドラッグ&ドロップで要素を並び替えできます</CardDescription>
                  </div>
                  <Button onClick={newMessage} variant="outline" size="sm">新規作成</Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="message-name">メッセージ名</Label>
                    <Input
                      id="message-name"
                      value={design.name}
                      onChange={(e) => setDesign(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="メッセージに名前を付けてください"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>本体背景色</Label>
                      <ColorPicker
                        color={design.styles?.body?.backgroundColor || '#ffffff'}
                        onChange={(backgroundColor) =>
                          setDesign(prev => ({ ...prev, styles: { body: { backgroundColor } } }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>本体パディング（paddingAll）</Label>
                      <Select
                        value={design.body.paddingAll || '0px'}
                        onValueChange={(value) => setDesign(prev => ({ ...prev, body: { ...prev.body, paddingAll: value } }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0px">0px（なし）</SelectItem>
                          <SelectItem value="sm">sm</SelectItem>
                          <SelectItem value="md">md</SelectItem>
                          <SelectItem value="lg">lg</SelectItem>
                          <SelectItem value="xl">xl</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => addElement('text')} size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-1" /> テキスト
                    </Button>
                    <Button onClick={() => addElement('image')} size="sm" variant="outline">
                      <Image className="w-4 h-4 mr-1" /> 画像
                    </Button>
                    <Button onClick={() => addElement('button')} size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-1" /> ボタン
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>要素の並び替え（ドラッグして順序変更）</Label>
                    <div className="max-h-96 overflow-y-auto">
                      {design.body.contents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                          <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">要素を追加して開始してください</p>
                        </div>
                      ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                          <SortableContext items={design.body.contents.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            {design.body.contents.map((element) => (
                              <SortableItem
                                key={element.id}
                                element={element}
                                onUpdate={updateElement}
                                onDelete={deleteElement}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button onClick={saveMessage} disabled={loading} className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      {loading ? "保存中..." : currentMessageId ? "上書き保存" : "保存する"}
                    </Button>
                    <Button
                      onClick={sendMessage}
                      disabled={loading}
                      className="bg-[#06c755] hover:bg-[#05b84c] text-white border-[#06c755]"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {loading ? "送信中..." : "全体配信"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右：プレビュー & 保存一覧 */}
          <div className="space-y-6 border-l border-border pl-4 flex-1">
            {/* プレビュー */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" /> プレビュー
                </CardTitle>
                <CardDescription>現在作成中のFlexメッセージのプレビューです</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded-lg p-4 min-h-[200px]">
                  {design.body.contents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">要素を追加するとプレビューが表示されます</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg shadow-sm border max-w-[280px] mx-auto overflow-hidden">
                      {/* hero（フチなし） */}
                      {previewHasHero && previewFirst?.properties?.url && (
                        <img
                          src={previewFirst.properties.url}
                          alt="hero"
                          className="w-full block"
                          style={{
                            aspectRatio: (previewFirst.properties.aspectRatio || '20:13').replace(':', '/')
                          }}
                        />
                      )}

                      {/* body */}
                      <div
                        style={{
                          padding: previewPadding,
                          backgroundColor: design.styles?.body?.backgroundColor || '#ffffff'
                        }}
                      >
                        {previewBodyList.map((element, index) => {
                          const isFirst = index === 0;
                          return (
                            <div key={element.id} style={{ marginTop: !isFirst ? 12 : 0 }}>
                              {element.type === 'text' && (
                                <div
                                  className="flex-1"
                                  style={{
                                    color: element.properties.color || '#000000',
                                    backgroundColor:
                                      element.properties.backgroundColor &&
                                      element.properties.backgroundColor !== '#ffffff'
                                        ? element.properties.backgroundColor
                                        : undefined,
                                    fontSize:
                                      element.properties.size === 'xs' ? 12 :
                                      element.properties.size === 'sm' ? 14 :
                                      element.properties.size === 'lg' ? 18 :
                                      element.properties.size === 'xl' ? 20 :
                                      element.properties.size === 'xxl' ? 22 : 16,
                                    fontWeight: element.properties.weight === 'bold' ? 'bold' : 'normal',
                                    textAlign: (element.properties.align as any) || 'left',
                                    padding:
                                      element.properties.backgroundColor &&
                                      element.properties.backgroundColor !== '#ffffff'
                                        ? '4px 8px'
                                        : undefined,
                                    borderRadius:
                                      element.properties.backgroundColor &&
                                      element.properties.backgroundColor !== '#ffffff'
                                        ? 4
                                        : undefined,
                                    whiteSpace: 'pre-wrap'
                                  }}
                                >
                                  {element.properties.text || 'テキスト'}
                                </div>
                              )}

                              {element.type === 'image' && element.properties.url && (
                                <img
                                  src={element.properties.url}
                                  alt="image"
                                  className="w-full h-auto rounded"
                                  style={{ aspectRatio: (element.properties.aspectRatio || '20:13').replace(':', '/') }}
                                />
                              )}

                              {element.type === 'button' && (
                                <button
                                  className="w-full rounded text-sm font-medium"
                                  style={{
                                    backgroundColor:
                                      element.properties.style === 'primary'
                                        ? (element.properties.color || '#0066cc')
                                        : element.properties.style === 'secondary'
                                        ? '#f0f0f0'
                                        : 'transparent',
                                    color:
                                      element.properties.style === 'primary'
                                        ? '#fff'
                                        : element.properties.style === 'secondary'
                                        ? '#333'
                                        : (element.properties.color || '#0066cc'),
                                    border:
                                      element.properties.style === 'link'
                                        ? `1px solid ${element.properties.color || '#0066cc'}`
                                        : 'none',
                                    padding:
                                      element.properties.height === 'sm' ? '8px 16px' :
                                      element.properties.height === 'lg' ? '16px 16px' : '12px 16px'
                                  }}
                                >
                                  {element.properties.action?.label || 'ボタン'}
                                </button>
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

            {/* 保存済み一覧 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">保存済みメッセージ</CardTitle>
                <CardDescription>保存したFlexメッセージの一覧です</CardDescription>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">保存されたメッセージがありません</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {messages.map((message) => (
                      <div key={message.id} className={`border rounded-lg p-3 ${currentMessageId === message.id ? 'border-primary bg-primary/5' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{message.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {new Date(message.created_at).toLocaleDateString('ja-JP')}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => loadMessage(message)} className="text-xs h-7 px-2">
                            読込
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => sendSavedMessage(message)} disabled={loading} className="text-xs h-7 px-2">
                            <Send className="w-3 h-3 mr-1" /> 配信
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteMessage(message.id, message.name)} className="text-xs h-7 px-2 text-destructive hover:text-destructive">
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
