import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Settings2, Users, CreditCard, Globe, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MemberSite {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  domain: string | null;
  is_published: boolean;
  is_public: boolean;
  access_type: string;
  price: number;
  currency: string;
  trial_days: number;
}

interface SiteUser {
  id: string;
  user_email: string;
  user_name: string | null;
  access_level: string;
  status: string;
  joined_at: string;
  expires_at: string | null;
  total_payment: number;
}

const MemberSiteManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get('site');
  
  const [loading, setLoading] = useState(false);
  const [site, setSite] = useState<MemberSite | null>(null);
  const [siteUsers, setSiteUsers] = useState<SiteUser[]>([]);
  
  // Site settings form
  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [siteSlug, setSiteSlug] = useState("");
  const [siteDomain, setSiteDomain] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [accessType, setAccessType] = useState("paid");
  const [price, setPrice] = useState(0);
  const [trialDays, setTrialDays] = useState(0);

  useEffect(() => {
    if (siteId) {
      loadSiteData();
      loadSiteUsers();
    }
  }, [siteId]);

  const loadSiteData = async () => {
    if (!siteId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('member_sites')
        .select('*')
        .eq('id', siteId)
        .single();

      if (error) throw error;
      
      setSite(data);
      setSiteName(data.name);
      setSiteDescription(data.description || "");
      setSiteSlug(data.slug);
      setSiteDomain(data.domain || "");
      setIsPublished(data.is_published);
      setIsPublic(data.is_public);
      setAccessType(data.access_type);
      setPrice(data.price);
      setTrialDays(data.trial_days);
    } catch (error) {
      console.error('Error loading site:', error);
      toast({
        title: "エラー",
        description: "サイト情報の読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSiteUsers = async () => {
    if (!siteId) return;
    
    try {
      const { data, error } = await supabase
        .from('member_site_users')
        .select('*')
        .eq('site_id', siteId)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      setSiteUsers(data || []);
    } catch (error) {
      console.error('Error loading site users:', error);
    }
  };

  const updateSiteSettings = async () => {
    if (!siteId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('member_sites')
        .update({
          name: siteName,
          description: siteDescription,
          slug: siteSlug,
          domain: siteDomain,
          is_published: isPublished,
          is_public: isPublic,
          access_type: accessType,
          price: price,
          trial_days: trialDays,
        })
        .eq('id', siteId);

      if (error) throw error;
      
      toast({
        title: "更新完了",
        description: "サイト設定を更新しました",
      });
      
      loadSiteData();
    } catch (error) {
      console.error('Error updating site:', error);
      toast({
        title: "エラー",
        description: "サイト設定の更新に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/member-sites")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              サイト一覧に戻る
            </Button>
            <Settings2 className="w-6 h-6" />
            <h1 className="text-2xl font-bold">サイト別管理</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {!siteId ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-muted-foreground">サイトが選択されていません</p>
                <Button 
                  onClick={() => navigate("/member-sites")}
                  className="mt-4"
                >
                  サイト一覧に戻る
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : loading && !site ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-muted-foreground">読み込み中...</p>
              </div>
            </CardContent>
          </Card>
        ) : site ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">{site.name}</h2>
              <p className="text-muted-foreground">サイト管理ダッシュボード</p>
            </div>

            <Tabs defaultValue="settings" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  基本設定
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  利用者管理
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  決済設定
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  分析
                </TabsTrigger>
              </TabsList>

              <TabsContent value="settings">
                <Card>
                  <CardHeader>
                    <CardTitle>基本設定</CardTitle>
                    <CardDescription>
                      サイトの基本情報と公開設定
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="siteName">サイト名</Label>
                        <Input
                          id="siteName"
                          value={siteName}
                          onChange={(e) => setSiteName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="siteSlug">URL スラッグ</Label>
                        <Input
                          id="siteSlug"
                          value={siteSlug}
                          onChange={(e) => setSiteSlug(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="siteDescription">説明</Label>
                      <Input
                        id="siteDescription"
                        value={siteDescription}
                        onChange={(e) => setSiteDescription(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="siteDomain">カスタムドメイン</Label>
                      <Input
                        id="siteDomain"
                        value={siteDomain}
                        onChange={(e) => setSiteDomain(e.target.value)}
                        placeholder="example.com"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="accessType">アクセスタイプ</Label>
                        <Select value={accessType} onValueChange={setAccessType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">無料</SelectItem>
                            <SelectItem value="paid">有料（買い切り）</SelectItem>
                            <SelectItem value="subscription">サブスクリプション</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {accessType !== 'free' && (
                        <div className="space-y-2">
                          <Label htmlFor="price">料金 (円)</Label>
                          <Input
                            id="price"
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(Number(e.target.value))}
                          />
                        </div>
                      )}
                    </div>

                    {accessType !== 'free' && (
                      <div className="space-y-2">
                        <Label htmlFor="trialDays">無料体験期間 (日)</Label>
                        <Input
                          id="trialDays"
                          type="number"
                          value={trialDays}
                          onChange={(e) => setTrialDays(Number(e.target.value))}
                        />
                      </div>
                    )}

                    <div className="flex gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isPublished}
                          onChange={(e) => setIsPublished(e.target.checked)}
                        />
                        <span>公開する</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isPublic}
                          onChange={(e) => setIsPublic(e.target.checked)}
                        />
                        <span>パブリックアクセス許可</span>
                      </label>
                    </div>

                    <Button onClick={updateSiteSettings} disabled={loading}>
                      {loading ? "更新中..." : "設定を保存"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="users">
                <Card>
                  <CardHeader>
                    <CardTitle>利用者一覧 ({siteUsers.length})</CardTitle>
                    <CardDescription>
                      サイトの利用者管理
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {siteUsers.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">まだ利用者がいません</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>メールアドレス</TableHead>
                            <TableHead>名前</TableHead>
                            <TableHead>アクセスレベル</TableHead>
                            <TableHead>ステータス</TableHead>
                            <TableHead>参加日</TableHead>
                            <TableHead>支払い総額</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {siteUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell>{user.user_email}</TableCell>
                              <TableCell>{user.user_name || '-'}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{user.access_level}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                                  {user.status === 'active' ? 'アクティブ' : 
                                   user.status === 'suspended' ? '停止中' : 
                                   user.status === 'expired' ? '期限切れ' : user.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(user.joined_at).toLocaleDateString('ja-JP')}
                              </TableCell>
                              <TableCell>¥{user.total_payment.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payments">
                <Card>
                  <CardHeader>
                    <CardTitle>決済設定</CardTitle>
                    <CardDescription>
                      Stripe連携と決済プランの管理
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">決済設定機能は今後実装予定です</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics">
                <Card>
                  <CardHeader>
                    <CardTitle>アクセス分析</CardTitle>
                    <CardDescription>
                      サイトの利用状況とパフォーマンス
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">分析機能は今後実装予定です</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-muted-foreground">サイトが見つかりません</p>
                <Button 
                  onClick={() => navigate("/member-sites")}
                  className="mt-4"
                >
                  サイト一覧に戻る
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default MemberSiteManagement;