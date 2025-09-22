import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaLibrarySelector } from '@/components/MediaLibrarySelector';
import { 
  Plus, 
  Type, 
  Image, 
  Video, 
  List, 
  Quote, 
  Code2,
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
  Lightbulb
} from 'lucide-react';

export interface Block {
  id: string;
  type: 'paragraph' | 'heading' | 'image' | 'video' | 'list' | 'quote' | 'code' | 'separator' | 'note' | 'dialogue';
  content: any;
  order: number;
}

interface EnhancedBlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

const getHeadingDefaults = (style: number) => {
  switch (style) {
    case 1:
      return { color1: '#2589d0', color2: '#f2f2f2', color3: '#333333' };
    case 2:
      return { color1: '#80c8d1', color2: '#f4f4f4', color3: '#ffffff' };
    case 3:
      return { color1: '#ffca2c', color2: '#ffffff', color3: '#333333' };
    case 4:
      return { color1: '#494949', color2: '#7db4e6', color3: '#494949' };
    default:
      return { color1: '#2589d0', color2: '#f2f2f2', color3: '#333333' };
  }
}

export const EnhancedBlockEditor: React.FC<EnhancedBlockEditorProps> = ({ blocks, onChange }) => {
  const [collapsedBlocks, setCollapsedBlocks] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [blocks.length]);

  const addBlock = (type: Block['type']) => {
    const newBlock: Block = {
      id: Math.random().toString(36),
      type,
      content: getDefaultContent(type),
      order: blocks.length
    };
    onChange([...blocks, newBlock]);
  };

  const updateBlock = (id: string, content: any) => {
    const updatedBlocks = blocks.map(block => 
      block.id === id ? { ...block, content } : block
    );
    onChange(updatedBlocks);
  };

  const deleteBlock = (id: string) => {
    const updatedBlocks = blocks.filter(block => block.id !== id);
    onChange(updatedBlocks);
  };

  const duplicateBlock = (id: string) => {
    const blockToDuplicate = blocks.find(block => block.id === id);
    if (blockToDuplicate) {
      const newBlock: Block = {
        ...blockToDuplicate,
        id: Math.random().toString(36),
        order: blockToDuplicate.order + 0.5
      };
      const reorderedBlocks = [...blocks, newBlock].sort((a, b) => a.order - b.order)
        .map((b, i) => ({ ...b, order: i }));
      onChange(reorderedBlocks);
    }
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const blockIndex = blocks.findIndex(block => block.id === id);
    if (
      (direction === 'up' && blockIndex > 0) ||
      (direction === 'down' && blockIndex < blocks.length - 1)
    ) {
      const newBlocks = [...blocks];
      const targetIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1;
      
      // Swap orders
      const tempOrder = newBlocks[blockIndex].order;
      newBlocks[blockIndex].order = newBlocks[targetIndex].order;
      newBlocks[targetIndex].order = tempOrder;

      onChange(newBlocks.sort((a, b) => a.order - b.order));
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsedBlocks(prev =>
      prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
    );
  };

  const getDefaultContent = (type: Block['type']) => {
    const baseContent = { title: '' };
    switch (type) {
      case 'paragraph': return { 
        ...baseContent,
        text: '', 
        fontSize: '16px', 
        color: '#454545', 
        backgroundColor: 'transparent',
        bold: false,
        italic: false,
        underline: false,
        alignment: 'left'
      };
      case 'heading': return { 
        ...baseContent,
        text: '', 
        level: 1, 
        design_style: 1,
        color1: '#2589d0',
        color2: '#f2f2f2',
        color3: '#333333',
        fontSize: '24px', 
        color: '#454545', 
        bold: false,
        italic: false,
        underline: false,
        alignment: 'left'
      };
      case 'image': return { 
        ...baseContent,
        url: '', 
        alt: '', 
        caption: '', 
        size: 'medium',
        linkUrl: '', 
        alignment: 'center',
        rounded: true,
        hoverEffect: false
      };
      case 'video': return { 
        ...baseContent,
        url: '', 
        caption: '', 
        borderColor: '#000000',
        rounded: true,
        size: 'medium'
      };
      case 'list': return { ...baseContent, items: [''], type: 'bullet' };
      case 'quote': return { ...baseContent, text: '', author: '', backgroundColor: '#f3f4f6' };
      case 'code': return { ...baseContent, code: '', language: 'javascript' };
      case 'separator': return { ...baseContent };
      case 'note': return {
        ...baseContent,
        text: '', 
        fontSize: '16px', 
        color: '#454545', 
        bold: false,
        italic: false,
        underline: false,
        alignment: 'left'
      };
      case 'dialogue': return {
        ...baseContent,
        leftIcon: '/placeholder.svg',
        rightIcon: '/placeholder.svg',
        leftName: '左の名前',
        rightName: '右の名前',
        bubbleBackgroundColor: '#f2f2f2',
        items: [
          { alignment: 'left', text: 'これは会話風の吹き出しです。' }
        ]
      };
      default: return { ...baseContent };
    }
  };

  const renderCollapsedPreview = (block: Block) => {
    const blockTypeMap: { [key: string]: string } = {
      paragraph: '段落',
      heading: '見出し',
      image: '画像',
      video: '動画',
      list: 'リスト',
      quote: '引用',
      code: 'コード',
      separator: '区切り線',
      note: '注意事項',
      dialogue: '対話',
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
        case 'quote':
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
        default:
          previewContent = '...';
      }
    }
    return <p className="text-sm text-muted-foreground truncate font-mono">{prefix}{previewContent}</p>;
  };

  const renderBlock = (block: Block) => {
    const isCollapsed = collapsedBlocks.includes(block.id);

    return (
      <Card key={block.id} className="mb-4 group bg-white dark:bg-gray-800 shadow-md">
        <CardContent className={isCollapsed ? "p-0" : "p-2"}>
          <div className="flex items-start space-x-2">
            <div className={`flex flex-col items-center space-y-1 ${isCollapsed ? 'pt-1' : 'pt-2'}`}>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveBlock(block.id, 'up')}><ChevronUp className="h-4 w-4" /></Button>
              <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveBlock(block.id, 'down')}><ChevronDown className="h-4 w-4" /></Button>
            </div>
            
            <div className={`flex-1 ${isCollapsed ? 'py-1' : 'p-2'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 mr-2" onClick={() => toggleCollapse(block.id)}>
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  {isCollapsed && renderCollapsedPreview(block)}
                </div>
                <div className="flex space-x-1">
                  <div className="flex space-x-1">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => duplicateBlock(block.id)}><Copy className="h-4 w-4" /></Button>
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
              </div>
              {!isCollapsed && (
                <div className="mt-2 space-y-4">
                  <Input
                    placeholder="ブロックタイトル（任意）"
                    value={block.content?.title || ''}
                    onChange={(e) => updateBlock(block.id, { ...(block.content || {}), title: e.target.value })}
                    className="text-xs h-8 bg-slate-50"
                  />
                  {renderBlockContent(block)}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
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
          <Button size="sm" variant={block.content.alignment === 'left' ? "default" : "ghost"} className="h-8 w-8 p-0" onClick={() => updateBlock(block.id, { ...block.content, alignment: 'left' })}><AlignLeft className="h-3 w-3" /></Button>
          <Button size="sm" variant={block.content.alignment === 'center' ? "default" : "ghost"} className="h-8 w-8 p-0" onClick={() => updateBlock(block.id, { ...block.content, alignment: 'center' })}><AlignCenter className="h-3 w-3" /></Button>
          <Button size="sm" variant={block.content.alignment === 'right' ? "default" : "ghost"} className="h-8 w-8 p-0" onClick={() => updateBlock(block.id, { ...block.content, alignment: 'right' })}><AlignRight className="h-3 w-3" /></Button>
        </div>

        <Input type="number" placeholder="サイズ" value={parseInt(block.content.fontSize) || 16} onChange={(e) => updateBlock(block.id, { ...block.content, fontSize: `${e.target.value}px` })} className="w-20 h-8" min="8" max="72" />
        
        <div className="flex items-center space-x-1">
          <Palette className="h-3 w-3" />
          <input type="color" value={block.content.color || '#000000'} onChange={(e) => updateBlock(block.id, { ...block.content, color: e.target.value })} className="w-8 h-8 rounded border" />
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
    const sizeClasses: { [key: string]: string } = {
      small: 'w-1/4',
      medium: 'w-1/2',
      large: 'w-3/4',
      full: 'w-full'
    };

    const textStyle = (block.type === 'paragraph' || block.type === 'heading' || block.type === 'note') ? {
      fontSize: block.content.fontSize,
      color: block.content.color,
      fontWeight: block.content.bold ? 'bold' : 'normal',
      fontStyle: block.content.italic ? 'italic' : 'normal',
      textDecoration: block.content.underline ? 'underline' : 'none',
      textAlign: block.content.alignment || 'left'
    } as React.CSSProperties : {};

    switch (block.type) {
      case 'paragraph':
        return (
          <div>
            {renderTextFormatting(block)}
            <Textarea
              placeholder="段落テキストを入力..."
              value={block.content.text}
              onChange={(e) => updateBlock(block.id, { ...block.content, text: e.target.value })}
              rows={3}
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
                value={block.content.level.toString()}
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
                value={block.content.design_style?.toString() || '1'}
                onValueChange={(value) => {
                  const style = parseInt(value);
                  const defaults = getHeadingDefaults(style);
                  updateBlock(block.id, { 
                    ...block.content, 
                    design_style: style,
                    ...defaults 
                  });
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
                  ></div>
                </div>
                <div
                  onBlur={e => updateBlock(block.id, { ...block.content, text: e.currentTarget.textContent || '' })}
                  contentEditable="true"
                  suppressContentEditableWarning={true}
                  className="w-full bg-transparent focus:outline-none"
                  style={textStyle}
                >{block.content.text}</div>
              </div>
            ) : (
              <div
                className={`heading-style-${block.content.design_style || 1}`}
                style={headingStyle}
              >
                <div
                  onBlur={e => updateBlock(block.id, { ...block.content, text: e.currentTarget.textContent || '' })}
                  contentEditable="true"
                  suppressContentEditableWarning={true}
                  className="w-full bg-transparent focus:outline-none"
                  style={textStyle}
                >{block.content.text}</div>
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">オプション</label>
                  <div className="flex items-center space-x-2">
                    <Switch id={`rounded-image-${block.id}`} checked={block.content.rounded !== false} onCheckedChange={(checked) => updateBlock(block.id, { ...block.content, rounded: checked })} />
                    <Label htmlFor={`rounded-image-${block.id}`} className="text-sm font-normal">角丸</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id={`hover-effect-${block.id}`} checked={!!block.content.hoverEffect} onCheckedChange={(checked) => updateBlock(block.id, { ...block.content, hoverEffect: checked })} />
                    <Label htmlFor={`hover-effect-${block.id}`} className="text-sm font-normal">ホバー</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">リンクURL (任意)</label>
                <div className="flex items-center gap-2">
                  <Link className="h-5 w-5 text-muted-foreground" />
                  <Input type="url" placeholder="https://example.com" value={block.content.linkUrl || ''} onChange={(e) => updateBlock(block.id, { ...block.content, linkUrl: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Input placeholder="代替テキスト (画像の簡単な説明)" value={block.content.alt || ''} onChange={(e) => updateBlock(block.id, { ...block.content, alt: e.target.value })} />
              <Input placeholder="キャプション (画像の下に表示されるテキスト)" value={block.content.caption || ''} onChange={(e) => updateBlock(block.id, { ...block.content, caption: e.target.value })} />
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
                value={block.content.text}
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
            <Select value={block.content.type} onValueChange={(value) => updateBlock(block.id, { ...block.content, type: value })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bullet">箇条書き</SelectItem>
                <SelectItem value="numbered">番号付き</SelectItem>
              </SelectContent>
            </Select>
            {block.content.items.map((item: string, index: number) => (
              <div key={index} className="flex space-x-2">
                <Input
                  value={item}
                  onChange={(e) => {
                    const newItems = [...block.content.items];
                    newItems[index] = e.target.value;
                    updateBlock(block.id, { ...block.content, items: newItems });
                  }}
                  placeholder={`項目 ${index + 1}`}
                />
                <Button size="sm" variant="outline" onClick={() => {
                  const newItems = block.content.items.filter((_: any, i: number) => i !== index);
                  updateBlock(block.id, { ...block.content, items: newItems });
                }}>削除</Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => {
              const newItems = [...block.content.items, ''];
              updateBlock(block.id, { ...block.content, items: newItems });
            }}>項目を追加</Button>
          </div>
        );
      
      case 'quote':
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm">背景色:</span>
              <input type="color" value={block.content.backgroundColor || '#f3f4f6'} onChange={(e) => updateBlock(block.id, { ...block.content, backgroundColor: e.target.value })} className="w-8 h-8 rounded border" />
            </div>
            <Textarea
              placeholder="引用テキスト"
              value={block.content.text}
              onChange={(e) => updateBlock(block.id, { ...block.content, text: e.target.value })}
              rows={3}
              style={{ backgroundColor: block.content.backgroundColor || '#f3f4f6' }}
            />
            <Input placeholder="引用元（オプション）" value={block.content.author} onChange={(e) => updateBlock(block.id, { ...block.content, author: e.target.value })} />
          </div>
        );
      
      case 'code':
        return (
          <div className="space-y-2">
            <Select value={block.content.language} onValueChange={(value) => updateBlock(block.id, { ...block.content, language: value })}>
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
              value={block.content.code}
              onChange={(e) => updateBlock(block.id, { ...block.content, code: e.target.value })}
              rows={8}
              className="font-mono"
            />
          </div>
        );
      
      case 'video':
        const convertYouTubeUrl = (url: string) => {
          const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
          const match = url.match(youtubeRegex);
          if (match) return `https://www.youtube.com/embed/${match[1]}`;
          return url;
        };

        return (
          <div className="space-y-2">
            <Input placeholder="動画URL (YouTube対応)" value={block.content.url} onChange={(e) => updateBlock(block.id, { ...block.content, url: e.target.value })} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm">枠線色:</span>
                <input type="color" value={block.content.borderColor || '#000000'} onChange={(e) => updateBlock(block.id, { ...block.content, borderColor: e.target.value })} className="w-8 h-8 rounded border" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id={`rounded-video-${block.id}`} checked={block.content.rounded !== false} onCheckedChange={(checked) => updateBlock(block.id, { ...block.content, rounded: checked })} />
                <Label htmlFor={`rounded-video-${block.id}`} className="text-sm">角丸</Label>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">サイズ</Label>
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
            </div>
            {block.content.url && (
              <div className="aspect-video">
                <iframe
                  src={convertYouTubeUrl(block.content.url)}
                  className="w-full h-full rounded-lg"
                  style={{ border: `3px solid ${block.content.borderColor || '#000000'}` }}
                  allowFullScreen
                />
              </div>
            )}
            <Input placeholder="キャプション" value={block.content.caption} onChange={(e) => updateBlock(block.id, { ...block.content, caption: e.target.value })} />
          </div>
        );
      
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
              {block.content.items.map((item: any, index: number) => (
                <div key={index} className="flex items-start gap-2 p-2 rounded-md border bg-white dark:bg-gray-900/50">
                  <img src={item.alignment === 'left' ? block.content.leftIcon || '/placeholder.svg' : block.content.rightIcon || '/placeholder.svg'} alt="icon preview" className="w-10 h-10 rounded-full object-cover mt-1" />
                  <div className="flex-1 space-y-2">
                    <Textarea 
                      placeholder="テキスト..."
                      value={item.text}
                      onChange={(e) => {
                        const newItems = [...block.content.items];
                        newItems[index] = { ...item, text: e.target.value };
                        updateBlock(block.id, { ...block.content, items: newItems });
                      }}
                      rows={3}
                      className="w-full text-sm"
                    />
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1 rounded-md p-0.5">
                        <Button size="sm" variant={item.alignment === 'left' ? 'secondary' : 'ghost'} className="h-7" onClick={() => {
                          const newItems = [...block.content.items];
                          newItems[index] = { ...item, alignment: 'left' };
                          updateBlock(block.id, { ...block.content, items: newItems });
                        }}>左</Button>
                        <Button size="sm" variant={item.alignment === 'right' ? 'secondary' : 'ghost'} className="h-7" onClick={() => {
                          const newItems = [...block.content.items];
                          newItems[index] = { ...item, alignment: 'right' };
                          updateBlock(block.id, { ...block.content, items: newItems });
                        }}>右</Button>
                      </div>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7" onClick={() => {
                        const newItems = block.content.items.filter((_: any, i: number) => i !== index);
                        updateBlock(block.id, { ...block.content, items: newItems });
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => {
                  const newItems = [...block.content.items, { alignment: 'left', text: '' }];
                  updateBlock(block.id, { ...block.content, items: newItems });
                }}><Plus className="h-4 w-4 mr-1" /> 左向きを追加</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const newItems = [...block.content.items, { alignment: 'right', text: '' }];
                  updateBlock(block.id, { ...block.content, items: newItems });
                }}><Plus className="h-4 w-4 mr-1" /> 右向きを追加</Button>
              </div>
            </div>
          </div>
        );
      
      default:
        return <div>Unknown block type</div>;
    }
  };

  return (
    <div className="relative h-[70vh] flex flex-col border rounded-md bg-white">
      <div ref={scrollContainerRef} className="flex-grow overflow-y-auto p-4 border border-gray-300" style={{ backgroundColor: '#ffffe0' }}>
        {blocks.length === 0 && (
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

        {blocks.sort((a, b) => a.order - b.order).map(renderBlock)}
      </div>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border border-gray-300 z-10">
        <div className="p-2">
          <div className="grid grid-cols-5 gap-1">
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('paragraph')}><Type className="h-5 w-5 mb-1" /><span className="text-xs">段落</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('heading')}><Type className="h-5 w-5 mb-1" /><span className="text-xs">見出し</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('image')}><Image className="h-5 w-5 mb-1" /><span className="text-xs">画像</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('video')}><Video className="h-5 w-5 mb-1" /><span className="text-xs">動画</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('list')}><List className="h-5 w-5 mb-1" /><span className="text-xs">リスト</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('quote')}><Quote className="h-5 w-5 mb-1" /><span className="text-xs">引用</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('code')}><Code2 className="h-5 w-5 mb-1" /><span className="text-xs">コード</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('separator')}><Minus className="h-5 w-5 mb-1" /><span className="text-xs">区切り線</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('note')}><AlertTriangle className="h-5 w-5 mb-1" /><span className="text-xs">注意事項</span></Button>
            <Button variant="ghost" className="flex flex-col h-auto py-2" onClick={() => addBlock('dialogue')}><MessageSquare className="h-5 w-5 mb-1" /><span className="text-xs">対話</span></Button>
          </div>
        </div>
      </div>
    </div>
  );
};