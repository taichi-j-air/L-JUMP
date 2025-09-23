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
    const pathSegments = url.pathname.split('/');
    const slug = pathSegments[pathSegments.length - 1];
    const uid = url.searchParams.get('uid');

    if (!slug || !uid) {
      return new Response(
        JSON.stringify({ error: 'Missing slug or UID parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get member site by slug and UID
    const { data: site, error: siteError } = await supabase
      .from('member_sites')
      .select(`
        *,
        member_site_content(
          id,
          title,
          content,
          content_blocks,
          page_type,
          slug,
          is_published,
          access_level,
          sort_order
        )
      `)
      .eq('slug', slug)
      .eq('site_uid', uid)
      .eq('is_published', true)
      .single();

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
  
  // Sort content by sort_order
  const publishedContent = site.member_site_content
    ?.filter((content: any) => content.is_published)
    ?.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)) || [];

  const contentHTML = publishedContent.map((content: any) => {
    if (content.content_blocks && Array.isArray(content.content_blocks)) {
      // Render content blocks if available
      return content.content_blocks.map((block: any) => {
        switch (block.type) {
          case 'heading':
            return `<h${block.level || 2} style="color: ${primaryColor}; margin: 1.5rem 0 1rem;">${block.content || ''}</h${block.level || 2}>`;
          case 'paragraph':
            return `<p style="margin: 1rem 0; line-height: 1.6;">${block.content || ''}</p>`;
          case 'image':
            return `<img src="${block.src || ''}" alt="${block.alt || ''}" style="max-width: 100%; height: auto; margin: 1rem 0;" />`;
          case 'video':
            return `<video controls style="max-width: 100%; height: auto; margin: 1rem 0;"><source src="${block.src || ''}" type="video/mp4"></video>`;
          default:
            return `<div style="margin: 1rem 0;">${block.content || ''}</div>`;
        }
      }).join('');
    } else {
      // Fallback to plain content
      return `<div style="margin: 2rem 0;">${content.content || ''}</div>`;
    }
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            background-color: #fff;
          }
          
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
          }
          
          .header {
            text-align: center;
            margin-bottom: 3rem;
            padding-bottom: 2rem;
            border-bottom: 2px solid ${primaryColor};
          }
          
          .site-title {
            font-size: 2.5rem;
            font-weight: bold;
            color: ${primaryColor};
            margin-bottom: 1rem;
          }
          
          .site-description {
            font-size: 1.1rem;
            color: #666;
            max-width: 600px;
            margin: 0 auto;
          }
          
          .content {
            max-width: 800px;
            margin: 0 auto;
          }
          
          .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
            color: ${primaryColor};
            margin: 2rem 0 1rem;
          }
          
          .content p {
            margin: 1rem 0;
            line-height: 1.8;
          }
          
          .content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 1.5rem 0;
          }
          
          .content video {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 1.5rem 0;
          }
          
          @media (max-width: 768px) {
            .container {
              padding: 1rem;
            }
            
            .site-title {
              font-size: 2rem;
            }
            
            .site-description {
              font-size: 1rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="header">
            <h1 class="site-title">${site.name}</h1>
            ${site.description ? `<p class="site-description">${site.description}</p>` : ''}
          </header>
          
          <main class="content">
            ${contentHTML || '<p>コンテンツが準備中です。</p>'}
          </main>
        </div>
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