import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse query parameters
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const uid = url.searchParams.get('uid'); // LINE friend short_uid for authentication
    const passcode = url.searchParams.get('passcode'); // Optional passcode

    if (!slug) {
      return new Response(
        generateErrorPage('エラー', 'サイトが見つかりません'),
        { headers: { 'Content-Type': 'text/html' }, status: 404 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch member site data
    const { data: site, error: siteError } = await supabase
      .from('member_sites')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (siteError) {
      console.error('Site fetch error:', siteError);
      return new Response(
        generateErrorPage('エラー', 'サイトの取得に失敗しました'),
        { headers: { 'Content-Type': 'text/html' }, status: 500 }
      );
    }

    if (!site) {
      console.log('Site not found:', { slug, uid });
      return new Response(
        generateErrorPage('404', 'サイトが見つかりません'),
        { headers: { 'Content-Type': 'text/html' }, status: 404 }
      );
    }

    // Check UID-based authentication if provided
    if (uid && uid !== '[UID]') {
      // Find LINE friend by short_uid
      const { data: friend, error: friendError } = await supabase
        .from('line_friends')
        .select('id, user_id')
        .eq('short_uid_ci', uid.toUpperCase())
        .eq('user_id', site.user_id)
        .maybeSingle();

      if (friendError || !friend) {
        console.log('Friend not found or error:', { uid, error: friendError });
        return new Response(
          generateErrorPage('認証エラー', 'アクセス権限がありません'),
          { headers: { 'Content-Type': 'text/html' }, status: 403 }
        );
      }

      // Check passcode if required
      if (site.passcode && site.passcode !== passcode) {
        return new Response(
          generatePasscodeInputPage(slug, uid),
          { headers: { 'Content-Type': 'text/html' }, status: 200 }
        );
      }

      // Check tag-based access control
      if (site.allowed_tag_ids && site.allowed_tag_ids.length > 0) {
        const { data: friendTags } = await supabase
          .from('friend_tags')
          .select('tag_id')
          .eq('friend_id', friend.id);

        const friendTagIds = friendTags?.map(ft => ft.tag_id) || [];
        const hasAllowedTag = site.allowed_tag_ids.some(tagId => friendTagIds.includes(tagId));

        if (!hasAllowedTag) {
          return new Response(
            generateErrorPage('アクセス拒否', 'このコンテンツにアクセスする権限がありません'),
            { headers: { 'Content-Type': 'text/html' }, status: 403 }
          );
        }
      }

      // Check blocked tags
      if (site.blocked_tag_ids && site.blocked_tag_ids.length > 0) {
        const { data: friendTags } = await supabase
          .from('friend_tags')
          .select('tag_id')
          .eq('friend_id', friend.id);

        const friendTagIds = friendTags?.map(ft => ft.tag_id) || [];
        const hasBlockedTag = site.blocked_tag_ids.some(tagId => friendTagIds.includes(tagId));

        if (hasBlockedTag) {
          return new Response(
            generateErrorPage('アクセス拒否', 'このコンテンツにアクセスする権限がありません'),
            { headers: { 'Content-Type': 'text/html' }, status: 403 }
          );
        }
      }
    }

    // Fetch categories and content after authentication
    const { data: categories, error: categoriesError } = await supabase
      .from('member_site_categories')
      .select('*')
      .eq('site_id', site.id)
      .order('sort_order');

    const { data: content, error: contentError } = await supabase
      .from('member_site_content')
      .select('*')
      .eq('site_id', site.id)
      .eq('is_published', true)
      .order('sort_order');

    if (categoriesError || contentError) {
      console.error('Content fetch error:', { categoriesError, contentError });
      return new Response(
        generateErrorPage('エラー', 'コンテンツの取得に失敗しました'),
        { headers: { 'Content-Type': 'text/html' }, status: 500 }
      );
    }

    const siteData = {
      ...site,
      member_site_categories: categories || [],
      member_site_content: content || []
    };

    // Generate and return HTML
    const html = generateSiteHTML(siteData);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
      status: 200
    });

  } catch (error) {
    console.error('Error in member-site-view:', error);
    return new Response(
      generateErrorPage('エラーが発生しました', 'サイトの読み込み中にエラーが発生しました。'),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
      }
    );
  }
});

