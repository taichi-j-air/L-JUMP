import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Menu, X } from "lucide-react";

interface MemberSite {
  id: string;
  name: string;
  description?: string;
  is_published: boolean;
  theme_config?: any;
}

interface MemberSiteCategory {
  id: string;
  name: string;
  description?: string;
  content_count: number;
  sort_order: number;
  thumbnail_url?: string | null;
}

interface MemberSiteContent {
  id: string;
  title: string;
  content?: string;
  content_blocks?: any;
  category_id?: string;
  is_published: boolean;
  sort_order: number;
  page_type: string;
  progress_percentage?: number | null;
}

const MemberSiteView = () => {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [site, setSite] = useState<MemberSite | null>(null);
  const [categories, setCategories] = useState<MemberSiteCategory[]>([]);
  const [contents, setContents] = useState<MemberSiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [currentCategoryPage, setCurrentCategoryPage] = useState(1);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => (typeof window !== "undefined" ? window.innerWidth >= 1024 : true));
  const [themeConfig, setThemeConfig] = useState<any>({});

  // プログレスバーの色
  const progressBarColor = "hsl(var(--primary))";

  // テーマ設定
  const headerColors = {
    background: themeConfig.headerBgColor || "hsl(var(--card))",
    foreground: themeConfig.headerFgColor || "hsl(var(--card-foreground))",
  };
  const sidebarColors = {
    background: themeConfig.sidebarBgColor || "hsl(var(--card))",
    foreground: themeConfig.sidebarFgColor || "hsl(var(--card-foreground))",
  };

  // ページ状態の管理
  const currentView = searchParams.get('view') || 'categories'; // categories, content-list, content-detail
  const categoryId = searchParams.get('category');
  const contentId = searchParams.get('content');

  useEffect(() => {
    const loadSite = async () => {
      if (!slug) return;
      
      try {
        // サイト情報を取得
        const { data: siteData, error: siteError } = await supabase
          .from('member_sites')
          .select('*')
          .eq('slug', slug)
          .eq('is_published', true)
          .maybeSingle();

        if (siteError) throw siteError;
        if (!siteData) throw new Error('サイトが見つかりません');

        setSite(siteData);
        setThemeConfig(siteData.theme_config || {});

        // カテゴリ情報を取得
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('member_site_categories')
          .select('*')
          .eq('site_id', siteData.id)
          .order('sort_order', { ascending: true });

        if (categoriesError) throw categoriesError;
        setCategories(categoriesData || []);

        // コンテンツ情報を取得
        const { data: contentsData, error: contentsError } = await supabase
          .from('member_site_content')
          .select('*')
          .eq('site_id', siteData.id)
          .eq('is_published', true)
          .order('sort_order', { ascending: true });

        if (contentsError) throw contentsError;
        setContents(contentsData || []);

      } catch (error) {
        console.error('Error loading site:', error);
        setError(error instanceof Error ? error.message : 'サイトが見つかりません');
      } finally {
        setLoading(false);
      }
    };

    loadSite();
  }, [slug]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const categoriesPerRow = isDesktop ? 5 : 2;
  const rowsPerPage = isDesktop ? 2 : 4;
  const categoriesPerPage = categoriesPerRow * rowsPerPage;

  useEffect(() => {
    setCurrentCategoryPage((prev) => {
      const maxPage = Math.max(1, Math.ceil(categories.length / categoriesPerPage));
      return Math.min(prev, maxPage);
    });
  }, [categories.length, categoriesPerPage]);

  const totalCategoryPages = Math.max(1, Math.ceil(categories.length / categoriesPerPage));
  const paginatedCategories = categories.slice(
    (currentCategoryPage - 1) * categoriesPerPage,
    currentCategoryPage * categoriesPerPage
  );

  const goToPreviousCategoryPage = () => {
    setCurrentCategoryPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextCategoryPage = () => {
    setCurrentCategoryPage((prev) => Math.min(totalCategoryPages, prev + 1));
  };

  // ナビゲーション関数
  const navigateToCategories = () => {
    setSearchParams({});
    setSelectedCategoryId(null);
    setSelectedContentId(null);
    setCurrentCategoryPage(1);
  };

  const navigateToContentList = (categoryId: string) => {
    setSearchParams({ view: 'content-list', category: categoryId });
    setSelectedCategoryId(categoryId);
    setSelectedContentId(null);
  };

  const navigateToContentDetail = (contentId: string) => {
    const content = contents.find(c => c.id === contentId);
    const params: any = { view: 'content-detail', content: contentId };
    if (content?.category_id) {
      params.category = content.category_id;
    }
    setSearchParams(params);
    setSelectedContentId(contentId);
  };

  // コンテンツブロックのレンダリング
  const renderContentBlocks = (blocks: any) => {
    if (!blocks) return null;
    
    // JSON文字列の場合はパース
    let blocksArray = blocks;
    if (typeof blocks === 'string') {
      try {
        blocksArray = JSON.parse(blocks);
      } catch (e) {
        return null;
      }
    }
    
    if (!Array.isArray(blocksArray)) return null;

    return blocksArray.map((block: any, index: number) => {
      switch (block.type) {
        case 'heading':
          const HeadingTag = `h${block.level || 2}` as keyof JSX.IntrinsicElements;
          return (
            <HeadingTag key={index} className="text-2xl font-bold mb-4 text-foreground">
              {block.content}
            </HeadingTag>
          );
        case 'paragraph':
          return (
            <p key={index} className="mb-4 text-foreground leading-relaxed">
              {block.content}
            </p>
          );
        case 'image':
          return (
            <img
              key={index}
              src={block.src}
              alt={block.alt || ''}
              className="w-full max-w-2xl mx-auto rounded-lg mb-6"
            />
          );
        case 'video':
          return (
            <video
              key={index}
              controls
              className="w-full max-w-2xl mx-auto rounded-lg mb-6"
            >
              <source src={block.src} type="video/mp4" />
            </video>
          );
        default:
          return (
            <div key={index} className="mb-4 text-foreground">
              {block.content}
            </div>
          );
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground">読み込み中...</div>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card>
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">404 - ページが見つかりません</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCategory = categories.find(c => c.id === categoryId);
  const categoryContents = contents.filter(c => c.category_id === categoryId);
  const selectedContent = contents.find(c => c.id === contentId);

  // カテゴリごとの進捗率を計算
  const categoryProgressMap = new Map<string, number>();
  categories.forEach(category => {
    const contentsInCategory = contents.filter(c => c.category_id === category.id);
    if (contentsInCategory.length > 0) {
      const totalProgress = contentsInCategory.reduce((acc, content) => acc + (content.progress_percentage || 0), 0);
      categoryProgressMap.set(category.id, Math.round(totalProgress / contentsInCategory.length));
    } else {
      categoryProgressMap.set(category.id, 0);
    }
  });

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ヘッダー */}
      <header
        className="border-b border-border sticky top-0 z-40"
        style={{
          backgroundColor: headerColors.background,
          color: headerColors.foreground,
        }}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold">{site.name}</h1>
          
          <div className="flex items-center gap-2">
            {currentView !== 'categories' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (currentView === 'content-detail' && categoryId) {
                    navigateToContentList(categoryId);
                  } else {
                    navigateToCategories();
                  }
                }}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                戻る
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setSideMenuOpen(!sideMenuOpen)}
            >
              {sideMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* サイドメニュー */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-30 w-64 border-r border-border transform transition-transform duration-300 ease-in-out ${
            sideMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
          style={{
            backgroundColor: sidebarColors.background,
            color: sidebarColors.foreground,
          }}
        >
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">カテゴリ</h2>
          </div>
          <nav className="p-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  navigateToContentList(category.id);
                  setSideMenuOpen(false);
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedCategoryId === category.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="font-medium">{category.name}</div>
                <div className="text-sm text-muted-foreground">
                  {category.content_count}件のコンテンツ
                </div>
              </button>
            ))}
          </nav>
        </aside>

        {/* オーバーレイ（モバイル用） */}
        {sideMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setSideMenuOpen(false)}
          />
        )}

        {/* メインコンテンツ */}
        <main className="flex-1 min-h-screen">
          {currentView === 'categories' && (
            <div className="px-3 py-6">
              
              <div className="grid grid-cols-2 gap-3 justify-center lg:grid-cols-5 lg:gap-y-6 lg:gap-x-2">
                {paginatedCategories.map((category) => (
                  <Card
                    key={category.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden w-full flex flex-col border border-gray-300 rounded"
                    onClick={() => navigateToContentList(category.id)}
                  >
                    <div className="aspect-[16/9] w-full bg-gray-200">
                      {category.thumbnail_url ? (
                        <img
                          src={category.thumbnail_url}
                          alt={`${category.name}のサムネイル`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          サムネイルが設定されていません
                        </div>
                      )}
                    </div>
                    <CardContent className="flex flex-1 flex-col p-4">
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold text-foreground truncate">
                          {category.name}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 h-10">
                          {category.description}
                        </p>
                      </div>

                      <div className="mt-auto pt-4">
                        <div className="h-3 w-full rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${categoryProgressMap.get(category.id) || 0}%`,
                              backgroundColor: progressBarColor,
                            }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                          <div className="max-[499px]:hidden">コンテンツ数: {category.content_count}</div>
                          <div>{`${categoryProgressMap.get(category.id) || 0}% : 完了`}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {totalCategoryPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousCategoryPage}
                    disabled={currentCategoryPage === 1}
                  >
                    前へ
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentCategoryPage} / {totalCategoryPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextCategoryPage}
                    disabled={currentCategoryPage === totalCategoryPages}
                  >
                    次へ
                  </Button>
                </div>
              )}
            </div>
          )}

          {currentView === 'content-list' && selectedCategory && (
            <div className="px-3 py-6">
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2 text-foreground">
                  {selectedCategory.name}
                </h1>
                {selectedCategory.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedCategory.description}
                  </p>
                )}
                <div className="mt-2 text-sm text-muted-foreground">
                  コンテンツ数: {selectedCategory.content_count}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {categoryContents.map((content) => {
                  const contentProgress = Math.max(
                    0,
                    Math.min(100, Number(content.progress_percentage ?? 0))
                  );

                  return (
                    <Card
                      key={content.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => navigateToContentDetail(content.id)}
                    >
                      <CardContent className="space-y-4 p-6">
                        <h3 className="text-lg font-semibold text-foreground">
                          {content.title}
                        </h3>
                        <div>
                          <Progress value={contentProgress} className="h-2" />
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>進捗</span>
                            <span>{contentProgress}%</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          読む >
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {categoryContents.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    このカテゴリにはまだコンテンツがありません。
                  </p>
                </div>
              )}
            </div>
          )}

          {currentView === 'content-detail' && selectedContent && (
            <div className="px-3 py-6">
              <article className="max-w-4xl mx-auto">
                <header className="mb-8">
                  <h1 className="text-4xl font-bold mb-4 text-foreground">
                    {selectedContent.title}
                  </h1>
                </header>

                <div className="prose prose-lg max-w-none">
                  {selectedContent.content_blocks && selectedContent.content_blocks.length > 0 ? (
                    renderContentBlocks(selectedContent.content_blocks)
                  ) : selectedContent.content ? (
                    <div className="text-foreground leading-relaxed">
                      {selectedContent.content}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">コンテンツが準備中です。</p>
                  )}
                </div>
              </article>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MemberSiteView;