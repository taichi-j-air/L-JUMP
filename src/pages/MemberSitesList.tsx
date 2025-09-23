import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Globe, Plus, Settings, Eye, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MemberSite {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  is_published: boolean;
  is_public: boolean;
  access_type: string;
  price: number;
  created_at: string;
  updated_at: string;
  site_uid: string;
  public_url?: string;
  published_at?: string;
}

const MemberSitesList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<MemberSite[]>([]);

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('member_sites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      console.error('Error loading sites:', error);
      toast({
        title: "エラー",
        description: "サイト一覧の読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPreviewUrl = (site: MemberSite) => {
    if (site.is_published && site.public_url) {
      return site.public_url;
    }
    return `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/member-site-view?slug=${site.slug}&uid=${site.site_uid}`;
  };

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
            <Globe className="w-6 h-6" />
            <h1 className="text-2xl font-bold">会員サイト一覧</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">作成済みサイト</h2>
              <p className="text-muted-foreground">会員向けサイトを管理します</p>
            </div>
            <Button onClick={() => navigate("/member-sites/builder")} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              新しいサイトを作成
            </Button>
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-muted-foreground">読み込み中...</p>
                </div>
              </CardContent>
            </Card>
          ) : sites.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>会員サイト</CardTitle>
                <CardDescription>
                  会員限定コンテンツサイトの作成・管理
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">まだサイトが作成されていません</p>
                  <Button onClick={() => navigate("/member-sites/builder")} className="flex items-center gap-2 mx-auto">
                    <Plus className="w-4 h-4" />
                    最初のサイトを作成
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>作成済みサイト ({sites.length})</CardTitle>
                <CardDescription>
                  会員サイトの一覧と管理
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>サイト名</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>アクセス</TableHead>
                      <TableHead>料金</TableHead>
                      <TableHead>作成日</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sites.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{site.name}</div>
                            {site.description && (
                              <div className="text-sm text-muted-foreground">{site.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Badge variant={site.is_published ? "default" : "secondary"}>
                              {site.is_published ? "公開中" : "下書き"}
                            </Badge>
                            {site.is_public && (
                              <Badge variant="outline">パブリック</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {site.access_type === 'free' ? '無料' : 
                             site.access_type === 'paid' ? '有料' : 
                             site.access_type === 'subscription' ? 'サブスク' : site.access_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {site.access_type !== 'free' ? `¥${site.price.toLocaleString()}` : '無料'}
                        </TableCell>
                        <TableCell>
                          {new Date(site.created_at).toLocaleDateString('ja-JP')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate(`/member-sites/builder?site=${site.id}`)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate(`/member-sites/management?site=${site.id}`)}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => window.open(getPreviewUrl(site), '_blank')}
                              title={site.is_published ? "公開サイトを表示" : "プレビュー"}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default MemberSitesList;