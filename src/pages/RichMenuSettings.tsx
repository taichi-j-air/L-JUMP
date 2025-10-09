import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Menu, Plus, MoreHorizontal, Settings, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RichMenuEditor } from "@/components/RichMenuEditor";

interface RichMenu {
  id: string;
  name: string;
  background_image_url?: string;
  chat_bar_text: string;
  is_default: boolean;
  is_active: boolean;
  size: 'full' | 'half';
  created_at: string;
  line_rich_menu_id?: string | null;
  line_rich_menu_alias_id?: string | null;
  selected?: boolean;
}

const RichMenuSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [richMenus, setRichMenus] = useState<RichMenu[]>([]);
  const [editingMenu, setEditingMenu] = useState<RichMenu | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    loadRichMenus();
  }, []);

  const loadRichMenus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('rich_menus').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setRichMenus((data || []).map(menu => ({ ...menu, size: menu.size as 'full' | 'half' })));
    } catch (error) {
      console.error('Error loading rich menus:', error);
      toast({ title: "エラー", description: "リッチメニューの読み込みに失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const createNewMenu = () => {
    setEditingMenu(null);
    setShowEditor(true);
  };

  const editMenu = (menu: RichMenu) => {
    setEditingMenu(menu);
    setShowEditor(true);
  };

  const deleteMenu = async (dbId: string, lineId: string | null | undefined) => {
    if (!confirm('このリッチメニューを削除しますか？\nLINE上からも削除されますが、元に戻すことはできません。')) return;
    try {
      setLoading(true);
      if (lineId) {
        await supabase.functions.invoke('delete-rich-menu', { body: { richMenuId: lineId } });
      }
      const { error: dbError } = await supabase.from('rich_menus').delete().eq('id', dbId);
      if (dbError) throw dbError;
      toast({ title: "削除完了", description: "リッチメニューを削除しました。" });
      loadRichMenus();
    } catch (error) {
      console.error('Error deleting rich menu:', error);
      toast({ title: "エラー", description: `削除に失敗しました: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const setDefaultMenu = async (dbId: string, lineId: string | null | undefined) => {
    if (!lineId) {
      toast({ title: "エラー", description: "このリッチメニューはLINEに登録されていないため、デフォルトに設定できません。", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      await supabase.from('rich_menus').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('rich_menus').update({ is_default: true }).eq('id', dbId);
      const { error: lineError } = await supabase.functions.invoke('set-default-rich-menu', { body: { richMenuId: lineId } });
      if (lineError) throw lineError;
      toast({ title: "設定完了", description: "デフォルトリッチメニューがLINE公式アカウントに反映されました" });
      loadRichMenus();
    } catch (error) {
      console.error('Error setting default menu:', error);
      toast({ title: "エラー", description: `設定に失敗しました: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const onEditorSave = () => {
    setShowEditor(false);
    setEditingMenu(null);
    loadRichMenus();
  };

  if (showEditor) {
    return <RichMenuEditor menu={editingMenu} onSave={onEditorSave} onCancel={() => { setShowEditor(false); setEditingMenu(null); }} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b"><div className="container mx-auto px-4 py-4"><div className="flex items-center justify-between"><div className="flex items-center gap-4"><Button variant="ghost" size="sm" onClick={() => navigate("/")} className="flex items-center gap-2"><ArrowLeft className="w-4 h-4" />戻る</Button><h1 className="text-2xl font-bold">リッチメニュー設定</h1></div><Button onClick={createNewMenu} className="flex items-center gap-2"><Plus className="w-4 h-4" />新規作成</Button></div></div></header>
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle>リッチメニュー管理</CardTitle>
            <CardDescription>LINE公式アカウントのリッチメニューを作成・管理します</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden w-[100px] sm:table-cell">プレビュー</TableHead>
                  <TableHead>名前</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="hidden md:table-cell">チャットバー</TableHead>
                  <TableHead className="hidden md:table-cell">作成日</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">読み込み中...</TableCell></TableRow>
                ) : richMenus.length > 0 ? (
                  richMenus.map((menu) => (
                    <TableRow key={menu.id}>
                      <TableCell className="hidden sm:table-cell">
                        {menu.background_image_url ? <img alt={menu.name} className="aspect-video rounded-md object-cover" height="64" src={menu.background_image_url} width="100" /> : <div className="h-16 w-[100px] bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">No Image</div>}
                      </TableCell>
                      <TableCell className="font-medium">{menu.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {menu.is_default && <Badge variant="secondary">デフォルト</Badge>}
                          {menu.is_active ? <Badge variant="outline">有効</Badge> : <Badge variant="destructive">無効</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{menu.chat_bar_text}</TableCell>
                      <TableCell className="hidden md:table-cell">{format(new Date(menu.created_at), "yyyy/MM/dd")}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>アクション</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => editMenu(menu)}><Settings className="h-4 w-4 mr-2"/>編集</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDefaultMenu(menu.id, menu.line_rich_menu_id)} disabled={menu.is_default || !menu.line_rich_menu_id}><Star className="h-4 w-4 mr-2"/>デフォルトに設定</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => deleteMenu(menu.id, menu.line_rich_menu_id)}><Trash2 className="h-4 w-4 mr-2"/>削除</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">リッチメニューがありません。「新規作成」から最初のメニューを作成しましょう。</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default RichMenuSettings;
