import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Block } from '@/components/EnhancedBlockEditor';
import { HeadingDesignStyles, renderBlocks } from '@/lib/blockRenderer';
import { ChevronLeft, Menu, X } from 'lucide-react';

interface MemberSite {
  id: string;
  name: string;
  description?: string;
  is_published: boolean;
  theme_config?: any;
  require_passcode?: boolean;
  passcode?: string;
  user_id: string;
}

interface MemberSiteCategory {
  id: string;
  site_id: string;
  name: string;
  description?: string;
  content_count: number;
  sort_order: number;
  thumbnail_url?: string | null;
  content_blocks: any;
  created_at: string;
  updated_at: string;
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
  progress_status?: 'completed' | 'incomplete';
}

const MemberSiteView: React.FC = () => {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL パラメータ
  const uid = searchParams.get('uid') || undefined;
  const passcodeParam = searchParams.get('passcode') || undefined;

  // ビューと選択
  const currentView = (searchParams.get('view') as 'categories' | 'content-list' | 'content-detail') || 'categories';
  const categoryId = searchParams.get('category') || undefined;
  const contentId = searchParams.get('content') || undefined;

  // 状態
  const [site, setSite] = useState<MemberSite | null>(null);
  const [categories, setCategories] = useState<MemberSiteCategory[]>([]);
  const [contents, setContents] = useState<MemberSiteContent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState<boolean>(false);
  const [requirePasscode, setRequirePasscode] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>(passcodeParam || '');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [submittingPasscode, setSubmittingPasscode] = useState<boolean>(false);
  const [sideMenuOpen, setSideMenuOpen] = useState<boolean>(false);
  const [updatingProgress, setUpdatingProgress] = useState<boolean>(false);
  const [progressUpdateError, setProgressUpdateError] = useState<string | null>(null);

  const preview = searchParams.get('preview') === 'true';

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const selectedContent = useMemo(
    () => contents.find((c) => c.id === contentId),
    [contents, contentId]
  );

  const isContentCompleted = useMemo(
    () => (selectedContent ? (selectedContent.progress_percentage ?? 0) >= 100 : false),
    [selectedContent]
  );

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // レイアウトレスポンシブ
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  // 進捗バー色
  const progressBarColor = 'hsl(var(--primary))';

  // テーマ
  const themeConfig = site?.theme_config || {};
  const headerColors = {
    background: themeConfig.headerBgColor || themeConfig.header_color || 'hsl(var(--card))',
    foreground: themeConfig.headerFgColor || 'hsl(var(--card-foreground))',
  };
  const sidebarColors = {
    background: themeConfig.sidebarBgColor || themeConfig.sidebar_color || 'hsl(var(--card))',
    foreground: themeConfig.sidebarFgColor || 'hsl(var(--card-foreground))',
    hoverBackground: themeConfig.sidebarHoverBgColor || 'hsl(var(--muted))',
    hoverForeground: themeConfig.sidebarHoverFgColor || 'hsl(var(--card-foreground))',
    activeBackground: themeConfig.sidebarActiveBgColor || 'hsl(var(--primary))',
    activeForeground: themeConfig.sidebarActiveFgColor || 'hsl(var(--primary-foreground))',
  };

  // フェッチと認証
  const fetchData = useCallback(async (providedPasscode?: string) => {
    if (!slug) {
      return;
    }

    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
      setAuthFailed(false);
      setRequirePasscode(false);
      setPasscodeError(null);
    }

    try {
      if (preview) {
        const { data: siteData, error: siteError } = await supabase
          .from('member_sites')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();
        if (siteError) throw siteError;
        if (!siteData) throw new Error('サイトが見つかりません。');

        const { data: categoryData, error: catError } = await supabase
          .from('member_site_categories')
          .select('*')
          .eq('site_id', siteData.id)
          .order('sort_order');
        if (catError) throw catError;

        const { data: contentData, error: contError } = await supabase
          .from('member_site_content')
          .select('*')
          .eq('site_id', siteData.id)
          .order('sort_order');
        if (contError) throw contError;

        if (isMountedRef.current) {
          setSite(siteData);
          setCategories(categoryData || []);
          setContents(contentData || []);
        }
        return;
      }

      const params = new URLSearchParams({ slug });
      if (uid) params.append('uid', uid);

      const passcodeToUse = providedPasscode ?? passcodeParam;
      if (passcodeToUse) {
        params.append('passcode', passcodeToUse);
      }

      const res = await fetch(
        `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/member-site-view?${params.toString()}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );

      if (!res.ok) {
        let parsed: any = null;
        try {
          parsed = await res.json();
        } catch {
          parsed = null;
        }

        if (isMountedRef.current) {
          setSite(null);
          setCategories([]);
          setContents([]);
        }

        const rawCode = parsed?.errorCode ?? parsed?.error ?? parsed?.code;
        const normalizedCode = typeof rawCode === 'string' ? rawCode.toUpperCase() : undefined;
        const message = typeof parsed?.message === 'string' ? parsed.message : (typeof parsed?.error === 'string' ? parsed.error : undefined);
        const messageLower = message?.toLowerCase() || '';
        const isPasscodeRequired = normalizedCode === 'PASSCODE_REQUIRED' || messageLower.includes('passcode required');
        const isInvalidPasscode = normalizedCode === 'INVALID_PASSCODE' || messageLower.includes('invalid passcode');

        if (isPasscodeRequired) {
          if (isMountedRef.current) {
            setRequirePasscode(true);
          }
          return;
        }

        if (isInvalidPasscode) {
          if (isMountedRef.current) {
            setRequirePasscode(true);
            setPasscodeError('パスコードが正しくありません');
          }
          return;
        }

        if (isMountedRef.current) {
          setAuthFailed(true);
        }
        return;
      }

      const result = await res.json();
      if (isMountedRef.current) {
        setSite(result.site as MemberSite);
        setCategories((result.categories || []) as MemberSiteCategory[]);
        setContents((result.content || []) as MemberSiteContent[]);
        setRequirePasscode(false);
        setPasscodeError(null);
      }
    } catch (error) {
      console.error('Error fetching member site data:', error);
      if (isMountedRef.current) {
        setError(error instanceof Error ? error.message : 'エラーが発生しました。時間を置いてから再度アクセスしてください。');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [slug, uid, passcodeParam, preview]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (passcodeParam) {
      setPasscode(passcodeParam);
    }
  }, [passcodeParam]);

  useEffect(() => {
    setProgressUpdateError(null);
  }, [contentId]);

  const handlePasscodeSubmit = useCallback(async () => {
    const trimmed = passcode.trim();
    if (!trimmed) {
      setPasscodeError('パスコードを入力してください');
      return;
    }

    setPasscodeError(null);
    setSubmittingPasscode(true);
    try {
      await fetchData(trimmed);
    } finally {
      if (isMountedRef.current) {
        setSubmittingPasscode(false);
      }
    }
  }, [passcode, fetchData]);

  // レスポンシブ
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // カテゴリのページング
  const categoriesPerRow = isDesktop ? 5 : 2;
  const rowsPerPage = isDesktop ? 2 : 4;
  const categoriesPerPage = categoriesPerRow * rowsPerPage;
  const [currentCategoryPage, setCurrentCategoryPage] = useState<number>(1);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(categories.length / categoriesPerPage));
    setCurrentCategoryPage(prev => Math.min(prev, maxPage));
  }, [categories.length, categoriesPerPage]);

  const totalCategoryPages = Math.max(1, Math.ceil(categories.length / categoriesPerPage));
  const paginatedCategories = useMemo(() => {
    const start = (currentCategoryPage - 1) * categoriesPerPage;
    return categories.slice(start, start + categoriesPerPage);
  }, [categories, currentCategoryPage, categoriesPerPage]);

  // カテゴリ別進捗（平均）
  const categoryProgressMap = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach(cat => {
      const list = contents.filter(c => c.category_id === cat.id);
      if (list.length === 0) {
        map.set(cat.id, 0);
      } else {
        const sum = list.reduce((acc, c) => acc + (c.progress_percentage || 0), 0);
        map.set(cat.id, Math.round(sum / list.length));
      }
    });
    return map;
  }, [categories, contents]);

  // ナビゲーション
  const navigateToCategories = () => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('view', 'categories');
      p.delete('category');
      p.delete('content');
      return p;
    });
    setSideMenuOpen(false);
    setCurrentCategoryPage(1);
  };

  const navigateToContentList = (catId: string) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('view', 'content-list');
      p.set('category', catId);
      p.delete('content');
      return p;
    });
    setSideMenuOpen(false);
  };

  const navigateToContentDetail = (contId: string) => {
    const item = contents.find(c => c.id === contId);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('view', 'content-detail');
      p.set('content', contId);
      if (item?.category_id) p.set('category', item.category_id);
      return p;
    });
    setSideMenuOpen(false);
  };

  const handleToggleCompletion = useCallback(async () => {
    if (!selectedContent || !slug) {
      return;
    }

    if (!uid) {
      setProgressUpdateError('UIDが指定されていないため、学習状況を記録できません。');
      return;
    }

    if (updatingProgress) {
      return;
    }

    const contentIdCurrent = selectedContent.id;
    const wasCompleted = (selectedContent.progress_percentage ?? 0) >= 100;
    const nextCompleted = !wasCompleted;

    setProgressUpdateError(null);
    setUpdatingProgress(true);

    setContents(prev =>
      prev.map(item =>
        item.id === contentIdCurrent
          ? {
              ...item,
              progress_percentage: nextCompleted ? 100 : 0,
              progress_status: nextCompleted ? 'completed' : 'incomplete',
            }
          : item
      )
    );

    try {
      const response = await fetch(
        'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/member-site-progress',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            uid,
            contentId: contentIdCurrent,
            completed: nextCompleted,
          }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          (result && typeof result.error === 'string' && result.error) || '学習状況の更新に失敗しました'
        );
      }

      setContents(prev =>
        prev.map(item =>
          item.id === contentIdCurrent
            ? {
                ...item,
                progress_percentage:
                  typeof result.progress_percentage === 'number'
                    ? result.progress_percentage
                    : nextCompleted
                      ? 100
                      : 0,
                progress_status:
                  (result.status as 'completed' | 'incomplete' | undefined) ??
                  (nextCompleted ? 'completed' : 'incomplete'),
              }
            : item
        )
      );
    } catch (error) {
      console.error('Failed to toggle completion:', error);
      setProgressUpdateError(
        error instanceof Error ? error.message : '学習状況の更新に失敗しました'
      );
      setContents(prev =>
        prev.map(item =>
          item.id === contentIdCurrent
            ? {
                ...item,
                progress_percentage: wasCompleted ? 100 : 0,
                progress_status: wasCompleted ? 'completed' : 'incomplete',
              }
            : item
        )
      );
    } finally {
      setUpdatingProgress(false);
    }
  }, [selectedContent, slug, uid, updatingProgress]);

  // コンテンツブロック描画
  const normalizeBlocks = (blocks: any): Block[] | null => {
    if (!blocks) return null;
    let arr = blocks;
    if (typeof blocks === 'string') {
      try {
        arr = JSON.parse(blocks);
      } catch {
        return null;
      }
    }
    if (!Array.isArray(arr) || arr.length === 0) return null;

    return (arr as any[])
      .map((block: any, index: number) => {
        if (block && typeof block === 'object') {
          const withId = block.id ? block : { ...block, id: `${block.type || 'block'}-${index}` };
          return withId as Block;
        }
        return null;
      })
      .filter((item): item is Block => item !== null);
  };

  const categoryBlocksMap = useMemo(() => {
    const map = new Map<string, Block[]>();
    categories.forEach((cat) => {
      const normalized = normalizeBlocks(cat.content_blocks);
      if (normalized) {
        map.set(cat.id, normalized);
      }
    });
    return map;
  }, [categories]);

  // コンテンツブロック描画
  const renderContentBlocks = (blocks: any) => {
    const arr = Array.isArray(blocks) ? (blocks as Block[]) : normalizeBlocks(blocks);
    if (!arr) return null;
    return renderBlocks(arr);
  };

  if (authFailed) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 flex justify-center items-center p-4">
          <div className="pb-20">
            <Card className="w-full max-w-md">
            <CardContent className="p-8">
              <h1 className="text-2xl font-bold mb-6 text-center">会員サイトを表示できません</h1>
              <p className="text-sm text-muted-foreground mb-4">
                表示できない理由として、以下が考えられます。
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                <li>LINE友達限定で公開されている</li>
                <li>ページの閲覧条件を満たしていない</li>
              </ul>
            </CardContent>
          </Card>
          </div>
        </main>
        <footer className="text-center text-sm text-muted-foreground py-4">
          © {new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  // ローディング／エラー
  if (requirePasscode) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-bold">パスコードを入力してください</h1>
                <p className="text-sm text-muted-foreground">会員サイトの閲覧にはパスコードの入力が必要です。</p>
              </div>
              <div className="space-y-3">
                <Input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="パスコードを入力"
                  disabled={submittingPasscode}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handlePasscodeSubmit();
                    }
                  }}
                />
                {passcodeError && <p className="text-sm text-destructive text-left">{passcodeError}</p>}
                <Button
                  className="w-full"
                  onClick={() => void handlePasscodeSubmit()}
                  disabled={submittingPasscode}
                >
                  {submittingPasscode ? '確認中...' : '送信'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <footer className="text-center text-sm text-muted-foreground py-4">
          © {new Date().getFullYear()}
        </footer>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  if (error || !site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">エラーが発生しました</h1>
            <p className="text-muted-foreground mb-6">{error || 'サイトが見つかりません。'}</p>
            <Button onClick={() => window.location.reload()}>再読み込み</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCategoryBlocks = selectedCategory ? categoryBlocksMap.get(selectedCategory.id) || normalizeBlocks(selectedCategory.content_blocks) : null;
  const selectedContentBlocks = selectedContent ? normalizeBlocks(selectedContent.content_blocks) : null;

  return (
    <>
      {/* サイドバー用の微調整スタイル */}
      {HeadingDesignStyles}
      <style>
        {`
          .sidebar-button:hover {
            background-color: ${sidebarColors.hoverBackground};
            color: ${sidebarColors.hoverForeground};
          }
          .sidebar-button:hover .text-muted-foreground {
            color: ${sidebarColors.hoverForeground};
            opacity: 0.8;
          }
          .sidebar-active {
            background-color: ${sidebarColors.activeBackground};
            color: ${sidebarColors.activeForeground};
          }
          .sidebar-active .text-muted-foreground {
            color: ${sidebarColors.activeForeground};
            opacity: 0.8;
          }
          @media (max-width: 639px) {
            .learning-status-head {
              font-size: clamp(0.75rem, 2vw, 1rem);
            }
          }
          :root {
            --sidebar-hover-background: ${sidebarColors.hoverBackground};
            --sidebar-hover-foreground: ${sidebarColors.hoverForeground};
          }
        `}
      </style>

      {/* ヘッダー */}
      <header
        className="border-b border-border sticky top-0 z-40"
        style={{ backgroundColor: headerColors.background, color: headerColors.foreground }}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            
            <h1 className="text-lg font-semibold">{site.name}</h1>
          </div>

          <Button
            size="sm"
            className={`md:hidden ${sideMenuOpen ? 'rounded-md' : ''} bg-transparent hover:bg-[var(--sidebar-hover-background)] hover:text-[var(--sidebar-hover-foreground)]`}
            onClick={() => setSideMenuOpen(!sideMenuOpen)}
            style={sideMenuOpen ? { backgroundColor: sidebarColors.activeBackground, color: sidebarColors.activeForeground } : {}}
          >
            {sideMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* サイドバー */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-30 w-64 border-r border-border transform transition-transform duration-300 ease-in-out top-16 ${
            sideMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
          style={{ backgroundColor: sidebarColors.background, color: sidebarColors.foreground }}
        >
          <button
            onClick={() => {
              navigateToCategories();
              setSideMenuOpen(false);
            }}
            className={`sidebar-button w-full text-left px-4 py-3 transition-colors ${
              currentView === 'categories' ? 'sidebar-active' : ''
            }`}
          >
            <div className="font-medium">TOP</div>
          </button>
          <div className="p-4 border-t border-border">
            <h2 className="font-semibold">カテゴリ</h2>
          </div>
          <nav>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigateToContentList(cat.id)}
                className={`sidebar-button w-full text-left px-4 py-3 transition-colors ${
                  categoryId === cat.id ? 'sidebar-active' : ''
                }`}
              >
                <div className="font-medium">{cat.name}</div>
                {themeConfig.showContentCount !== false && (
                  <div className="text-sm text-muted-foreground">{cat.content_count}件のコンテンツ</div>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* モバイル用オーバーレイ */}
        {sideMenuOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSideMenuOpen(false)} />}

        {/* メイン */}
        <main className={`flex-1 min-h-screen ${currentView !== 'categories' ? 'max-[500px]:bg-white' : ''}`}>
          {/* カテゴリ一覧 */}
          {currentView === 'categories' && (
            <div className="px-3 py-6">
              <div className="grid grid-cols-2 gap-3 justify-center lg:grid-cols-5 lg:gap-y-6 lg:gap-x-2">
                {paginatedCategories.map((cat) => (
                  <Card
                    key={cat.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden w-full flex flex-col border border-gray-300 rounded"
                    onClick={() => navigateToContentList(cat.id)}
                  >
                    <div className="aspect-[16/9] w-full bg-gray-200">
                      {cat.thumbnail_url ? (
                        <img src={cat.thumbnail_url} alt={`${cat.name}のサムネイル`} className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          サムネイルが設定されていません
                        </div>
                      )}
                    </div>
                    <CardContent className="flex flex-1 flex-col p-4">
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold text-foreground truncate">{cat.name}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 h-10">{cat.description}</p>
                      </div>
                      <div className="mt-auto pt-4">
                        <div className="h-3 w-full rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${categoryProgressMap.get(cat.id) || 0}%`, backgroundColor: progressBarColor }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                          <div className="max-[499px]:hidden">コンテンツ数: {cat.content_count}</div>
                          <div>{`${categoryProgressMap.get(cat.id) || 0}% : 完了`}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

              </div>

              {totalCategoryPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-4">
                  <Button variant="outline" size="sm" onClick={() => setCurrentCategoryPage(p => Math.max(1, p - 1))} disabled={currentCategoryPage === 1}>
                    前へ
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentCategoryPage} / {totalCategoryPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentCategoryPage(p => Math.min(totalCategoryPages, p + 1))}
                    disabled={currentCategoryPage === totalCategoryPages}
                  >
                    次へ
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* コンテンツ一覧（テーブル） */}
          {currentView === 'content-list' && selectedCategory && (
            <div className="px-4 md:px-3 py-6">
              <Button
                size="sm"
                onClick={() => navigateToCategories()}
                className="flex items-center gap-1 mb-2 bg-transparent text-[#292929] hover:bg-transparent hover:opacity-70 px-3 md:px-0"
              >
                <ChevronLeft className="h-4 w-4" />
                戻る
              </Button>
              <div className="w-full md:max-w-4xl md:mx-auto">
                <div className="bg-white space-y-8 min-[500px]:shadow-sm min-[500px]:p-6 min-[500px]:border min-[500px]:rounded-lg">
                  <div>
                    <h1 className="text-3xl font-bold mb-2 text-foreground">{selectedCategory.name}</h1>
                    {selectedCategory.description && <p className="text-sm text-muted-foreground">{selectedCategory.description}</p>}
                    <div className="mt-2 text-sm text-muted-foreground">コンテンツ数: {selectedCategory.content_count}</div>
                    {selectedCategoryBlocks && (
                      <div className="prose prose-sm max-w-none text-foreground mt-6">
                        {renderContentBlocks(selectedCategoryBlocks)}
                      </div>
                    )}
                  </div>

                  <Table className="border border-collapse bg-white w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="border w-5/6 learning-status-head">下の項目からコンテンツを選択してください</TableHead>
                        <TableHead className="border text-center w-1/6 learning-status-head">
                          <span className="inline-block sm:hidden" style={{ whiteSpace: 'nowrap' }}>
                            学習<br />状況
                          </span>
                          <span className="hidden sm:inline-block">学習状況</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contents
                        .filter(c => c.category_id === selectedCategory.id)
                        .map(item => (
                          <TableRow
                            key={item.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigateToContentDetail(item.id)}
                          >
                            <TableCell className="border font-medium w-5/6">
                              <div className="line-clamp-2 sm:line-clamp-none">{item.title}</div>
                            </TableCell>
                            <TableCell className="border text-center w-1/6">
                              {item.progress_percentage === 100 ? (
                                <span className="font-bold" style={{ color: 'rgb(12, 179, 134)', whiteSpace: 'nowrap' }}>
                                  完了
                                </span>
                              ) : (
                                <span className="font-bold" style={{ color: '#EF4444', whiteSpace: 'nowrap' }}>
                                  未完了
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>

                  {contents.filter(c => c.category_id === selectedCategory.id).length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">このカテゴリにはまだコンテンツがありません。</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* コンテンツ詳細 */}
          {currentView === 'content-detail' && selectedContent && (
            <div className="px-4 py-6">
              <Button
                size="sm"
                onClick={() => navigateToContentList(selectedContent.category_id || '')}
                className="flex items-center gap-1 mb-2 bg-transparent text-[#292929] hover:bg-transparent hover:opacity-70"
              >
                <ChevronLeft className="h-4 w-4" />
                戻る
              </Button>
              <article className="max-w-4xl mx-auto">
                <div className="bg-white space-y-6 min-[500px]:border min-[500px]:rounded-lg min-[500px]:shadow-sm min-[500px]:p-6">
                  <header className="mb-8">
                    <h1 className="text-4xl font-bold mb-4 text-foreground">{selectedContent.title}</h1>
                  </header>

                  <div className="prose prose-lg max-w-none">
                    {selectedContentBlocks ? (
                      renderContentBlocks(selectedContentBlocks)
                    ) : (
                      <p className="text-muted-foreground">コンテンツが準備中です。</p>
                    )}
                  </div>
                  <div className="border-t pt-6 flex flex-col gap-3">
                    <span className="text-sm text-muted-foreground">
                      学習状況: <span className={`font-semibold ${isContentCompleted ? "text-emerald-500" : "text-destructive"}`}>{isContentCompleted ? "完了" : "未完了"}</span>
                    </span>
                    <p className="text-xs text-muted-foreground -mt-2">
                      学習が完了したら、下のボタンを押してください。(間違えて押した場合はもう一度押すと元に戻せます)
                    </p>
                    <Button
                      onClick={() => void handleToggleCompletion()}
                      disabled={updatingProgress || !uid}
                      className={`w-full sm:w-auto ${isContentCompleted ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}`}
                    >
                      {updatingProgress ? "更新中..." : isContentCompleted ? "完了" : "完了を押す"}
                    </Button>
                    {!uid && (
                      <p className="text-xs text-muted-foreground">
                        UIDが指定されていないため、学習状況は保存されません。
                      </p>
                    )}
                    {progressUpdateError && (
                      <p className="text-sm text-destructive">{progressUpdateError}</p>
                    )}
                  </div>
                </div>
              </article>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default MemberSiteView;
