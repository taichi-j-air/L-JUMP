import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Eye, Plus, Trash2, Settings, Edit, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface MemberSite {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  access_type: string;
  price: number;
  theme_config: any;
  is_published: boolean;
  is_public: boolean;
  created_at: string;
}

interface SiteContent {
  id: string;
  title: string;
  content: string | null;
  page_type: string;
  slug: string;
  is_published: boolean;
  access_level: string;
  sort_order: number;
}

const MemberSiteBuilder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const siteId = searchParams.get('site');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Site data
  const [site, setSite] = useState<MemberSite | null>(null);
  const [sites, setSites] = useState<MemberSite[]>([]); // For the list on the left
  const [siteContents, setSiteContents] = useState<SiteContent[]>([]);
  
  // Form states
  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [siteSlug, setSiteSlug] = useState("");
  const [accessType, setAccessType] = useState("paid");
  const [price, setPrice] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  
  // Content editing
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [contentTitle, setContentTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [contentSlug, setContentSlug] = useState("");
  const [contentType, setContentType] = useState("page");
  const [contentAccessLevel, setContentAccessLevel] = useState("member");
  const [contentPublished, setContentPublished] = useState(false);

  useEffect(() => {
    loadSites(); // Load all sites for the left panel
    if (siteId) {
      loadSiteData();
      loadSiteContents();
    } else {
      // Reset form if no site is selected
      setSite(null);
      setSiteName("");
      setSiteDescription("");
      setSiteSlug("");
      setAccessType("paid");
      setPrice(0);
      setIsPublished(false);
      setIsPublic(false);
      setSiteContents([]);
      setSelectedContentId(null);
    }
  }, [siteId]);

  const handleCreateSite = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('認証が必要です');

      const { data, error } = await supabase
        .from('member_sites')
        .insert({
          name: "新しいサイト",
          description: "",
          slug: `site-${Date.now()}`,
          access_type: "paid",
          price: 0,
          is_published: false,
          is_public: false,
          user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Refresh sites list and select the new site
      await loadSites();
      setSearchParams({ site: data.id });
      
      toast({
        title: "作成完了",
        description: "新しいサイトを作成しました",
      });
    } catch (error) {
      console.error('Error creating site:', error);
      toast({
        title: "エラー",
        description: "サイトの作成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    if (!confirm('本当にこのサイトを削除しますか？関連するコンテンツも全て削除されます。')) return;
    
    setSaving(true);
    try {
      // Delete related data first
      await supabase.from('member_site_content').delete().eq('site_id', siteId);
      await supabase.from('member_site_payments').delete().eq('site_id', siteId);
      await supabase.from('member_site_subscriptions').delete().eq('site_id', siteId);
      await supabase.from('member_site_users').delete().eq('site_id', siteId);
      
      // Delete the site itself
      const { error } = await supabase
        .from('member_sites')
        .delete()
        .eq('id', siteId);

      if (error) throw error;
      
      // If the deleted site was selected, clear selection
      if (siteId === searchParams.get('site')) {
        setSearchParams({});
      }
      
      // Refresh sites list
      await loadSites();
      
      toast({
        title: "削除完了",
        description: "サイトを削除しました",
      });
    } catch (error) {
      console.error('Error deleting site:', error);
      toast({
        title: "エラー",
        description: "サイトの削除に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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
      setAccessType(data.access_type);
      setPrice(data.price);
      setIsPublished(data.is_published);
      setIsPublic(data.is_public);
    } catch (error) {
      console.error('Error loading site:', error);
      toast({
        title: "エラー",
        description: "サイト情報の読み込みに失敗しました",
        variant: "destructive",
      });
      setSearchParams({}); // Clear siteId if loading fails
    } finally {
      setLoading(false);
    }
  };

  const loadSiteContents = async () => {
    if (!siteId) return;
    
    try {
      const { data, error } = await supabase
        .from('member_site_content')
        .select('*')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSiteContents(data || []);
    } catch (error) {
      console.error('Error loading contents:', error);
    }
  };

  const saveSite = async () => {
    setSaving(true);
    try {
      if (siteId && siteId !== 'new') {
        // Update existing site
        const { error } = await supabase
          .from('member_sites')
          .update({
            name: siteName,
            description: siteDescription,
            slug: siteSlug,
            access_type: accessType,
            price: price,
            is_published: isPublished,
            is_public: isPublic,
          })
          .eq('id', siteId);

        if (error) throw error;
      } else {
        // Create new site
        const { data, error } = await supabase
          .from('member_sites')
          .insert({
            name: siteName,
            description: siteDescription,
            slug: siteSlug,
            access_type: accessType,
            price: price,
            is_published: isPublished,
            is_public: isPublic,
            user_id: (await supabase.auth.getUser()).data.user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Redirect to edit mode with the new site ID
        setSearchParams({ site: data.id });
        toast({
          title: "作成完了",
          description: "新しいサイトを作成しました",
        });
        return;
      }
      
      toast({
        title: "保存完了",
        description: "サイト情報を保存しました",
      });
      
      loadSiteData();
      loadSites(); // Refresh the list on the left
    } catch (error) {
      console.error('Error saving site:', error);
      toast({
        title: "エラー",
        description: "サイト情報の保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveContent = async () => {
    if (!siteId || !selectedContentId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('member_site_content')
        .update({
          title: contentTitle,
          content: contentText,
          slug: contentSlug,
          page_type: contentType,
          access_level: contentAccessLevel,
          is_published: contentPublished,
        })
        .eq('id', selectedContentId);

      if (error) throw error;
      
      toast({
        title: "保存完了",
        description: "コンテンツを保存しました",
      });
      
      loadSiteContents();
    } catch (error) {
      console.error('Error saving content:', error);
      toast({
        title: "エラー",
        description: "コンテンツの保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const createNewContent = async () => {
    if (!siteId) return;
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('member_site_content')
        .insert({
          site_id: siteId,
          title: "新しいページ",
          content: "",
          slug: `page-${Date.now()}`,
          page_type: "page",
          access_level: "member",
          is_published: false,
          sort_order: siteContents.length,
        })
        .select()
        .single();

      if (error) throw error;
      
      setSelectedContentId(data.id);
      setContentTitle(data.title);
      setContentText(data.content || "");
      setContentSlug(data.slug);
      setContentType(data.page_type);
      setContentAccessLevel(data.access_level);
      setContentPublished(data.is_published);
      
      loadSiteContents();
      
      toast({
        title: "作成完了",
        description: "新しいページを作成しました",
      });
    } catch (error) {
      console.error('Error creating content:', error);
      toast({
        title: "エラー",
        description: "ページの作成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectContent = (content: SiteContent) => {
    setSelectedContentId(content.id);
    setContentTitle(content.title);
    setContentText(content.content || "");
    setContentSlug(content.slug);
    setContentType(content.page_type);
    setContentAccessLevel(content.access_level);
    setContentPublished(content.is_published);
  };

  const deleteContent = async (contentId: string) => {
    if (!confirm("本当にこのページを削除しますか？")) return;
    
    try {
      const { error } = await supabase
        .from('member_site_content')
        .delete()
        .eq('id', contentId);

      if (error) throw error;
      
      if (selectedContentId === contentId) {
        setSelectedContentId(null);
        setContentTitle("");
        setContentText("");
        setContentSlug("");
      }
      
      loadSiteContents();
      
      toast({
        title: "削除完了",
        description: "ページを削除しました",
      });
    } catch (error) {
      console.error('Error deleting content:', error);
      toast({
        title: "エラー",
        description: "ページの削除に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedContent = siteContents.find(c => c.id === selectedContentId);

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
            <Settings className="w-6 h-6" />
            <h1 className="text-2xl font-bold">
              {siteId ? "サイト編集" : "新しいサイトを作成"}
            </h1>
          </div>
        </div>
      </header>

      <main className="px-4 py-8">
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-muted-foreground">読み込み中...</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Left Column: Site List */}
            <div className="col-span-12 md:col-span-3 space-y-3">
              <Card>
                <CardHeader className="flex flex-col gap-2 py-3">
                  <div className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">会員サイト一覧</CardTitle>
                    <Button size="sm" onClick={handleCreateSite} disabled={saving} className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      追加
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    作成中のサイト: {sites.length}件
                  </div>
                </CardHeader>
                <CardContent className="p-2">
                  {sites.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">まだサイトがありません</p>
                  ) : (
                    <div className="space-y-1">
                      {sites.map((s) => (
                        <div
                          key={s.id}
                          className={`flex items-center justify-between border rounded-md px-2 py-1.5 transition-all ${
                            siteId === s.id 
                              ? 'bg-primary/10 border-primary shadow-sm' 
                              : 'border-border hover:border-primary/50 hover:bg-muted/60'
                          }`}
                        >
                          <button
                            onClick={() => setSearchParams({ site: s.id })}
                            className="flex-1 text-left min-w-0"
                          >
                            <div className="text-sm font-medium line-clamp-1">{s.name}</div>
                          </button>
                          <div className="flex items-center gap-1 ml-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/member-site/${s.slug}`, '_blank');
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              disabled={saving}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSite(s.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Builder with Tabs */}
            <div className="col-span-12 md:col-span-9 space-y-6">
              <Tabs defaultValue={siteId ? "content-list" : "site-settings"}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="content-list">コンテンツ一覧</TabsTrigger>
                  <TabsTrigger value="category-settings">カテゴリ設定</TabsTrigger>
                  <TabsTrigger value="plan-settings">プラン設定</TabsTrigger>
                  <TabsTrigger value="content-display">コンテンツ表示方法</TabsTrigger>
                  <TabsTrigger value="site-settings">サイト設定</TabsTrigger>
                </TabsList>

                  <TabsContent value="content-list" className="border-2 border-border rounded-none">
                    <div className="flex">
                      {/* Content Sidebar - 20% width */}
                      <div className="w-1/5 border-r border-border flex flex-col">
                        <div className="bg-[rgb(12,34,54)] py-6 px-4">
                          <div className="flex items-center justify-center">
                            <h3 className="text-base font-medium text-white">コンテンツ一覧</h3>
                          </div>
                        </div>
                        <div className="bg-white p-4 border-b border-border">
                          <Button size="sm" onClick={createNewContent} disabled={saving} className="w-full bg-[#0cb386] hover:bg-[#0cb386]/90 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            コンテンツ追加
                          </Button>
                        </div>
                        <div className="flex-grow overflow-y-auto">
                          {siteContents.length === 0 ? (
                            <p className="text-xs text-muted-foreground">ページがありません</p>
                          ) : (
                            <Table className="w-full border-collapse">
                              <TableBody>
                                {siteContents.map((content) => (
                                  <TableRow
                                    key={content.id}
                                    className={`cursor-pointer transition-colors border-b-0 last:border-b-0 ${
                                      selectedContentId === content.id
                                        ? 'bg-[#0cb386]/20 border-l-2 border-[#0cb386]'
                                        : 'hover:bg-muted/50'
                                    }`}
                                    onClick={() => selectContent(content)}
                                  >
                                    <TableCell className="py-2 px-2 text-left align-top border-b-0">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-medium truncate">{content.title}</div>
                                        <div className="text-xs text-muted-foreground">{content.page_type}</div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2 px-2 text-right align-top border-b-0 w-1/4">
                                      <div className="flex items-center justify-end gap-1">
                                        {content.is_published && (
                                          <Badge variant="secondary" className="text-xs">公開</Badge>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteContent(content.id);
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>
                      
                      {/* Main Content Area - 80% width */}
                      <div className="w-4/5 border border-border">
                        {selectedContent ? (
                          <Card>
                            <CardHeader>
                              <CardTitle>ページ編集</CardTitle>
                              <CardDescription>
                                {selectedContent.title} の編集
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="contentTitle">ページタイトル</Label>
                                  <Input
                                    id="contentTitle"
                                    value={contentTitle}
                                    onChange={(e) => setContentTitle(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="contentSlug">URL スラッグ</Label>
                                  <Input
                                    id="contentSlug"
                                    value={contentSlug}
                                    onChange={(e) => setContentSlug(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="contentType">ページタイプ</Label>
                                  <Select value={contentType} onValueChange={setContentType}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="page">ページ</SelectItem>
                                      <SelectItem value="post">投稿</SelectItem>
                                      <SelectItem value="landing">ランディング</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="contentAccessLevel">アクセスレベル</Label>
                                  <Select value={contentAccessLevel} onValueChange={setContentAccessLevel}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="public">パブリック</SelectItem>
                                      <SelectItem value="member">会員限定</SelectItem>
                                      <SelectItem value="premium">プレミアム会員限定</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>公開設定</Label>
                                  <label className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={contentPublished}
                                      onChange={(e) => setContentPublished(e.target.checked)}
                                    />
                                    <span>公開する</span>
                                  </label>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="contentText">コンテンツ</Label>
                                <Textarea
                                  id="contentText"
                                  value={contentText}
                                  onChange={(e) => setContentText(e.target.value)}
                                  rows={15}
                                  placeholder="ページの内容を入力してください"
                                />
                              </div>

                              <Button onClick={saveContent} disabled={saving} className="w-full">
                                <Save className="w-4 h-4 mr-2" />
                                {saving ? "保存中..." : "ページを保存"}
                              </Button>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card>
                            <CardContent className="p-12">
                              <div className="text-center">
                                <p className="text-muted-foreground mb-4">
                                  左側からページを選択して編集するか、新しいページを作成してください
                                </p>
                                <Button onClick={createNewContent}>
                                  <Plus className="w-4 h-4 mr-2" />
                                  最初のページを作成
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="category-settings" className="border-2 border-border rounded-none">
                    <Card>
                      <CardHeader><CardTitle>カテゴリ設定</CardTitle></CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">カテゴリ設定のコンテンツ</p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="plan-settings" className="border-2 border-border rounded-none">
                    <Card>
                      <CardHeader><CardTitle>プラン設定</CardTitle></CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">プラン設定のコンテンツ</p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="content-display" className="border-2 border-border rounded-none">
                    <Card>
                      <CardHeader><CardTitle>コンテンツ表示方法</CardTitle></CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">コンテンツ表示方法のコンテンツ</p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="site-settings" className="border-2 border-border rounded-none">
                    {/* Existing Site Settings */}
                    <Card>
                      <CardHeader>
                        <CardTitle>サイト設定</CardTitle>
                        <CardDescription>
                          基本情報と設定
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="siteName">サイト名</Label>
                          <Input
                            id="siteName"
                            value={siteName}
                            onChange={(e) => setSiteName(e.target.value)}
                            placeholder="サイト名を入力"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="siteDescription">説明</Label>
                          <Textarea
                            id="siteDescription"
                            value={siteDescription}
                            onChange={(e) => setSiteDescription(e.target.value)}
                            placeholder="サイトの説明を入力"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="siteSlug">URL スラッグ</Label>
                          <Input
                            id="siteSlug"
                            value={siteSlug}
                            onChange={(e) => setSiteSlug(e.target.value)}
                            placeholder="url-slug"
                          />
                        </div>

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

                        <Button onClick={saveSite} disabled={saving} className="w-full">
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? "保存中..." : "サイト設定を保存"}
                        </Button>
                        
                        {siteId && siteId !== 'new' && (
                          <div className="space-y-2">
                            <Button 
                              variant="outline" 
                              onClick={() => window.open(`/member-site/${siteSlug}`, '_blank')}
                              className="w-full"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              プレビュー
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => navigate(`/member-sites/management?site=${siteId}`)}
                              className="w-full"
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              管理画面へ
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MemberSiteBuilder;