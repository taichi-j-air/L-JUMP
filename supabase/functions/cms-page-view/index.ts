import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

console.log("Listening on http://localhost:9999/\n")

type TokenMap = Record<string, string>

interface PageResponse {
  id: string
  title: string
  content: string | null
  content_blocks: unknown[]
  visibility: string | null
  timer_enabled: boolean | null
  timer_deadline: string | null
  timer_text: string | null
  timer_display_mode: string | null
  timer_text_color: string | null
  timer_bg_color: string | null
  timer_style: string | null
  timer_mode: string | null
  timer_duration_seconds: number | null
  timer_day_label: string | null
  timer_hour_label: string | null
  timer_minute_label: string | null
  timer_second_label: string | null
  show_milliseconds: boolean | null
  internal_timer: boolean | null
  expire_action: string | null
  timer_mode_step_delivery: boolean | null
  timer_step_id: string | null
  timer_scenario_id: string | null
  show_remaining_text: boolean | null
  show_end_date: boolean | null
  require_passcode: boolean | null
  tag_label: string | null
  allowed_tag_ids: string[] | null
  blocked_tag_ids: string[] | null
}

type FriendRow = {
  id: string
  display_name: string | null
  line_user_id: string | null
  user_id: string
  short_uid_ci: string | null
}

const PLACEHOLDER_UID_VALUES = new Set(["[UID]", "UID", "NULL"])

// 共通エラーレスポンス関数
function errorResponse(error: string, message?: string, status: number = 403) {
  return new Response(
    JSON.stringify({ error, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
}

function normalizeUid(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const upper = trimmed.toUpperCase()
  return PLACEHOLDER_UID_VALUES.has(upper) ? null : upper
}

function replaceTokensInString(value: string, tokens: TokenMap): string {
  let result = value
  for (const [token, replacement] of Object.entries(tokens)) {
    if (!token) continue
    const replacementValue = replacement ?? ""
    if (result.includes(token)) {
      result = result.split(token).join(replacementValue)
    }
  }
  return result
}

function replaceTokensDeep(value: unknown, tokens: TokenMap): unknown {
  if (!tokens || Object.keys(tokens).length === 0) {
    return value
  }

  if (typeof value === "string") {
    return replaceTokensInString(value, tokens)
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceTokensDeep(item, tokens))
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, val]) => [
      key,
      replaceTokensDeep(val, tokens),
    ])
    return Object.fromEntries(entries)
  }

  return value
}

