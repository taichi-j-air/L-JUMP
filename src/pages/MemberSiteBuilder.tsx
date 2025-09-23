import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Eye, Plus, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MemberSite {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  access_type: string;
  price: number;
  theme_config: any;
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
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get('site');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Site data
  const [site, setSite] = useState<MemberSite | null>(null);
  const [siteContents, setSiteContents] = useState<SiteContent[]>([]);
  
  // Form states
  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [siteSlug, setSiteSlug] = useState("");
  const [accessType, setAccessType] = useState("paid");
  const [price, setPrice] = useState(0);
  
  // Content editing
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [contentTitle, setContentTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [contentSlug, setContentSlug] = useState("");
  const [contentType, setContentType] = useState("page");
  const [contentAccessLevel, setContentAccessLevel] = useState("member");
  const [contentPublished, setContentPublished] = useState(false);

  useEffect(() => {
    if (siteId) {
      loadSiteData();
      loadSiteContents();
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
      setAccessType(data.access_type);
      setPrice(data.price);
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
      if (siteId) {
        // Update existing site
        const { error } = await supabase
          .from('member_sites')
          .update({
            name: siteName,
            description: siteDescription,
            slug: siteSlug,
            access_type: accessType,
            price: price,
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
            user_id: (await supabase.auth.getUser()).data.user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Redirect to edit mode with the new site ID
        navigate(`/member-sites/builder?site=${data.id}`);
        return;
      }
      
      toast({
        title: "保存完了",
        description: "サイト情報を保存しました",
      });
      
      loadSiteData();
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

      <main className="container mx-auto px-4 py-8 max-w-6xl">
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
            {/* Site Settings */}
            <div className="col-span-4">
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

                  <Button onClick={saveSite} disabled={saving} className="w-full">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "保存中..." : "サイト設定を保存"}
                  </Button>
                  
                  {siteId && (
                    <Button 
                      variant="outline" 
                      onClick={() => navigate(`/member-sites/management?site=${siteId}`)}
                      className="w-full"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      管理画面へ
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Content List */}
              {siteId && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      ページ一覧
                      <Button size="sm" onClick={createNewContent} disabled={saving}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {siteContents.map((content) => (
                        <div
                          key={content.id}
                          className={`p-3 border rounded cursor-pointer hover:bg-accent ${
                            selectedContentId === content.id ? 'bg-accent' : ''
                          }`}
                          onClick={() => selectContent(content)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{content.title}</div>
                              <div className="text-sm text-muted-foreground">
                                /{content.slug}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteContent(content.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Content Editor */}
            <div className="col-span-8">
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
              ) : siteId ? (
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
              ) : (
                <Card>
                  <CardContent className="p-12">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-4">
                        まずはサイトの基本設定を保存してください
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MemberSiteBuilder;