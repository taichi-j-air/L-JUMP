import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";

interface AffiliateRank {
  id?: number;
  rank_name: string;
  commission_signup_amount: number;
  commission_subscription_rate: number;
  description: string;
}

interface RankEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rank: AffiliateRank) => void;
  rank: AffiliateRank | null;
}

const defaultRank: AffiliateRank = {
  rank_name: '',
  commission_signup_amount: 0,
  commission_subscription_rate: 0,
  description: '',
};

export function RankEditorDialog({ isOpen, onClose, onSave, rank }: RankEditorDialogProps) {
  const [editedRank, setEditedRank] = useState<AffiliateRank>(rank || defaultRank);

  useEffect(() => {
    setEditedRank(rank || defaultRank);
  }, [rank, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedRank(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    // Convert numeric fields from string to number before saving
    const rankToSave = {
      ...editedRank,
      commission_signup_amount: Number(editedRank.commission_signup_amount) || 0,
      commission_subscription_rate: Number(editedRank.commission_subscription_rate) || 0,
    };
    onSave(rankToSave);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{rank?.id ? 'ランクを編集' : '新規ランクを作成'}</DialogTitle>
          <DialogDescription>
            アフィリエイトランクの詳細を入力してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rank_name" className="text-right">ランク名</Label>
            <Input id="rank_name" name="rank_name" value={editedRank.rank_name} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="commission_signup_amount" className="text-right">新規登録報酬 (円)</Label>
            <Input id="commission_signup_amount" name="commission_signup_amount" type="number" value={editedRank.commission_signup_amount} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="commission_subscription_rate" className="text-right">課金報酬率 (%)</Label>
            <Input id="commission_subscription_rate" name="commission_subscription_rate" type="number" step="0.01" value={editedRank.commission_subscription_rate} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">説明</Label>
            <Input id="description" name="description" value={editedRank.description} onChange={handleChange} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
