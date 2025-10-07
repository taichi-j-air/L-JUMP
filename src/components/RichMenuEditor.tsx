import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
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
  line_rich_menu_id?: string | null;
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
  const editorRef = useRef<HTMLDivElement>(null);
  const [availableRichMenus, setAvailableRichMenus] = useState<RichMenu[]>([]);

  useEffect(() => {
    if (menu?.id) {
      loadTapAreas(menu.id);
    }
    loadAvailableRichMenus();
  }, [menu?.id]);

  const loadTapAreas = async (richMenuId: string) => {
    const { data, error } = await supabase.from('rich_menu_areas').select('*').eq('rich_menu_id', richMenuId);
    if (error) {
      console.error('Error loading tap areas:', error);
      return;
    }
    setTapAreas((data || []).map(area => ({ ...area, id: area.id } as TapArea)));
  };

  const loadAvailableRichMenus = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase.from('rich_menus').select('id, name').eq('user_id', userData.user.id).order('name');
    if (error) {
      console.error('Error loading rich menus:', error);
    } else {
      setAvailableRichMenus(data as RichMenu[]);
    }
  };

  const addTapArea = () => {
    const newArea: TapArea = { id: crypto.randomUUID(), x_percent: 10, y_percent: 10, width_percent: 30, height_percent: 20, action_type: 'uri', action_value: '' };
    setTapAreas([...tapAreas, newArea]);
    setSelectedArea(newArea.id);
  };

  const updateTapArea = (id: string, updates: Partial<TapArea>) => {
    setTapAreas(areas => areas.map(area => area.id === id ? { ...area, ...updates } : area));
  };

  const deleteTapArea = (id: string) => {
    setTapAreas(areas => areas.filter(area => area.id !== id));
    if (selectedArea === id) setSelectedArea(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "エラー", description: "名前を入力してください", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // For existing menus, we only update the DB. A more robust solution would handle updates to LINE API as well.
      if (menu?.id) {
        const { error: updateError } = await supabase.from('rich_menus').update({ name, background_image_url: backgroundImageUrl, chat_bar_text: chatBarText, is_default: isDefault, is_active: isActive, size }).eq('id', menu.id);
        if (updateError) throw updateError;
        // Logic for updating tap areas for existing menu
        await supabase.from('rich_menu_areas').delete().eq('rich_menu_id', menu.id);
        if (tapAreas.length > 0) {
            const { error: areaError } = await supabase.from('rich_menu_areas').insert(tapAreas.map(a => ({ ...a, rich_menu_id: menu.id })));
            if (areaError) throw areaError;
        }
        toast({ title: "保存完了", description: "リッチメニューを更新しました" });
        onSave();
        return;
      }

      // --- Logic for NEW menu --- 
      if (!backgroundImageUrl) {
        toast({ title: "エラー", description: "新規メニューには背景画像が必須です。", variant: "destructive" });
        return;
      }

      // Step 1: Insert menu into our DB to get a stable ID
      const { data: userData } = await supabase.auth.getUser();
      const { data: newMenu, error: insertError } = await supabase.from('rich_menus').insert({ user_id: userData.user?.id!, name, background_image_url: backgroundImageUrl, chat_bar_text: chatBarText, is_default: false, is_active: isActive, size }).select().single();
      if (insertError) throw insertError;
      const dbId = newMenu.id;

      // Step 2: Create menu on LINE API via function
      const richMenuDataForLine = { name, chat_bar_text: chatBarText, size, background_image_url: backgroundImageUrl, areas: tapAreas.map(a => ({ bounds: { x: Math.round((a.x_percent / 100) * (size === 'full' ? 2500 : 1200)), y: Math.round((a.y_percent / 100) * (size === 'full' ? 1686 : 810)), width: Math.round((a.width_percent / 100) * (size === 'full' ? 2500 : 1200)), height: Math.round((a.height_percent / 100) * (size === 'full' ? 1686 : 810)) }, action: { type: a.action_type, uri: a.action_type === 'uri' ? a.action_value : undefined, text: a.action_type === 'message' ? a.action_value : undefined, richMenuAliasId: a.action_type === 'richmenuswitch' ? a.action_value : undefined } })) };
      const { data: funcData, error: createError } = await supabase.functions.invoke('create-rich-menu', { body: { richMenuData: richMenuDataForLine } });
      if (createError) throw new Error(`LINEへのメニュー作成に失敗: ${createError.message}`);
      const lineRichMenuId = funcData.lineRichMenuId;

      // Step 3: Save the returned line_rich_menu_id to our DB
      const { error: updateError } = await supabase.from('rich_menus').update({ line_rich_menu_id: lineRichMenuId }).eq('id', dbId);
      if (updateError) throw updateError;

      // Step 4: Save tap areas with the stable DB ID
      if (tapAreas.length > 0) {
        const { error: areaError } = await supabase.from('rich_menu_areas').insert(tapAreas.map(a => ({ ...a, rich_menu_id: dbId })));
        if (areaError) throw areaError;
      }

      // Step 5: If isDefault is checked, set it as default on LINE
      if (isDefault) {
        await supabase.from('rich_menus').update({ is_default: false }).neq('id', dbId); // Unset other defaults
        await supabase.from('rich_menus').update({ is_default: true }).eq('id', dbId); // Set this as default
        const { error: setDefaultError } = await supabase.functions.invoke('set-default-rich-menu', { body: { richMenuId: lineRichMenuId } });
        if (setDefaultError) {
            toast({ title: "警告", description: `デフォルト設定に失敗: ${setDefaultError.message}`, variant: "destructive" });
        }
      }

      toast({ title: "作成完了", description: "新しいリッチメニューを作成し、LINEに登録しました。" });
      onSave();

    } catch (error) {
      console.error('Error saving rich menu:', error);
      toast({ title: "エラー", description: `保存に失敗しました: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b"><div className="container mx-auto px-4 py-4"><div className="flex items-center justify-between"><div className="flex items-center gap-4"><Button variant="ghost" size="sm" onClick={onCancel} className="flex items-center gap-2"><ArrowLeft className="w-4 h-4" />戻る</Button><h1 className="text-2xl font-bold">{menu ? 'リッチメニュー編集' : '新規リッチメニュー作成'}</h1></div><Button onClick={handleSave} disabled={loading}>{loading ? '保存中...' : '保存'}</Button></div></div></header>
      <main className="container mx-auto px-4 py-8 max-w-7xl"><div className="grid grid-cols-1 lg:grid-cols-2 gap-8"><div><Card><CardHeader><CardTitle>基本設定</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="name">名前</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="リッチメニュー名" /></div><div><Label htmlFor="chatBarText">チャットバーテキスト</Label><Input id="chatBarText" value={chatBarText} onChange={(e) => setChatBarText(e.target.value)} placeholder="メニュー" maxLength={14} /><p className="text-sm text-muted-foreground mt-1">14文字以内で入力してください</p></div><div><Label htmlFor="size">サイズ</Label><Select value={size} onValueChange={(value: 'full' | 'half') => setSize(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full">フル (2500×1686px)</SelectItem><SelectItem value="half">ハーフ (2500×843px)</SelectItem></SelectContent></Select></div><div className="flex items-center space-x-2"><Switch id="isActive" checked={isActive} onCheckedChange={(checked) => setIsActive(checked)} /><Label htmlFor="isActive">有効</Label></div><div className="flex items-center space-x-2"><Switch id="isDefault" checked={isDefault} onCheckedChange={(checked) => setIsDefault(checked)} /><Label htmlFor="isDefault">デフォルト表示</Label></div></CardContent></Card><Card><CardHeader><CardTitle>背景画像</CardTitle><CardDescription>1MB以下の画像を選択してください。推奨サイズ: {size === 'full' ? '2500×1686px' : '2500×843px'}</CardDescription></CardHeader><CardContent><MediaLibrarySelector trigger={<Button variant="outline" className="w-full">{backgroundImageUrl ? '画像を変更' : '画像を選択'}</Button>} onSelect={setBackgroundImageUrl} selectedUrl={backgroundImageUrl} />{backgroundImageUrl && (<div className="mt-4"><img src={backgroundImageUrl} alt="Background" className="w-full h-auto rounded border" /></div>)}</CardContent></Card><Card><CardHeader><div className="flex justify-between items-center"><CardTitle>タップエリア</CardTitle><Button onClick={addTapArea} size="sm"><Plus className="w-4 h-4 mr-2" />追加</Button></div></CardHeader><CardContent className="space-y-4">{tapAreas.map((area) => (<div key={area.id} className={`p-3 border rounded ${selectedArea === area.id ? 'border-primary bg-primary/5' : 'border-border'}`} onClick={() => setSelectedArea(area.id)}><div className="flex justify-between items-center mb-2"><span className="font-medium">エリア {tapAreas.indexOf(area) + 1}</span><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteTapArea(area.id); }}><Trash2 className="w-4 h-4" /></Button></div><div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground"><div>X: {area.x_percent.toFixed(1)}%</div><div>Y: {area.y_percent.toFixed(1)}%</div><div>幅: {area.width_percent.toFixed(1)}%</div><div>高: {area.height_percent.toFixed(1)}%</div></div>{selectedArea === area.id && (<div className="mt-3 space-y-3"><div><Label>アクションタイプ</Label><Select value={area.action_type} onValueChange={(value: 'uri' | 'message' | 'richmenuswitch') => updateTapArea(area.id, { action_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="uri">URL遷移</SelectItem><SelectItem value="message">テキスト送信</SelectItem><SelectItem value="richmenuswitch">リッチメニュー切り替え</SelectItem></SelectContent></Select></div><div><Label>{area.action_type === 'uri' && 'URL'}{area.action_type === 'message' && 'メッセージ'}{area.action_type === 'richmenuswitch' && 'リッチメニューID'}</Label>{area.action_type === 'richmenuswitch' ? (<Select value={area.action_value} onValueChange={(value) => updateTapArea(area.id, { action_value: value })}><SelectTrigger><SelectValue placeholder="リッチメニューを選択" /></SelectTrigger><SelectContent>{availableRichMenus.map((richMenu) => (<SelectItem key={richMenu.id} value={richMenu.id}>{richMenu.name}</SelectItem>))}</SelectContent></Select>) : (<Input value={area.action_value} onChange={(e) => updateTapArea(area.id, { action_value: e.target.value })} placeholder={area.action_type === 'uri' ? 'https://example.com' : area.action_type === 'message' ? 'メッセージを入力' : 'リッチメニューIDを入力'} />)}</div></div>)}</div>))}
                {tapAreas.length === 0 && (<div className="text-center py-8 text-muted-foreground"><p>タップエリアがありません</p><p className="text-sm">「追加」ボタンでエリアを作成してください</p></div>)}</CardContent></Card></div><div><RichMenuPreview backgroundImageUrl={backgroundImageUrl} chatBarText={chatBarText} size={size} tapAreas={tapAreas} selectedArea={selectedArea} onAreaSelect={setSelectedArea} onAreaUpdate={updateTapArea} editorRef={editorRef} /></div></div></main>
    </div>
  );
};