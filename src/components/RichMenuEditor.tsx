import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MediaLibrarySelector } from "@/components/MediaLibrarySelector";
import { RichMenuPreview } from "@/components/RichMenuPreview";

// Interfaces (omitted for brevity, no changes)
interface RichMenu { id: string; name: string; background_image_url?: string; chat_bar_text: string; is_default: boolean; is_active: boolean; size: 'full' | 'half'; line_rich_menu_id?: string | null; selected?: boolean; }
interface TapArea { id: string; x_percent: number; y_percent: number; width_percent: number; height_percent: number; action_type: 'uri' | 'message' | 'richmenuswitch'; action_value: string; }

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
  const [selected, setSelected] = useState(menu?.selected || false);
  const [isActive, setIsActive] = useState<boolean>(menu?.is_active ?? true);
  const [size, setSize] = useState<'full' | 'half'>(menu?.size || 'full');
  const [tapAreas, setTapAreas] = useState<TapArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [availableRichMenus, setAvailableRichMenus] = useState<RichMenu[]>([]);

  useEffect(() => {
    if (menu?.id) loadTapAreas(menu.id);
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
    if (error) console.error('Error loading rich menus:', error);
    else setAvailableRichMenus(data as RichMenu[]);
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
      if (menu?.id) {
        const { error } = await supabase.from('rich_menus').update({ name, background_image_url: backgroundImageUrl, chat_bar_text: chatBarText, is_default: isDefault, selected, is_active: isActive, size }).eq('id', menu.id);
        if (error) throw error;
        await supabase.from('rich_menu_areas').delete().eq('rich_menu_id', menu.id);
        if (tapAreas.length > 0) {
            const { error: areaError } = await supabase.from('rich_menu_areas').insert(tapAreas.map(a => ({ ...a, rich_menu_id: menu.id })));
            if (areaError) throw areaError;
        }
        toast({ title: "保存完了", description: "リッチメニューを更新しました" });
        onSave();
        return;
      }

      if (!backgroundImageUrl) {
        toast({ title: "エラー", description: "新規メニューには背景画像が必須です。", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const { data: newMenu, error: insertError } = await supabase.from('rich_menus').insert({ user_id: userData.user?.id!, name, background_image_url: backgroundImageUrl, chat_bar_text: chatBarText, is_default: false, selected, is_active: isActive, size }).select().single();
      if (insertError) throw insertError;
      const dbId = newMenu.id;

      const width = 2500;
      const height = size === 'full' ? 1686 : 843;
      const richMenuDataForLine = { name, chat_bar_text: chatBarText, size, selected, background_image_url: backgroundImageUrl, areas: tapAreas.map(a => ({ bounds: { x: Math.round((a.x_percent / 100) * width), y: Math.round((a.y_percent / 100) * height), width: Math.round((a.width_percent / 100) * width), height: Math.round((a.height_percent / 100) * height) }, action: { type: a.action_type, uri: a.action_type === 'uri' ? a.action_value : undefined, text: a.action_type === 'message' ? a.action_value : undefined, richMenuAliasId: a.action_type === 'richmenuswitch' ? a.action_value : undefined } })) };
      const { data: funcData, error: createError } = await supabase.functions.invoke('create-rich-menu', { body: { richMenuData: richMenuDataForLine } });
      if (createError || !funcData.lineRichMenuId) throw new Error(`LINEへのメニュー作成に失敗: ${createError?.message || 'Unknown error'}`);
      const lineRichMenuId = funcData.lineRichMenuId;

      const { error: updateError } = await supabase.from('rich_menus').update({ line_rich_menu_id: lineRichMenuId }).eq('id', dbId);
      if (updateError) throw updateError;

      if (tapAreas.length > 0) {
        const { error: areaError } = await supabase.from('rich_menu_areas').insert(tapAreas.map(a => ({ ...a, rich_menu_id: dbId })));
        if (areaError) throw areaError;
      }

      if (isDefault) {
        await supabase.from('rich_menus').update({ is_default: false }).neq('id', dbId);
        await supabase.from('rich_menus').update({ is_default: true }).eq('id', dbId);
        const { error: setDefaultError } = await supabase.functions.invoke('set-default-rich-menu', { body: { richMenuId: lineRichMenuId } });
        if (setDefaultError) toast({ title: "警告", description: `デフォルト設定に失敗: ${setDefaultError.message}`, variant: "destructive" });
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
      <header className="border-b sticky top-0 bg-background z-10"><div className="container mx-auto px-4 py-4"><div className="flex items-center justify-between"><div className="flex items-center gap-4"><Button variant="ghost" size="sm" onClick={onCancel} className="flex items-center gap-2"><ArrowLeft className="w-4 h-4" />戻る</Button><h1 className="text-2xl font-bold">{menu ? 'リッチメニュー編集' : '新規リッチメニュー作成'}</h1></div><Button onClick={handleSave} disabled={loading}>{loading ? '保存中...' : '保存'}</Button></div></div></header>
      <main className="container mx-auto px-4 py-8 max-w-7xl"><div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="settings">基本設定</TabsTrigger><TabsTrigger value="design">デザイン</TabsTrigger><TabsTrigger value="publish">公開設定</TabsTrigger></TabsList>
            <TabsContent value="settings" className="mt-4">
              <Card>
                <CardHeader><CardTitle>基本設定</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2"><Label htmlFor="name">名前</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="管理用のリッチメニュー名" /></div>
                  <div className="space-y-2"><Label htmlFor="chatBarText">チャットバーテキスト</Label><Input id="chatBarText" value={chatBarText} onChange={(e) => setChatBarText(e.target.value)} placeholder="メニュー" maxLength={14} /><p className="text-sm text-muted-foreground">14文字以内で入力してください</p></div>
                  <div className="space-y-2"><Label htmlFor="size">サイズ</Label><Select value={size} onValueChange={(value: 'full' | 'half') => setSize(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full">フル (2500×1686px)</SelectItem><SelectItem value="half">ハーフ (2500×843px)</SelectItem></SelectContent></Select></div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="design" className="mt-4">
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>背景画像</CardTitle><CardDescription>1MB以下の画像を選択してください。推奨サイズ: {size === 'full' ? '2500×1686px' : '2500×843px'}</CardDescription></CardHeader>
                  <CardContent><MediaLibrarySelector trigger={<Button variant="outline" className="w-full">{backgroundImageUrl ? '画像を変更' : '画像を選択'}</Button>} onSelect={setBackgroundImageUrl} selectedUrl={backgroundImageUrl} />{backgroundImageUrl && (<div className="mt-4 rounded border overflow-hidden"><img src={backgroundImageUrl} alt="Background" className="w-full h-auto" /></div>)}</CardContent>
                </Card>
                <Card>
                  <CardHeader><div className="flex justify-between items-center"><CardTitle>タップエリア</CardTitle><Button onClick={addTapArea} size="sm"><Plus className="w-4 h-4 mr-2" />追加</Button></div></CardHeader>
                  <CardContent className="space-y-4">{tapAreas.map((area, index) => (<div key={area.id} className={`p-4 border rounded-lg ${selectedArea === area.id ? 'border-primary' : ''}`} onClick={() => setSelectedArea(area.id)}><div className="flex justify-between items-center mb-3"><span className="font-medium">エリア {index + 1}</span><Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); deleteTapArea(area.id); }}><Trash2 className="w-4 h-4" /></Button></div>{selectedArea === area.id && (<div className="space-y-4"><div><Label>アクションタイプ</Label><Select value={area.action_type} onValueChange={(value: 'uri' | 'message' | 'richmenuswitch') => updateTapArea(area.id, { action_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="uri">URLを開く</SelectItem><SelectItem value="message">テキストを送信</SelectItem><SelectItem value="richmenuswitch">リッチメニューを切り替え</SelectItem></SelectContent></Select></div><div><Label>{area.action_type === 'uri' ? 'URL' : area.action_type === 'message' ? '送信テキスト' : '切り替え先メニュー'}</Label>{area.action_type === 'richmenuswitch' ? (<Select value={area.action_value} onValueChange={(value) => updateTapArea(area.id, { action_value: value })}><SelectTrigger><SelectValue placeholder="リッチメニューを選択" /></SelectTrigger><SelectContent>{availableRichMenus.map((richMenu) => (<SelectItem key={richMenu.id} value={richMenu.id}>{richMenu.name}</SelectItem>))}</SelectContent></Select>) : (<Input value={area.action_value} onChange={(e) => updateTapArea(area.id, { action_value: e.target.value })} placeholder={area.action_type === 'uri' ? 'https://example.com' : 'こんにちは'} />)}</div></div>)}</div>))}
                    {tapAreas.length === 0 && (<div className="text-center py-10 text-muted-foreground"><p>タップエリアがありません</p><p className="text-sm">「追加」ボタンでエリアを作成してください</p></div>)}</CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="publish" className="mt-4">
                <Card>
                    <CardHeader><CardTitle>公開設定</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><Label htmlFor="isActive" className="text-base">有効化</Label><p className="text-sm text-muted-foreground">このリッチメニューをアクティブにします。</p></div><Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} /></div>
                        <div className="flex items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><Label htmlFor="isDefault" className="text-base">デフォルトのメニューにする</Label><p className="text-sm text-muted-foreground">他のメニューが指定されていない全てのユーザーにこのメニューを表示します。</p></div><Switch id="isDefault" checked={isDefault} onCheckedChange={setIsDefault} /></div>
                        <div className="flex items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><Label htmlFor="selected" className="text-base">初期状態で開く</Label><p className="text-sm text-muted-foreground">ユーザーがトーク画面を開いた時に、最初からメニューを開いた状態にします。</p></div><Switch id="selected" checked={selected} onCheckedChange={setSelected} /></div>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </div>
        <div className="sticky top-24">
          <RichMenuPreview backgroundImageUrl={backgroundImageUrl} chatBarText={chatBarText} size={size} tapAreas={tapAreas} selectedArea={selectedArea} onAreaSelect={setSelectedArea} onAreaUpdate={updateTapArea} editorRef={editorRef} />
        </div>
      </div></main>
    </div>
  );
};