import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Menu, Plus, Settings, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RichMenuEditor } from "@/components/RichMenuEditor";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
}

const RichMenuSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [richMenus, setRichMenus] = useState<RichMenu[]>([]);
  const [editingMenu, setEditingMenu] = useState<RichMenu | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    loadRichMenus();
  }, []);

  const loadRichMenus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rich_menus')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedData = (data || []).map(menu => ({
        ...menu,
        size: menu.size as 'full' | 'half',
      }));
      
      setRichMenus(formattedData);
    } catch (error) {
      console.error('Error loading rich menus:', error);
      toast({
        title: "エラー",
        description: "リッチメニューの読み込みに失敗しました",
        variant: "destructive",
      });
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
    if (!confirm('このリッチメニューを削除しますか？')) return;
    
    try {
      setLoading(true);
      let lineError: any = null;

      if (lineId) {
        const { error } = await supabase.functions.invoke('delete-rich-menu', {
          body: { richMenuId: lineId }
        });
        lineError = error;
      }

      if (lineError) {
        console.error('LINE API error during deletion:', lineError);
      }

      const { error: dbError } = await supabase
        .from('rich_menus')
        .delete()
        .eq('id', dbId);

      if (dbError) throw dbError;
      
      toast({
        title: "削除完了",
        description: lineError ? "データベースから削除されました（LINE APIでの削除に失敗）" : "データベースとLINE公式アカウントから削除されました",
      });
      loadRichMenus();
    } catch (error) {
      console.error('Error deleting rich menu:', error);
      toast({
        title: "エラー",
        description: "削除に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setDefaultMenu = async (dbId: string, lineId: string | null | undefined) => {
    if (!lineId) {
      toast({
        title: "エラー",
        description: "このリッチメニューはLINEに登録されていないため、デフォルトに設定できません。",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      await supabase
        .from('rich_menus')
        .update({ is_default: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      const { error: dbError } = await supabase
        .from('rich_menus')
        .update({ is_default: true })
        .eq('id', dbId);

      if (dbError) throw dbError;

      const { error: lineError } = await supabase.functions.invoke('set-default-rich-menu', {
        body: { richMenuId: lineId }
      });

      if (lineError) {
        console.error('LINE API error:', lineError);
        const description = (lineError as Error)?.message || "データベースは更新されましたが、LINE公式アカウントへの反映でエラーが発生しました。";
        toast({
          title: "警告",
          description: description,
          variant: "destructive"
        });
      } else {
        toast({
          title: "設定完了",
          description: "デフォルトリッチメニューがLINE公式アカウントに反映されました",
        });
      }
      
      loadRichMenus();
    } catch (error) {
      console.error('Error setting default menu:', error);
      toast({
        title: "エラー",
        description: "設定に失敗しました",
        variant: "destructive",
      });
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
    return (
      <RichMenuEditor
        menu={editingMenu}
        onSave={onEditorSave}
        onCancel={() => {
          setShowEditor(false);
          setEditingMenu(null);
        }}
      />
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
              戻る
            </Button>
            <Menu className="w-6 h-6" />
            <h1 className="text-2xl font-bold">リッチメニュー設定</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">リッチメニュー管理</h2>
              <p className="text-muted-foreground">LINE公式アカウントのリッチメニューを作成・管理します</p>
            </div>
            <Button onClick={createNewMenu} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              新規作成
            </Button>
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">読み込み中...</div>
              </CardContent>
            </Card>
          ) : richMenus.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Menu className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">リッチメニューがありません</h3>
                <p className="text-muted-foreground mb-4">
                  最初のリッチメニューを作成して、LINE公式アカウントをより魅力的にしましょう
                </p>
                <Button onClick={createNewMenu} className="flex items-center gap-2 mx-auto">
                  <Plus className="w-4 h-4" />
                  新規作成
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {richMenus.map((menu) => (
                <Card key={menu.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{menu.name}</CardTitle>
                          {menu.is_default && (
                            <Badge variant="secondary">デフォルト</Badge>
                          )}
                          {!menu.is_active && (
                            <Badge variant="outline">無効</Badge>
                          )}
                        </div>
                        <CardDescription>
                          チャットバーテキスト: {menu.chat_bar_text} | サイズ: {menu.size === 'full' ? 'フル' : 'ハーフ'}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editMenu(menu)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        {!menu.is_default && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDefaultMenu(menu.id, menu.line_rich_menu_id)}
                                    disabled={!menu.line_rich_menu_id}
                                  >
                                    デフォルトに設定
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {!menu.line_rich_menu_id && (
                                <TooltipContent>
                                  <p>背景画像を設定し、LINEに登録されたメニューのみ設定可能です。</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMenu(menu.id, menu.line_rich_menu_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {menu.background_image_url && (
                    <CardContent className="pt-0">
                      <div className="w-full max-w-sm mx-auto">
                        <img
                          src={menu.background_image_url}
                          alt={menu.name}
                          className="w-full h-auto rounded border"
                        />
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );

};

export default RichMenuSettings;