import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ChevronLeft, Home, Menu, X, Users, FileText, Search } from 'lucide-react';

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
  const uid = searchParams.get('uid');
  const passcode = searchParams.get('passcode');

  const [site, setSite] = useState<MemberSite | null>(null);
  const [categories, setCategories] = useState<MemberSiteCategory[]>([]);
  const [content, setContent] = useState<MemberSiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'categories' | 'content' | 'detail'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<MemberSiteCategory | null>(null);
  const [selectedContent, setSelectedContent] = useState<MemberSiteContent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isOwnerPreview, setIsOwnerPreview] = useState(false);
  const [requirePasscode, setRequirePasscode] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const isPreview = searchParams.get('preview') === 'true';
        setIsOwnerPreview(isPreview);

        if (isPreview) {
          // Owner preview mode - fetch from Supabase directly
          const { data: siteResult, error: siteError } = await supabase
            .from('member_sites')
            .select('*')
            .eq('slug', slug)
            .single();

          if (siteError) throw siteError;

          const { data: categoriesResult, error: categoriesError } = await supabase
            .from('member_site_categories')
            .select('*')
            .eq('site_id', siteResult.id)
            .order('sort_order');

          if (categoriesError) throw categoriesError;

          const { data: contentResult, error: contentError } = await supabase
            .from('member_site_content')
            .select('*')
            .eq('site_id', siteResult.id)
            .order('created_at', { ascending: false });

          if (contentError) throw contentError;

          setSite(siteResult);
          setCategories(categoriesResult || []);
          setContent(contentResult || []);
        } else {
          // Public access mode - use edge function
          const params = new URLSearchParams({ slug });
          if (uid) params.append('uid', uid);
          if (passcode || passcodeInput) params.append('passcode', passcode || passcodeInput);

          const response = await fetch(
            `https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/member-site-view?${params}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          const result = await response.json();
          
          if (!result.success) {
            if (result.requirePasscode) {
              setRequirePasscode(true);
              setLoading(false);
              return;
            }
            throw new Error(result.error || 'Failed to load site');
          }

          setSite(result.site);
          setCategories(result.categories || []);
          setContent(result.content || []);
        }

        // Handle view from URL params
        const viewParam = searchParams.get('view');
        const categoryIdParam = searchParams.get('categoryId');
        const contentIdParam = searchParams.get('contentId');

        if (contentIdParam) {
          const contentItem = content.find((c: MemberSiteContent) => c.id === contentIdParam);
          if (contentItem) {
            setSelectedContent(contentItem);
            setCurrentView('detail');
          }
        } else if (categoryIdParam) {
          const category = categories.find((c: MemberSiteCategory) => c.id === categoryIdParam);
          if (category) {
            setSelectedCategory(category);
            setCurrentView('content');
          }
        } else if (viewParam === 'categories') {
          setCurrentView('categories');
        }

        setRequirePasscode(false);
      } catch (err) {
        console.error('Error fetching member site data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchData();
    }
  }, [slug, uid, passcode, passcodeInput, searchParams]);

  const navigateToCategories = () => {
    setCurrentView('categories');
    setSelectedCategory(null);
    setSelectedContent(null);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('view', 'categories');
      newParams.delete('categoryId');
      newParams.delete('contentId');
      return newParams;
    });
  };

  const navigateToContentList = (category: MemberSiteCategory) => {
    setCurrentView('content');
    setSelectedCategory(category);
    setSelectedContent(null);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('view', 'content');
      newParams.set('categoryId', category.id);
      newParams.delete('contentId');
      return newParams;
    });
  };

  const navigateToContentDetail = (contentItem: MemberSiteContent) => {
    setCurrentView('detail');
    setSelectedContent(contentItem);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('view', 'detail');
      newParams.set('contentId', contentItem.id);
      if (contentItem.category_id) {
        newParams.set('categoryId', contentItem.category_id);
      }
      return newParams;
    });
  };

  const renderContentBlocks = (blocks: any[]) => {
    if (!blocks || !Array.isArray(blocks)) return null;

    return blocks.map((block, index) => {
      switch (block.type) {
        case 'heading':
          const HeadingTag = `h${block.level || 2}` as keyof JSX.IntrinsicElements;
          return (
            <HeadingTag 
              key={index} 
              className={`font-bold mb-4 ${
                block.level === 1 ? 'text-3xl' :
                block.level === 3 ? 'text-lg' : 'text-xl'
              }`}
            >
              {block.content}
            </HeadingTag>
          );
        case 'paragraph':
          return (
            <p key={index} className="mb-4 leading-relaxed">
              {block.content}
            </p>
          );
        case 'image':
          return (
            <div key={index} className="mb-4">
              <img 
                src={block.url} 
                alt={block.alt || '画像'} 
                className="max-w-full h-auto rounded-lg"
              />
              {block.caption && (
                <p className="text-sm text-muted-foreground mt-2">{block.caption}</p>
              )}
            </div>
          );
        case 'video':
          return (
            <div key={index} className="mb-4">
              <video 
                controls 
                className="max-w-full h-auto rounded-lg"
                src={block.url}
              >
                お使いのブラウザは動画再生に対応していません。
              </video>
              {block.caption && (
                <p className="text-sm text-muted-foreground mt-2">{block.caption}</p>
              )}
            </div>
          );
        default:
          return null;
      }
    });
  };

  const handlePasscodeSubmit = () => {
    setPasscodeInput(passcodeInput);
    // Trigger re-fetch with passcode
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (requirePasscode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-card rounded-lg p-6 shadow-lg">
            <h1 className="text-2xl font-bold mb-4 text-center">パスコード入力</h1>
            <p className="text-muted-foreground mb-6 text-center">
              このサイトにアクセスするにはパスコードが必要です。
            </p>
            <div className="space-y-4">
              <Input
                type="password"
                placeholder="パスコードを入力"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasscodeSubmit()}
              />
              <Button 
                onClick={handlePasscodeSubmit}
                className="w-full"
                disabled={!passcodeInput.trim()}
              >
                アクセス
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">エラーが発生しました</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>
            再読み込み
          </Button>
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">サイトが見つかりません</h1>
          <p className="text-muted-foreground">指定されたサイトは存在しないか、公開されていません。</p>
        </div>
      </div>
    );
  }

  const filteredContent = content.filter(c => 
    !selectedCategory || c.category_id === selectedCategory.id
  ).filter(c => 
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const itemsPerPage = 6;
  const totalPages = Math.ceil(filteredContent.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContent = filteredContent.slice(startIndex, startIndex + itemsPerPage);

  const themeConfig = site.theme_config || {};
  const headerStyle = themeConfig.header_color ? { backgroundColor: themeConfig.header_color } : {};
  const sidebarStyle = themeConfig.sidebar_color ? { backgroundColor: themeConfig.sidebar_color } : {};

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header 
        className="bg-primary text-primary-foreground p-4 flex items-center justify-between relative z-50"
        style={headerStyle}
      >
        <div className="flex items-center gap-4">
          {currentView !== 'categories' && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                if (currentView === 'detail') {
                  if (selectedContent?.category_id) {
                    const category = categories.find(c => c.id === selectedContent.category_id);
                    if (category) {
                      navigateToContentList(category);
                    } else {
                      navigateToCategories();
                    }
                  } else {
                    navigateToCategories();
                  }
                } else {
                  navigateToCategories();
                }
              }}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={navigateToCategories}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <Home className="w-4 h-4" />
          </Button>
          
          <h1 className="text-lg font-semibold truncate">{site.name}</h1>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setSideMenuOpen(!sideMenuOpen)}
          className="text-primary-foreground hover:bg-primary-foreground/20"
        >
          <Menu className="w-4 h-4" />
        </Button>
      </header>

      {/* Side Menu */}
      {sideMenuOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSideMenuOpen(false)} />
          <div 
            className="absolute right-0 top-0 h-full w-80 bg-card shadow-lg"
            style={sidebarStyle}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">メニュー</h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSideMenuOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  navigateToCategories();
                  setSideMenuOpen(false);
                }}
              >
                <Home className="w-4 h-4 mr-2" />
                ホーム
              </Button>
              
              {categories.map(category => (
                <Button
                  key={category.id}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    navigateToContentList(category);
                    setSideMenuOpen(false);
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto p-4">
        {currentView === 'categories' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">カテゴリ一覧</h2>
              {site.description && (
                <p className="text-muted-foreground">{site.description}</p>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map(category => (
                <div
                  key={category.id}
                  className="bg-card rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigateToContentList(category)}
                >
                  {category.thumbnail_url && (
                    <img 
                      src={category.thumbnail_url} 
                      alt={category.name}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                  )}
                  <h3 className="text-xl font-semibold mb-2">{category.name}</h3>
                  {category.description && (
                    <p className="text-muted-foreground mb-4">{category.description}</p>
                  )}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <FileText className="w-4 h-4 mr-1" />
                    {category.content_count} 件のコンテンツ
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'content' && selectedCategory && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">{selectedCategory.name}</h2>
              {selectedCategory.description && (
                <p className="text-muted-foreground">{selectedCategory.description}</p>
              )}
            </div>
            
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="コンテンツを検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedContent.map(contentItem => (
                <div
                  key={contentItem.id}
                  className="bg-card rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigateToContentDetail(contentItem)}
                >
                  <h3 className="text-xl font-semibold mb-2">{contentItem.title}</h3>
                  {contentItem.progress_percentage !== null && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>進捗</span>
                        <span>{contentItem.progress_percentage}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${contentItem.progress_percentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    タイプ: {contentItem.page_type}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-8 gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'detail' && selectedContent && (
          <div>
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-4">{selectedContent.title}</h1>
            </div>
            
            <div className="bg-card rounded-lg p-6">
              {selectedContent.content_blocks ? (
                <div className="prose max-w-none">
                  {renderContentBlocks(selectedContent.content_blocks)}
                </div>
              ) : selectedContent.content ? (
                <div 
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedContent.content }}
                />
              ) : (
                <p className="text-muted-foreground">コンテンツがありません。</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MemberSiteView;