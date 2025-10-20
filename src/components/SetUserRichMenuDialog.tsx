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
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (menusError) throw menusError;
      setRichMenus(menus as RichMenu[]);

      // Fetch the currently linked rich menu for the user
      try {
        const { data: currentMenuData, error: currentMenuError } = await supabase.functions.invoke('get-user-rich-menu', {
          body: { userId: friend.line_user_id },
        });

        if (currentMenuError) {
          console.log('No menu linked for user (expected):', currentMenuError);
          setCurrentUserMenuId(null);
          setSelectedMenuId('default');
        } else if (currentMenuData?.richMenuId) {
          setCurrentUserMenuId(currentMenuData.richMenuId);
          setSelectedMenuId(currentMenuData.richMenuId);
        } else {
          setCurrentUserMenuId(null);
          setSelectedMenuId('default');
        }
      } catch (menuError) {
        console.log('Could not fetch user menu (treating as default):', menuError);
        setCurrentUserMenuId(null);
        setSelectedMenuId('default');
      }

    } catch (error) {
      console.error("Error loading rich menus:", error);
      toast({ title: "エラー", description: `リッチメニュー一覧の読み込みに失敗しました: ${(error as Error).message}`, variant: "destructive" });
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
        const { data, error } = await supabase.functions.invoke('unlink-rich-menu-from-user', {
          body: { userId: friend.line_user_id },
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || 'リッチメニューのデフォルト設定に失敗しました。');
        toast({ title: "成功", description: "リッチメニューをデフォルトに戻しました。" });
      } else {
        // Link the selected menu using its ID
        const menuToLink = richMenus.find(m => m.id === selectedMenuId);
        if (!menuToLink) {
          throw new Error("選択されたメニューが見つかりません。");
        }
        const { data, error } = await supabase.functions.invoke('link-rich-menu-to-user', {
          body: { userId: friend.line_user_id, richMenuId: menuToLink.id },
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || 'リッチメニューの設定に失敗しました。');
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
          <DialogDescription>
            ユーザー「{friend?.display_name}」に表示するリッチメニューを選択してください。
            {currentUserMenuId && (
              <div className="mt-2 text-sm font-medium">
                現在適用中: {richMenus.find(m => m.id === currentUserMenuId)?.name || 'デフォルトメニュー'}
              </div>
            )}
            {!currentUserMenuId && (
              <div className="mt-2 text-sm text-muted-foreground">
                現在: デフォルトメニュー
              </div>
            )}
          </DialogDescription>
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