function normalizeContentBlocks(raw: unknown): unknown[] {
  if (!raw) {
    return []
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return Array.isArray(raw) ? raw : []
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { shareCode, uid, pageId, passcode = "", isPreview = false, pageType } = await req.json()

    console.log(
      `🔍 Request received: shareCode=${shareCode}, uid=${uid}, pageId=${pageId}, isPreview=${isPreview}, pageType=${pageType}, passcode=${passcode ? '***' : 'none'}`
    )

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    let page
    if (isPreview && pageId) {
      const { data } = await supabase
        .from("cms_pages")
        .select("*")
        .eq("id", pageId)
        .single()
      page = data
    } else {
      let query = supabase
        .from("cms_pages")
        .select("*")
        .eq("share_code", shareCode)

      if (pageType === "public") {
        query = query.eq("page_type", "public")
      }

      const { data } = await query.single()
      page = data
    }

    if (!page) {
      return errorResponse("not_found", "Page not found", 404)
    }

    if (!isPreview && !page.is_published) {
      return errorResponse("not_published", "Page is not published", 423)
    }

    if (page.require_passcode && !isPreview) {
      if (!passcode || passcode !== page.passcode) {
        return errorResponse("passcode_required", "Passcode is required", 401)
      }
    }

    const normalizedUid = normalizeUid(uid)
    const tokenValues: TokenMap = {}

    let friend: FriendRow | null = null

    if (!isPreview) {
      const requiresFriend = page.visibility === "friends_only"

      if (requiresFriend && !normalizedUid) {
        return errorResponse("access_denied", "UID is required to view this page", 403)
      }

      if (requiresFriend && normalizedUid && !/^[A-Z0-9]{6}$/.test(normalizedUid)) {
        return errorResponse("access_denied", "Invalid UID format", 403)
      }

      if (normalizedUid && /^[A-Z0-9]{6}$/.test(normalizedUid)) {
        const { data: friendData, error: friendError } = await supabase
          .from("line_friends")
          .select("id, display_name, line_user_id, user_id, short_uid_ci")
          .eq("short_uid_ci", normalizedUid)
          .eq("user_id", page.user_id)
          .maybeSingle<FriendRow>()

        if (friendError) {
          console.error("Failed to fetch friend data:", friendError)
        }

        if (friendData) {
          friend = friendData
        }

        if (requiresFriend && (!friendData || friendError)) {
          return errorResponse("access_denied", "Friend not found or unauthorized access", 403)
        }
      } else if (requiresFriend) {
        return errorResponse("access_denied", "Invalid UID format", 403)
      }
    }

    if (normalizedUid) {
      tokenValues["[UID]"] = friend?.short_uid_ci ?? normalizedUid
    }

    const rawDisplayName = friend?.display_name?.trim()
    const fallbackName = rawDisplayName && rawDisplayName.length > 0 ? rawDisplayName : "あなた"

    tokenValues["[LINE_NAME]"] = fallbackName
    tokenValues["[LINE_NAME_SAN]"] = fallbackName === "あなた" ? "あなた" : `${fallbackName}さん`
    tokenValues["[LINE_ID]"] = friend?.line_user_id ?? ""

    if (friend && (page.blocked_tag_ids?.length > 0 || page.allowed_tag_ids?.length > 0)) {
      console.log(`Checking tag access for friend ${friend.id}`)

      const { data: friendTags } = await supabase
        .from("friend_tags")
        .select("tag_id")
        .eq("friend_id", friend.id)

      const friendTagIds = friendTags?.map((ft) => ft.tag_id) || []
      console.log(`Friend has tags: ${friendTagIds}`)

      if (page.blocked_tag_ids?.length > 0) {
        const hasBlockedTag = page.blocked_tag_ids.some((tagId: string) => friendTagIds.includes(tagId))
        if (hasBlockedTag) {
          console.log("Friend blocked by tag")
          return errorResponse("tag_blocked", "Access denied due to tag restrictions", 403)
        }
      }

      if (page.allowed_tag_ids?.length > 0) {
        const hasAllowedTag = page.allowed_tag_ids.some((tagId: string) => friendTagIds.includes(tagId))
        if (!hasAllowedTag) {
          console.log("Friend missing required tag")
          return errorResponse("tag_required", "Required tag not found", 403)
        }
      }
    }

    if (!isPreview && page.timer_enabled && (page.expire_action === "hide" || page.expire_action === "hide_page")) {
      let isTimerExpired = false
      console.log(`🕒 Timer expiration check: mode=${page.timer_mode}, expire_action=${page.expire_action}`)

      if (page.timer_mode === "absolute" && page.timer_deadline) {
        const deadline = new Date(page.timer_deadline)
        const now = new Date()
        isTimerExpired = now >= deadline
        console.log(`📅 Absolute timer check: deadline=${deadline.toISOString()}, now=${now.toISOString()}, page.timer_deadline=${page.timer_deadline}, expired=${isTimerExpired}`)
      } else if ((page.timer_mode === "per_access" || page.timer_mode === "step_delivery") && friend) {
        const { data: accessData } = await supabase
          .from("friend_page_access")
          .select("timer_start_at, timer_end_at, access_enabled")
          .eq("friend_id", friend.id)
          .eq("page_share_code", page.share_code)
          .maybeSingle()

        console.log(`🔍 Access data: ${JSON.stringify(accessData)}`)

        if (accessData && accessData.timer_end_at) {
          isTimerExpired = new Date() >= new Date(accessData.timer_end_at)
          console.log(`⏰ Timer end check: timer_end_at=${accessData.timer_end_at}, expired=${isTimerExpired}`)
        } else if (accessData && accessData.timer_start_at && page.timer_duration_seconds && page.timer_duration_seconds > 0) {
          const startTime = new Date(accessData.timer_start_at)
          const endTime = new Date(startTime.getTime() + page.timer_duration_seconds * 1000)
          isTimerExpired = new Date() >= endTime
          console.log(`⏱ Duration check: start=${accessData.timer_start_at}, duration=${page.timer_duration_seconds}s, expired=${isTimerExpired}`)

          if (!accessData.timer_end_at) {
            await supabase
              .from("friend_page_access")
              .update({ timer_end_at: endTime.toISOString() })
              .eq("friend_id", friend.id)
              .eq("page_share_code", page.share_code)
          }
        } else if (accessData && accessData.timer_start_at && (!page.timer_duration_seconds || page.timer_duration_seconds <= 0)) {
          console.log("⚠️ Timer duration is 0 or null - timer disabled")
          isTimerExpired = false
        }
      }

      if (isTimerExpired) {
        console.log("⛔ Timer expired - hiding page")
        return errorResponse("timer_expired", "ページの閲覧期限が過ぎました", 410)
      }
    }

    const contentBlocks = normalizeContentBlocks(page.content_blocks)

    const basePageData: PageResponse = {
      id: page.id,
      title: page.title,
      content: page.content,
      content_blocks: contentBlocks,
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
      show_remaining_text: page.show_remaining_text,
      show_end_date: page.show_end_date,
      require_passcode: page.require_passcode,
      tag_label: page.tag_label,
      allowed_tag_ids: page.allowed_tag_ids,
      blocked_tag_ids: page.blocked_tag_ids,
    }

    const processedPageData = replaceTokensDeep(basePageData, tokenValues) as PageResponse

    console.log("✅ Success - returning page content with tokens applied")

    return new Response(JSON.stringify({ ...processedPageData, token_values: tokenValues }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error:", error)
    return errorResponse("server_error", (error as Error).message, 500)
  }
})
