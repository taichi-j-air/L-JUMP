import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Move, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MediaLibrarySelector } from "@/components/MediaLibrarySelector";
import { RichMenuPreview } from "@/components/RichMenuPreview";

interface RichMenu {
  id: string;
  name: string;
  background_image_url?: string;
  chat_bar_text: string;
  is_default: boolean;
  is_active: boolean;
  size: 'full' | 'half';
}

interface TapArea {
  id: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  action_type: 'uri' | 'message' | 'richmenuswitch';
  action_value: string;
}

interface RichMenuEditorProps {
  menu?: RichMenu | null;
  onSave: () => void;
  onCancel: () => void;
}

export const RichMenuEditor = ({ menu, onSave, onCancel }: RichMenuEditorProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(menu?.name || "");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(menu?.background_image_url || "");
  const [chatBarText, setChatBarText] = useState(menu?.chat_bar_text || "メニュー");
  const [isDefault, setIsDefault] = useState(menu?.is_default || false);
  const [isActive, setIsActive] = useState<boolean>(menu?.is_active ?? true);
  const [size, setSize] = useState<'full' | 'half'>(menu?.size || 'full');
  const [tapAreas, setTapAreas] = useState<TapArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menu?.id) {
      loadTapAreas(menu.id);
    }
  }, [menu?.id]);

  const loadTapAreas = async (richMenuId: string) => {
    try {
      const { data, error } = await supabase
        .from('rich_menu_areas')
        .select('*')
        .eq('rich_menu_id', richMenuId);

      if (error) throw error;
      
      const formattedData = (data || []).map(area => ({
        id: area.id,
        x_percent: area.x_percent,
        y_percent: area.y_percent,
        width_percent: area.width_percent,
        height_percent: area.height_percent,
        action_type: area.action_type as 'uri' | 'message' | 'richmenuswitch',
        action_value: area.action_value,
      }));
      
      setTapAreas(formattedData);
    } catch (error) {
      console.error('Error loading tap areas:', error);
    }
  };

  const addTapArea = () => {
    const newArea: TapArea = {
      id: crypto.randomUUID(),
      x_percent: 10,
      y_percent: 10,
      width_percent: 30,
      height_percent: 20,
      action_type: 'uri',
      action_value: '',
    };
    setTapAreas([...tapAreas, newArea]);
    setSelectedArea(newArea.id);
  };

  const updateTapArea = (id: string, updates: Partial<TapArea>) => {
    setTapAreas(areas => 
      areas.map(area => 
        area.id === id ? { ...area, ...updates } : area
      )
    );
  };

  const deleteTapArea = (id: string) => {
    setTapAreas(areas => areas.filter(area => area.id !== id));
    if (selectedArea === id) {
      setSelectedArea(null);
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, areaId: string) => {
    e.preventDefault();
    setSelectedArea(areaId);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !selectedArea || !editorRef.current) return;

    const rect = editorRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;

    updateTapArea(selectedArea, {
      x_percent: Math.max(0, Math.min(100, tapAreas.find(a => a.id === selectedArea)!.x_percent + deltaX)),
      y_percent: Math.max(0, Math.min(100, tapAreas.find(a => a.id === selectedArea)!.y_percent + deltaY)),
    });

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, selectedArea, dragStart, tapAreas]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "エラー",
        description: "名前を入力してください",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let richMenuId = menu?.id;

      if (menu?.id) {
        // 既存メニューの更新
        const { error } = await supabase
          .from('rich_menus')
          .update({
            name,
            background_image_url: backgroundImageUrl,
            chat_bar_text: chatBarText,
            is_default: isDefault,
            is_active: isActive,
            size,
          })
          .eq('id', menu.id);

        if (error) throw error;
      } else {
        // 新規メニューの作成
        const { data: userData } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('rich_menus')
          .insert({
            user_id: userData.user?.id!,
            name,
            background_image_url: backgroundImageUrl,
            chat_bar_text: chatBarText,
            is_default: isDefault,
            is_active: isActive,
            size,
          })
          .select()
          .single();

        if (error) throw error;
        richMenuId = data.id;
      }

      // タップエリアの保存
      if (richMenuId) {
        // 既存のエリアを削除
        await supabase
          .from('rich_menu_areas')
          .delete()
          .eq('rich_menu_id', richMenuId);

        // 新しいエリアを挿入
        if (tapAreas.length > 0) {
          const { error } = await supabase
            .from('rich_menu_areas')
            .insert(
              tapAreas.map(area => ({
                rich_menu_id: richMenuId,
                x_percent: area.x_percent,
                y_percent: area.y_percent,
                width_percent: area.width_percent,
                height_percent: area.height_percent,
                action_type: area.action_type,
                action_value: area.action_value,
              }))
            );

          if (error) throw error;
        }
      }

      toast({
        title: "保存完了",
        description: "リッチメニューを保存しました",
      });
      onSave();
    } catch (error) {
      console.error('Error saving rich menu:', error);
      toast({
        title: "エラー",
        description: "保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedAreaData = tapAreas.find(area => area.id === selectedArea);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                戻る
              </Button>
              <h1 className="text-2xl font-bold">
                {menu ? 'リッチメニュー編集' : '新規リッチメニュー作成'}
              </h1>
            </div>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* エディター側 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>基本設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">名前</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="リッチメニュー名"
                  />
                </div>
                
                <div>
                  <Label htmlFor="chatBarText">チャットバーテキスト</Label>
                  <Input
                    id="chatBarText"
                    value={chatBarText}
                    onChange={(e) => setChatBarText(e.target.value)}
                    placeholder="メニュー"
                    maxLength={14}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    14文字以内で入力してください
                  </p>
                </div>

                <div>
                  <Label htmlFor="size">サイズ</Label>
                  <Select value={size} onValueChange={(value: 'full' | 'half') => setSize(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">フル (2500×1686px)</SelectItem>
                      <SelectItem value="half">ハーフ (2500×843px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={isActive}
                    onCheckedChange={(checked) => setIsActive(checked)}
                  />
                  <Label htmlFor="isActive">有効</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isDefault"
                    checked={isDefault}
                    onCheckedChange={(checked) => setIsDefault(checked)}
                  />
                  <Label htmlFor="isDefault">デフォルト表示</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>背景画像</CardTitle>
                <CardDescription>
                  1MB以下の画像を選択してください。推奨サイズ: {size === 'full' ? '2500×1686px' : '2500×843px'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MediaLibrarySelector
                  trigger={
                    <Button variant="outline" className="w-full">
                      {backgroundImageUrl ? '画像を変更' : '画像を選択'}
                    </Button>
                  }
                  onSelect={setBackgroundImageUrl}
                  selectedUrl={backgroundImageUrl}
                />
                {backgroundImageUrl && (
                  <div className="mt-4">
                    <img
                      src={backgroundImageUrl}
                      alt="Background"
                      className="w-full h-auto rounded border"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>タップエリア</CardTitle>
                  <Button onClick={addTapArea} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    追加
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {tapAreas.map((area) => (
                  <div
                    key={area.id}
                    className={`p-3 border rounded ${
                      selectedArea === area.id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                    onClick={() => setSelectedArea(area.id)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">エリア {tapAreas.indexOf(area) + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTapArea(area.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>X: {area.x_percent.toFixed(1)}%</div>
                      <div>Y: {area.y_percent.toFixed(1)}%</div>
                      <div>幅: {area.width_percent.toFixed(1)}%</div>
                      <div>高: {area.height_percent.toFixed(1)}%</div>
                    </div>

                    {selectedArea === area.id && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <Label>アクションタイプ</Label>
                          <Select
                            value={area.action_type}
                            onValueChange={(value: 'uri' | 'message' | 'richmenuswitch') =>
                              updateTapArea(area.id, { action_type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="uri">URL遷移</SelectItem>
                              <SelectItem value="message">テキスト送信</SelectItem>
                              <SelectItem value="richmenuswitch">リッチメニュー切り替え</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>
                            {area.action_type === 'uri' && 'URL'}
                            {area.action_type === 'message' && 'メッセージ'}
                            {area.action_type === 'richmenuswitch' && 'リッチメニューID'}
                          </Label>
                          <Input
                            value={area.action_value}
                            onChange={(e) =>
                              updateTapArea(area.id, { action_value: e.target.value })
                            }
                            placeholder={
                              area.action_type === 'uri' ? 'https://example.com' :
                              area.action_type === 'message' ? 'メッセージを入力' :
                              'リッチメニューIDを入力'
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {tapAreas.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>タップエリアがありません</p>
                    <p className="text-sm">「追加」ボタンでエリアを作成してください</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* プレビュー側 */}
          <div>
            <RichMenuPreview
              backgroundImageUrl={backgroundImageUrl}
              chatBarText={chatBarText}
              size={size}
              tapAreas={tapAreas}
              selectedArea={selectedArea}
              onAreaSelect={setSelectedArea}
              onAreaUpdate={updateTapArea}
              editorRef={editorRef}
              onMouseDown={handleMouseDown}
            />
          </div>
        </div>
      </main>
    </div>
  );
};