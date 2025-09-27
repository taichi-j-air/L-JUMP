import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Helper to create a standardized error response
function errorResponse(message: string, status: number, errorCode: string) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    errorCode,
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const uid = url.searchParams.get('uid');
    const passcode = url.searchParams.get('passcode');

    if (!slug) {
      return errorResponse('Site slug is required', 400, 'BAD_REQUEST');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch Site
    const { data: site, error: siteError } = await supabase
      .from('member_sites')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (siteError) throw siteError;
    if (!site) {
      return errorResponse('Site not found or not published', 404, 'NOT_FOUND');
    }

    // 2. UID Authentication
    if (!uid) {
        return errorResponse('UID is required for this site', 401, 'UID_AUTH_FAILED');
    }

    const { data: friendData, error: friendError } = await supabase
        .from('line_friends')
        .select('id, user_id')
        .eq('short_uid_ci', uid.toUpperCase())
        .eq('user_id', site.user_id)
        .maybeSingle();

    if (friendError || !friendData) {
        return errorResponse('Invalid UID', 401, 'UID_AUTH_FAILED');
    }

    // 3. Tag Control
    const hasAllowedTags = site.allowed_tag_ids && site.allowed_tag_ids.length > 0;
    const hasBlockedTags = site.blocked_tag_ids && site.blocked_tag_ids.length > 0;

    if (hasAllowedTags || hasBlockedTags) {
      const { data: friendTags } = await supabase
        .from('friend_tags')
        .select('tag_id')
        .eq('friend_id', friendData.id);
      const friendTagIds = friendTags?.map(ft => ft.tag_id) || [];

      if (hasAllowedTags) {
        const hasRequiredTag = site.allowed_tag_ids.some((tagId: string) => friendTagIds.includes(tagId));
        if (!hasRequiredTag) {
          return errorResponse('Access denied by tag policy', 403, 'TAG_AUTH_FAILED');
        }
      }

      if (hasBlockedTags) {
        const hasBlockedTag = site.blocked_tag_ids.some((tagId: string) => friendTagIds.includes(tagId));
        if (hasBlockedTag) {
          return errorResponse('Access denied by tag policy', 403, 'TAG_AUTH_FAILED');
        }
      }
    }

    // 4. Passcode Check
    if (site.require_passcode) {
      if (!passcode) {
        return errorResponse('Passcode required', 401, 'PASSCODE_REQUIRED');
      }
      if (passcode !== site.passcode) {
        return errorResponse('Invalid passcode', 403, 'INVALID_PASSCODE');
      }
    }

    // 5. Success - Fetch data and return
    const [{ data: categories, error: catError }, { data: content, error: contError }, { data: progressRows, error: progressError }] = await Promise.all([
      supabase.from('member_site_categories').select('*').eq('site_id', site.id).order('sort_order'),
      supabase.from('member_site_content').select('*').eq('site_id', site.id).eq('is_published', true).order('sort_order'),
      supabase
        .from('member_site_content_progress')
        .select('content_id, status, progress_percentage')
        .eq('site_id', site.id)
        .eq('friend_id', friendData.id),
    ]);

    if (catError) throw catError;
    if (contError) throw contError;
    if (progressError) throw progressError;

    const progressMap = new Map<string, { status: string; progress_percentage: number }>();
    (progressRows || []).forEach((row) => {
      progressMap.set(row.content_id, {
        status: row.status ?? 'completed',
        progress_percentage: typeof row.progress_percentage === 'number' ? row.progress_percentage : 100,
      });
    });

    const enrichedContent = (content || []).map((item) => {
      const progress = progressMap.get(item.id) || { status: 'incomplete', progress_percentage: 0 };
      return {
        ...item,
        progress_status: progress.status,
        progress_percentage: progress.progress_percentage,
      };
    });

    return new Response(JSON.stringify({
      success: true,
      site,
      categories: categories || [],
      content: enrichedContent,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Internal Server Error:', error.message);
    return errorResponse('Internal server error', 500, 'SERVER_ERROR');
  }
});
