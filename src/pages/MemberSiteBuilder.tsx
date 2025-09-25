import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Eye, Plus, Trash2, Settings, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { MediaLibrarySelector } from "@/components/MediaLibrarySelector";
import { EnhancedBlockEditor } from "@/components/EnhancedBlockEditor";

// Data Interfaces
interface MemberSite {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  access_type: "free" | "paid";
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
  page_type: "page" | "post" | "landing";
  slug: string;
  is_published: boolean;
  access_level: "public" | "member" | "premium";
  sort_order: number;
  category_id?: string | null;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  site_id: string;
  sort_order: number;
  content_count: number;
  created_at: string;
  thumbnail_url: string | null;
  content_blocks?: any[] | null; // JSON array
}

const MemberSiteBuilder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const siteId = searchParams.get("site");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(siteId ? "content-list" : "site-settings");

  // Site data
  const [site, setSite] = useState<MemberSite | null>(null);
  const [sites, setSites] = useState<MemberSite[]>([]);
  const [siteContents, setSiteContents] = useState<SiteContent[]>([]);

  // Site form
  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [siteSlug, setSiteSlug] = useState("");
  const [accessType, setAccessType] = useState<"free" | "paid">("paid");
  const [price, setPrice] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [headerBgColor, setHeaderBgColor] = useState("#ffffff");
  const [headerFgColor, setHeaderFgColor] = useState("#000000");
  const [sidebarBgColor, setSidebarBgColor] = useState("#ffffff");
  const [sidebarFgColor, setSidebarFgColor] = useState("#000000");

  // Content editing
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [contentTitle, setContentTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [contentSlug, setContentSlug] = useState("");
  const [contentType, setContentType] = useState<"page" | "post" | "landing">("page");
  const [contentAccessLevel, setContentAccessLevel] = useState<"public" | "member" | "premium">("member");
  const [contentPublished, setContentPublished] = useState(false);
  const [contentCategoryId, setContentCategoryId] = useState<string>("none");

  // Category editing
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryThumbnailUrl, setCategoryThumbnailUrl] = useState<string | null>(null);
  const [categoryBlocks, setCategoryBlocks] = useState<any[]>([]); // JSON array

  useEffect(() => {
    loadSites();
    if (siteId) {
      // reset (site switch)
      setSite(null);
      setSiteName("");
      setSiteDescription("");
      setSiteSlug("");
      setAccessType("paid");
      setPrice(0);
      setIsPublished(false);
      setIsPublic(false);
      setHeaderBgColor("#ffffff");
      setHeaderFgColor("#000000");
      setSidebarBgColor("#ffffff");
      setSidebarFgColor("#000000");
      setSelectedContentId(null);
      setContentTitle("");
      setContentText("");
      setContentSlug("");
      setContentType("page");
      setContentAccessLevel("member");
      setContentPublished(false);
      setContentCategoryId("none");
      setSelectedCategoryId(null);
      setCategoryName("");
      setCategoryDescription("");
      setCategoryThumbnailUrl(null);
      setCategoryBlocks([]);

      // load fresh
      loadSiteData();
      loadSiteContents();
      loadCategories();
    } else {
      // reset all when no site selected
      setSite(null);
      setSiteName("");
      setSiteDescription("");
      setSiteSlug("");
      setAccessType("paid");
      setPrice(0);
      setIsPublished(false);
      setIsPublic(false);
      setHeaderBgColor("#ffffff");
      setHeaderFgColor("#000000");
      setSidebarBgColor("#ffffff");
      setSidebarFgColor("#000000");
      setSiteContents([]);
      setSelectedContentId(null);
      setCategories([]);
      setSelectedCategoryId(null);
      setCategoryName("");
      setCategoryDescription("");
      setCategoryThumbnailUrl(null);
      setCategoryBlocks([]);
    }
  }, [siteId]);

  const loadSites = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("member_sites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSites((data || []).map((d: any) => ({ ...d, access_type: (d.access_type || "paid") as "free" | "paid" })));
    } catch (error) {
      console.error("Error loading sites:", error);
      toast({ title: "エラー", description: "サイト一覧の読み込みに失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadSiteData = async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("member_sites").select("*").eq("id", siteId).single();
      if (error) throw error;
      setSite(data as MemberSite);
      setSiteName(data.name);
      setSiteDescription(data.description || "");
      setSiteSlug(data.slug);
      setAccessType((data.access_type as "free" | "paid") || "paid");
      setPrice(data.price);
      setIsPublished(data.is_published);
      setIsPublic(data.is_public);
      const theme = data.theme_config || {};
      setHeaderBgColor(theme.headerBgColor || "#ffffff");
      setHeaderFgColor(theme.headerFgColor || "#000000");
      setSidebarBgColor(theme.sidebarBgColor || "#ffffff");
      setSidebarFgColor(theme.sidebarFgColor || "#000000");
    } catch (error) {
      console.error("Error loading site:", error);
      toast({ title: "エラー", description: "サイト情報の読み込みに失敗しました", variant: "destructive" });
      setSearchParams({});
    } finally {
      setLoading(false);
    }
  };

  const loadSiteContents = async () => {
    if (!siteId) return;
    try {
      const { data, error } = await supabase
        .from("member_site_content")
        .select("*")
        .eq("site_id", siteId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setSiteContents((data || []).map(item => ({
        ...item,
        page_type: item.page_type as "page" | "post" | "landing",
        access_level: item.access_level as "public" | "premium" | "member"
      })));
    } catch (error) {
      console.error("Error loading contents:", error);
    }
  };

  const loadCategories = async () => {
    if (!siteId) return;
    try {
      const { data, error } = await supabase
        .from("member_site_categories")
        .select("*, member_site_content(count)")
        .eq("site_id", siteId)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const formatted: Category[] =
        (data as any[] | null)?.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          site_id: cat.site_id,
          sort_order: cat.sort_order,
          created_at: cat.created_at,
          thumbnail_url: cat.thumbnail_url ?? null,
          content_blocks: Array.isArray(cat.content_blocks) ? cat.content_blocks : [],
          content_count: Array.isArray(cat.member_site_content)
            ? cat.member_site_content.length
            : cat.member_site_content?.[0]?.count ?? 0,
        })) ?? [];

      setCategories(formatted);
    } catch (error) {
      console.error("Error loading categories:", error);
      toast({ title: "エラー", description: "カテゴリの読み込みに失敗しました", variant: "destructive" });
    }
  };

  const saveSite = async () => {
    setSaving(true);
    try {
      const theme_config = { headerBgColor, headerFgColor, sidebarBgColor, sidebarFgColor };
      if (siteId && siteId !== "new") {
        const { error } = await supabase
          .from("member_sites")
          .update({
            name: siteName,
            description: siteDescription,
            slug: siteSlug,
            access_type: accessType,
            price,
            is_published: isPublished,
            is_public: isPublic,
            theme_config,
          })
          .eq("id", siteId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("member_sites")
          .insert({
            name: siteName,
            description: siteDescription,
            slug: siteSlug,
            access_type: accessType,
            price,
            is_published: isPublished,
            is_public: isPublic,
            theme_config,
            user_id: (await supabase.auth.getUser()).data.user?.id,
          })
          .select()
          .single();
        if (error) throw error;

        setSearchParams({ site: data.id });
        toast({ title: "作成完了", description: "新しいサイトを作成しました" });
        return;
      }
      toast({ title: "保存完了", description: "サイト情報を保存しました" });
      loadSiteData();
      loadSites();
    } catch (error) {
      console.error("Error saving site:", error);
      toast({ title: "エラー", description: "サイト情報の保存に失敗しました", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveContent = async () => {
    if (!siteId || !selectedContentId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("member_site_content")
        .update({
          title: contentTitle,
          content: contentText,
          slug: contentSlug,
          page_type: contentType,
          access_level: contentAccessLevel,
          is_published: contentPublished,
          category_id: contentCategoryId === "none" ? null : contentCategoryId,
        })
        .eq("id", selectedContentId);
      if (error) throw error;

      toast({ title: "保存完了", description: "コンテンツを保存しました" });
      loadSiteContents();
      loadCategories();
    } catch (error) {
      console.error("Error saving content:", error);
      toast({ title: "エラー", description: "コンテンツの保存に失敗しました", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSite = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("認証が必要です");
      const { data, error } = await supabase
        .from("member_sites")
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

      await loadSites();
      setSearchParams({ site: data.id });
      toast({ title: "作成完了", description: "新しいサイトを作成しました" });
    } catch (error) {
      console.error("Error creating site:", error);
      toast({ title: "エラー", description: "サイトの作成に失敗しました", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createNewContent = async () => {
    if (!siteId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("member_site_content")
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
      setContentType(data.page_type as "page" | "post" | "landing");
      setContentAccessLevel(data.access_level as "public" | "premium" | "member");
      setContentPublished(data.is_published);
      setContentCategoryId("none");

      loadSiteContents();
      toast({ title: "作成完了", description: "新しいページを作成しました" });
    } catch (error) {
      console.error("Error creating content:", error);
      toast({ title: "エラー", description: "ページの作成に失敗しました", variant: "destructive" });
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
    setContentCategoryId(content.category_id || "none");
  };

  const deleteContent = async (contentId: string) => {
    if (!confirm("本当にこのページを削除しますか？")) return;
    try {
      const { error } = await supabase.from("member_site_content").delete().eq("id", contentId);
      if (error) throw error;

      if (selectedContentId === contentId) {
        setSelectedContentId(null);
        setContentTitle("");
        setContentText("");
        setContentSlug("");
      }
      loadSiteContents();
      loadCategories();
      toast({ title: "削除完了", description: "ページを削除しました" });
    } catch (error) {
      console.error("Error deleting content:", error);
      toast({ title: "エラー", description: "ページの削除に失敗しました", variant: "destructive" });
    }
  };

  const createNewCategory = async () => {
    if (!siteId) {
      toast({ title: "エラー", description: "サイトが選択されていません", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("member_site_categories")
        .insert({
          name: "新しいカテゴリ",
          description: "",
          site_id: siteId,
          sort_order: categories.length,
          thumbnail_url: null,
          content_blocks: [], // 空配列で作成
        })
        .select()
        .single();
      if (error) throw error;

      setSelectedCategoryId(data.id);
      setCategoryName(data.name);
      setCategoryDescription(data.description || "");
      setCategoryThumbnailUrl(data.thumbnail_url ?? null);
      setCategoryBlocks(Array.isArray(data.content_blocks) ? data.content_blocks : []);

      loadCategories();
      toast({ title: "作成完了", description: "新しいカテゴリを作成しました" });
    } catch (error) {
      console.error("Error creating category:", error);
      toast({ title: "エラー", description: "カテゴリの作成に失敗しました", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async () => {
    if (!siteId || !categoryName.trim()) {
      toast({ title: "エラー", description: "カテゴリ名を入力してください", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: categoryName,
        description: categoryDescription,
        site_id: siteId,
        sort_order: categories.length,
        thumbnail_url: categoryThumbnailUrl,
        content_blocks: Array.isArray(categoryBlocks) ? categoryBlocks : [], // 常に配列
      };

      if (selectedCategoryId) {
        const { error } = await supabase.from("member_site_categories").update(payload).eq("id", selectedCategoryId);
        if (error) throw error;
        toast({ title: "保存完了", description: "カテゴリを更新しました" });
      } else {
        const { error } = await supabase.from("member_site_categories").insert(payload);
        if (error) throw error;
        toast({ title: "作成完了", description: "新しいカテゴリを作成しました" });
      }
      loadCategories();
    } catch (error) {
      console.error("Error saving category:", error);
      toast({ title: "エラー", description: "カテゴリの保存に失敗しました", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectCategory = (category: Category) => {
    setSelectedCategoryId(category.id);
    setCategoryName(category.name);
    setCategoryDescription(category.description || "");
    setCategoryThumbnailUrl(category.thumbnail_url ?? null);
    setCategoryBlocks(Array.isArray(category.content_blocks) ? category.content_blocks : []);
  };

  const deleteCategory = async (categoryId: string) => {
    if (!confirm("本当にこのカテゴリを削除しますか？このカテゴリに属するコンテンツは「カテゴリなし」に移動されます。")) return;
    setSaving(true);
    try {
      await supabase.from("member_site_content").update({ category_id: null }).eq("category_id", categoryId);
      const { error } = await supabase.from("member_site_categories").delete().eq("id", categoryId);
      if (error) throw error;

      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null);
        setCategoryName("");
        setCategoryDescription("");
        setCategoryThumbnailUrl(null);
        setCategoryBlocks([]);
      }
      loadCategories();
      loadSiteContents();
      toast({ title: "削除完了", description: "カテゴリを削除しました" });
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({ title: "エラー", description: "カテゴリの削除に失敗しました", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedContent = siteContents.find((c) => c.id === selectedContentId);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/member-sites")} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              サイト一覧に戻る
            </Button>
            <Settings className="w-6 h-6" />
            <h1 className="text-2xl font-bold">{siteId ? "サイト編集" : "新しいサイトを作成"}</h1>
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
            {/* Left Column */}
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
                  <div className="text-sm text-muted-foreground">作成中のサイト: {sites.length}件</div>
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
                            siteId === s.id ? "bg-primary/10 border-primary shadow-sm" : "border-border hover:border-primary/50 hover:bg-muted/60"
                          }`}
                        >
                          <button onClick={() => setSearchParams({ site: s.id })} className="flex-1 text-left min-w-0">
                            <div className="text-sm font-medium line-clamp-1">{s.name}</div>
                          </button>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/member-site/${s.slug}`, "_blank");
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
                                (async () => {
                                  if (!confirm("本当にこのサイトを削除しますか？関連するコンテンツも全て削除されます。")) return;
                                  try {
                                    await supabase.from("member_site_content").delete().eq("site_id", s.id);
                                    await supabase.from("member_site_categories").delete().eq("site_id", s.id);
                                    await supabase.from("member_site_payments").delete().eq("site_id", s.id);
                                    await supabase.from("member_site_subscriptions").delete().eq("site_id", s.id);
                                    await supabase.from("member_site_users").delete().eq("site_id", s.id);
                                    const { error } = await supabase.from("member_sites").delete().eq("id", s.id);
                                    if (error) throw error;
                                    if (s.id === searchParams.get("site")) setSearchParams({});
                                    await loadSites();
                                    toast({ title: "削除完了", description: "サイトを削除しました" });
                                  } catch (err) {
                                    console.error(err);
                                    toast({ title: "エラー", description: "サイトの削除に失敗しました", variant: "destructive" });
                                  }
                                })();
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

            {/* Right Column */}
            <div className="col-span-12 md:col-span-9 space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="content-list">コンテンツ一覧</TabsTrigger>
                  <TabsTrigger value="category-settings">カテゴリ設定</TabsTrigger>
                  <TabsTrigger value="plan-settings">プラン設定</TabsTrigger>
                  <TabsTrigger value="content-display">コンテンツ表示方法</TabsTrigger>
                  <TabsTrigger value="site-settings">サイト設定</TabsTrigger>
                </TabsList>

                {/* Content List */}
                <TabsContent value="content-list" className="border-2 border-border rounded-none">
                  <div className="flex">
                    {/* Sidebar */}
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
                              {siteContents.map((content, index) => (
                                <div key={content.id} className={`border-t border-border ${index === 0 ? "border-t-0" : ""} ${index === siteContents.length - 1 ? "border-b" : ""}`}>
                                  <TableRow
                                    className={`cursor-pointer w-full ${selectedContentId === content.id ? "bg-[#0cb386]/20" : ""}`}
                                    onClick={() => selectContent(content)}
                                  >
                                    <TableCell className="py-1 text-left align-top w-full">
                                      <div className="flex items-center gap-2">
                                        <span className={`h-2 w-2 rounded-full ${content.is_published ? "bg-green-500" : "bg-red-500"}`}></span>
                                        <div className="h-4 w-px bg-border"></div>
                                        <div className="min-w-0 flex-1">
                                          <div className="text-xs font-medium truncate">{content.title}</div>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-1 text-right align-top w-1/4">
                                      <div className="flex items-center justify-end gap-1">
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
                                </div>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </div>

                    {/* Main */}
                    <div className="w-4/5 rounded-none">
                      {selectedContent ? (
                        <Card className="rounded-none">
                          <CardHeader>
                            <CardTitle>ページ編集</CardTitle>
                            <CardDescription>{selectedContent.title} の編集</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="contentTitle">ページタイトル</Label>
                                <Input id="contentTitle" value={contentTitle} onChange={(e) => setContentTitle(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="contentSlug">URL スラッグ</Label>
                                <Input id="contentSlug" value={contentSlug} onChange={(e) => setContentSlug(e.target.value)} />
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="contentType">ページタイプ</Label>
                                <Select value={contentType} onValueChange={(v: "page" | "post" | "landing") => setContentType(v)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border z-50">
                                    <SelectItem value="page">ページ</SelectItem>
                                    <SelectItem value="post">投稿</SelectItem>
                                    <SelectItem value="landing">ランディング</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="contentAccessLevel">アクセスレベル</Label>
                                <Select value={contentAccessLevel} onValueChange={(v: "public" | "member" | "premium") => setContentAccessLevel(v)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border z-50">
                                    <SelectItem value="public">パブリック</SelectItem>
                                    <SelectItem value="member">会員限定</SelectItem>
                                    <SelectItem value="premium">プレミアム会員限定</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="category">カテゴリ</Label>
                                <Select value={contentCategoryId} onValueChange={setContentCategoryId}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="カテゴリを選択" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border z-50">
                                    <SelectItem value="none">カテゴリなし</SelectItem>
                                    {categories.map((category) => (
                                      <SelectItem key={category.id} value={category.id}>
                                        {category.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>公開設定</Label>
                                <label className="flex items-center space-x-2">
                                  <input type="checkbox" checked={contentPublished} onChange={(e) => setContentPublished(e.target.checked)} />
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
                        <Card className="rounded-none">
                          <CardContent className="p-12">
                            <div className="text-center">
                              <p className="text-muted-foreground mb-4">左側からページを選択して編集するか、新しいページを作成してください</p>
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

                {/* Category Settings */}
                <TabsContent value="category-settings" className="border-2 border-border rounded-none">
                  <div className="flex">
                    {/* Sidebar */}
                    <div className="w-1/5 border-r border-border flex flex-col">
                      <div className="bg-[rgb(12,34,54)] py-6 px-4">
                        <div className="flex items-center justify-center">
                          <h3 className="text-base font-medium text-white">カテゴリ一覧</h3>
                        </div>
                      </div>
                      <div className="bg-white p-4 border-b border-border">
                        <Button size="sm" onClick={createNewCategory} disabled={saving} className="w-full bg-[#0cb386] hover:bg-[#0cb386]/90 text-white">
                          <Plus className="w-4 h-4 mr-2" />
                          カテゴリ追加
                        </Button>
                      </div>
                      <div className="flex-grow overflow-y-auto">
                        {categories.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-4">カテゴリがありません</p>
                        ) : (
                          <Table className="w-full border-collapse">
                            <TableBody>
                              {categories.map((category, index) => (
                                <div key={category.id} className={`border-t border-border ${index === 0 ? "border-t-0" : ""} ${index === categories.length - 1 ? "border-b" : ""}`}>
                                  <TableRow
                                    className={`cursor-pointer w-full ${selectedCategoryId === category.id ? "bg-[#0cb386]/20" : ""}`}
                                    onClick={() => selectCategory(category)}
                                  >
                                    <TableCell className="py-2 text-left w-full">
                                      <div className="flex items-center gap-2">
                                        {category.thumbnail_url && <img src={category.thumbnail_url} className="w-6 h-6 object-cover rounded" alt="" />}
                                        <div className="text-xs font-medium">{category.name}</div>
                                      </div>
                                      <div className="text-xs text-muted-foreground">{category.content_count}件のコンテンツ</div>
                                    </TableCell>
                                    <TableCell className="py-2 text-right w-1/4">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteCategory(category.id);
                                          }}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                </div>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </div>

                    {/* Main */}
                    <div className="w-4/5 rounded-none">
                      {selectedCategory || (!selectedCategoryId && categoryName) ? (
                        <Card className="rounded-none">
                          <CardHeader>
                            <CardTitle>カテゴリ編集</CardTitle>
                            <CardDescription>{selectedCategory ? `${selectedCategory.name} の編集` : "新しいカテゴリを作成"}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="space-y-2">
                              <Label htmlFor="categoryName">カテゴリ名</Label>
                              <Input id="categoryName" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="カテゴリ名を入力してください" />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="categoryDescription">説明</Label>
                              <Textarea
                                id="categoryDescription"
                                value={categoryDescription}
                                onChange={(e) => setCategoryDescription(e.target.value)}
                                placeholder="カテゴリの説明を入力してください（任意）"
                                rows={4}
                              />
                            </div>

                            {/* URL入力 + MediaLibrary ボタン */}
                            <div className="space-y-2">
                              <Label htmlFor="thumbnail-url">サムネイルURL</Label>
                              <Input
                                id="thumbnail-url"
                                placeholder="https://example.com/image.jpg"
                                value={categoryThumbnailUrl ?? ""}
                                onChange={(e) => setCategoryThumbnailUrl(e.target.value || null)}
                              />
                              <p className="text-xs text-muted-foreground">直接URLを入力するか、下の「画像を選択」ボタンからメディアライブラリを開いて設定できます。</p>
                            </div>

                            <div className="space-y-2">
                              <Label>サムネイル画像</Label>
                              <div className="flex items-center gap-2">
                                {categoryThumbnailUrl && (
                                  <img src={categoryThumbnailUrl} alt="Category Thumbnail" className="w-24 h-24 object-cover rounded-md border" />
                                )}

                                <MediaLibrarySelector
                                  trigger={
                                    <Button type="button" variant="outline" className="flex items-center gap-2">
                                      <ImageIcon className="w-4 h-4" />
                                      {categoryThumbnailUrl ? "画像を変更" : "画像を選択"}
                                    </Button>
                                  }
                                  onSelect={(url: string) => setCategoryThumbnailUrl(url)}
                                  selectedUrl={categoryThumbnailUrl ?? undefined}
                                />

                                {categoryThumbnailUrl && (
                                  <Button type="button" variant="ghost" size="icon" onClick={() => setCategoryThumbnailUrl(null)} title="画像を削除">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* ブロックエディタ */}
                            <div className="space-y-2">
                              <Label>詳細コンテンツ（ブロックエディタ）</Label>
                              <EnhancedBlockEditor
                                blocks={Array.isArray(categoryBlocks) ? categoryBlocks : []}
                                onChange={(next: any[]) => setCategoryBlocks(Array.isArray(next) ? next : [])}
                              />
                              <div className="flex gap-2">
                                <Button type="button" variant="secondary" onClick={() => setCategoryBlocks([])} title="ブロックをクリア">
                                  クリア
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                この内容は <code>member_site_categories.content_blocks</code>（JSON配列）に保存されます。
                              </p>
                            </div>

                            <Button onClick={saveCategory} disabled={saving || !categoryName.trim()} className="w-full">
                              <Save className="w-4 h-4 mr-2" />
                              {saving ? "保存中..." : selectedCategoryId ? "カテゴリを更新" : "カテゴリを作成"}
                            </Button>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="rounded-none">
                          <CardContent className="p-12">
                            <div className="text-center">
                              <p className="text-muted-foreground mb-4">左側からカテゴリを選択して編集するか、新しいカテゴリを作成してください</p>
                              <Button onClick={createNewCategory}>
                                <Plus className="w-4 h-4 mr-2" />
                                最初のカテゴリを作成
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Plan Settings */}
                <TabsContent value="plan-settings" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>プラン設定</CardTitle>
                      <CardDescription>このサイトの料金プランを設定します</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="access-type">アクセス種別</Label>
                          <Select value={accessType} onValueChange={(v: "free" | "paid") => setAccessType(v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border z-50">
                              <SelectItem value="free">無料</SelectItem>
                              <SelectItem value="paid">有料</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="price">価格（円）</Label>
                          <Input id="price" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} disabled={accessType === "free"} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Content Display */}
                <TabsContent value="content-display" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>コンテンツ表示方法</CardTitle>
                      <CardDescription>この機能は開発中です。</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">この機能は開発中です。</p>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Site Settings */}
                <TabsContent value="site-settings" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>基本設定</CardTitle>
                      <CardDescription>サイトの基本情報を設定します</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="site-name">サイト名</Label>
                          <Input id="site-name" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="サイト名を入力" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="site-slug">URL スラッグ</Label>
                          <Input id="site-slug" value={siteSlug} onChange={(e) => setSiteSlug(e.target.value)} placeholder="url-slug" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="site-description">サイト説明</Label>
                        <Textarea id="site-description" value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} placeholder="サイトの説明を入力" rows={4} />
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                          <span>サイトを公開する</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                          <span>検索エンジンに表示</span>
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>デザイン設定</CardTitle>
                      <CardDescription>公開ページのデザインを設定します</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="header-bg-color">ヘッダー背景色</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="header-bg-color"
                              type="color"
                              value={headerBgColor}
                              onChange={(e) => setHeaderBgColor(e.target.value)}
                              className="p-1 h-10 w-14"
                            />
                            <Input
                              type="text"
                              value={headerBgColor}
                              onChange={(e) => setHeaderBgColor(e.target.value)}
                              placeholder="#FFFFFF"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="header-fg-color">ヘッダー文字色</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="header-fg-color"
                              type="color"
                              value={headerFgColor}
                              onChange={(e) => setHeaderFgColor(e.target.value)}
                              className="p-1 h-10 w-14"
                            />
                            <Input
                              type="text"
                              value={headerFgColor}
                              onChange={(e) => setHeaderFgColor(e.target.value)}
                              placeholder="#000000"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="sidebar-bg-color">サイドバー背景色</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="sidebar-bg-color"
                              type="color"
                              value={sidebarBgColor}
                              onChange={(e) => setSidebarBgColor(e.target.value)}
                              className="p-1 h-10 w-14"
                            />
                            <Input
                              type="text"
                              value={sidebarBgColor}
                              onChange={(e) => setSidebarBgColor(e.target.value)}
                              placeholder="#FFFFFF"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sidebar-fg-color">サイドバー文字色</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="sidebar-fg-color"
                              type="color"
                              value={sidebarFgColor}
                              onChange={(e) => setSidebarFgColor(e.target.value)}
                              className="p-1 h-10 w-14"
                            />
                            <Input
                              type="text"
                              value={sidebarFgColor}
                              onChange={(e) => setSidebarFgColor(e.target.value)}
                              placeholder="#000000"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Button onClick={saveSite} disabled={saving} className="w-full">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "保存中..." : "サイト設定を保存"}
                  </Button>
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