import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface AffiliateRank {
  id: number;
  rank_name: string;
}

interface AffiliateData {
  user_id: string;
  email: string;
  full_name: string;
  affiliate_ranks: AffiliateRank | null;
  referral_count: number;
  total_earnings: number;
}

export default function AffiliateManagementPage() {
  const [affiliates, setAffiliates] = useState<AffiliateData[]>([]);
  const [allRanks, setAllRanks] = useState<AffiliateRank[]>([]);
  const [filteredAffiliates, setFilteredAffiliates] = useState<AffiliateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRankDialogOpen, setIsRankDialogOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliateData | null>(null);
  const [selectedRankId, setSelectedRankId] = useState<string>("");
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [affiliatesRes, ranksRes] = await Promise.all([
        supabase.functions.invoke('admin-get-affiliates'),
        supabase.functions.invoke('get-affiliate-ranks'),
      ]);

      if (affiliatesRes.error) throw affiliatesRes.error;
      if (ranksRes.error) throw ranksRes.error;

      setAffiliates(affiliatesRes.data.affiliates);
      setFilteredAffiliates(affiliatesRes.data.affiliates);
      setAllRanks(ranksRes.data.ranks);
    } catch (error) {
      console.error('Error fetching affiliate data:', error);
      toast({ title: "データ取得に失敗しました", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filteredData = affiliates.filter(item => {
      return (
        item.full_name?.toLowerCase().includes(lowercasedFilter) ||
        item.email?.toLowerCase().includes(lowercasedFilter)
      );
    });
    setFilteredAffiliates(filteredData);
  }, [searchTerm, affiliates]);

  const openRankDialog = (affiliate: AffiliateData) => {
    setSelectedAffiliate(affiliate);
    setSelectedRankId(affiliate.affiliate_ranks?.id?.toString() || "");
    setIsRankDialogOpen(true);
  };

  const handleRankChange = async () => {
    if (!selectedAffiliate || !selectedRankId) return;

    try {
      const { error } = await supabase.functions.invoke('admin-set-affiliate-rank', {
        body: { user_id: selectedAffiliate.user_id, rank_id: parseInt(selectedRankId) },
      });

      if (error) throw error;

      toast({ title: "ランクを更新しました" });
      setIsRankDialogOpen(false);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error updating rank:', error);
      toast({ title: "ランクの更新に失敗しました", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>アフィリエイト一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input 
              placeholder="名前またはEmailで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {isLoading ? (
            <p>読み込み中...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>ランク</TableHead>
                  <TableHead>紹介数</TableHead>
                  <TableHead>総報酬額</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAffiliates.map((affiliate) => (
                  <TableRow key={affiliate.user_id}>
                    <TableCell>{affiliate.full_name || 'N/A'}</TableCell>
                    <TableCell>{affiliate.email}</TableCell>
                    <TableCell>{affiliate.affiliate_ranks?.rank_name || 'N/A'}</TableCell>
                    <TableCell>{affiliate.referral_count}</TableCell>
                    <TableCell>{affiliate.total_earnings.toLocaleString()}円</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openRankDialog(affiliate)}>
                        ランク変更
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRankDialogOpen} onOpenChange={setIsRankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ランク変更</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p><b>{selectedAffiliate?.full_name || selectedAffiliate?.email}</b> のランクを変更します。</p>
            <Select value={selectedRankId} onValueChange={setSelectedRankId}>
              <SelectTrigger>
                <SelectValue placeholder="ランクを選択..." />
              </SelectTrigger>
              <SelectContent>
                {allRanks.map(rank => (
                  <SelectItem key={rank.id} value={rank.id.toString()}>
                    {rank.rank_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRankDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleRankChange}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
