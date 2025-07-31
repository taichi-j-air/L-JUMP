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
import { ArrowLeft, Send, Plus, Trash2, Image, MessageSquare, Move, Save, Eye, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
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
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FlexMessage {
  id: string;
  name: string;
  content: any;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface FlexElement {
  id: string;
  type: 'text' | 'image' | 'button' | 'box' | 'icon';
  properties: {
    text?: string;
    url?: string;
    size?: string;
    weight?: string;
    color?: string;
    align?: string;
    margin?: string;
    wrap?: boolean;
    aspectRatio?: string;
    aspectMode?: string;
    style?: string;
    height?: string;
    action?: {
      type: 'message' | 'uri' | 'postback';
      label?: string;
      text?: string;
      uri?: string;
      data?: string;
    };
    layout?: string;
    spacing?: string;
    backgroundColor?: string;
  };
}

interface FlexDesign {
  name: string;
  body: {
    type: 'box';
    layout: 'vertical';
    spacing?: string;
    backgroundColor?: string;
    contents: FlexElement[];
  };
  hero?: FlexElement;
  footer?: {
    type: 'box';
    layout: 'vertical';
    spacing: string;
    contents: FlexElement[];
  };
  styles?: {
    body?: {
      backgroundColor?: string;
    };
  };
}

const SortableItem = ({ element, onUpdate, onDelete }: {
  element: FlexElement;
  onUpdate: (id: string, properties: any) => void;
  onDelete: (id: string) => void;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: element.id });

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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xs">極小</SelectItem>
                    <SelectItem value="sm">小</SelectItem>
                    <SelectItem value="md">中</SelectItem>
                    <SelectItem value="lg">大</SelectItem>
                    <SelectItem value="xl">特大</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>太さ</Label>
                <Select
                  value={element.properties.weight || 'normal'}
                  onValueChange={(value) => onUpdate(element.id, { ...element.properties, weight: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xxs">XXS</SelectItem>
                    <SelectItem value="xs">XS</SelectItem>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                    <SelectItem value="xl">XL</SelectItem>
                    <SelectItem value="xxl">XXL</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>アスペクト比</Label>
                <Select
                  value={element.properties.aspectRatio || '1:1'}
                  onValueChange={(value) => onUpdate(element.id, { ...element.properties, aspectRatio: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="20:13">20:13</SelectItem>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="4:3">4:3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                onChange={(e) => onUpdate(element.id, { 
                  ...element.properties, 
                  action: { ...element.properties.action, label: e.target.value } 
                })}
                placeholder="ボタンに表示するテキスト"
              />
            </div>
            <div className="space-y-2">
              <Label>ボタンタイプ</Label>
              <Select
                value={element.properties.action?.type || 'uri'}
                onValueChange={(value) => onUpdate(element.id, { 
                  ...element.properties, 
                  action: { ...element.properties.action, type: value } 
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">メッセージ送信</SelectItem>
                  <SelectItem value="uri">URL開く</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {element.properties.action?.type === 'uri' && (
              <div className="space-y-2">
                <Label>リンクURL</Label>
                <Input
                  value={element.properties.action?.uri || ''}
                  onChange={(e) => onUpdate(element.id, { 
                    ...element.properties, 
                    action: { ...element.properties.action, uri: e.target.value } 
                  })}
                  placeholder="https://example.com"
                />
              </div>
            )}

            {element.properties.action?.type === 'message' && (
              <div className="space-y-2">
                <Label>送信メッセージ</Label>
                <Input
                  value={element.properties.action?.text || ''}
                  onChange={(e) => onUpdate(element.id, { 
                    ...element.properties, 
                    action: { ...element.properties.action, text: e.target.value } 
                  })}
                  placeholder="送信するメッセージ"
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(element.id)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      
      {!isCollapsed && (
        <div className="mt-3">
          {renderElementEditor()}
        </div>
      )}
    </div>
  );
};

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
      contents: []
    }
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
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

      if (error) {
        throw error;
      }

      setMessages(flexMessages || []);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "エラー",
        description: "データの読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const addElement = (type: 'text' | 'image' | 'button') => {
    const newElement: FlexElement = {
      id: `element-${Date.now()}`,
      type,
      properties: type === 'text' 
        ? { text: 'サンプルテキスト', size: 'md', weight: 'normal', color: '#000000' }
        : type === 'image'
        ? { url: '', size: 'full', aspectRatio: '20:13', aspectMode: 'cover' }
        : { style: 'primary', action: { type: 'uri', label: 'ボタン', uri: 'https://line.me/' } }
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
        contents: prev.body.contents.map(element =>
          element.id === id ? { ...element, properties } : element
        )
      }
    }));
  };

  const deleteElement = (id: string) => {
    setDesign(prev => ({
      ...prev,
      body: {
        ...prev.body,
        contents: prev.body.contents.filter(element => element.id !== id)
      }
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setDesign(prev => {
        const oldIndex = prev.body.contents.findIndex(item => item.id === active.id);
        const newIndex = prev.body.contents.findIndex(item => item.id === over?.id);

        return {
          ...prev,
          body: {
            ...prev.body,
            contents: arrayMove(prev.body.contents, oldIndex, newIndex)
          }
        };
      });
    }
  };

  const generateFlexJson = () => {
    const contents = design.body.contents.map((element, index) => {
      const props = element.properties;
      const isFirst = index === 0;
      const isLast = index === design.body.contents.length - 1;
      
      switch (element.type) {
        case 'text':
          return {
            type: 'text',
            text: (props.text || '').replace(/\n/g, '\n'),
            ...(props.size && { size: props.size }),
            ...(props.weight && props.weight !== 'normal' && { weight: props.weight }),
            ...(props.color && props.color !== '#000000' && { color: props.color }),
            ...(props.align && props.align !== 'start' && { align: props.align }),
            ...(!isFirst && { margin: "15px" }),
            wrap: true
          };
        
        case 'image':
          return {
            type: 'image',
            url: props.url || '',
            ...(props.size && { size: props.size }),
            ...(props.aspectRatio && { aspectRatio: props.aspectRatio }),
            ...(props.aspectMode && { aspectMode: props.aspectMode }),
            ...(!isFirst && { margin: "15px" }),
            ...(props.action && { action: props.action })
          };
        
        case 'button':
          return {
            type: 'button',
            ...(props.style && { style: props.style }),
            ...(props.color && { color: props.color }),
            ...(props.height && { height: props.height }),
            ...(!isFirst && { margin: "15px" }),
            action: props.action || { type: 'uri', uri: 'https://line.me/' }
          };
        
        default:
          return null;
      }
    }).filter(Boolean);

    return {
      type: "flex",
      altText: design.name || "Flexメッセージ",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "none",
          contents
        },
        ...(design.styles && { styles: design.styles })
      }
    };
  };

  const saveMessage = async () => {
    if (!design.name.trim()) {
      toast({
        title: "入力エラー",
        description: "メッセージ名を入力してください",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "認証エラー",
          description: "ログインが必要です",
          variant: "destructive",
        });
        return;
      }

      const flexJson = generateFlexJson();
      
      if (currentMessageId) {
        // 上書き保存
        const { error } = await supabase
          .from('flex_messages')
          .update({
            name: design.name,
            content: flexJson
          })
          .eq('id', currentMessageId);

        if (error) throw error;
        
        toast({
          title: "更新成功",
          description: `「${design.name}」を更新しました`,
        });
      } else {
        // 新規保存
        const { data, error } = await supabase
          .from('flex_messages')
          .insert({
            user_id: user.id,
            name: design.name,
            content: flexJson
          })
          .select()
          .single();

        if (error) throw error;
        
        setCurrentMessageId(data.id);
        
        toast({
          title: "保存成功",
          description: `「${design.name}」を保存しました`,
        });
      }

      checkAuthAndLoadMessages();
    } catch (error) {
      console.error('Error saving message:', error);
      toast({
        title: "保存エラー",
        description: "メッセージの保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMessage = (message: FlexMessage) => {
    const content = message.content.contents;
    
    setCurrentMessageId(message.id);
    setDesign({
      name: message.name,
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: content.body?.spacing || 'md',
        backgroundColor: content.body?.backgroundColor,
        contents: (content.body?.contents || []).map((item: any, index: number) => ({
          id: `element-${Date.now()}-${index}`,
          type: item.type,
          properties: { ...item, action: item.action }
        }))
      },
      styles: content.styles
    });
    
    toast({
      title: "読み込み完了",
      description: `「${message.name}」を読み込みました`,
    });
  };

  const sendMessage = async () => {
    if (design.body.contents.length === 0) {
      toast({
        title: "入力エラー",
        description: "少なくとも1つの要素を追加してください",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "認証エラー",
          description: "ログインが必要です",
          variant: "destructive",
        });
        return;
      }

      const flexJson = generateFlexJson();
      
      const { data, error } = await supabase.functions.invoke('send-flex-message', {
        body: {
          flexMessage: flexJson,
          userId: user.id
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "送信完了",
        description: "Flexメッセージを送信しました",
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "送信エラー",
        description: error.message || "メッセージの送信に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendSavedMessage = async (message: FlexMessage) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "認証エラー",
          description: "ログインが必要です",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-flex-message', {
        body: {
          flexMessage: message.content,
          userId: user.id
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "送信完了",
        description: `「${message.name}」を送信しました`,
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "送信エラー",
        description: error.message || "メッセージの送信に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (messageId: string, messageName: string) => {
    if (!confirm(`「${messageName}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('flex_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        throw error;
      }

      toast({
        title: "削除完了",
        description: `「${messageName}」を削除しました`,
      });

      checkAuthAndLoadMessages();
      
      // 削除したメッセージが現在編集中のものだった場合、編集状態をリセット
      if (currentMessageId === messageId) {
        setCurrentMessageId(null);
        setDesign({
          name: "",
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: []
          }
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "削除エラー",
        description: "メッセージの削除に失敗しました",
        variant: "destructive",
      });
    }
  };

  const newMessage = () => {
    setCurrentMessageId(null);
    setDesign({
      name: "",
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: []
      }
    });
    toast({
      title: "新規作成",
      description: "新しいメッセージを作成します",
    });
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              ダッシュボードに戻る
            </Button>
            <h1 className="text-2xl font-bold">Flexメッセージデザイナー</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* 左側：デザイナー */}
          <div className="space-y-6 w-96 flex-shrink-0">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      メッセージデザイナー
                    </CardTitle>
                    <CardDescription>
                      ドラッグ&ドロップで要素を並び替えできます
                    </CardDescription>
                  </div>
                  <Button onClick={newMessage} variant="outline" size="sm">
                    新規作成
                  </Button>
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

                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => addElement('text')} size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-1" />
                      テキスト
                    </Button>
                    <Button onClick={() => addElement('image')} size="sm" variant="outline">
                      <Image className="w-4 h-4 mr-1" />
                      画像
                    </Button>
                    <Button onClick={() => addElement('button')} size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-1" />
                      ボタン
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
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={design.body.contents.map(item => item.id)}
                            strategy={verticalListSortingStrategy}
                          >
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
                      {loading ? "保存中..." : currentMessageId ? "上書き保存" : "新規保存"}
                    </Button>
                    <Button 
                      onClick={sendMessage} 
                      disabled={loading}
                      className="bg-[#06c755] hover:bg-[#05b84c] text-white border-[#06c755]"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {loading ? "送信中..." : "LINE配信"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右側：プレビューと保存済みメッセージ一覧 */}
          <div className="space-y-6">
            {/* プレビュー画面 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  プレビュー
                </CardTitle>
                <CardDescription>
                  現在作成中のFlexメッセージのプレビューです
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded-lg p-4 min-h-[200px]">
                  {design.body.contents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">要素を追加するとプレビューが表示されます</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg shadow-sm border max-w-[280px] mx-auto">
                      <div>
                        {design.body.contents.map((element, index) => {
                          const isFirst = index === 0;
                          const isLast = index === design.body.contents.length - 1;
                          
                          return (
                            <div 
                              key={element.id} 
                              className="flex"
                              style={{
                                marginTop: !isFirst ? '15px' : undefined,
                                marginBottom: !isLast ? '15px' : undefined
                              }}
                            >
                              {element.type === 'text' && (
                                <div 
                                  className="flex-1"
                                  style={{
                                    color: element.properties.color || '#000000',
                                    backgroundColor: element.properties.backgroundColor !== '#ffffff' ? element.properties.backgroundColor : undefined,
                                    fontSize: element.properties.size === 'xs' ? '12px' : 
                                             element.properties.size === 'sm' ? '14px' :
                                             element.properties.size === 'lg' ? '18px' :
                                             element.properties.size === 'xl' ? '20px' : '16px',
                                    fontWeight: element.properties.weight === 'bold' ? 'bold' : 'normal',
                                    textAlign: element.properties.align as any || 'left',
                                    padding: element.properties.backgroundColor !== '#ffffff' ? '4px 8px' : undefined,
                                    borderRadius: element.properties.backgroundColor !== '#ffffff' ? '4px' : undefined,
                                    whiteSpace: 'pre-wrap'
                                  }}
                                >
                                  {element.properties.text || 'テキスト'}
                                </div>
                              )}
                              {element.type === 'image' && element.properties.url && (
                                <div className="flex-1">
                                  <img 
                                    src={element.properties.url} 
                                    alt="プレビュー画像" 
                                    className="w-full h-auto rounded"
                                    style={{
                                      aspectRatio: element.properties.aspectRatio?.replace(':', '/') || '20/13'
                                    }}
                                  />
                                </div>
                              )}
                              {element.type === 'button' && (
                                <div className="flex-1">
                                  <button 
                                    className="w-full rounded text-sm font-medium"
                                    style={{
                                      backgroundColor: element.properties.color || (
                                        element.properties.style === 'primary' ? '#0066cc' : 
                                        element.properties.style === 'secondary' ? '#f0f0f0' : 'transparent'
                                      ),
                                      color: element.properties.color ? 
                                        (element.properties.color === '#ffffff' || element.properties.color === '#f0f0f0' ? '#333' : 'white') :
                                        (element.properties.style === 'primary' ? 'white' : 
                                         element.properties.style === 'secondary' ? '#333' : '#0066cc'),
                                      border: element.properties.style === 'secondary' ? 'none' : 
                                              element.properties.style === 'link' ? 
                                                `1px solid ${element.properties.color || '#0066cc'}` : 'none',
                                      padding: element.properties.height === 'sm' ? '8px 16px' : 
                                               element.properties.height === 'lg' ? '16px 16px' : '12px 16px'
                                    }}
                                  >
                                    {element.properties.action?.label || 'ボタン'}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  保存済みメッセージ
                </CardTitle>
                <CardDescription>
                  保存したFlexメッセージの一覧です
                </CardDescription>
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