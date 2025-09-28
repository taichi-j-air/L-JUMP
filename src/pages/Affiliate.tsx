import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

export default function AffiliatePage() {
  const [user, setUser] = useState<User | null>(null);
  const [affiliateLink, setAffiliateLink] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const baseUrl = window.location.origin;
        setAffiliateLink(`${baseUrl}/auth?ref=${user.id}`);
      }
    };
    fetchUser();
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(affiliateLink);
    toast({
      title: "コピーしました",
      description: "アフィリエイトリンクをクリップボードにコピーしました。",
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-4">
      {/* Top Column: Affiliate Link */}
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

      {/* Bottom Column: Tabs */}
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
              <p>L!JUMPを紹介して報酬を獲得しましょう！</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><b>新規ユーザー登録:</b> 1件につき <b>500円</b></li>
                <li><b>有料プランへの初回アップグレード:</b> 1件につき <b>2,000円</b></li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings">
          <Card>
            <CardHeader>
              <CardTitle>報酬実績</CardTitle>
            </CardHeader>
            <CardContent>
              <p>ここにあなたの報酬実績が表示されます。（現在開発中です）</p>
              {/* TODO: Implement earnings display */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payout">
          <Card>
            <CardHeader>
              <CardTitle>支払い設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>報酬を受け取る銀行口座を設定してください。（現在開発中です）</p>
              {/* TODO: Implement payout settings form */}
              <div>
                <label htmlFor="bank-name" className="block text-sm font-medium text-gray-700">銀行名</label>
                <Input id="bank-name" disabled />
              </div>
              <div>
                <label htmlFor="branch-name" className="block text-sm font-medium text-gray-700">支店名</label>
                <Input id="branch-name" disabled />
              </div>
              <div>
                <label htmlFor="account-number" className="block text-sm font-medium text-gray-700">口座番号</label>
                <Input id="account-number" disabled />
              </div>
              <Button disabled>保存</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tos">
          <Card>
            <CardHeader>
              <CardTitle>利用規約</CardTitle>
            </CardHeader>
            <CardContent>
              <p>ここにアフィリエイトプログラムの利用規約が表示されます。（現在開発中です）</p>
              {/* TODO: Add Terms of Service */}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}