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
      return errorResponse('Site slug is required', 400);
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
      return errorResponse('Failed to fetch site data', 500);
    }

    if (!site) {
      return errorResponse('Site not found or not published', 404);
    }

    // Check if passcode is required
    if (site.require_passcode && !passcode) {
      return errorResponse('Passcode required', 401, { requirePasscode: true });
    }

    // Verify passcode if provided
    if (site.require_passcode && site.passcode && passcode !== site.passcode) {
      return errorResponse('Invalid passcode', 403);
    }

    // Authentication check for UID if provided
    if (uid) {
      // Verify friend exists and has access
      const { data: friendData, error: friendError } = await supabase
        .from('line_friends')
        .select('id, user_id')
        .eq('short_uid_ci', uid.toUpperCase())
        .eq('user_id', site.user_id)
        .maybeSingle();

      if (friendError || !friendData) {
        return errorResponse('Authentication required - LINE friend status needed', 401);
      }

      // Check tag-based access control if configured
      if (site.allowed_tag_ids && site.allowed_tag_ids.length > 0) {
        const { data: friendTags } = await supabase
          .from('friend_tags')
          .select('tag_id')
          .eq('friend_id', friendData.id);

        const friendTagIds = friendTags?.map(ft => ft.tag_id) || [];
        const hasRequiredTag = site.allowed_tag_ids.some((tagId: string) => 
          friendTagIds.includes(tagId)
        );

        if (!hasRequiredTag) {
          return errorResponse('Access denied - required tags not found', 403);
        }
      }

      // Check blocked tags
      if (site.blocked_tag_ids && site.blocked_tag_ids.length > 0) {
        const { data: friendTags } = await supabase
          .from('friend_tags')
          .select('tag_id')
          .eq('friend_id', friendData.id);

        const friendTagIds = friendTags?.map(ft => ft.tag_id) || [];
        const hasBlockedTag = site.blocked_tag_ids.some((tagId: string) => 
          friendTagIds.includes(tagId)
        );

        if (hasBlockedTag) {
          return errorResponse('Access denied - blocked tags found', 403);
        }
      }
    }

    // Fetch categories
    const { data: categories, error: categoriesError } = await supabase
      .from('member_site_categories')
      .select('*')
      .eq('site_id', site.id)
      .order('sort_order');

    if (categoriesError) {
      console.error('Categories fetch error:', categoriesError);
      return errorResponse('Failed to fetch categories', 500);
    }

    // Fetch content
    const { data: content, error: contentError } = await supabase
      .from('member_site_content')
      .select('*')
      .eq('site_id', site.id)
      .eq('is_published', true)
      .order('sort_order');

    if (contentError) {
      console.error('Content fetch error:', contentError);
      return errorResponse('Failed to fetch content', 500);
    }

    // Return JSON data for React to render
    return new Response(JSON.stringify({
      success: true,
      site,
      categories: categories || [],
      content: content || []
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return errorResponse('Internal server error', 500);
  }
});

function errorResponse(message: string, status: number = 400, extra: any = {}) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    ...extra
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}