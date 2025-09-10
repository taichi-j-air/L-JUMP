import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

console.log("Listening on http://localhost:9999/\n")

// 共通エラーレスポンス関数
function errorResponse(error: string, message?: string, status: number = 403) {
  return new Response(
    JSON.stringify({ error, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { shareCode, uid, pageId, passcode = "", isPreview = false } = await req.json()

    console.log(
      `🔍 Request received: shareCode=${shareCode}, uid=${uid}, pageId=${pageId}, isPreview=${isPreview}, passcode=${passcode ? '***' : 'none'}`
    )

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // ページデータ取得
    let page
    if (isPreview && pageId) {
      const { data } = await supabase
        .from("cms_pages")
        .select("*")
        .eq("id", pageId)
        .single()
      page = data
    } else {
      const { data } = await supabase
        .from("cms_pages")
        .select("*")
        .eq("share_code", shareCode)
        .single()
      page = data
    }

    if (!page) {
      return errorResponse("not_found", "Page not found", 404)
    }

    console.log(`Page found: {
      id: "${page.id}",
      user_id: "${page.user_id}",
      visibility: "${page.visibility}"
    }`)

    // 公開状態チェック
    if (!isPreview && !page.is_published) {
      return errorResponse("not_published", "Page is not published", 403)
    }

    // パスコードチェック
    if (page.require_passcode && !isPreview) {
      if (!passcode || passcode !== page.passcode) {
        return errorResponse("passcode_required", "Passcode is required", 403)
      }
    }

    // 友だち限定ページのチェック
    if (page.visibility === "friends_only" && !isPreview) {
      if (!uid || uid === "[UID]") {
        console.log("❌ FRIENDS_ONLY: Missing or placeholder UID - BLOCKED")
        console.log(`   Current UID value: "${uid}"`)
        return errorResponse("access_denied", "UID is required to view this page", 403)
      }

      console.log(`🔐 Friend authentication required for UID: ${uid}`)

      // UIDフォーマットチェック
      if (!/^[A-Z0-9]{6}$/.test(uid)) {
        console.log("❌ FRIENDS_ONLY: Invalid UID format - BLOCKED")
        console.log(`   Expected: 6 alphanumeric characters, Got: "${uid}" (length: ${uid.length})`)
        return errorResponse("access_denied", "Invalid UID format", 403)
      }

      // DB照合前にデバッグ情報を出力
      console.log(`🔍 Looking up friend: uid="${uid}", page_user_id="${page.user_id}"`)
      
      const { data: friend, error: friendError } = await supabase
        .from("line_friends")
        .select("id, display_name, line_user_id, user_id, short_uid_ci")
        .eq("short_uid_ci", uid.toUpperCase())
        .eq("user_id", page.user_id)
        .single()

      console.log(`📊 Friend lookup result:`, { friend, friendError })

      if (friendError || !friend) {
        console.log("❌ FRIENDS_ONLY: Friend not found or unauthorized - BLOCKED")
        console.log(`   Error details: ${friendError?.message}`)
        
        // Check if any friends exist for this user to help debugging
        const { data: allFriends, error: allError } = await supabase
          .from("line_friends")
          .select("short_uid_ci, display_name")
          .eq("user_id", page.user_id)
          .limit(5)

        console.log(`📋 Available friends for user ${page.user_id}:`, allFriends?.map(f => f.short_uid_ci) || 'none')
        
        return errorResponse("access_denied", "Friend not found or unauthorized access", 403)
      }

      console.log(`✅ Friend authenticated: ${friend.display_name} (${uid})`)
    }

    // ページデータを返す
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
      blocked_tag_ids: page.blocked_tag_ids,
    }

    console.log("✅ Success - returning page content")

    return new Response(JSON.stringify(pageData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error:", error)
    return errorResponse("server_error", (error as Error).message, 500)
  }
})
