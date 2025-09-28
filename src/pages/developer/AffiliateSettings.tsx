import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { RankEditorDialog } from "@/components/RankEditorDialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import RichTextEditor from "@/components/RichTextEditor"; // Import the editor

interface AffiliateRank {
  id: number;
  rank_name: string;
  commission_signup_amount: number;
  commission_subscription_rate: number;
  description: string;
}

export default function AffiliateSettingsPage() {
  const [ranks, setRanks] = useState<AffiliateRank[]>([]);
  const [isLoadingRanks, setIsLoadingRanks] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedRank, setSelectedRank] = useState<AffiliateRank | null>(null);
  const [rankToDelete, setRankToDelete] = useState<AffiliateRank | null>(null);
  const [tosContent, setTosContent] = useState("");
  const [isLoadingTos, setIsLoadingTos] = useState(true);
  const [isSavingTos, setIsSavingTos] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRanks();
    fetchTos();
  }, []);

  const fetchRanks = async () => {
    setIsLoadingRanks(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-affiliate-ranks');
      if (error) throw error;
      setRanks(data.ranks);
    } catch (error) {
      console.error('Error fetching affiliate ranks:', error);
      toast({ title: "ランクの読み込みに失敗しました", variant: "destructive" });
    } finally {
      setIsLoadingRanks(false);
    }
  };

  const fetchTos = async () => {
    setIsLoadingTos(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-affiliate-tos');
      if (error) throw error;
      setTosContent(data.tos || '');
    } catch (error) {
      console.error('Error fetching ToS:', error);
      toast({ title: "利用規約の読み込みに失敗しました", variant: "destructive" });
    } finally {
      setIsLoadingTos(false);
    }
  };

  const handleCreate = () => {
    setSelectedRank(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (rank: AffiliateRank) => {
    setSelectedRank(rank);
    setIsEditorOpen(true);
  };

  const handleDeleteClick = (rank: AffiliateRank) => {
    setRankToDelete(rank);
    setIsDeleteConfirmOpen(true);
  };

  const handleSaveRank = async (rankToSave: Omit<AffiliateRank, 'id'> & { id?: number }) => {
    try {
      const { error } = await supabase.functions.invoke('admin-update-affiliate-rank', {
        body: rankToSave,
      });
      if (error) throw error;
      toast({ title: "ランクを保存しました" });
      setIsEditorOpen(false);
      fetchRanks();
    } catch (error) {
      console.error('Error saving rank:', error);
      toast({ title: "ランクの保存に失敗しました", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!rankToDelete) return;
    try {
      const { error } = await supabase.functions.invoke('admin-delete-affiliate-rank', {
        body: { rank_id: rankToDelete.id },
      });
      if (error) throw error;
      toast({ title: "ランクを削除しました" });
      setIsDeleteConfirmOpen(false);
      setRankToDelete(null);
      fetchRanks();
    } catch (error) {
      console.error('Error deleting rank:', error);
      toast({ title: "ランクの削除に失敗しました", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveTos = async () => {
    setIsSavingTos(true);
    try {
      const { error } = await supabase.functions.invoke('admin-update-affiliate-tos', {
        body: { tos_content: tosContent },
      });
      if (error) throw error;
      toast({ title: "利用規約を保存しました" });
    } catch (error) {
      console.error('Error saving ToS:', error);
      toast({ title: "利用規約の保存に失敗しました", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingTos(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <RankEditorDialog 
        isOpen={isEditorOpen} 
        onClose={() => setIsEditorOpen(false)} 
        onSave={handleSaveRank} 
        rank={selectedRank}
      />

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              ランク「{rankToDelete?.rank_name}」を削除します。この操作は元に戻せません。
              このランクが割り当てられているユーザーがいる場合、削除は失敗します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>アフィリエイトランク管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button onClick={handleCreate}>
              <PlusCircle className="mr-2 h-4 w-4" />
              新規ランク作成
            </Button>
          </div>
          {isLoadingRanks ? (
            <p>読み込み中...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ランク名</TableHead>
                  <TableHead>新規登録報酬</TableHead>
                  <TableHead>課金報酬率</TableHead>
                  <TableHead>説明</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranks.map((rank) => (
                  <TableRow key={rank.id}>
                    <TableCell className="font-medium">{rank.rank_name}</TableCell>
                    <TableCell>{rank.commission_signup_amount.toLocaleString()}円</TableCell>
                    <TableCell>{rank.commission_subscription_rate * 100}%</TableCell>
                    <TableCell>{rank.description}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(rank)}>編集</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(rank)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>利用規約設定</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingTos ? (
            <p>読み込み中...</p>
          ) : (
            <div className="space-y-4">
              <RichTextEditor value={tosContent} onChange={setTosContent} />
              <div className="flex justify-end">
                <Button onClick={handleSaveTos} disabled={isSavingTos}>
                  {isSavingTos && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                  利用規約を保存
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
