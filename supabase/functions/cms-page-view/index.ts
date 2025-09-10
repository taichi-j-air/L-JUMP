import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Listening on http://localhost:9999/\n")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { shareCode, uid, pageId, passcode = '', isPreview = false } = await req.json()
    
    console.log(`Request received: shareCode=${shareCode}, uid=${uid}, pageId=${pageId}, isPreview=${isPreview}`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get page data
    let page
    if (isPreview && pageId) {
      const { data } = await supabase
        .from('cms_pages')
        .select('*')
        .eq('id', pageId)
        .single()
      page = data
    } else {
      const { data } = await supabase
        .from('cms_pages')
        .select('*')
        .eq('share_code', shareCode)
        .single()
      page = data
    }

    if (!page) {
      return new Response(
        JSON.stringify({ error: 'not_found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Page found: {
  id: "${page.id}",
  user_id: "${page.user_id}",
  visibility: "${page.visibility}"
}`)

    // Check if page is published
    if (!isPreview && !page.is_published) {
      return new Response(
        JSON.stringify({ 
          error: 'not_published',
          title: page.title,
          content: page.content,
          content_blocks: page.content_blocks
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check passcode if required
    if (page.require_passcode && !isPreview) {
      if (!passcode || passcode !== page.passcode) {
        return new Response(
          JSON.stringify({ error: 'passcode_required' }),
          { 
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

// Friend authentication for friends_only pages
if (page.visibility === "friends_only" && !isPreview) {
  // UIDが存在しない or 未変換のときは即ブロック
  if (!uid || uid === '[UID]') {
    console.log(`❌ STRICT: Missing or placeholder UID - BLOCKED`)
    return new Response(
      JSON.stringify({ 
        error: 'access_denied',
        message: 'UID is required to view this page'
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`🔐 Friend authentication required for UID: ${uid}`)

  // UIDフォーマットチェック
  if (!/^[A-Z0-9]{6}$/.test(uid)) {
    console.log(`❌ STRICT: Invalid UID format - BLOCKED`)
    return new Response(
      JSON.stringify({ 
        error: 'access_denied',
        message: 'Invalid friend identification'
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // DB照合（UIDが存在するかつページ所有者の友達か）
  const { data: friend, error: friendError } = await supabase
    .from('line_friends')
    .select('id, display_name, line_user_id, user_id')
    .eq('short_uid_ci', uid.toUpperCase())
    .eq('user_id', page.user_id)
    .single()

  if (friendError || !friend) {
    console.log(`❌ STRICT: Friend not found or unauthorized - BLOCKED`)
    return new Response(
      JSON.stringify({ 
        error: 'access_denied',
        message: 'Friend not found or unauthorized access'
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`✅ Friend authenticated: ${friend.display_name} (${uid})`)
}


      console.log(`✅ Friend authenticated: ${friend.display_name} (${uid})`)
    }

    // Return page data
    const pageData = {
      id: page.id,
      title: page.title,
      content: page.content,
      content_blocks: page.content_blocks,
      visibility: page.visibility,
      timer_enabled: page.timer_enabled,
      timer_deadline: page.timer_deadline,
      timer_text: page.timer_text,
      timer_display_mode: page.timer_display_mode,
      timer_text_color: page.timer_text_color,
      timer_bg_color: page.timer_bg_color,
      timer_style: page.timer_style,
      timer_mode: page.timer_mode,
      timer_duration_seconds: page.timer_duration_seconds,
      timer_day_label: page.timer_day_label,
      timer_hour_label: page.timer_hour_label,
      timer_minute_label: page.timer_minute_label,
      timer_second_label: page.timer_second_label,
      show_milliseconds: page.show_milliseconds,
      internal_timer: page.internal_timer,
      expire_action: page.expire_action,
      timer_mode_step_delivery: page.timer_mode_step_delivery,
      timer_step_id: page.timer_step_id,
      timer_scenario_id: page.timer_scenario_id,
      require_passcode: page.require_passcode,
      tag_label: page.tag_label,
      allowed_tag_ids: page.allowed_tag_ids,
      blocked_tag_ids: page.blocked_tag_ids
    }

    console.log("Success - returning page content")

    return new Response(
      JSON.stringify(pageData),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'server_error', message: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})