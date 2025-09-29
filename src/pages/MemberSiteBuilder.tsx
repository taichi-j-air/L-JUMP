import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Eye, Plus, Trash2, Settings, Image as ImageIcon, ExternalLink, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { MediaLibrarySelector } from "@/components/MediaLibrarySelector";
import { EnhancedBlockEditor } from "@/components/EnhancedBlockEditor";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* =========================
   追加インストール不要のローカル Modifiers
   ========================= */
// clamp ユーティリティ
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** 水平方向の移動を禁止（上下のみ） */
const restrictToVerticalAxis = ({ transform }: any) => {
  return { ...transform, x: 0 };
};

/** 親コンテナの枠内に移動を制限（上下のみ） */
const restrictToParentElement = (args: any) => {
  const { transform } = args;
  // dnd-kit の実装差異に備え、いくつかの候補から枠矩形・要素矩形を拾う
  const container =
    args.scrollableAncestorRects?.[0] ??
    args.containerNodeRect ??
    args.windowRect ??
    null;
  const activeRect = args.draggingNodeRect ?? args.activeNodeRect ?? null;

  if (!container || !activeRect) {
    // 情報が取れない環境でも横移動は殺しておく
    return { ...transform, x: 0 };
  }

  const offsetTop = activeRect.top - container.top;
  const minY = -offsetTop; // これ以上上だと枠外
  const maxY = container.height - activeRect.height - offsetTop; // これ以上下だと枠外

  return {
    ...transform,
    x: 0,
    y: clamp(transform.y, minY, maxY),
  };
};

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
  content_blocks?: any[] | null;
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
  ignore_sequential?: boolean;
}

/* ========== Sortables: 共通スタイル ========== */
const useSortableStyle = (transform: any, transition: string | undefined, isDragging: boolean) =>
  ({
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  } as React.CSSProperties);

