import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Loader2 } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DOMPurify from "dompurify";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface AffiliateRank {
  id: number;
  rank_name: string;
  commission_signup_amount: number;
  commission_subscription_rate: number;
  description: string;
}

interface Commission {
  source_event: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "cancelled";
  created_at: string;
}

interface EarningsData {
  referral_count: number;
  stats: {
    pending_amount: number;
    approved_amount: number;
    paid_amount: number;
  };
  recent_commissions: Commission[];
}

interface PayoutDetails {
  payout_method: string;
  bank_name: string;
  branch_name: string;
  account_holder_name: string;
  account_type: string;
  account_number: string;
}

const initialPayoutDetails: PayoutDetails = {
  payout_method: "bank_transfer",
  bank_name: "",
  branch_name: "",
  account_holder_name: "",
  account_type: "普通",
  account_number: "",
};

const statusTranslations: Record<Commission["status"], string> = {
  pending: "承認待ち",
  approved: "支払可能",
  paid: "支払済み",
  cancelled: "キャンセル",
};

const eventTranslations: Record<string, string> = {
  user_signup: "新規ユーザー登録",
  first_subscription: "初回有料プラン契約",
};

export default function AffiliatePage() {
  const [affiliateLink, setAffiliateLink] = useState("");
  const [tosContent, setTosContent] = useState("");
  const [isLoadingTos, setIsLoadingTos] = useState(true);
  const [ranks, setRanks] = useState<AffiliateRank[]>([]);
  const [isLoadingRanks, setIsLoadingRanks] = useState(true);
  const [payoutDetails, setPayoutDetails] = useState<PayoutDetails>(initialPayoutDetails);
  const [isLoadingPayout, setIsLoadingPayout] = useState(true);
  const [isSavingPayout, setIsSavingPayout] = useState(false);
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const baseUrl = window.location.origin;
        setAffiliateLink(`${baseUrl}/auth?ref=${user.id}`);
      } else {
        setAffiliateLink("");
      }
    };

    const fetchTos = async () => {
      setIsLoadingTos(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-affiliate-tos");
        if (error) throw error;
        setTosContent(DOMPurify.sanitize(data.tos));
      } catch (error) {
        console.error("Error fetching terms of service:", error);
        setTosContent("<p>利用規約の読み込みに失敗しました。</p>");
      } finally {
        setIsLoadingTos(false);
      }
    };

    const fetchRanks = async () => {
      setIsLoadingRanks(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-affiliate-ranks");
        if (error) throw error;
        setRanks(data.ranks);
      } catch (error) {
        console.error("Error fetching affiliate ranks:", error);
      } finally {
        setIsLoadingRanks(false);
      }
    };

    const fetchPayoutSettings = async () => {
      setIsLoadingPayout(true);
      try {
        const { data: rawData, error: rawError } = await supabase.functions.invoke("get-affiliate-payout-settings-raw");
        if (rawError) throw rawError;

        if (rawData.settings) {
          const rawSettings = rawData.settings as Partial<PayoutDetails>;
          const encryptedFields: Array<keyof PayoutDetails> = [
            "bank_name",
            "branch_name",
            "account_holder_name",
            "account_type",
            "account_number",
          ];

          const decryptionPromises = Object.entries(rawSettings)
            .filter(([key, value]) => encryptedFields.includes(key as keyof PayoutDetails) && value)
            .map(async ([key, encryptedValue]) => {
              const { data, error } = await supabase.functions.invoke("decrypt-credential", {
                body: { encryptedValue: encryptedValue as string },
              });
              if (error) throw new Error(`Failed to decrypt ${key}`);
              return [key, data.decryptedValue as string] as const;
            });

          const decryptedEntries = await Promise.all(decryptionPromises);
          const decryptedDetails = Object.fromEntries(decryptedEntries) as Partial<PayoutDetails>;
          const cleanedSettings = Object.fromEntries(
            Object.entries(rawSettings).map(([key, value]) => [key, value ?? ""])
          ) as Partial<PayoutDetails>;

          setPayoutDetails((prev) => ({
            ...prev,
            ...cleanedSettings,
            ...decryptedDetails,
          }));
        } else {
          setPayoutDetails({ ...initialPayoutDetails });
        }
      } catch (error) {
        console.error("Error fetching or decrypting payout settings:", error);
        toast({ title: "支払い設定の読み込みに失敗しました", variant: "destructive" });
      } finally {
        setIsLoadingPayout(false);
      }
    };

    const fetchEarnings = async () => {
      setIsLoadingEarnings(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-affiliate-earnings");
        if (error) throw error;
        setEarningsData(data);
      } catch (error) {
        console.error("Error fetching affiliate earnings:", error);
        toast({ title: "報酬実績の読み込みに失敗しました", variant: "destructive" });
      } finally {
        setIsLoadingEarnings(false);
      }
    };

    fetchUser();
    fetchTos();
    fetchRanks();
    fetchPayoutSettings();
    fetchEarnings();
  }, []);

  const handlePayoutDetailsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const fieldName = name as keyof PayoutDetails;
    setPayoutDetails((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSavePayoutSettings = async () => {
    setIsSavingPayout(true);
    try {
      const fieldsToEncrypt = {
        bank_name: payoutDetails.bank_name,
        branch_name: payoutDetails.branch_name,
        account_holder_name: payoutDetails.account_holder_name,
        account_type: payoutDetails.account_type,
        account_number: payoutDetails.account_number,
      };

      const encryptionPromises = Object.entries(fieldsToEncrypt)
        .map(async ([key, value]) => {
          if (!value) return [key, null];
          const { data, error } = await supabase.functions.invoke('encrypt-credential', {
            body: { value },
          });
          if (error) throw new Error(`Failed to encrypt ${key}`);
          return [key, data.encryptedValue];
        });

      const encryptedEntries = await Promise.all(encryptionPromises);
      const encryptedSettings = Object.fromEntries(encryptedEntries);

      const { error: updateError } = await supabase.functions.invoke('update-affiliate-payout-settings', {
        body: { payoutSettings: { ...payoutDetails, ...encryptedSettings } },
      });

      if (updateError) throw updateError;

      toast({ title: "支払い設定を保存しました" });
    } catch (error) {
      console.error('Error saving payout settings:', error);
      toast({ title: "設定の保存に失敗しました", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingPayout(false);
    }
  };

  const copyToClipboard = () => {
    if (!affiliateLink) {
      return;
    }

    navigator.clipboard.writeText(affiliateLink);
    toast({
      title: "コピーしました",
      description: "アフィリエイトリンクをクリップボードにコピーしました。",
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>あなたのアフィリエイトリンク</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center space-x-2">
          <Input value={affiliateLink} readOnly placeholder="リンクを生成中..." />
          <Button onClick={copyToClipboard} size="icon" disabled={!affiliateLink}>
            <Copy className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="commission" className="w-full">
        <TabsList>
          <TabsTrigger value="commission">報酬価格表</TabsTrigger>
          <TabsTrigger value="earnings">報酬実績</TabsTrigger>
          <TabsTrigger value="payout">支払い設定</TabsTrigger>
          <TabsTrigger value="tos">利用規約</TabsTrigger>
        </TabsList>

        <TabsContent value="commission">
          <Card>
            <CardHeader>
              <CardTitle>報酬価格表</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoadingRanks ? (
                <p>読み込み中...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ランク</TableHead>
                      <TableHead>新規登録</TableHead>
                      <TableHead>有料課金率</TableHead>
                      <TableHead>説明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranks.map((rank) => (
                      <TableRow key={rank.id}>
                        <TableCell className="font-medium">{rank.rank_name}</TableCell>
                        <TableCell>{rank.commission_signup_amount.toLocaleString()}円</TableCell>
                        <TableCell>{rank.commission_subscription_rate * 100}%</TableCell>
                        <TableCell>{rank.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings">
          <Card>
            <CardHeader>
              <CardTitle>報酬実績</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingEarnings ? (
                <p>読み込み中...</p>
              ) : earningsData ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">支払可能報酬</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {earningsData.stats.approved_amount.toLocaleString()}円
                        </div>
                        <p className="text-xs text-muted-foreground">現在お支払い可能な金額です。</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">承認待ち報酬</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {earningsData.stats.pending_amount.toLocaleString()}円
                        </div>
                        <p className="text-xs text-muted-foreground">現在承認待ちの金額です。</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">紹介経由の登録人数</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{earningsData.referral_count}人</div>
                        <p className="text-xs text-muted-foreground">あなたのリンク経由で登録した総数です。</p>
                      </CardContent>
                    </Card>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-2">最近の報酬イベント</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>日付</TableHead>
                          <TableHead>イベント</TableHead>
                          <TableHead>金額</TableHead>
                          <TableHead>ステータス</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {earningsData.recent_commissions.length > 0 ? (
                          earningsData.recent_commissions.map((commission, index) => (
                            <TableRow key={`${commission.source_event}-${commission.created_at}-${index}`}>
                              <TableCell>{format(new Date(commission.created_at), "yyyy/MM/dd HH:mm")}</TableCell>
                              <TableCell>{eventTranslations[commission.source_event] || commission.source_event}</TableCell>
                              <TableCell>{commission.amount.toLocaleString()}円</TableCell>
                              <TableCell>
                                <Badge>{statusTranslations[commission.status] || commission.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center">
                              最近の報酬イベントはありません。
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <p>報酬実績の読み込みに失敗しました。</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payout">
          <Card>
            <CardHeader>
              <CardTitle>支払い設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingPayout ? (
                <p>読み込み中...</p>
              ) : (
                <div className="space-y-4 max-w-md">
                  <div>
                    <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700">
                      銀行名
                    </label>
                    <Input
                      id="bank_name"
                      name="bank_name"
                      value={payoutDetails.bank_name}
                      onChange={handlePayoutDetailsChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="branch_name" className="block text-sm font-medium text-gray-700">
                      支店名
                    </label>
                    <Input
                      id="branch_name"
                      name="branch_name"
                      value={payoutDetails.branch_name}
                      onChange={handlePayoutDetailsChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="account_type" className="block text-sm font-medium text-gray-700">
                      口座種別
                    </label>
                    <Input
                      id="account_type"
                      name="account_type"
                      value={payoutDetails.account_type}
                      onChange={handlePayoutDetailsChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="account_number" className="block text-sm font-medium text-gray-700">
                      口座番号
                    </label>
                    <Input
                      id="account_number"
                      name="account_number"
                      value={payoutDetails.account_number}
                      onChange={handlePayoutDetailsChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="account_holder_name" className="block text-sm font-medium text-gray-700">
                      口座名義人（カタカナ）
                    </label>
                    <Input
                      id="account_holder_name"
                      name="account_holder_name"
                      value={payoutDetails.account_holder_name}
                      onChange={handlePayoutDetailsChange}
                    />
                  </div>
                  <Button onClick={handleSavePayoutSettings} disabled={isSavingPayout}>
                    {isSavingPayout && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 保存
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tos">
          <Card>
            <CardHeader>
              <CardTitle>利用規約</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingTos ? (
                <p>読み込み中...</p>
              ) : (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: tosContent }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}