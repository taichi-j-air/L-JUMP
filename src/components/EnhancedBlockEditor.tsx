import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MediaLibrarySelector } from '@/components/MediaLibrarySelector';
import { supabase } from '@/integrations/supabase/client';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Type,
  Image,
  Video,
  List,
  Quote,
  Folder,
  GripVertical,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Bold,
  Italic,
  Underline,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  ChevronRight,
  AlertTriangle,
  MessageSquare,
  Link,
  Lightbulb,
  AlertCircle,
  FileText
} from 'lucide-react';

/* =========================
   Types
========================= */
export interface Block {
  id: string;
  type:
    | 'paragraph'
    | 'heading'
    | 'image'
    | 'video'
    | 'list'
    | 'code'
    | 'separator'
    | 'note'
    | 'dialogue'
    | 'button'
    | 'background'
    | 'form_embed';
  content: any;
  order: number;
}

/** 両対応にするため blocks と value を両方サポート */
interface EnhancedBlockEditorProps {
  blocks?: Block[];
  value?: Block[];
  onChange: (blocks: Block[]) => void;
  hideBackgroundBlockButton?: boolean; // 追加
  hideTemplateButton?: boolean;       // 追加
  requirePublicForms?: boolean;
}

/* =========================
   Button Templates (12個そのまま)
========================= */
const buttonTemplates = [
  {
    name: 'テンプレート1',
    text: '申し込みはこちら',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 16,
      textColor: '#212121',
      backgroundColor: '#FFF824',
      borderRadius: 50,
      shadow: false,
      borderEnabled: true,
      borderWidth: 2,
      borderColor: '#212121',
    }
  },
  {
    name: 'テンプレート2',
    text: '申し込みはこちら >',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 18,
      textColor: '#ffffff',
      backgroundColor: '#F07400',
      borderRadius: 6,
      shadow: true,
      borderEnabled: false,
    }
  },
  {
    name: 'テンプレート3',
    text: '申し込みはこちら',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 18,
      textColor: '#000000',
      backgroundColor: '#ffffff',
      borderRadius: 0,
      shadow: false,
      borderEnabled: true,
      borderWidth: 2,
      borderColor: '#000000',
    }
  },
  {
    name: 'テンプレート4',
    text: '申し込みはこちら',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 16,
      textColor: '#009DFF',
      backgroundColor: '#ffffff',
      borderRadius: 6,
      shadow: true,
      borderEnabled: true,
      borderWidth: 1,
      borderColor: '#009DFF',
    }
  },
  {
    name: 'テンプレート5',
    text: '申し込みはこちら',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 18,
      textColor: '#ffffff',
      backgroundColor: '#0CB386',
      borderRadius: 0,
      shadow: true,
      borderEnabled: false,
    }
  },
  {
    name: 'テンプレート6',
    text: '申し込みはこちら',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 18,
      textColor: '#ffffff',
      backgroundColor: '#EE4F4F',
      borderRadius: 6,
      shadow: true,
      borderEnabled: false,
    }
  },
  {
    name: 'テンプレート7',
    text: '申し込みはこちら',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 16,
      textColor: '#85B7FD',
      backgroundColor: '#F1FCFE',
      borderRadius: 0,
      shadow: true,
      borderEnabled: true,
      borderWidth: 2,
      borderColor: '#85B7FD',
    }
  },
  {
    name: 'テンプレート8',
    text: '申し込みはこちら',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 16,
      textColor: '#ffffff',
      backgroundColor: '#242424',
      borderRadius: 50,
      shadow: false,
      borderEnabled: false,
    }
  },
  {
    name: 'テンプレート9',
    text: '申し込みはこちら',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 16,
      textColor: '#ffffff',
      backgroundColor: '#EF8383',
      borderRadius: 50,
      shadow: false,
      borderEnabled: false,
    }
  },
  {
    name: 'テンプレート10',
    text: '申し込みはこちら',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 16,
      textColor: '#242424',
      backgroundColor: '#F0F0F0',
      borderRadius: 0,
      shadow: false,
      borderEnabled: true,
      borderWidth: 1,
      borderColor: '#242424',
    }
  },
  {
    name: 'テンプレート11',
    text: '申し込みはこちら',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 18,
      textColor: '#FF9300',
      backgroundColor: '#ffffff',
      borderRadius: 50,
      shadow: false,
      borderEnabled: true,
      borderWidth: 1,
      borderColor: '#FF9300',
    }
  },
  {
    name: 'テンプレート12',
    text: '申し込みはこちら',
    styles: {
      width: 'medium',
      alignment: 'center',
      height: 50,
      textSize: 16,
      textColor: '#ffffff',
      backgroundColor: '#C3AE88',
      borderRadius: 6,
      shadow: true,
      borderEnabled: false,
    }
  }
];

/* =========================
   Helpers
========================= */
const getHeadingDefaults = (style: number) => {
  switch (style) {
    case 1: return { color1: '#2589d0', color2: '#f2f2f2', color3: '#333333' };
    case 2: return { color1: '#80c8d1', color2: '#f4f4f4', color3: '#ffffff' };
    case 3: return { color1: '#ffca2c', color2: '#ffffff', color3: '#333333' };
    case 4: return { color1: '#494949', color2: '#7db4e6', color3: '#494949' };
    default: return { color1: '#2589d0', color2: '#f2f2f2', color3: '#333333' };
  }
};

const uid = () => Math.random().toString(36).slice(2);

