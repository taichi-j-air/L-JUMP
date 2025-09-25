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
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const uid = url.searchParams.get('uid');

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Missing slug parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get member site with categories and content
    let query = supabase
      .from('member_sites')
      .select(`
        *,
        member_site_categories(
          id,
          name,
          description,
          thumbnail_url,
          content_count,
          sort_order
        ),
        member_site_content(
          id,
          title,
          content,
          content_blocks,
          page_type,
          slug,
          is_published,
          access_level,
          sort_order,
          category_id
        )
      `)
      .eq('slug', slug)
      .eq('is_published', true);

    // Add UID verification if provided
    if (uid) {
      query = query.eq('site_uid', uid);
    }

    const { data: site, error: siteError } = await query.single();

    if (siteError || !site) {
      console.log('Site not found:', siteError);
      return new Response(
        generateErrorPage('サイトが見つかりません', 'お探しのサイトは存在しないか、公開されていません。'),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
        }
      );
    }

    // Check access control based on site type
    if (site.access_type === 'paid') {
      // For paid sites, additional access verification would be needed
      // For now, we'll allow access if the UID is correct
    }

    // Generate the site HTML
    const html = generateSiteHTML(site);

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
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
            grid-column: 1 / -1;
            text-align: center;
            color: #666;
            padding: 3rem;
            font-style: italic;
          }
          
          /* Article View */
          .article {
            max-width: 800px;
            margin: 0 auto;
          }
          
          .article-header {
            margin-bottom: 3rem;
            text-align: center;
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
            color: ${primaryColor};
            margin: 2rem 0 1rem;
            font-weight: 600;
          }
          
          .content-paragraph {
            margin: 1.5rem 0;
            color: #444;
          }
          
          .content-image, .content-video {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 2rem 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          
          .content-block, .content-fallback {
            margin: 1.5rem 0;
            color: #444;
          }
          
          /* Mobile Styles */
          @media (max-width: 768px) {
            .header-content {
              padding: 0 1rem;
            }
            
            .menu-toggle {
              display: block;
            }
            
            .layout {
              flex-direction: column;
            }
            
            .sidebar {
              position: fixed;
              top: 70px;
              left: 0;
              width: 280px;
              transform: translateX(-100%);
              transition: transform 0.3s ease;
              z-index: 90;
              height: calc(100vh - 70px);
            }
            
            .sidebar.open {
              transform: translateX(0);
            }
            
            .sidebar-overlay {
              position: fixed;
              top: 70px;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0,0,0,0.5);
              z-index: 80;
              display: none;
            }
            
            .sidebar-overlay.show {
              display: block;
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
            
            .categories-grid {
              grid-template-columns: 1fr;
            }
            
            .content-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <header class="header">
          <div class="header-content">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
              <h1 class="site-title">${site.name}</h1>
            </div>
            <button class="back-btn" onclick="goBack()">← 戻る</button>
          </div>
        </header>
        
        <!-- Sidebar Overlay (Mobile) -->
        <div class="sidebar-overlay" onclick="closeSidebar()"></div>
        
        <!-- Layout -->
        <div class="layout">
          <!-- Sidebar -->
          <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
              <h2 class="sidebar-title">カテゴリ</h2>
            </div>
            <nav>
              ${categoryNavHTML}
            </nav>
          </aside>
          
          <!-- Main Content -->
          <main class="main-content">
            <!-- Categories View -->
            <div id="categories-view" class="categories-view">
              <h1>${site.name}</h1>
              ${site.description ? `<p class="site-description">${site.description}</p>` : ''}
              <div class="categories-grid">
                ${categoriesHTML}
              </div>
            </div>
            
            <!-- Category Content Views -->
            ${categoryContentHTML}
            
            <!-- Individual Content Views -->
            ${contentPagesHTML}
          </main>
        </div>
        
        <script>
          let currentView = 'categories';
          let currentCategory = null;
          let currentContent = null;
          
          function showView(viewId) {
            // Hide all views
            document.getElementById('categories-view').style.display = 'none';
            document.querySelectorAll('.category-content').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.content-detail').forEach(el => el.style.display = 'none');
            
            // Show target view
            const targetView = document.getElementById(viewId);
            if (targetView) {
              targetView.style.display = 'block';
            }
            
            // Update back button
            const backBtn = document.querySelector('.back-btn');
            backBtn.style.display = viewId === 'categories-view' ? 'none' : 'block';
            
            // Update category nav active state
            document.querySelectorAll('.category-nav-item').forEach(el => el.classList.remove('active'));
            if (currentCategory) {
              const activeNav = document.querySelector(\`[data-category="\${currentCategory}"]\`);
              if (activeNav) activeNav.classList.add('active');
            }
          }
          
          function showCategory(categoryId) {
            currentView = 'category';
            currentCategory = categoryId;
            currentContent = null;
            showView(\`category-\${categoryId}\`);
            closeSidebar();
          }
          
          function showContent(contentId) {
            currentView = 'content';
            currentContent = contentId;
            showView(\`content-\${contentId}\`);
          }
          
          function goBack() {
            if (currentView === 'content' && currentCategory) {
              showCategory(currentCategory);
            } else {
              currentView = 'categories';
              currentCategory = null;
              currentContent = null;
              showView('categories-view');
            }
          }
          
          function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            const isOpen = sidebar.classList.contains('open');
            
            if (isOpen) {
              closeSidebar();
            } else {
              sidebar.classList.add('open');
              overlay.classList.add('show');
            }
          }
          
          function closeSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
          }
          
          // Initialize
          document.addEventListener('DOMContentLoaded', function() {
            showView('categories-view');
          });
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
            font-family: system-ui, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          
          .error-container {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 400px;
          }
          
          .error-title {
            font-size: 1.5rem;
            color: #e74c3c;
            margin-bottom: 1rem;
          }
          
          .error-message {
            color: #666;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1 class="error-title">${title}</h1>
          <p class="error-message">${message}</p>
        </div>
      </body>
    </html>
  `;
}