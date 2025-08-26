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
                      action: { ...(element.properties.action as PostbackAction), type: 'postback', data: e.t