/* =========================
   Component
========================= */
export const EnhancedBlockEditor: React.FC<EnhancedBlockEditorProps> = (props) => {
  // 両対応：blocks / value のどちらでも受ける
  const incomingBlocks: Block[] = useMemo(
    () =>
      Array.isArray(props.blocks)
        ? props.blocks
        : Array.isArray(props.value)
        ? props.value!
        : [],
    [props.blocks, props.value]
  );

  // map安全化 and sort
  const sortedBlocks: Block[] = useMemo(
    () =>
      Array.isArray(incomingBlocks)
        ? incomingBlocks
            .map(b => ({
              id: b?.id ?? uid(),
              type: b?.type ?? 'paragraph',
              order: typeof b?.order === 'number' ? b.order : 0,
              content: (b?.content && typeof b.content === 'object') ? b.content : {},
            }))
            .sort((a, b) => a.order - b.order)
        : [],
    [incomingBlocks]
  );

  const [expandedBlocks, setExpandedBlocks] = useState<string[]>([]);
  const [templateDialogOpenFor, setTemplateDialogOpenFor] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastAddedBlockTypeRef = useRef<Block['type'] | null>(null);
  const blockIds = useMemo(() => sortedBlocks.map(block => block.id), [sortedBlocks]);
  const hasBackgroundBlock = useMemo(() => sortedBlocks.some(block => block.type === 'background'), [sortedBlocks]);

  const [forms, setForms] = useState<Array<{ id: string; name: string; is_public?: boolean }>>([]);
  const availableForms = useMemo(
    () =>
      props.requirePublicForms
        ? forms.filter((form) => form.is_public)
        : forms,
    [forms, props.requirePublicForms]
  );

  useEffect(() => {
    const fetchForms = async () => {
      const query = supabase
        .from('forms')
        .select('id, name, is_public')
        .order('name', { ascending: true });
      const { data, error } = await query;
      if (!error) setForms((data as Array<{ id: string; name: string; is_public?: boolean }>) || []);
      else console.error('Error fetching forms:', error);
    };
    fetchForms();
  }, []);

  useEffect(() => {
    setExpandedBlocks(prev => (prev.length === 0 ? prev : prev.filter(id => blockIds.includes(id))));
  }, [blockIds]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    if (lastAddedBlockTypeRef.current === 'background') {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
    lastAddedBlockTypeRef.current = null;
  }, [sortedBlocks.length]);

  const emit = (next: Block[]) => props.onChange(Array.isArray(next) ? next : []);

  /* -------- CRUD -------- */
  const getDefaultContent = (type: Block['type']) => {
    const baseContent = { title: '' };
    switch (type) {
      case 'paragraph': return {
        ...baseContent, text: '', fontSize: '16px', color: '#454545', backgroundColor: 'transparent',
        bold: false, italic: false, underline: false, alignment: 'left'
      };
      case 'heading': return {
        ...baseContent, text: '', level: 1, design_style: 1,
        color1: '#2589d0', color2: '#f2f2f2', color3: '#333333',
        fontSize: '24px', color: '#454545', backgroundColor: 'transparent', bold: false, italic: false, underline: false, alignment: 'left'
      };
      case 'image': return {
        ...baseContent, url: '', alt: '', caption: '', size: 'medium',
        linkUrl: '', alignment: 'center', rounded: true, hoverEffect: false, removeMargins: false
      };
      case 'video': return {
        ...baseContent, url: '', caption: '', borderColor: '#000000', rounded: true, size: 'medium', borderEnabled: true
      };
      case 'list': return { ...baseContent, items: [''], type: 'bullet' };
      case 'code': return { ...baseContent, code: '', language: 'javascript' };
      case 'separator': return { ...baseContent };
      case 'form_embed': return {
        ...baseContent,
        formId: '',
        title: 'フォーム埋め込み',
        description: 'ここにフォームが埋め込まれます。',
        delayEnabled: false,
        delaySeconds: 0,
        delayHeadline: '',
        delayMessage: '',
        delayStyle: {
          headlineColor: '',
          headlineSize: '',
          messageColor: '',
          messageSize: '',
          timerColor: '',
          timerSize: '',
        },
        delayShowCountdown: true,
      };
      case 'note': return { ...baseContent, text: '', fontSize: '16px', color: '#454545', backgroundColor: 'transparent', bold: false, italic: false, underline: false, alignment: 'left' };
      case 'dialogue': return {
        ...baseContent, leftIcon: '/placeholder.svg', rightIcon: '/placeholder.svg',
        leftName: '左の名前', rightName: '右の名前', bubbleBackgroundColor: '#f2f2f2',
        items: [{ alignment: 'left', text: 'これは会話風の吹き出しです。' }]
      };
      case 'button': return {
        ...baseContent, text: 'ボタンテキスト', url: '', alignment: 'center', width: 'auto',
        height: 40, textColor: '#ffffff', textSize: 16, backgroundColor: '#2563eb',
        borderRadius: 6, shadow: true, borderEnabled: false, borderWidth: 1, borderColor: '#000000'
      };
      case 'background': return { ...baseContent, color: '#f5f5f5' };
      default: return { ...baseContent };
    }
  };

  const addBlock = (type: Block['type']) => {
    const newBlock: Block = { id: uid(), type, content: getDefaultContent(type), order: sortedBlocks.length };
    emit([...sortedBlocks, newBlock].map((b, i) => ({ ...b, order: i })));
    setExpandedBlocks(prev => (prev.includes(newBlock.id) ? prev : [...prev, newBlock.id]));
    lastAddedBlockTypeRef.current = type;
  };

  const updateBlock = (id: string, content: any) => {
    const updated = sortedBlocks.map(block => (block.id === id ? { ...block, content } : block));
    emit(updated);
  };

  const deleteBlock = (id: string) => {
    const newBlocks = sortedBlocks.filter(block => block.id !== id);
    emit(newBlocks.map((b, i) => ({ ...b, order: i })));
  };

  const duplicateBlock = (id: string) => {
    const blockToDuplicate = sortedBlocks.find(block => block.id === id);
    if (!blockToDuplicate) return;
    const newBlock: Block = { ...blockToDuplicate, id: uid(), order: (blockToDuplicate.order ?? 0) + 0.5 };
    const reorderedBlocks = [...sortedBlocks, newBlock]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((b, i) => ({ ...b, order: i }));
    emit(reorderedBlocks);
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const blockIndex = sortedBlocks.findIndex(block => block.id === id);
    if (blockIndex < 0) return;
    
    const newBlocks = [...sortedBlocks];
    const targetIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1;

    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;

    const isBackground = (i: number) => newBlocks[i]?.type === 'background';
    if (isBackground(blockIndex) || isBackground(targetIndex)) return;

    [newBlocks[blockIndex], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[blockIndex]];

    emit(newBlocks.map((b, i) => ({ ...b, order: i })));
  };

  const toggleCollapse = (id: string) => {
    setExpandedBlocks(prev => (prev.includes(id) ? prev.filter(blockId => blockId !== id) : [...prev, id]));
  };

  /* -------- DND Handlers -------- */
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sortedBlocks.findIndex((b) => b.id === active.id);
      const newIndex = sortedBlocks.findIndex((b) => b.id === over.id);
      
      if (sortedBlocks[oldIndex]?.type === 'background' || sortedBlocks[newIndex]?.type === 'background') {
        return;
      }

      const newBlocks = arrayMove(sortedBlocks, oldIndex, newIndex);
      emit(newBlocks.map((b, i) => ({ ...b, order: i })));
    }
  };

  /* -------- UI helpers -------- */
  const renderCollapsedPreview = (block: Block) => {
    const blockTypeMap: { [key: string]: string } = {
      paragraph: 'テキスト',
      heading: '見出し',
      image: '画像',
      video: '動画',
      list: 'リスト',
      code: 'コード',
      separator: '区切り線',
      note: '注意事項',
      dialogue: '対話',
      button: 'ボタン',
      background: '背景色',
      form_embed: 'フォーム埋め込み',
    };
    const typeName = blockTypeMap[block.type] || 'ブロック';
    const prefix = `${typeName}：`;

    let previewContent: string;

    if (block.content?.title) {
      previewContent = block.content.title;
    } else {
      switch (block.type) {
        case 'heading':
        case 'paragraph':
        case 'note':
          previewContent = block.content?.text ? (block.content.text.substring(0, 50) + (block.content.text.length > 50 ? '...' : '')) : '';
          break;
        case 'image':
          previewContent = block.content?.alt || block.content?.url?.substring(block.content.url.lastIndexOf('/') + 1) || '';
          break;
        case 'video':
          previewContent = block.content?.url || '';
          break;
        case 'list':
          previewContent = block.content?.items?.[0] ? (block.content.items[0].substring(0, 40) + (block.content.items[0].length > 40 ? '...' : '')) : '';
          break;
        case 'separator':
          previewContent = '区切り線';
          break;
        case 'dialogue':
          previewContent = block.content?.items?.[0]?.text ? (block.content.items[0].text.substring(0, 40) + (block.content.items[0].text.length > 40 ? '...' : '')) : '';
          break;
        case 'button':
          previewContent = block.content?.text || '';
          break;
        case 'background':
          previewContent = block.content?.color || '';
          break;
        case 'form_embed': {
          const formId = block.content?.formId;
          const formName =
            forms.find(form => form.id === formId)?.name ||
            block.content?.title ||
            block.content?.formName;
          const delayEnabled = block.content?.delayEnabled && (block.content?.delaySeconds ?? 0) > 0;
          const delayLabel = delayEnabled ? `（遅延${Math.floor(Number(block.content.delaySeconds) / 60)}分）` : '';
          previewContent = `${formName || formId || ''}${delayLabel}`;
          break;
        }
        default:
          previewContent = '...';
      }
    }
    return <p className="w-full truncate text-sm text-muted-foreground font-mono">{prefix}{previewContent}</p>;
  };

  const renderTextFormatting = (block: Block) => {
    if (block.type !== 'paragraph' && block.type !== 'heading' && block.type !== 'note') return null;

    return (
      <div className="flex flex-wrap gap-2 mb-2 p-2 bg-muted rounded-lg">
        <div className="flex items-center space-x-1 border-r pr-2">
          <Button size="sm" variant={block.content.bold ? "default" : "ghost"} className="h-8 w-8 p-0" onClick={() => updateBlock(block.id, { ...block.content, bold: !block.content.bold })}><Bold className="h-3 w-3" /></Button>
          <Button size="sm" variant={block.content.italic ? "default" : "ghost"} className="h-8 w-8 p-0" onClick={() => updateBlock(block.id, { ...block.content, italic: !block.content.italic })}><Italic className="h-3 w-3" /></Button>
          <Button size="sm" variant={block.content.underline ? "default" : "ghost"} className="h-8 w-8 p-0" onClick={() => updateBlock(block.id, { ...block.content, underline: !block.content.underline })}><Underline className="h-3 w-3" /></Button>
        </div>

        <div className="flex items-center space-x-1 border-r pr-2">
          <Button size="sm" variant={(block.content.alignment ?? 'left') === 'left' ? "default" : "ghost"} className="h-8 w-8 p-0" onClick={() => updateBlock(block.id, { ...block.content, alignment: 'left' })}><AlignLeft className="h-3 w-3" /></Button>
          <Button size="sm" variant={block.content.alignment === 'center' ? "default" : "ghost"} className="h-8 w-8 p-0" onClick={() => updateBlock(block.id, { ...block.content, alignment: 'center' })}><AlignCenter className="h-3 w-3" /></Button>
          <Button size="sm" variant={block.content.alignment === 'right' ? "default" : "ghost"} className="h-8 w-8 p-0" onClick={() => updateBlock(block.id, { ...block.content, alignment: 'right' })}><AlignRight className="h-3 w-3" /></Button>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => {
              const currentSize = parseInt(block.content.fontSize || '16') || 16;
              const newSize = Math.max(8, currentSize - 1); // min 8
              updateBlock(block.id, { ...block.content, fontSize: `${newSize}px` });
            }}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            type="number"
            placeholder="サイズ"
            value={parseInt(block.content.fontSize || '16') || 16}
            onChange={(e) => {
                const newSize = Math.max(8, Math.min(72, Number(e.target.value))); // min 8, max 72
                updateBlock(block.id, { ...block.content, fontSize: `${newSize}px` })
            }}
            className="w-16 h-8 text-center"
            min={8}
            max={72}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => {
              const currentSize = parseInt(block.content.fontSize || '16') || 16;
              const newSize = Math.min(72, currentSize + 1); // max 72
              updateBlock(block.id, { ...block.content, fontSize: `${newSize}px` });
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex items-center space-x-1">
          <Palette className="h-3 w-3" />
          <span className="text-xs">文字色:</span>
          <input type="color" value={block.content.color || '#000000'} onChange={(e) => updateBlock(block.id, { ...block.content, color: e.target.value })} className="w-8 h-8 rounded border" title="文字色" />
          <span className="text-xs ml-2">背景色:</span>
          <input type="color" value={block.content.backgroundColor || '#FFFFFF'} onChange={(e) => updateBlock(block.id, { ...block.content, backgroundColor: e.target.value })} className="w-8 h-8 rounded border" title="背景色" />
        </div>

        {block.type === 'heading' && (
          <div className="flex items-center space-x-2 border-l pl-2">
            <span className="text-xs font-medium">色1:</span>
            <input type="color" value={block.content.color1 || ''} onChange={(e) => updateBlock(block.id, { ...block.content, color1: e.target.value })} className="w-7 h-7 rounded border" />
            <span className="text-xs font-medium">色2:</span>
            <input type="color" value={block.content.color2 || ''} onChange={(e) => updateBlock(block.id, { ...block.content, color2: e.target.value })} className="w-7 h-7 rounded border" />
            <span className="text-xs font-medium">色3:</span>
            <input type="color" value={block.content.color3 || ''} onChange={(e) => updateBlock(block.id, { ...block.content, color3: e.target.value })} className="w-7 h-7 rounded border" />
          </div>
        )}
      </div>
    );
  };

  const renderBlockContent = (block: Block) => {
    const sizeClasses: { [key: string]: string } = { small: 'w-1/4', medium: 'w-1/2', large: 'w-3/4', full: 'w-full' };

    const textStyle = (block.type === 'paragraph' || block.type === 'heading' || block.type === 'note')
      ? ({
          fontSize: block.content.fontSize,
          color: block.content.color,
          backgroundColor: block.content.backgroundColor,
          fontWeight: block.content.bold ? 'bold' : 'normal',
          fontStyle: block.content.italic ? 'italic' : 'normal',
          textDecoration: block.content.underline ? 'underline' : 'none',
          textAlign: block.content.alignment || 'left'
        } as React.CSSProperties)
      : {};

    switch (block.type) {
      case 'background': {
        const colorValue = typeof block.content?.color === 'string' ? block.content.color : '#f5f5f5';
        const sanitizedColor = colorValue.startsWith('#') ? colorValue : `#${colorValue}`;
        const safeColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(sanitizedColor) ? sanitizedColor : '#f5f5f5';

        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>背景色</Label>
              <input
                type="color"
                value={safeColor}
                onChange={(e) => updateBlock(block.id, { ...(block.content || {}), color: e.target.value })}
                className="w-full h-16 rounded border"
              />
            </div>
            <div className="space-y-1">
              <Label>カラーコード</Label>
              <Input
                value={sanitizedColor}
                onChange={(e) => {
                  let value = e.target.value.trim();
                  value = value.startsWith('#') ? `#${value.slice(1).replace(/[^0-9a-fA-F]/g, '')}` : `#${value.replace(/[^0-9a-fA-F]/g, '')}`;
                  if (value.length > 7) value = value.slice(0, 7);
                  updateBlock(block.id, { ...(block.content || {}), color: value });
                }}
              />
            </div>
          </div>
        );
      }

      case 'paragraph':
        return (
          <div>
            {renderTextFormatting(block)}
            <Textarea
              placeholder="段落テキストを入力..."
              value={block.content.text || ''}
              onChange={(e) => updateBlock(block.id, { ...block.content, text: e.target.value })}
              rows={6}
              style={textStyle}
              data-block-id={block.id}
            />
          </div>
        );

      case 'heading': {
        const headingStyle = {
          '--heading-color-1': block.content.color1,
          '--heading-color-2': block.content.color2,
          '--heading-color-3': block.content.color3,
        } as React.CSSProperties;

        return (
          <div className="space-y-2">
            {renderTextFormatting(block)}
            <div className="flex space-x-2">
              <Select
                value={String(block.content.level ?? 1)}
                onValueChange={(value) => updateBlock(block.id, { ...block.content, level: parseInt(value) })}
              >
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="H Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">H1</SelectItem>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                  <SelectItem value="4">H4</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={String(block.content.design_style ?? 1)}
                onValueChange={(value) => {
                  const style = parseInt(value);
                  const defaults = getHeadingDefaults(style);
                  updateBlock(block.id, { ...block.content, design_style: style, ...defaults });
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="デザインを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">デザイン 1</SelectItem>
                  <SelectItem value="2">デザイン 2</SelectItem>
                  <SelectItem value="3">デザイン 3</SelectItem>
                  <SelectItem value="4">デザイン 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(block.content.design_style || 1) === 3 ? (
              <div className="flex items-center my-6" style={{ color: block.content.color3 || '#333333' }}>
                <div className="relative mr-4 flex-shrink-0">
                  <div
                    className="flex items-center justify-center rounded-full w-[25px] h-[25px]"
                    style={{ backgroundColor: block.content.color1 || '#ffca2c' }}
                  >
                    <Lightbulb size={15} color={block.content.color2 || 'white'} />
                  </div>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 left-[20px] w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-l-[12px]"
                    style={{ borderLeftColor: block.content.color1 || '#ffca2c' }}
                  />
                </div>
                <div
                  onBlur={e => updateBlock(block.id, { ...block.content, text: e.currentTarget.textContent || '' })}
                  contentEditable
                  suppressContentEditableWarning
                  className="w-full bg-transparent focus:outline-none"
                  style={textStyle}
                >{block.content.text || ''}</div>
              </div>
            ) : (
              <div
                className={`heading-style-${block.content.design_style || 1}`}
                style={headingStyle}
              >
                <div
                  onBlur={e => updateBlock(block.id, { ...block.content, text: e.currentTarget.textContent || '' })}
                  contentEditable
                  suppressContentEditableWarning
                  className="w-full bg-transparent focus:outline-none"
                  style={textStyle}
                >{block.content.text || ''}</div>
              </div>
            )}
          </div>
        );
      }

      case 'image':
        return (
          <div className="space-y-4">
            <MediaLibrarySelector
              trigger={<Button variant="outline">メディアライブラリから画像を選択</Button>}
              onSelect={(url) => updateBlock(block.id, { ...block.content, url })}
              selectedUrl={block.content.url}
            />

            {block.content.url && (
              <div className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-md flex justify-center">
                <img
                  src={block.content.url}
                  alt={block.content.alt || 'preview'}
                  className={`max-w-full h-auto rounded shadow-md ${sizeClasses[block.content.size] || 'w-1/2'}`}
                />
              </div>
            )}

            <div className="space-y-4 pt-2 border-t">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">配置</label>
                  <div className="flex items-center gap-1 rounded-md bg-muted p-1 w-fit">
                    <Button size="sm" variant={block.content.alignment === 'left' ? 'default' : 'ghost'} onClick={() => updateBlock(block.id, { ...block.content, alignment: 'left' })} className="h-8"><AlignLeft className="h-4 w-4" /></Button>
                    <Button size="sm" variant={block.content.alignment === 'center' || !block.content.alignment ? 'default' : 'ghost'} onClick={() => updateBlock(block.id, { ...block.content, alignment: 'center' })} className="h-8"><AlignCenter className="h-4 w-4" /></Button>
                    <Button size="sm" variant={block.content.alignment === 'right' ? 'default' : 'ghost'} onClick={() => updateBlock(block.id, { ...block.content, alignment: 'right' })} className="h-8"><AlignRight className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">サイズ</label>
                  <Select value={block.content.size || 'medium'} onValueChange={(value) => updateBlock(block.id, { ...block.content, size: value })}>
                    <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="サイズ" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">25%</SelectItem>
                      <SelectItem value="medium">50%</SelectItem>
                      <SelectItem value="large">75%</SelectItem>
                      <SelectItem value="full">100%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    オプション
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="p-0 flex items-center justify-center" onClick={(e) => e.preventDefault()}>
                            <AlertCircle className="h-4 w-4 text-white fill-gray-500" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs text-[11px] text-gray-600">
                          <ul className="list-disc pl-4 space-y-1 text-left">
                            <li><b>角丸:</b> 画像の四隅を丸くします。</li>
                            <li><b>ホバー:</b> マウスカーソルを画像に重ねた際に透明度を変更するエフェクトを追加します。</li>
                            <li><b>余白をなくす:</b> ページの左右の余白を無視して、画像を画面幅いっぱいに表示します。</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch id={`rounded-image-${block.id}`} checked={block.content.rounded !== false} onCheckedChange={(checked) => updateBlock(block.id, { ...block.content, rounded: checked })} />
                      <Label htmlFor={`rounded-image-${block.id}`} className="text-sm font-normal">角丸</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id={`hover-effect-${block.id}`} checked={!!block.content.hoverEffect} onCheckedChange={(checked) => updateBlock(block.id, { ...block.content, hoverEffect: checked })} />
                      <Label htmlFor={`hover-effect-${block.id}`} className="text-sm font-normal">ホバー</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id={`remove-margins-${block.id}`} checked={!!block.content.removeMargins} onCheckedChange={(checked) => updateBlock(block.id, { ...block.content, removeMargins: checked })} />
                      <Label htmlFor={`remove-margins-${block.id}`} className="text-sm font-normal">余白をなくす</Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <label className="text-sm font-medium flex items-center gap-1">
                リンクとテキスト
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="p-0 flex items-center justify-center" onClick={(e) => e.preventDefault()}>
                        <AlertCircle className="h-4 w-4 text-white fill-gray-500" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs text-[11px] text-gray-600">
                      <ul className="list-disc pl-4 space-y-1 text-left">
                        <li><b>リンクURL:</b> 画像全体の遷移先。</li>
                        <li><b>代替テキスト:</b> 画像説明（SEO）。</li>
                        <li><b>キャプション:</b> 画像下の説明文。</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              <div className="flex items-center gap-2">
                <Link className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <Input type="url" placeholder="リンクURL (任意)" value={block.content.linkUrl || ''} onChange={(e) => updateBlock(block.id, { ...block.content, linkUrl: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex-shrink-0" />
                <Input placeholder="代替テキスト" value={block.content.alt || ''} onChange={(e) => updateBlock(block.id, { ...block.content, alt: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex-shrink-0" />
                <Input placeholder="キャプション" value={block.content.caption || ''} onChange={(e) => updateBlock(block.id, { ...block.content, caption: e.target.value })} />
              </div>
            </div>
          </div>
        );

      case 'separator':
        return <div className="py-2"><hr className="border-t-2 border-gray-300" /></div>;

      case 'note':
        return (
          <div>
            {renderTextFormatting(block)}
            <div className="note-box">
              <Textarea
                placeholder="注意事項を入力..."
                value={block.content.text || ''}
                onChange={(e) => updateBlock(block.id, { ...block.content, text: e.target.value })}
                className="w-full bg-transparent focus:ring-0 border-0 p-0"
                style={textStyle}
              />
            </div>
          </div>
        );

      case 'list':
        return (
          <div className="space-y-2">
            <Select value={block.content.type || 'bullet'} onValueChange={(value) => updateBlock(block.id, { ...block.content, type: value })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bullet">箇条書き</SelectItem>
                <SelectItem value="numbered">番号付き</SelectItem>
              </SelectContent>
            </Select>
            {(Array.isArray(block.content.items) ? block.content.items : []).map((item: string, index: number) => (
              <div key={index} className="flex space-x-2">
                <Input
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(Array.isArray(block.content.items) ? block.content.items : [])];
                    newItems[index] = e.target.value;
                    updateBlock(block.id, { ...block.content, items: newItems });
                  }}
                  placeholder={`項目 ${index + 1}`}
                />
                <Button size="sm" variant="outline" onClick={() => {
                  const newItems = (Array.isArray(block.content.items) ? block.content.items : []).filter((_: any, i: number) => i !== index);
                  updateBlock(block.id, { ...block.content, items: newItems });
                }}>削除</Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => {
              const newItems = [...(Array.isArray(block.content.items) ? block.content.items : []), ''];
              updateBlock(block.id, { ...block.content, items: newItems });
            }}>項目を追加</Button>
          </div>
        );

      case 'code':
        return (
          <div className="space-y-2">
            <Select value={block.content.language || 'javascript'} onValueChange={(value) => updateBlock(block.id, { ...block.content, language: value })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="typescript">TypeScript</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="css">CSS</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="sql">SQL</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="コードを入力..."
              value={block.content.code || ''}
              onChange={(e) => updateBlock(block.id, { ...block.content, code: e.target.value })}
              rows={8}
              className="font-mono"
            />
          </div>
        );

      case 'form_embed': {
        const selectedForm = forms.find(f => f.id === block.content.formId);
        const selectedFormAvailable = !!availableForms.find(f => f.id === block.content.formId);
        const extraForms = (!selectedFormAvailable && selectedForm) ? [selectedForm] : [];
        const totalDelaySeconds = Number(block.content?.delaySeconds) || 0;
        const delayEnabled = !!block.content?.delayEnabled && totalDelaySeconds > 0;
        const delayMinutes = Math.floor(totalDelaySeconds / 60);
        const delaySeconds = totalDelaySeconds % 60;
        const rawDelayStyle = (block.content?.delayStyle && typeof block.content.delayStyle === 'object')
          ? block.content.delayStyle
          : {};
        const headlineColor = typeof rawDelayStyle.headlineColor === 'string'
          ? rawDelayStyle.headlineColor
          : (typeof rawDelayStyle.labelColor === 'string' ? rawDelayStyle.labelColor : '');
        const headlineSize = typeof rawDelayStyle.headlineSize === 'string'
          ? rawDelayStyle.headlineSize
          : (typeof rawDelayStyle.labelSize === 'string' ? rawDelayStyle.labelSize : '');
        const messageColor = typeof rawDelayStyle.messageColor === 'string'
          ? rawDelayStyle.messageColor
          : (typeof rawDelayStyle.labelColor === 'string' ? rawDelayStyle.labelColor : '');
        const messageSize = typeof rawDelayStyle.messageSize === 'string'
          ? rawDelayStyle.messageSize
          : (typeof rawDelayStyle.labelSize === 'string' ? rawDelayStyle.labelSize : '');
        const timerColor = typeof rawDelayStyle.timerColor === 'string' ? rawDelayStyle.timerColor : '';
        const timerSize = typeof rawDelayStyle.timerSize === 'string' ? rawDelayStyle.timerSize : '';
        const updateDelayStyle = (partial: Record<string, string>) => {
          const nextStyle = { ...(rawDelayStyle as Record<string, string>), ...partial };
          delete nextStyle.labelColor;
          delete nextStyle.labelSize;
          updateBlock(block.id, { ...block.content, delayStyle: nextStyle });
        };
        return (
          <div className="space-y-2">
            <Label>埋め込むフォームを選択</Label>
            <Select
              value={block.content.formId || ''}
              onValueChange={(value) => {
                const nextForm = forms.find(f => f.id === value);
                updateBlock(block.id, {
                  ...block.content,
                  formId: value,
                  title: nextForm?.name || 'フォーム埋め込み',
                  formName: nextForm?.name || '',
                });
              }}
              disabled={props.requirePublicForms && availableForms.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={props.requirePublicForms ? '外部公開済みフォームを選択' : 'フォームを選択'} />
              </SelectTrigger>
              <SelectContent>
                {availableForms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
                {extraForms.map((form) => (
                  <SelectItem key={`non-public-${form.id}`} value={form.id} disabled>
                    {form.name}（外部公開オフ）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {props.requirePublicForms && availableForms.length === 0 && (
              <p className="text-sm text-muted-foreground">
                外部公開済みのフォームがありません。フォーム管理で「外部公開」をオンにするとここに表示されます。
              </p>
            )}
            {props.requirePublicForms && block.content.formId && !selectedFormAvailable && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" aria-hidden="true" />
                <p className="text-sm leading-snug text-destructive">
                  このフォームは外部公開がオフのためページには表示されません。フォーム編集画面で「外部公開」をオンにしてください。
                </p>
              </div>
            )}
            {block.content.formId ? (
              <p className="text-sm text-muted-foreground">
                選択されたフォーム: {selectedForm?.name || block.content.formName || block.content.formId}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">フォームを選択してください。</p>
            )}
            <div className="pt-3 border-t border-dashed mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">表示を遅らせる</Label>
                <Switch
                  id={`form-delay-${block.id}`}
                  checked={!!block.content.delayEnabled}
                  onCheckedChange={(checked) => {
                    const nextSeconds = checked ? (totalDelaySeconds > 0 ? totalDelaySeconds : 600) : 0;
                    updateBlock(block.id, {
                      ...block.content,
                      delayEnabled: checked,
                      delaySeconds: nextSeconds,
                    });
                  }}
                />
              </div>
              {block.content.delayEnabled && (
                <div className="space-y-3 rounded-md bg-muted/40 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">待機時間（分）</Label>
                      <Input
                        type="number"
                        min={0}
                        value={delayMinutes}
                        onChange={(e) => {
                          const minutes = Math.max(0, parseInt(e.target.value || '0', 10));
                          const nextSeconds = minutes * 60 + delaySeconds;
                          updateBlock(block.id, { ...block.content, delaySeconds: nextSeconds });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">待機時間（秒）</Label>
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        value={delaySeconds}
                        onChange={(e) => {
                          const seconds = Math.min(59, Math.max(0, parseInt(e.target.value || '0', 10)));
                          const nextSeconds = delayMinutes * 60 + seconds;
                          updateBlock(block.id, { ...block.content, delaySeconds: nextSeconds });
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">待機中に表示するヘッドライン（未入力でデフォルト文言）</Label>
                    <Input
                      value={block.content.delayHeadline || ''}
                      onChange={(e) => updateBlock(block.id, { ...block.content, delayHeadline: e.target.value })}
                      placeholder="例：まもなくフォームが表示されます"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center justify-between">
                        ヘッドライン色
                        {headlineColor && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1 text-xs"
                            onClick={() => updateDelayStyle({ headlineColor: '' })}
                          >
                            クリア
                          </Button>
                        )}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={headlineColor || '#222222'}
                          onChange={(e) => updateDelayStyle({ headlineColor: e.target.value })}
                          className="h-10 w-14 p-1"
                        />
                        <Input
                          value={headlineColor}
                          onChange={(e) => updateDelayStyle({ headlineColor: e.target.value })}
                          placeholder="#222222"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center justify-between">
                        ヘッドラインサイズ（px）
                        {headlineSize && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1 text-xs"
                            onClick={() => updateDelayStyle({ headlineSize: '' })}
                          >
                            クリア
                          </Button>
                        )}
                      </Label>
                      <Input
                        type="number"
                        min={10}
                        max={72}
                        value={headlineSize}
                        onChange={(e) => updateDelayStyle({ headlineSize: e.target.value })}
                        placeholder="例: 20"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">待機中に表示するテキスト（{`{time}`} が残り時間に置き換わります）</Label>
                    <Input
                      value={block.content.delayMessage || ''}
                      onChange={(e) => updateBlock(block.id, { ...block.content, delayMessage: e.target.value })}
                      placeholder="例：フォームはあと {time} で表示されます"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center justify-between">
                        本文色
                        {messageColor && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1 text-xs"
                            onClick={() => updateDelayStyle({ messageColor: '' })}
                          >
                            クリア
                          </Button>
                        )}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={messageColor || '#555555'}
                          onChange={(e) => updateDelayStyle({ messageColor: e.target.value })}
                          className="h-10 w-14 p-1"
                        />
                        <Input
                          value={messageColor}
                          onChange={(e) => updateDelayStyle({ messageColor: e.target.value })}
                          placeholder="#555555"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center justify-between">
                        本文サイズ（px）
                        {messageSize && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1 text-xs"
                            onClick={() => updateDelayStyle({ messageSize: '' })}
                          >
                            クリア
                          </Button>
                        )}
                      </Label>
                      <Input
                        type="number"
                        min={10}
                        max={72}
                        value={messageSize}
                        onChange={(e) => updateDelayStyle({ messageSize: e.target.value })}
                        placeholder="例: 16"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center justify-between">
                        カウントダウン色
                        {timerColor && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1 text-xs"
                            onClick={() => updateDelayStyle({ timerColor: '' })}
                          >
                            クリア
                          </Button>
                        )}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={timerColor || '#0cb386'}
                          onChange={(e) => updateDelayStyle({ timerColor: e.target.value })}
                          className="h-10 w-14 p-1"
                        />
                        <Input
                          value={timerColor}
                          onChange={(e) => updateDelayStyle({ timerColor: e.target.value })}
                          placeholder="#0cb386"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center justify-between">
                        カウントダウンサイズ（px）
                        {timerSize && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1 text-xs"
                            onClick={() => updateDelayStyle({ timerSize: '' })}
                          >
                            クリア
                          </Button>
                        )}
                      </Label>
                      <Input
                        type="number"
                        min={14}
                        max={96}
                        value={timerSize}
                        onChange={(e) => updateDelayStyle({ timerSize: e.target.value })}
                        placeholder="例: 32"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`form-delay-countdown-${block.id}`}
                      checked={block.content.delayShowCountdown !== false}
                      onCheckedChange={(checked) => updateBlock(block.id, { ...block.content, delayShowCountdown: checked })}
                    />
                    <Label htmlFor={`form-delay-countdown-${block.id}`} className="text-sm font-normal">デジタルカウントダウンを表示</Label>
                  </div>
                  {delayEnabled && (
                    <p className="text-xs text-muted-foreground">
                      現在の設定: 約 {delayMinutes}分{delaySeconds.toString().padStart(2, '0')}秒 後にフォームを表示
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'video': {
        const convertYouTubeUrl = (url: string) => {
          const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
          const match = (url || '').match(youtubeRegex);
          if (match) return `https://www.youtube.com/embed/${match[1]}`;
          return url;
        };

        return (
          <div className="space-y-2">
            <Input placeholder="動画URL (YouTube対応)" value={block.content.url || ''} onChange={(e) => updateBlock(block.id, { ...block.content, url: e.target.value })} />
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">サイズ</Label>
                <Select value={block.content.size || 'medium'} onValueChange={(value) => updateBlock(block.id, { ...block.content, size: value })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="サイズ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">25%</SelectItem>
                    <SelectItem value="medium">50%</SelectItem>
                    <SelectItem value="large">75%</SelectItem>
                    <SelectItem value="full">100%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch id={`border-video-${block.id}`} checked={block.content.borderEnabled !== false} onCheckedChange={(checked) => updateBlock(block.id, { ...block.content, borderEnabled: checked })} />
                  <Label htmlFor={`border-video-${block.id}`} className="text-sm font-normal">枠線</Label>
                </div>
                {block.content.borderEnabled !== false && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">枠線色</Label>
                    <input type="color" value={block.content.borderColor || '#000000'} onChange={(e) => updateBlock(block.id, { ...block.content, borderColor: e.target.value })} className="w-10 h-10 rounded border p-1" />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch id={`rounded-video-${block.id}`} checked={block.content.rounded !== false} onCheckedChange={(checked) => updateBlock(block.id, { ...block.content, rounded: checked })} />
                <Label htmlFor={`rounded-video-${block.id}`} className="text-sm font-normal">角丸</Label>
              </div>
            </div>
            {block.content.url && (
              <div className={`mx-auto ${sizeClasses[block.content.size] || 'w-1/2'}`}>
                <div className="aspect-video w-full">
                  <iframe
                    src={convertYouTubeUrl(block.content.url)}
                    className="w-full h-full rounded-lg"
                    style={{ border: block.content.borderEnabled !== false ? `3px solid ${block.content.borderColor || '#000000'}` : 'none' }}
                    allowFullScreen
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-1 mt-4">
              <Label>キャプション</Label>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-green-500 rounded-full w-3 h-3 flex items-center justify-center cursor-help">
                      <span className="text-white text-[9px] font-bold">?</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs text-gray-600">
                      ・動画の下に表示される小さな文字です.<br />
                      ・動画のタイトルや補足テキストを入力してください.<br />
                      ・未入力でも大丈夫です
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input placeholder="キャプション" value={block.content.caption || ''} onChange={(e) => updateBlock(block.id, { ...block.content, caption: e.target.value })} />
          </div>
        );
      }

      case 'dialogue':
        return (
          <div className="space-y-4 p-3 bg-gray-50/50 dark:bg-gray-800/20 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">左キャラクター</label>
                <MediaLibrarySelector
                  trigger={
                    <Button variant="outline" className="w-full">
                      <Image className="h-4 w-4 mr-2" />
                      アイコンを選択
                    </Button>
                  }
                  onSelect={(url) => updateBlock(block.id, { ...block.content, leftIcon: url })}
                  selectedUrl={block.content.leftIcon}
                />
                {block.content.leftIcon && <img src={block.content.leftIcon} alt="left icon" className="w-16 h-16 rounded-full object-cover mx-auto" />}
                <Input
                  placeholder="名前"
                  value={block.content.leftName || ''}
                  onChange={(e) => updateBlock(block.id, { ...block.content, leftName: e.target.value })}
                  className="mt-2 text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">右キャラクター</label>
                <MediaLibrarySelector
                  trigger={
                    <Button variant="outline" className="w-full">
                      <Image className="h-4 w-4 mr-2" />
                      アイコンを選択
                    </Button>
                  }
                  onSelect={(url) => updateBlock(block.id, { ...block.content, rightIcon: url })}
                  selectedUrl={block.content.rightIcon}
                />
                {block.content.rightIcon && <img src={block.content.rightIcon} alt="right icon" className="w-16 h-16 rounded-full object-cover mx-auto" />}
                <Input
                  placeholder="名前"
                  value={block.content.rightName || ''}
                  onChange={(e) => updateBlock(block.id, { ...block.content, rightName: e.target.value })}
                  className="mt-2 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">吹き出し背景色:</label>
              <input type="color" value={block.content.bubbleBackgroundColor || '#f2f2f2'} onChange={(e) => updateBlock(block.id, { ...block.content, bubbleBackgroundColor: e.target.value })} className="w-8 h-8 rounded border" />
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">会話</label>
              {(Array.isArray(block.content.items) ? block.content.items : []).map((item: any, index: number) => (
                <div key={index} className="flex items-start gap-2 p-2 rounded-md border bg-white dark:bg-gray-900/50">
                  <img src={item.alignment === 'left' ? block.content.leftIcon || '/placeholder.svg' : block.content.rightIcon || '/placeholder.svg'} alt="icon preview" className="w-10 h-10 rounded-full object-cover mt-1" />
                  <div className="flex-1 space-y-2">
                    <Textarea
                      placeholder="テキスト..."
                      value={item.text || ''}
                      onChange={(e) => {
                        const newItems = [...(Array.isArray(block.content.items) ? block.content.items : [])];
                        newItems[index] = { ...item, text: e.target.value };
                        updateBlock(block.id, { ...block.content, items: newItems });
                      }}
                      rows={3}
                      className="w-full text-sm"
                    />
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1 rounded-md p-0.5">
                        <Button size="sm" variant={item.alignment === 'left' ? 'secondary' : 'ghost'} className="h-7" onClick={() => {
                          const newItems = [...(Array.isArray(block.content.items) ? block.content.items : [])];
                          newItems[index] = { ...item, alignment: 'left' };
                          updateBlock(block.id, { ...block.content, items: newItems });
                        }}>左</Button>
                        <Button size="sm" variant={item.alignment === 'right' ? 'secondary' : 'ghost'} className="h-7" onClick={() => {
                          const newItems = [...(Array.isArray(block.content.items) ? block.content.items : [])];
                          newItems[index] = { ...item, alignment: 'right' };
                          updateBlock(block.id, { ...block.content, items: newItems });
                        }}>右</Button>
                      </div>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7" onClick={() => {
                        const newItems = (Array.isArray(block.content.items) ? block.content.items : []).filter((_: any, i: number) => i !== index);
                        updateBlock(block.id, { ...block.content, items: newItems });
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => {
                  const newItems = [...(Array.isArray(block.content.items) ? block.content.items : []), { alignment: 'left', text: '' }];
                  updateBlock(block.id, { ...block.content, items: newItems });
                }}><Plus className="h-4 w-4 mr-1" /> 左向きを追加</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const newItems = [...(Array.isArray(block.content.items) ? block.content.items : []), { alignment: 'right', text: '' }];
                  updateBlock(block.id, { ...block.content, items: newItems });
                }}><Plus className="h-4 w-4 mr-1" /> 右向きを追加</Button>
              </div>
            </div>
          </div>
        );

      case 'button': {
        const buttonStyle: React.CSSProperties = {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 1.5rem',
          textDecoration: 'none',
          fontWeight: 600,
          color: block.content.textColor || '#ffffff',
          backgroundColor: block.content.backgroundColor || '#2563eb',
          borderRadius: `${block.content.borderRadius ?? 6}px`,
          fontSize: `${block.content.textSize || 16}px`,
          height: `${block.content.height || 40}px`,
          transition: 'opacity 0.2s',
        };

        // 予備: 将来グラデーション名のテンプレを追加したとき用
        if (block.content.template === 'グラデーション (紫)') {
          (buttonStyle as any).background = 'linear-gradient(to right, #9333ea, #4f46e5)';
        }

        if (block.content.shadow) {
          buttonStyle.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)';
        }

        if (block.content.width === 'full') {
          buttonStyle.width = '100%';
        } else if (block.content.width === 'medium') {
          buttonStyle.width = '75%';
        }

        if (block.content.borderEnabled) {
          buttonStyle.border = `${block.content.borderWidth || 1}px solid ${block.content.borderColor || '#000000'}`;
        }

        return (
          <div className="space-y-3">
            <Dialog open={templateDialogOpenFor === block.id} onOpenChange={(isOpen) => setTemplateDialogOpenFor(isOpen ? block.id : null)}>
              <DialogTrigger asChild>
                <Button variant="default" className="w-full">テンプレートからデザインを選択</Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl">
                <DialogHeader>
                  <DialogTitle>デザインテンプレートを選択</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                  {buttonTemplates.map((template) => {
                    const templateStyle: React.CSSProperties = {
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 1.5rem',
                      textDecoration: 'none',
                      fontWeight: 600,
                      color: template.styles.textColor,
                      borderRadius: `${template.styles.borderRadius ?? 6}px`,
                      fontSize: `${template.styles.textSize || 16}px`,
                      height: `${template.styles.height || 40}px`,
                      width: '100%',
                      backgroundColor: template.styles.backgroundColor,
                      ...(template.styles.shadow
                        ? { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }
                        : {})
                    };
                    if (template.styles.borderEnabled) {
                      (templateStyle as any).border = `${template.styles.borderWidth || 1}px solid ${template.styles.borderColor || '#000000'}`;
                    }

                    return (
                      <div key={template.name} className="space-y-2">
                        <button
                          style={templateStyle}
                          onClick={() => {
                            updateBlock(block.id, { ...block.content, ...template.styles, text: template.text, template: template.name });
                            setTemplateDialogOpenFor(null);
                          }}
                        >
                          {template.text}
                        </button>
                        <p className="text-center text-xs text-muted-foreground">{template.name}</p>
                      </div>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>

            {/* Preview */}
            <div className="my-3 p-3 rounded-md bg-muted flex items-center justify-center">
              <div style={buttonStyle}>
                {block.content.text || 'ボタンテキスト'}
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-1">
              <Label>ボタンテキスト</Label>
              <Input
                placeholder="例：詳しくはこちら"
                value={block.content.text || ''}
                onChange={(e) => updateBlock(block.id, { ...block.content, text: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>リンクURL</Label>
              <Input
                type="url"
                placeholder="https://example.com"
                value={block.content.url || ''}
                onChange={(e) => updateBlock(block.id, { ...block.content, url: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>配置</Label>
                <Select value={block.content.alignment || 'center'} onValueChange={(value) => updateBlock(block.id, { ...block.content, alignment: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">左寄せ</SelectItem>
                    <SelectItem value="center">中央</SelectItem>
                    <SelectItem value="right">右寄せ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>幅</Label>
                <Select value={block.content.width || 'auto'} onValueChange={(value) => updateBlock(block.id, { ...block.content, width: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自動</SelectItem>
                    <SelectItem value="medium">中間</SelectItem>
                    <SelectItem value="full">最大幅</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>高さ (px)</Label>
                <Input type="number" value={block.content.height ?? 40} onChange={(e) => updateBlock(block.id, { ...block.content, height: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>文字サイズ (px)</Label>
                <Input type="number" value={block.content.textSize ?? 16} onChange={(e) => updateBlock(block.id, { ...block.content, textSize: Number(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>文字色</Label>
                <input type="color" value={block.content.textColor || '#ffffff'} onChange={(e) => updateBlock(block.id, { ...block.content, textColor: e.target.value })} className="w-full h-10 rounded border" />
              </div>
              <div className="space-y-1">
                <Label>背景色</Label>
                <input type="color" value={block.content.backgroundColor || '#2563eb'} onChange={(e) => updateBlock(block.id, { ...block.content, backgroundColor: e.target.value })} className="w-full h-10 rounded border" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="space-y-1">
                <Label>角丸</Label>
                <Select value={String(block.content.borderRadius ?? 6)} onValueChange={(value) => updateBlock(block.id, { ...block.content, borderRadius: Number(value) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">なし (0px)</SelectItem>
                    <SelectItem value="6">標準 (6px)</SelectItem>
                    <SelectItem value="50">丸 (50px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-5">
                <Switch id={`shadow-${block.id}`} checked={block.content.shadow !== false} onCheckedChange={(checked) => updateBlock(block.id, { ...block.content, shadow: checked })} />
                <Label htmlFor={`shadow-${block.id}`}>影</Label>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t mt-3">
              <div className="flex items-center justify-between">
                <Label htmlFor={`border-${block.id}`}>枠線</Label>
                <Switch id={`border-${block.id}`} checked={!!block.content.borderEnabled} onCheckedChange={(checked) => updateBlock(block.id, { ...block.content, borderEnabled: checked })} />
              </div>
              {block.content.borderEnabled && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label>枠線 太さ (px)</Label>
                    <Input type="number" value={block.content.borderWidth ?? 1} onChange={(e) => updateBlock(block.id, { ...block.content, borderWidth: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>枠線 色</Label>
                    <input type="color" value={block.content.borderColor || '#000000'} onChange={(e) => updateBlock(block.id, { ...block.content, borderColor: e.target.value })} className="w-full h-10 rounded border" />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      default:
        return <div>Unknown block type</div>;
    }
  };

  /* =========================
     Render
  ========================= */
  return (
    <div className="relative min-h-[700px] h-[700px] max-h-[700px] flex flex-col border rounded-md bg-white">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 border border-gray-300" style={{ backgroundColor: '#ffffe0' }}>
        {sortedBlocks.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">ブロックを追加して記事を作成しましょう</p>
              <Button onClick={() => addBlock('paragraph')} >
                <Plus className="h-4 w-4 mr-2" />
                最初のブロックを追加
              </Button>
            </div>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blockIds}
            strategy={verticalListSortingStrategy}
          >
            {sortedBlocks.map(block => 
              <SortableBlockItem 
                key={block.id} 
                block={block}
                isCollapsed={!expandedBlocks.includes(block.id)}
                renderCollapsedPreview={renderCollapsedPreview}
                renderBlockContent={renderBlockContent}
                toggleCollapse={toggleCollapse}
                moveBlock={moveBlock}
                duplicateBlock={duplicateBlock}
                deleteBlock={deleteBlock}
                updateBlock={updateBlock}
                sortedBlocks={sortedBlocks}
              />
            )}
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex-none border-t border-gray-300 bg-background/95">
        <div className="p-2">
          <div className="grid grid-cols-6 gap-1">
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('heading')}><Type className="h-5 w-5 mb-1" /><span className="text-xs">見出し</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('paragraph')}><Type className="h-5 w-5 mb-1" /><span className="text-xs">テキスト</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('dialogue')}><MessageSquare className="h-5 w-5 mb-1" /><span className="text-xs">対話</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('note')}><AlertTriangle className="h-5 w-5 mb-1" /><span className="text-xs">注意事項</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('list')}><List className="h-5 w-5 mb-1" /><span className="text-xs">リスト</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('separator')}><Minus className="h-5 w-5 mb-1" /><span className="text-xs">区切り線</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('image')}><Image className="h-5 w-5 mb-1" /><span className="text-xs">画像</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('video')}><Video className="h-5 w-5 mb-1" /><span className="text-xs">動画</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('button')}><Link className="h-5 w-5 mb-1" /><span className="text-xs">ボタン</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('form_embed')}><FileText className="h-5 w-5 mb-1" /><span className="text-xs">フォーム</span></Button>
            {!props.hideBackgroundBlockButton && (
              <Button variant="ghost" className="flex flex-col h-auto py-2 hover:bg-[#0cb386] group" onClick={() => addBlock('background')} disabled={hasBackgroundBlock}>
                <Palette className="h-5 w-5 mb-1 text-[#0cb386] group-hover:text-white" />
                <span className="text-xs text-[#0cb386] group-hover:text-white">背景色</span>
              </Button>
            )}
            {!props.hideTemplateButton && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="flex flex-col h-auto py-2 hover:bg-[#0cb386] group">
                    <Folder className="h-5 w-5 mb-1 text-[#0cb386] group-hover:text-white" />
                    <span className="text-xs text-[#0cb386] group-hover:text-white">テンプレート</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>テンプレートを選択</DialogTitle>
                  </DialogHeader>
                  <p>ポップアップウィンドウの内容は後で指定されます。</p>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


interface SortableBlockItemProps {
  block: Block;
  isCollapsed: boolean;
  sortedBlocks: Block[];
  renderCollapsedPreview: (block: Block) => React.ReactNode;
  renderBlockContent: (block: Block) => React.ReactNode;
  toggleCollapse: (id: string) => void;
  moveBlock: (id: string, direction: 'up' | 'down') => void;
  duplicateBlock: (id: string) => void;
  deleteBlock: (id: string) => void;
  updateBlock: (id: string, content: any) => void;
}

const SortableBlockItem: React.FC<SortableBlockItemProps> = ({
  block,
  isCollapsed,
  sortedBlocks,
  renderCollapsedPreview,
  renderBlockContent,
  toggleCollapse,
  moveBlock,
  duplicateBlock,
  deleteBlock,
  updateBlock
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, disabled: block.type === 'background' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const blockIndex = sortedBlocks.findIndex(b => b.id === block.id);
  const isBackgroundBlock = block.type === 'background';
  const previousBlock = blockIndex > 0 ? sortedBlocks[blockIndex - 1] : undefined;
  const nextBlock = blockIndex >= 0 && blockIndex < sortedBlocks.length - 1 ? sortedBlocks[blockIndex + 1] : undefined;
  const canMoveUp = !isBackgroundBlock && blockIndex > 0 && previousBlock?.type !== 'background';
  const canMoveDown = !isBackgroundBlock && blockIndex < sortedBlocks.length - 1 && nextBlock?.type !== 'background';

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
      <Card key={block.id} className="mb-4 group bg-white dark:bg-gray-800 shadow-md border border-gray-300 rounded-sm">
        <CardContent className={isCollapsed ? "p-0" : "p-2"}>
          <div className="flex items-start space-x-2">
            <div className={`flex flex-col items-center space-y-1 ${isCollapsed ? 'pt-1' : 'pt-2'}`}>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveBlock(block.id, 'up')} disabled={!canMoveUp}><ChevronUp className="h-4 w-4" /></Button>
              <div {...attributes} {...listeners} className="cursor-grab">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveBlock(block.id, 'down')} disabled={!canMoveDown}><ChevronDown className="h-4 w-4" /></Button>
            </div>

            <div className={`flex-1 min-w-0 ${isCollapsed ? 'py-1' : 'p-2'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0 overflow-hidden">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 mr-2" onClick={() => toggleCollapse(block.id)}>
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  {isCollapsed && (
                    <div className="flex-1 min-w-0 overflow-hidden">
                      {renderCollapsedPreview(block)}
                    </div>
                  )}
                </div>
                <div className="flex space-x-1">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => duplicateBlock(block.id)} disabled={isBackgroundBlock}><Copy className="h-4 w-4" /></Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs text-gray-500">
                        <p>複製</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-white" onClick={() => deleteBlock(block.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs text-gray-500">
                        <p>削除</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              {!isCollapsed && (
                <div className="mt-2 space-y-4">
                  {block.type !== 'background' && (
                    <Input
                      placeholder="ブロックタイトル（任意）"
                      value={block.content?.title || ''}
                      onChange={(e) => updateBlock(block.id, { ...(block.content || {}), title: e.target.value })}
                      className="text-xs h-8 bg-slate-50"
                    />
                  )}
                  {renderBlockContent(block)}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}