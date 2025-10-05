import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type TokenMap = Record<string, string>

type FriendRow = {
  id: string
  user_id: string
  display_name: string | null
  line_user_id: string | null
  short_uid_ci: string | null
}

const PLACEHOLDER_UID_VALUES = new Set(['[UID]', 'UID', 'NULL'])

// Helper to create a standardized error response
function errorResponse(message: string, status: number, errorCode: string) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    errorCode,
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeUid(value: string | null | undefined): string | null {
  if (!value) {
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
    const replacementValue = replacement ?? ''
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

  if (typeof value === 'string') {
    return replaceTokensInString(value, tokens)
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceTokensDeep(item, tokens))
  }

  if (value && typeof value === 'object') {
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

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return Array.isArray(raw) ? raw : []
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')
    const uid = url.searchParams.get('uid')
    const passcode = url.searchParams.get('passcode')

    if (!slug) {
      return errorResponse('Site slug is required', 400, 'BAD_REQUEST')
    }

    const normalizedUid = normalizeUid(uid)
    if (!normalizedUid) {
      return errorResponse('UID is required for this site', 401, 'UID_AUTH_FAILED')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Fetch Site
    const { data: site, error: siteError } = await supabase
      .from('member_sites')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle()

    if (siteError) throw siteError
    if (!site) {
      return errorResponse('Site not found or not published', 404, 'NOT_FOUND')
    }

    // 2. UID Authentication
    const { data: friendData, error: friendError } = await supabase
      .from('line_friends')
      .select('id, user_id, display_name, line_user_id, short_uid_ci')
      .eq('short_uid_ci', normalizedUid)
      .eq('user_id', site.user_id)
      .maybeSingle<FriendRow>()

    if (friendError || !friendData) {
      return errorResponse('Invalid UID', 401, 'UID_AUTH_FAILED')
    }

    const rawDisplayName = friendData.display_name?.trim()
    const fallbackName = rawDisplayName && rawDisplayName.length > 0 ? rawDisplayName : "あなた"

    const tokenValues: TokenMap = {
      '[UID]': friendData.short_uid_ci ?? normalizedUid,
      '[LINE_NAME]': fallbackName,
      '[LINE_NAME_SAN]': fallbackName === 'あなた' ? 'あなた' : `${fallbackName}さん`,
      '[LINE_ID]': friendData.line_user_id ?? '',
    }

    // 3. Tag Control
    const hasAllowedTags = site.allowed_tag_ids && site.allowed_tag_ids.length > 0
    const hasBlockedTags = site.blocked_tag_ids && site.blocked_tag_ids.length > 0

    if (hasAllowedTags || hasBlockedTags) {
      const { data: friendTags } = await supabase
        .from('friend_tags')
        .select('tag_id')
        .eq('friend_id', friendData.id)
      const friendTagIds = friendTags?.map((ft) => ft.tag_id) || []

      if (hasAllowedTags) {
        const hasRequiredTag = site.allowed_tag_ids.some((tagId: string) => friendTagIds.includes(tagId))
        if (!hasRequiredTag) {
          return errorResponse('Access denied by tag policy', 403, 'TAG_AUTH_FAILED')
        }
      }

      if (hasBlockedTags) {
        const hasBlockedTag = site.blocked_tag_ids.some((tagId: string) => friendTagIds.includes(tagId))
        if (hasBlockedTag) {
          return errorResponse('Access denied by tag policy', 403, 'TAG_AUTH_FAILED')
        }
      }
    }

    // 4. Passcode Check
    if (site.require_passcode) {
      if (!passcode) {
        return errorResponse('Passcode required', 401, 'PASSCODE_REQUIRED')
      }
      if (passcode !== site.passcode) {
        return errorResponse('Invalid passcode', 403, 'INVALID_PASSCODE')
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
    ])

    if (catError) throw catError
    if (contError) throw contError
    if (progressError) throw progressError

    const progressMap = new Map<string, { status: string; progress_percentage: number }>()
    ;(progressRows || []).forEach((row) => {
      progressMap.set(row.content_id, {
        status: row.status ?? 'completed',
        progress_percentage: typeof row.progress_percentage === 'number' ? row.progress_percentage : 100,
      })
    })

    const processedCategories = (categories || []).map((category: any) => {
      const baseCategory = {
        ...category,
        content_blocks: normalizeContentBlocks(category?.content_blocks),
      }
      return replaceTokensDeep(baseCategory, tokenValues)
    })

    const enrichedContent = (content || []).map((item: any) => {
      const progress = progressMap.get(item.id) || { status: 'incomplete', progress_percentage: 0 }
      const baseContent = {
        ...item,
        content_blocks: normalizeContentBlocks(item?.content_blocks),
      }
      const processedContent = replaceTokensDeep(baseContent, tokenValues) as typeof baseContent
      return {
        ...processedContent,
        progress_status: progress.status,
        progress_percentage: progress.progress_percentage,
      }
    })

    const sitePayload = replaceTokensDeep(
      {
        ...site,
        theme_config: parseJsonValue(site.theme_config),
      },
      tokenValues,
    ) as typeof site

    return new Response(JSON.stringify({
      success: true,
      site: sitePayload,
      categories: processedCategories,
      content: enrichedContent,
      token_values: tokenValues,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Internal Server Error:', error instanceof Error ? error.message : error)
    return errorResponse('Internal server error', 500, 'SERVER_ERROR')
  }
})