/* ========== メイン ========== */
const MemberSiteBuilder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const siteId = searchParams.get("site");

  /** ハンドル運用向け：2px移動でドラッグ開始（誤作動防止） */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(KeyboardSensor)
  );

  // A new inline component for the sortable row to use hooks correctly
  const SortableCategoryRow = ({ category }: { category: Category }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
    const style = useSortableStyle(transform, transition, isDragging);

    return (
      <div ref={setNodeRef} style={style} className="border-b border-border">
        <TableRow
          className={`cursor-pointer w-full ${selectedCategoryId === category.id ? "bg-[#0cb386]/20" : ""}`}
          onClick={() => selectCategory(category)}
        >
          <TableCell className="py-2 w-8 align-middle">
            <button
              type="button"
              aria-label="ドラッグで並び替え"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted cursor-grab active:cursor-grabbing"
              style={{ touchAction: "none" }}
              title="ドラッグで並び替え"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          </TableCell>
          <TableCell className="py-2 text-left w-full">
            <div className="flex items-center gap-2">
              {category.thumbnail_url && (
                <img src={category.thumbnail_url} className="w-6 h-6 object-cover rounded" alt="" draggable={false} />
              )}
              <div className="text-xs font-medium">{category.name}</div>
            </div>
            <div className="text-xs text-muted-foreground">{category.content_count}件のコンテンツ</div>
          </TableCell>
          <TableCell className="py-2 text-right w-1/4">
            <div className="flex items-center justify-end gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => e.stopPropagation()}
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>本当にこのカテゴリを削除しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      「{category.name}」を削除します。このカテゴリに属するコンテンツは「カテゴリなし」に移動されます。この操作は元に戻せません。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setSaving(true);
                        try {
                          await supabase.from("member_site_content").update({ category_id: null }).eq("category_id", category.id);
                          const { error } = await supabase.from("member_site_categories").delete().eq("id", category.id);
                          if (error) throw error;
                          if (selectedCategoryId === category.id) {
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
                      }}
                    >
                      削除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TableCell>
        </TableRow>
      </div>
    );
  }


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
  const [headerBgColor, setHeaderBgColor] = useState("#ffffff");
  const [headerFgColor, setHeaderFgColor] = useState("#000000");
  const [sidebarBgColor, setSidebarBgColor] = useState("#ffffff");
  const [sidebarFgColor, setSidebarFgColor] = useState("#000000");
  const [sidebarHoverBgColor, setSidebarHoverBgColor] = useState("#f1f5f9");
  const [sidebarHoverFgColor, setSidebarHoverFgColor] = useState("#000000");
  const [sidebarActiveBgColor, setSidebarActiveBgColor] = useState("#60a5fa");
  const [sidebarActiveFgColor, setSidebarActiveFgColor] = useState("#ffffff");
  const [showContentCount, setShowContentCount] = useState(true);
  const [sequentialProgression, setSequentialProgression] = useState(false);

  // Access control state
  const [requirePasscode, setRequirePasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [allTags, setAllTags] = useState<{id: string, name: string}[]>([]);
  const [allowedTagIds, setAllowedTagIds] = useState<string[]>([]);
  const [blockedTagIds, setBlockedTagIds] = useState<string[]>([]);

  // Content editing
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [contentTitle, setContentTitle] = useState("");
  const [contentBlocks, setContentBlocks] = useState<any[]>([]);
  const [contentSlug, setContentSlug] = useState("");
  const [contentPublished, setContentPublished] = useState(false);
  const [contentCategoryId, setContentCategoryId] = useState<string>("none");
  const [contentSortOrder, setContentSortOrder] = useState(0);
  const [filterCategoryId, setFilterCategoryId] = useState("all");

  // Category editing
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryThumbnailUrl, setCategoryThumbnailUrl] = useState<string | null>(null);
  const [categoryBlocks, setCategoryBlocks] = useState<any[]>([]); // JSON array
  const [ignoreSequential, setIgnoreSequential] = useState(false);

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
      setHeaderBgColor("#ffffff");
      setHeaderFgColor("#000000");
      setSidebarBgColor("#ffffff");
      setSidebarFgColor("#000000");
      setSidebarHoverBgColor("#f1f5f9");
      setSidebarHoverFgColor("#000000");
      setSidebarActiveBgColor("#60a5fa");
      setSidebarActiveFgColor("#ffffff");
      setShowContentCount(true);
      setSequentialProgression(false);
      setRequirePasscode(false);
      setPasscode("");
      setAllowedTagIds([]);
      setBlockedTagIds([]);
      setSelectedContentId(null);
      setContentTitle("");
      setContentBlocks([]);
      setContentSlug("");
      setContentPublished(false);
      setContentCategoryId("none");
      setSelectedCategoryId(null);
      setCategoryName("");
      setCategoryDescription("");
      setCategoryThumbnailUrl(null);
      setCategoryBlocks([]);
      setIgnoreSequential(false);

      // load fresh
      loadSiteData();
      loadSiteContents();
      loadCategories();
      loadTags();
      setIgnoreSequential(false);
    } else {
      // reset all when no site selected
      setSite(null);
      setSiteName("");
      setSiteDescription("");
      setSiteSlug("");
      setAccessType("paid");
      setPrice(0);
      setIsPublished(false);
      setHeaderBgColor("#ffffff");
      setHeaderFgColor("#000000");
      setSidebarBgColor("#ffffff");
      setSidebarFgColor("#000000");
      setSidebarHoverBgColor("#f1f5f9");
      setSidebarHoverFgColor("#000000");
      setSidebarActiveBgColor("#60a5fa");
      setSidebarActiveFgColor("#ffffff");
      setShowContentCount(true);
      setSequentialProgression(false);
      setRequirePasscode(false);
      setPasscode("");
      setAllowedTagIds([]);
      setBlockedTagIds([]);
      setSiteContents([]);
      setSelectedContentId(null);
      setCategories([]);
      setSelectedCategoryId(null);
      setCategoryName("");
      setCategoryDescription("");
      setCategoryThumbnailUrl(null);
      setCategoryBlocks([]);
      setIgnoreSequential(false);
    }
  }, [siteId]);

  const loadSites = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSites([]);
        toast({ title: "エラー", description: "ユーザー情報が取得できませんでした。", variant: "destructive" });
        return;
      }
      const { data, error } = await supabase.from("member_sites").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      setSites((data || []).map((d: any) => ({ ...d, access_type: (d.access_type || "paid") as "free" | "paid" })));
    } catch (error) {
      console.error("Error loading sites:", error);
      toast({ title: "エラー", description: "サイト一覧の読み込みに失敗しました", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const { data, error } = await supabase.from("tags").select("id, name");
      if (error) throw error;
      setAllTags(data || []);
    } catch (error) {
      console.error("Error loading tags:", error);
      toast({ title: "エラー", description: "タグの読み込みに失敗しました", variant: "destructive" });
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
      const theme = (data.theme_config as any) || {};
      setHeaderBgColor(theme.headerBgColor || "#ffffff");
      setHeaderFgColor(theme.headerFgColor || "#000000");
      setSidebarBgColor(theme.sidebarBgColor || "#ffffff");
      setSidebarFgColor(theme.sidebarFgColor || "#000000");
      setSidebarHoverBgColor(theme.sidebarHoverBgColor || "#f1f5f9");
      setSidebarHoverFgColor(theme.sidebarHoverFgColor || "#000000");
      setSidebarActiveBgColor(theme.sidebarActiveBgColor || "#60a5fa");
      setSidebarActiveFgColor(theme.sidebarActiveFgColor || "#ffffff");
      setShowContentCount(theme.showContentCount !== false);
      setSequentialProgression(theme.sequentialProgression || false);

      // Load access control settings
      setRequirePasscode(data.require_passcode || false);
      setPasscode(data.passcode || "");
      setAllowedTagIds(data.allowed_tag_ids || []);
      setBlockedTagIds(data.blocked_tag_ids || []);
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
      setSiteContents(
        (data || []).map((item) => ({
          ...item,
          page_type: item.page_type as "page" | "post" | "landing",
          access_level: item.access_level as "public" | "premium" | "member",
          content_blocks: Array.isArray(item.content_blocks) ? item.content_blocks : [],
        }))
      );
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
          content_count: Array.isArray(cat.member_site_content) ? cat.member_site_content.length : cat.member_site_content?.[0]?.count ?? 0,
          ignore_sequential: cat.ignore_sequential,
        })) ?? [];

      setCategories(formatted);
    } catch (error) {
      console.error("Error loading categories:", error);
      toast({ title: "エラー", description: "カテゴリの読み込みに失敗しました", variant: "destructive" });
    }
  };

  const resetToDefaultColors = () => {
    setHeaderBgColor("#051e38");
    setHeaderFgColor("#ffffff");
    setSidebarBgColor("#21242c");
    setSidebarFgColor("#ffffff");
    setSidebarHoverBgColor("#e3e3e3");
    setSidebarHoverFgColor("#212121");
    setSidebarActiveBgColor("#828282");
    setSidebarActiveFgColor("#21242c");
    toast({ title: "デザイン設定をデフォルトに戻しました", description: "保存ボタンを押して変更を適用してください" });
  };

  const saveSite = async () => {
    setSaving(true);
    try {
      const theme_config = {
        headerBgColor,
        headerFgColor,
        sidebarBgColor,
        sidebarFgColor,
        sidebarHoverBgColor,
        sidebarHoverFgColor,
        sidebarActiveBgColor,
        sidebarActiveFgColor,
        showContentCount,
        sequentialProgression,
      };
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
            theme_config,
            require_passcode: requirePasscode,
            passcode: passcode,
            allowed_tag_ids: allowedTagIds,
            blocked_tag_ids: blockedTagIds,
          })
          .eq("id", siteId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("member_sites")
          .insert({
            name: "新しいサイト",
            description: "",
            slug: `site-${Date.now()}`,
            access_type: "paid",
            price: 0,
            is_published: false,
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
          content_blocks: contentBlocks, // Save new block data
          content: "", // Clear legacy field
          slug: contentSlug,
          is_published: contentPublished,
          category_id: contentCategoryId === "none" ? null : contentCategoryId,
          sort_order: contentSortOrder,
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
          content_blocks: [], // Initialize with empty blocks array
          slug: `page-${Date.now()}`,
          is_published: false,
          sort_order: siteContents.length,
        })
        .select()
        .single();
      if (error) throw error;

      setSelectedContentId(data.id);
      setContentTitle(data.title);
      setContentSlug(data.slug);
      setContentPublished(data.is_published);
      setContentCategoryId(data.category_id || "none");
      setContentSortOrder(data.sort_order);
      setContentBlocks(Array.isArray(data.content_blocks) ? data.content_blocks : []);

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
    setContentSlug(content.slug);
    setContentPublished(content.is_published);
    setContentCategoryId(content.category_id || "none");
    setContentSortOrder(content.sort_order);

    // Handle content_blocks (new) and content (legacy)
    if (content.content_blocks && Array.isArray(content.content_blocks) && content.content_blocks.length > 0) {
      setContentBlocks(content.content_blocks);
    } else if (content.content) {
      // Convert legacy text content to a single paragraph block
      setContentBlocks([{
        id: `block-${Date.now()}`,
        type: 'paragraph',
        data: { text: content.content }
      }]);
    } else {
      setContentBlocks([]);
    }
  };

  const deleteContent = async (contentId: string) => {
    // This logic has been moved to the AlertDialog
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
          content_blocks: [],
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
        content_blocks: Array.isArray(categoryBlocks) ? categoryBlocks : [],
        ignore_sequential: ignoreSequential,
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
    if (Array.isArray(category.content_blocks)) {
      setCategoryBlocks(category.content_blocks);
    } else if (typeof category.content_blocks === 'string') {
      try {
        const parsed = JSON.parse(category.content_blocks);
        setCategoryBlocks(Array.isArray(parsed) ? parsed : []);
      } catch {
        setCategoryBlocks([]);
      }
    } else {
      setCategoryBlocks([]);
    }
    setIgnoreSequential(category.ignore_sequential || false);
  };

  const deleteCategory = async (categoryId: string) => {
    // This logic has been moved to the AlertDialog
  };

  /** ▼▼ 並べ替え（カテゴリ）上下のみ＆枠内のみ ▼▼ */
  const handleCategoryDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((cat) => cat.id === active.id);
    const newIndex = categories.findIndex((cat) => cat.id === over.id);

    const newCategories = arrayMove(categories, oldIndex, newIndex);
    setCategories(newCategories);

    setSaving(true);
    try {
      for (let i = 0; i < newCategories.length; i++) {
        await supabase.from("member_site_categories").update({ sort_order: i }).eq("id", newCategories[i].id);
      }
      toast({ title: "並べ替え完了", description: "カテゴリの順序を保存しました" });
    } catch (error) {
      console.error("Error updating category sort order:", error);
      toast({ title: "エラー", description: "カテゴリの順序の保存に失敗しました", variant: "destructive" });
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
                                window.open(`/member-site/${s.slug}?preview=true`, "_blank");
                              }}
                              title="プレビュー (オーナー特権)"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                const publicUrl = `${window.location.origin}/member-site/${s.slug}?uid=[UID]`;

                                navigator.clipboard.writeText(publicUrl);
                                toast({
                                  title: "URLをコピーしました",
                                  description: "公開URLをクリップボードにコピーされました。[UID]をLINE友達のショートUIDに置き換えてください。",
                                });
                              }}
                              title="公開URLをコピー"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  disabled={saving}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>本当にこのサイトを削除しますか？</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    「{s.name}」に関連するすべてのコンテンツ、カテゴリ、設定が完全に削除されます。この操作は元に戻せません。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={async () => {
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
                                    }}
                                  >
                                    削除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
                      <div className="bg-white py-2 px-4 border-b border-border">
                        <div className="text-xs font-medium mb-2">カテゴリ別絞り込み</div>
                        <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
                          <SelectTrigger className="w-full h-8">
                            <SelectValue placeholder="カテゴリで絞り込み" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border z-50">
                            <SelectItem value="all">すべて</SelectItem>
                            <SelectItem value="unassigned">未設定</SelectItem>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-grow overflow-y-auto">
                        {siteContents.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-2">ページがありません</p>
                        ) : (
                          <Table className="w-full border-collapse table-fixed">
                            <TableBody>
                              {siteContents
                                .filter(
                                  (content) =>
                                    filterCategoryId === "all" ||
                                    (filterCategoryId === "unassigned" && !content.category_id) ||
                                    content.category_id === filterCategoryId
                                )
                                .map((content) => (
                                  <TableRow
                                    key={content.id}
                                    className={`cursor-pointer w-full ${selectedContentId === content.id ? "bg-[#0cb386]/20" : ""}`}
                                    onClick={() => selectContent(content)}
                                  >
                                    <TableCell className="py-1 pl-4 text-left align-top w-full">
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
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-5 w-5 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                              onClick={(e) => e.stopPropagation()}
                                              title="削除"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>本当にこのページを削除しますか？</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                「{content.title}」は完全に削除されます。この操作は元に戻せません。
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                              <AlertDialogAction
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  try {
                                                    const { error } = await supabase.from("member_site_content").delete().eq("id", content.id);
                                                    if (error) throw error;
                                                    if (selectedContentId === content.id) {
                                                      setSelectedContentId(null);
                                                      setContentTitle("");
                                                      setContentSlug("");
                                                      setContentBlocks([]);
                                                      setContentPublished(false);
                                                      setContentCategoryId("none");
                                                      setContentSortOrder(0);
                                                    }
                                                    loadSiteContents();
                                                    loadCategories();
                                                    toast({ title: "削除完了", description: "ページを削除しました" });
                                                  } catch (error) {
                                                    console.error("Error deleting content:", error);
                                                    toast({ title: "エラー", description: "ページの削除に失敗しました", variant: "destructive" });
                                                  }
                                                }}
                                              >
                                                削除
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </TableCell>
                                  </TableRow>
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

                            <div className="grid grid-cols-3 gap-4">
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
                              <div className="space-y-2 flex items-end">
                                <label className="flex items-center space-x-2 pb-2">
                                  <Switch checked={contentPublished} onCheckedChange={setContentPublished} id="content-published" />
                                  <Label htmlFor="content-published">公開する</Label>
                                </label>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="contentSortOrder">表示順位</Label>
                                <Input
                                  id="contentSortOrder"
                                  type="number"
                                  value={contentSortOrder}
                                  onChange={(e) => setContentSortOrder(Number(e.target.value))}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>コンテンツ</Label>
                              <div className="p-2 border rounded-md min-h-[300px]">
                                <EnhancedBlockEditor
                                  blocks={contentBlocks}
                                  onChange={setContentBlocks}
                                  hideBackgroundBlockButton={true}
                                  hideTemplateButton={true}
                                />
                              </div>
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
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleCategoryDragEnd}
                            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                          >
                            <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                              <Table className="w-full border-collapse">
                                <TableBody className="border-t border-border">
                                  {categories.map((category) => (
                                    <SortableCategoryRow key={category.id} category={category} />
                                  ))}
                                </TableBody>
                              </Table>
                            </SortableContext>
                          </DndContext>
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

                            <div className="flex items-center space-x-2 p-4 border rounded-lg">
                              <Switch
                                id="ignore-sequential"
                                checked={ignoreSequential}
                                onCheckedChange={setIgnoreSequential}
                              />
                              <div className="space-y-0.5">
                                <Label htmlFor="ignore-sequential">シーケンシャル設定を無視</Label>
                                <p className="text-xs text-muted-foreground">
                                  このカテゴリでは、サイト全体のシーケンシャル設定を無視して常に全てのコンテンツを表示します。
                                </p>
                              </div>
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
                      <CardDescription>会員サイトでのコンテンツの表示順序や条件を設定します。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center space-x-2 p-4 border rounded-lg">
                        <Switch
                          id="sequential-progression"
                          checked={sequentialProgression}
                          onCheckedChange={setSequentialProgression}
                        />
                        <div className="space-y-0.5">
                          <Label htmlFor="sequential-progression">シーケンシャル・プログレッション</Label>
                          <p className="text-xs text-muted-foreground">
                            前のコンテンツを完了しないと、次のコンテンツが表示されないようにします。
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button onClick={saveSite} disabled={saving} className="w-full">
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "保存中..." : "表示方法を保存"}
                      </Button>
                    </CardFooter>
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
                          <Switch checked={isPublished} onCheckedChange={setIsPublished} id="is-published" />
                          <Label htmlFor="is-published">サイトを公開する</Label>
                        </label>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Access Control Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>アクセス設定</CardTitle>
                      <CardDescription>パスコードやLINE友だちのタグでサイトへのアクセスを制御します。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Passcode Settings */}
                      <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-semibold">パスコード設定</h4>
                        <div className="flex items-center space-x-2">
                          <Switch id="require-passcode" checked={requirePasscode} onCheckedChange={setRequirePasscode} />
                          <Label htmlFor="require-passcode">パスコードを必須にする</Label>
                        </div>
                        {requirePasscode && (
                          <div className="space-y-2">
                            <Label htmlFor="passcode">パスコード</Label>
                            <Input id="passcode" type="text" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="パスコードを入力" />
                          </div>
                        )}
                      </div>

                      {/* Tag Settings */}
                      <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-semibold">タグ設定</h4>
                        <div className="space-y-2">
                          <Label>閲覧を許可するタグ（いずれか1つ以上持っている場合にアクセスを許可）</Label>
                          <div className="p-2 border rounded-md h-32 overflow-y-auto space-y-1">
                            {allTags.map(tag => (
                              <div key={tag.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`allowed-${tag.id}`}
                                  checked={allowedTagIds.includes(tag.id)}
                                  onCheckedChange={(checked) => {
                                    setAllowedTagIds(prev => 
                                      checked ? [...prev, tag.id] : prev.filter(id => id !== tag.id)
                                    );
                                  }}
                                />
                                <Label htmlFor={`allowed-${tag.id}`} className="font-normal">{tag.name}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>閲覧をブロックするタグ（いずれか1つでも持っている場合にアクセスを拒否）</Label>
                          <div className="p-2 border rounded-md h-32 overflow-y-auto space-y-1">
                            {allTags.map(tag => (
                              <div key={tag.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`blocked-${tag.id}`}
                                  checked={blockedTagIds.includes(tag.id)}
                                  onCheckedChange={(checked) => {
                                    setBlockedTagIds(prev => 
                                      checked ? [...prev, tag.id] : prev.filter(id => id !== tag.id)
                                    );
                                  }}
                                />
                                <Label htmlFor={`blocked-${tag.id}`} className="font-normal">{tag.name}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
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
                            <Input id="header-bg-color" type="color" value={headerBgColor} onChange={(e) => setHeaderBgColor(e.target.value)} className="p-1 h-10 w-14" />
                            <Input type="text" value={headerBgColor} onChange={(e) => setHeaderBgColor(e.target.value)} placeholder="#FFFFFF" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="header-fg-color">ヘッダー文字色</Label>
                          <div className="flex items-center gap-2">
                            <Input id="header-fg-color" type="color" value={headerFgColor} onChange={(e) => setHeaderFgColor(e.target.value)} className="p-1 h-10 w-14" />
                            <Input type="text" value={headerFgColor} onChange={(e) => setHeaderFgColor(e.target.value)} placeholder="#000000" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="sidebar-bg-color">サイドバー背景色</Label>
                          <div className="flex items-center gap-2">
                            <Input id="sidebar-bg-color" type="color" value={sidebarBgColor} onChange={(e) => setSidebarBgColor(e.target.value)} className="p-1 h-10 w-14" />
                            <Input type="text" value={sidebarBgColor} onChange={(e) => setSidebarBgColor(e.target.value)} placeholder="#FFFFFF" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sidebar-fg-color">サイドバー文字色</Label>
                          <div className="flex items-center gap-2">
                            <Input id="sidebar-fg-color" type="color" value={sidebarFgColor} onChange={(e) => setSidebarFgColor(e.target.value)} className="p-1 h-10 w-14" />
                            <Input type="text" value={sidebarFgColor} onChange={(e) => setSidebarFgColor(e.target.value)} placeholder="#000000" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="sidebar-hover-bg-color">サイドバーホバー背景色</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="sidebar-hover-bg-color"
                              type="color"
                              value={sidebarHoverBgColor}
                              onChange={(e) => setSidebarHoverBgColor(e.target.value)}
                              className="p-1 h-10 w-14"
                            />
                            <Input type="text" value={sidebarHoverBgColor} onChange={(e) => setSidebarHoverBgColor(e.target.value)} placeholder="#f1f5f9" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sidebar-hover-fg-color">サイドバーホバー文字色</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="sidebar-hover-fg-color"
                              type="color"
                              value={sidebarHoverFgColor}
                              onChange={(e) => setSidebarHoverFgColor(e.target.value)}
                              className="p-1 h-10 w-14"
                            />
                            <Input type="text" value={sidebarHoverFgColor} onChange={(e) => setSidebarHoverFgColor(e.target.value)} placeholder="#000000" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="sidebar-active-bg-color">サイドバー選択中背景色</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="sidebar-active-bg-color"
                              type="color"
                              value={sidebarActiveBgColor}
                              onChange={(e) => setSidebarActiveBgColor(e.target.value)}
                              className="p-1 h-10 w-14"
                            />
                            <Input type="text" value={sidebarActiveBgColor} onChange={(e) => setSidebarActiveBgColor(e.target.value)} placeholder="#60a5fa" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sidebar-active-fg-color">サイドバー選択中文字色</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="sidebar-active-fg-color"
                              type="color"
                              value={sidebarActiveFgColor}
                              onChange={(e) => setSidebarActiveFgColor(e.target.value)}
                              className="p-1 h-10 w-14"
                            />
                            <Input type="text" value={sidebarActiveFgColor} onChange={(e) => setSidebarActiveFgColor(e.target.value)} placeholder="#ffffff" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>その他</Label>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="show-content-count" checked={showContentCount} onCheckedChange={(checked) => setShowContentCount(checked as boolean)} />
                          <label htmlFor="show-content-count" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            サイドバーにコンテンツ数を表示する
                          </label>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button variant="outline" onClick={resetToDefaultColors}>
                          デフォルトに戻す
                        </Button>
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
