import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { User } from "@supabase/supabase-js";

interface Friend {
  id: string;
  line_user_id: string;
  display_name: string | null;
}

interface RichMenu {
  id: string;
  name: string;
  line_rich_menu_id?: string | null;
}

interface SetUserRichMenuDialogProps {
  user: User;
  friend: Friend | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SetUserRichMenuDialog = ({ user, friend, open, onOpenChange }: SetUserRichMenuDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [richMenus, setRichMenus] = useState<RichMenu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [currentUserMenuId, setCurrentUserMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (open && friend) {
      loadData();
    }
  }, [open, friend]);

  const loadData = async () => {
    if (!friend) return;
    setLoading(true);
    try {
      // Fetch all available rich menus
      const { data: menus, error: menusError } = await supabase
        .from('rich_menus')
        .select('id, name, line_rich_menu_id')
        .eq('user_id', user.id)
        .not('line_rich_menu_id', 'is', null)
        .order('name', { ascending: true });

      if (menusError) throw menusError;
      setRichMenus(menus as RichMenu[]);

      // Fetch the currently linked rich menu for the user
      const { data: currentMenuData, error: currentMenuError } = await supabase.functions.invoke('get-user-rich-menu', {
        body: { userId: friend.line_user_id },
      });

      if (currentMenuError) {
        // A 404 error is expected if no menu is linked, so we don't throw an error.
        if (!currentMenuError.message.includes('404')) {
            throw currentMenuError;
        }
        setCurrentUserMenuId(null);
        setSelectedMenuId('default');
      } else {
        const linkedLineId = currentMenuData.richMenuId;
        const matchingMenu = menus.find(m => m.line_rich_menu_id === linkedLineId);
        setCurrentUserMenuId(matchingMenu?.id || null);
        setSelectedMenuId(matchingMenu?.id || 'default');
      }

    } catch (error) {
      console.error("Error loading data for dialog:", error);
      toast({ title: "エラー", description: `データの読み込みに失敗しました: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!friend || selectedMenuId === null) return;

    setLoading(true);
    try {
      if (selectedMenuId === 'default') {
        // Unlink the current menu, reverting to default
        const { error } = await supabase.functions.invoke('unlink-rich-menu-from-user', {
          body: { userId: friend.line_user_id },
        });
        if (error) throw error;
        toast({ title: "成功", description: "リッチメニューをデフォルトに戻しました。" });
      } else {
        // Link the selected menu
        const menuToLink = richMenus.find(m => m.id === selectedMenuId);
        if (!menuToLink?.line_rich_menu_id) {
          throw new Error("選択されたメニューにLINE IDがありません。");
        }
        const { error } = await supabase.functions.invoke('link-rich-menu-to-user', {
          body: { userId: friend.line_user_id, richMenuId: menuToLink.line_rich_menu_id },
        });
        if (error) throw error;
        toast({ title: "成功", description: `「${menuToLink.name}」をユーザーに設定しました。` });
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving user rich menu:", error);
      toast({ title: "エラー", description: `設定に失敗しました: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>リッチメニューを設定</DialogTitle>
          <DialogDescription>ユーザー「{friend?.display_name}」に表示するリッチメニューを選択してください。</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center">読み込み中...</div>
        ) : (
          <div className="py-4">
            <RadioGroup value={selectedMenuId || 'default'} onValueChange={setSelectedMenuId}>
              <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                <RadioGroupItem value="default" id="default-menu" />
                <Label htmlFor="default-menu" className="font-bold">デフォルトメニュー</Label>
              </div>
              {richMenus.map((menu) => (
                <div key={menu.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                  <RadioGroupItem value={menu.id} id={menu.id} />
                  <Label htmlFor={menu.id}>{menu.name}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "保存中..." : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