function generateSiteHTML(site: any): string {
  const themeConfig = site.theme_config || {};
  const primaryColor = themeConfig.primaryColor || '#0cb386';
  const fontFamily = themeConfig.fontFamily || 'system-ui, sans-serif';
  
  // Sort categories and content
  const categories = site.member_site_categories
    ?.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)) || [];
  
  const publishedContent = site.member_site_content
    ?.filter((content: any) => content.is_published)
    ?.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)) || [];

  // Generate category navigation
  const categoryNavHTML = categories.map((category: any) => `
    <button onclick="showCategory('${category.id}')" class="category-nav-item" data-category="${category.id}">
      <div class="category-name">${category.name}</div>
      <div class="category-count">${category.content_count}件のコンテンツ</div>
    </button>
  `).join('');

  // Generate category blocks for main view
  const categoriesHTML = categories.map((category: any) => {
    const thumbnailHTML = category.thumbnail_url 
      ? `<div class="category-thumbnail"><img src="${category.thumbnail_url}" alt="${category.name}" /></div>`
      : `<div class="category-thumbnail category-thumbnail-placeholder"><div class="placeholder-text">画像なし</div></div>`;
    
    return `
      <div class="category-card" onclick="showCategory('${category.id}')">
        ${thumbnailHTML}
        <div class="category-content">
          <h3 class="category-title">${category.name}</h3>
          ${category.description ? `<p class="category-description">${category.description}</p>` : ''}
          <div class="category-meta">
            <span class="content-count">${category.content_count}件のコンテンツ</span>
            <span class="view-arrow">表示 →</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Generate content by category
  const categoryContentHTML = categories.map((category: any) => {
    const categoryContent = publishedContent.filter((content: any) => content.category_id === category.id);
    
    const contentListHTML = categoryContent.map((content: any) => `
      <div class="content-card" onclick="showContent('${content.id}')">
        <h4 class="content-title">${content.title}</h4>
        <div class="content-meta">読む →</div>
      </div>
    `).join('');

    return `
      <div id="category-${category.id}" class="category-content" style="display: none;">
        <div class="category-header">
          <h2 class="category-page-title">${category.name}</h2>
          ${category.description ? `<p class="category-page-description">${category.description}</p>` : ''}
        </div>
        <div class="content-grid">
          ${contentListHTML || '<p class="no-content">このカテゴリにはまだコンテンツがありません。</p>'}
        </div>
      </div>
    `;
  }).join('');

  // Generate individual content pages
  const contentPagesHTML = publishedContent.map((content: any) => {
    let contentBlocksHTML = '';
    
    if (content.content_blocks && Array.isArray(content.content_blocks)) {
      contentBlocksHTML = content.content_blocks.map((block: any) => {
        switch (block.type) {
          case 'heading':
            return `<h${block.level || 2} class="content-heading">${block.content || ''}</h${block.level || 2}>`;
          case 'paragraph':
            return `<p class="content-paragraph">${block.content || ''}</p>`;
          case 'image':
            return `<img src="${block.src || ''}" alt="${block.alt || ''}" class="content-image" />`;
          case 'video':
            return `<video controls class="content-video"><source src="${block.src || ''}" type="video/mp4"></video>`;
          default:
            return `<div class="content-block">${block.content || ''}</div>`;
        }
      }).join('');
    } else if (content.content) {
      contentBlocksHTML = `<div class="content-fallback">${content.content}</div>`;
    }

    return `
      <div id="content-${content.id}" class="content-detail" style="display: none;">
        <article class="article">
          <header class="article-header">
            <h1 class="article-title">${content.title}</h1>
          </header>
          <div class="article-content">
            ${contentBlocksHTML || '<p>コンテンツが準備中です。</p>'}
          </div>
        </article>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https:; media-src 'self' https:; script-src 'self' 'unsafe-inline';">
        <title>${site.name}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: ${fontFamily};
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
          }
          
          /* Header */
          .header {
            background: white;
            border-bottom: 1px solid #e0e0e0;
            position: sticky;
            top: 0;
            z-index: 100;
            padding: 1rem 0;
          }
          
          .header-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .site-title {
            font-size: 1.5rem;
            font-weight: bold;
            color: ${primaryColor};
          }
          
          .back-btn {
            background: none;
            border: 1px solid #ddd;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            color: #666;
            font-size: 0.9rem;
            display: none;
          }
          
          .back-btn:hover {
            background: #f5f5f5;
          }
          
          .menu-toggle {
            display: none;
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #666;
          }
          
          /* Layout */
          .layout {
            display: flex;
            max-width: 1200px;
            margin: 0 auto;
            min-height: calc(100vh - 70px);
          }
          
          /* Sidebar */
          .sidebar {
            width: 250px;
            background: white;
            border-right: 1px solid #e0e0e0;
            padding: 1.5rem 0;
            position: sticky;
            top: 70px;
            height: calc(100vh - 70px);
            overflow-y: auto;
          }
          
          .sidebar-header {
            padding: 0 1.5rem 1rem;
            border-bottom: 1px solid #e0e0e0;
            margin-bottom: 1rem;
          }
          
          .sidebar-title {
            font-weight: 600;
            color: #333;
          }
          
          .category-nav-item {
            display: block;
            width: 100%;
            text-align: left;
            background: none;
            border: none;
            padding: 0.75rem 1.5rem;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          
          .category-nav-item:hover {
            background: #f5f5f5;
          }
          
          .category-nav-item.active {
            background: ${primaryColor};
            color: white;
          }
          
          .category-name {
            font-weight: 500;
            margin-bottom: 0.25rem;
          }
          
          .category-count {
            font-size: 0.85rem;
            color: #666;
          }
          
          .category-nav-item.active .category-count {
            color: rgba(255, 255, 255, 0.8);
          }
          
          /* Main Content */
          .main-content {
            flex: 1;
            padding: 2rem;
            background: white;
          }
          
          /* Categories Grid */
          .categories-view h1 {
            font-size: 2.5rem;
            font-weight: bold;
            color: #333;
            margin-bottom: 1rem;
          }
          
          .categories-view .site-description {
            color: #666;
            margin-bottom: 3rem;
            font-size: 1.1rem;
          }
          
          .categories-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
          }
          
          .category-card {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
          }
          
          .category-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            border-color: ${primaryColor};
          }
          
          .category-thumbnail {
            width: 100%;
            height: 160px;
            overflow: hidden;
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .category-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .category-thumbnail-placeholder {
            background: linear-gradient(135deg, #f5f5f5, #e5e5e5);
          }
          
          .placeholder-text {
            color: #999;
            font-size: 14px;
          }
          
          .category-content {
            padding: 1.5rem;
            flex: 1;
          }

          .category-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 0.75rem;
          }
          
          .category-description {
            color: #666;
            margin-bottom: 1rem;
            line-height: 1.5;
          }
          
          .category-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 1rem;
            border-top: 1px solid #f0f0f0;
          }
          
          .content-count {
            font-size: 0.9rem;
            color: #666;
          }
          
          .view-arrow {
            color: ${primaryColor};
            font-weight: 500;
            font-size: 0.9rem;
          }
          
          /* Content Grid */
          .category-header h2 {
            font-size: 2rem;
            font-weight: bold;
            color: #333;
            margin-bottom: 1rem;
          }
          
          .category-page-description {
            color: #666;
            margin-bottom: 2rem;
            font-size: 1.1rem;
          }
          
          .content-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
          }
          
          .content-card {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 1.5rem;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          
          .content-card:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-color: ${primaryColor};
          }
          
          .content-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 1rem;
          }
          
          .content-meta {
            color: ${primaryColor};
            font-weight: 500;
            font-size: 0.9rem;
          }
          
          .no-content {
            color: #999;
            text-align: center;
            padding: 3rem 1rem;
          }
          
          /* Article Content */
          .article {
            max-width: 800px;
          }
          
          .article-header {
            margin-bottom: 2rem;
          }
          
          .article-title {
            font-size: 2.5rem;
            font-weight: bold;
            color: #333;
            line-height: 1.3;
          }
          
          .article-content {
            font-size: 1.1rem;
            line-height: 1.8;
          }
          
          .content-heading {
            color: #333;
            margin: 2rem 0 1rem;
            line-height: 1.4;
          }
          
          .content-paragraph {
            margin-bottom: 1.5rem;
          }
          
          .content-image {
            max-width: 100%;
            height: auto;
            margin: 2rem 0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          
          .content-video {
            max-width: 100%;
            height: auto;
            margin: 2rem 0;
            border-radius: 8px;
          }
          
          .content-block {
            margin-bottom: 1.5rem;
          }
          
          .content-fallback {
            white-space: pre-wrap;
          }
          
          /* Mobile Responsive */
          @media (max-width: 768px) {
            .layout {
              flex-direction: column;
            }
            
            .sidebar {
              width: 100%;
              height: auto;
              position: static;
              border-right: none;
              border-bottom: 1px solid #e0e0e0;
            }
            
            .main-content {
              padding: 1rem;
            }
            
            .categories-view h1 {
              font-size: 2rem;
            }
            
            .article-title {
              font-size: 2rem;
            }
            
            .menu-toggle {
              display: block;
            }
            
            .back-btn {
              display: block;
            }
            
            .sidebar {
              display: none;
            }
            
            .sidebar.mobile-open {
              display: block;
            }
          }
          
          /* Mobile menu styles */
          .mobile-sidebar {
            display: none;
            position: fixed;
            top: 70px;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            z-index: 200;
            overflow-y: auto;
          }
          
          .mobile-sidebar.open {
            display: block;
          }
        </style>
      </head>
      <body>
        <header class="header">
          <div class="header-content">
            <h1 class="site-title">${site.name}</h1>
            <button class="back-btn" onclick="goBack()">← 戻る</button>
            <button class="menu-toggle" onclick="toggleMobileMenu()">☰</button>
          </div>
        </header>
        
        <div class="layout">
          <aside class="sidebar">
            <div class="sidebar-header">
              <div class="sidebar-title">カテゴリ</div>
            </div>
            <button onclick="showCategories()" class="category-nav-item active" id="categories-nav">
              <div class="category-name">すべてのカテゴリ</div>
            </button>
            ${categoryNavHTML}
          </aside>
          
          <main class="main-content">
            <div id="categories-view" class="categories-view">
              <h1>${site.name}</h1>
              ${site.description ? `<p class="site-description">${site.description}</p>` : ''}
              <div class="categories-grid">
                ${categoriesHTML}
              </div>
            </div>
            
            ${categoryContentHTML}
            ${contentPagesHTML}
          </main>
        </div>
        
        <!-- Mobile Sidebar -->
        <div class="mobile-sidebar" id="mobile-sidebar">
          <div class="sidebar-header">
            <div class="sidebar-title">カテゴリ</div>
          </div>
          <button onclick="showCategories(); closeMobileMenu();" class="category-nav-item active" id="categories-nav-mobile">
            <div class="category-name">すべてのカテゴリ</div>
          </button>
          ${categoryNavHTML.replace(/onclick="showCategory/g, 'onclick="showCategory').replace(/\)"/g, '); closeMobileMenu();"')}
        </div>
        
        <script>
          let currentView = 'categories';
          
          function showCategories() {
            // Hide all content views
            document.querySelectorAll('.category-content, .content-detail').forEach(el => {
              el.style.display = 'none';
            });
            
            // Show categories view
            document.getElementById('categories-view').style.display = 'block';
            
            // Update navigation
            document.querySelectorAll('.category-nav-item').forEach(el => {
              el.classList.remove('active');
            });
            document.getElementById('categories-nav').classList.add('active');
            if (document.getElementById('categories-nav-mobile')) {
              document.getElementById('categories-nav-mobile').classList.add('active');
            }
            
            currentView = 'categories';
            updateBackButton();
          }
          
          function showCategory(categoryId) {
            // Hide all views
            document.querySelectorAll('.categories-view, .category-content, .content-detail').forEach(el => {
              el.style.display = 'none';
            });
            
            // Show category content
            const categoryElement = document.getElementById('category-' + categoryId);
            if (categoryElement) {
              categoryElement.style.display = 'block';
            }
            
            // Update navigation
            document.querySelectorAll('.category-nav-item').forEach(el => {
              el.classList.remove('active');
            });
            document.querySelectorAll('[data-category="' + categoryId + '"]').forEach(el => {
              el.classList.add('active');
            });
            
            currentView = 'category';
            updateBackButton();
          }
          
          function showContent(contentId) {
            // Hide all views
            document.querySelectorAll('.categories-view, .category-content, .content-detail').forEach(el => {
              el.style.display = 'none';
            });
            
            // Show content detail
            const contentElement = document.getElementById('content-' + contentId);
            if (contentElement) {
              contentElement.style.display = 'block';
            }
            
            currentView = 'content';
            updateBackButton();
          }
          
          function updateBackButton() {
            const backBtn = document.querySelector('.back-btn');
            if (currentView === 'categories') {
              backBtn.style.display = 'none';
            } else {
              backBtn.style.display = 'block';
            }
          }
          
          function goBack() {
            if (currentView === 'content') {
              // Go back to category view (find which category this content belongs to)
              // For now, just go to categories view
              showCategories();
            } else if (currentView === 'category') {
              showCategories();
            }
          }
          
          function toggleMobileMenu() {
            const mobileSidebar = document.getElementById('mobile-sidebar');
            mobileSidebar.classList.toggle('open');
          }
          
          function closeMobileMenu() {
            const mobileSidebar = document.getElementById('mobile-sidebar');
            mobileSidebar.classList.remove('open');
          }
          
          // Close mobile menu when clicking outside
          document.addEventListener('click', function(event) {
            const mobileSidebar = document.getElementById('mobile-sidebar');
            const menuToggle = document.querySelector('.menu-toggle');
            
            if (!mobileSidebar.contains(event.target) && !menuToggle.contains(event.target)) {
              closeMobileMenu();
            }
          });
          
          // Initialize view
          updateBackButton();
        </script>
      </body>
    </html>
  `;
}

function generateErrorPage(title: string, message: string): string {
  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          margin: 0;
          padding: 0;
          background: #f5f5f5;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .error-container {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
        }
        h1 { color: #333; margin-bottom: 1rem; }
        p { color: #666; }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>${title}</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `;
}

function generatePasscodeInputPage(slug: string, uid: string): string {
  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>パスコード入力</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          margin: 0;
          padding: 0;
          background: #f5f5f5;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .passcode-container {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
          width: 100%;
        }
        h1 { color: #333; margin-bottom: 1rem; }
        input {
          width: 100%;
          padding: 12px;
          margin: 1rem 0;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          box-sizing: border-box;
        }
        button {
          background: #007bff;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          width: 100%;
        }
        button:hover { background: #0056b3; }
        .error { color: #dc3545; margin-top: 1rem; }
      </style>
    </head>
    <body>
      <div class="passcode-container">
        <h1>パスコード入力</h1>
        <p>このコンテンツにアクセスするにはパスコードが必要です</p>
        <form id="passcodeForm">
          <input type="password" id="passcode" placeholder="パスコードを入力してください" required>
          <button type="submit">認証</button>
        </form>
        <div id="error" class="error" style="display: none;"></div>
      </div>
      <script>
        document.getElementById('passcodeForm').addEventListener('submit', function(e) {
          e.preventDefault();
          const passcode = document.getElementById('passcode').value;
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('passcode', passcode);
          window.location.href = currentUrl.toString();
        });
      </script>
    </body>
    </html>
  `;
}