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
    let friend = null
    if (page.visibility === "friends_only" && !isPreview) {
      if (!uid || uid === "[UID]") {
        return errorResponse("access_denied", "UID is required to view this page", 403)
      }

      // UIDフォーマットチェック
      if (!/^[A-Z0-9]{6}$/.test(uid)) {
        return errorResponse("access_denied", "Invalid UID format", 403)
      }

      const { data: friendData, error: friendError } = await supabase
        .from("line_friends")
        .select("id, display_name, line_user_id, user_id, short_uid_ci")
        .eq("short_uid_ci", uid.toUpperCase())
        .eq("user_id", page.user_id)
        .single()

      if (friendError || !friendData) {
        return errorResponse("access_denied", "Friend not found or unauthorized access", 403)
      }
      
      friend = friendData
    }

    // タグ条件チェック（友だち限定ページのみ）
    if (page.visibility === "friends_only" && friend && !isPreview) {
      const hasAllowedTagIds = page.allowed_tag_ids && page.allowed_tag_ids.length > 0
      const hasBlockedTagIds = page.blocked_tag_ids && page.blocked_tag_ids.length > 0
      
      if (hasAllowedTagIds || hasBlockedTagIds) {
        // 友だちのタグを取得
        const { data: friendTags, error: tagError } = await supabase
          .from("friend_tags")
          .select("tag_id")
          .eq("friend_id", friend.id)
        
        if (tagError) {
          console.error("Tag lookup error:", tagError)
          return errorResponse("server_error", "Tag lookup failed", 500)
        }
        
        const friendTagIds = friendTags?.map(ft => ft.tag_id) || []
        console.log(`🏷️ Friend tags: ${friendTagIds.join(', ')}`)
        
        // 閲覧禁止タグチェック
        if (hasBlockedTagIds) {
          const hasBlockedTag = page.blocked_tag_ids.some(tagId => friendTagIds.includes(tagId))
          if (hasBlockedTag) {
            console.log("❌ Friend has blocked tag")
            return errorResponse("tag_blocked", "Access denied due to tag restrictions", 403)
          }
        }
        
        // 閲覧可能タグチェック
        if (hasAllowedTagIds) {
          const hasAllowedTag = page.allowed_tag_ids.some(tagId => friendTagIds.includes(tagId))
          if (!hasAllowedTag) {
            console.log("❌ Friend does not have required tag")
            return errorResponse("tag_required", "Access denied: required tag not found", 403)
          }
        }
        
        console.log("✅ Tag conditions passed")
      }
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
