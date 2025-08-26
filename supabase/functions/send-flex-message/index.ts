import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** 深いコピー（友だちごとのUID置換で元JSONを壊さないため） */
function deepClone<T>(obj: T): T {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj))
}

/** 配列/オブジェクト/文字列を再帰でなめて [UID] を置換 */
function deepReplaceUID(node: any, uid: string): any {
  if (node == null) return node
  if (Array.isArray(node)) return node.map((v) => deepReplaceUID(v, uid))
  if (typeof node === 'object') {
    const out: any = {}
    for (const [k, v] of Object.entries(node)) out[k] = deepReplaceUID(v, uid)
    return out
  }
  if (typeof node === 'string') return node.replace(/\[UID\]/g, uid)
  return node
}

/** UID 置換（非破壊） */
function addUidToFlexContentSafely(flexMessage: any, friendShortUid: string | null): any {
  if (!friendShortUid || !flexMessage) return flexMessage
  const cloned = deepClone(flexMessage)
  return deepReplaceUID(cloned, friendShortUid)
}

/** Flex入力を必ず { type:'flex', altText, contents } に正規化 */
function normalizeFlexMessage(input: any): { type: 'flex'; altText: string; contents: any } | null {
  if (!input) return null

  // 既に flex ラップ済み
  if (input.type === 'flex' && input.contents) {
    return {
      type: 'flex',
      altText: typeof input.altText === 'string' && input.altText.trim() ? input.altText : 'お知らせ',
      contents: input.contents,
    }
  }

  // ルートが bubble / carousel
  if (input.type === 'bubble' || input.type === 'carousel') {
    return { type: 'flex', altText: 'お知らせ', contents: input }
  }

  // { contents: bubble|carousel, altText? } 形式
  if (input.contents && (input.contents.type === 'bubble' || input.contents.type === 'carousel')) {
    return {
      type: 'flex',
      altText: typeof input.altText === 'string' && input.altText.trim() ? input.altText : 'お知らせ',
      contents: input.contents,
    }
  }

  return null
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const rawFlexMessage = body.flexMessage
    const userId = body.userId as string

    // flexMessage が文字列（JSON文字列）で来るケースにも対応
    let flexMessage = rawFlexMessage
    if (typeof rawFlexMessage === 'string') {
      try { flexMessage = JSON.parse(rawFlexMessage) } catch { /* 無視してそのまま */ }
    }

    // Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // プロファイル（LINEチャネルアクセストークン）
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('line_channel_access_token')
      .eq('user_id', userId)
      .single()

    if (profileError || !profile?.line_channel_access_token) {
      return new Response(
        JSON.stringify({ error: 'LINE APIアクセストークンが未設定か取得に失敗しました' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 送信対象（友だち）
    const { data: friends, error: friendsError } = await supabase
      .from('line_friends')
      .select('line_user_id, short_uid')
      .eq('user_id', userId)

    if (friendsError) {
      return new Response(
        JSON.stringify({ error: '友だちリストの取得に失敗しました' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!friends?.length) {
      return new Response(
        JSON.stringify({ error: '送信対象の友だちが見つかりません' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const results: Array<{ lineUserId: string; success: boolean; error?: any }> = []

    for (const friend of friends) {
      try {
        // 1) 友だちごとに UID を注入（非破壊）
        const uidInjected = addUidToFlexContentSafely(flexMessage, friend.short_uid ?? null)

        // 2) Flex を正規形にラップ（type/altText を保証）
        const normalized = normalizeFlexMessage(uidInjected)
        if (!normalized) {
          results.push({ lineUserId: friend.line_user_id, success: false, error: 'Flexメッセージの形式が不正です' })
          continue
        }

        const payload = {
          to: friend.line_user_id,
          messages: [normalized],
        }

        const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${profile.line_channel_access_token}`,
          },
          body: JSON.stringify(payload)
        })

        if (!lineRes.ok) {
          let errBody: any = null
          try { errBody = await lineRes.json() } catch { errBody = await lineRes.text() }
          results.push({ lineUserId: friend.line_user_id, success: false, error: errBody })
        } else {
          results.push({ lineUserId: friend.line_user_id, success: true })
        }
      } catch (e: any) {
        results.push({ lineUserId: friend.line_user_id, success: false, error: e?.message || String(e) })
      }
    }

    const successCount = results.filter(r => r.success).length
    const errorCount = results.length - successCount

    return new Response(
      JSON.stringify({
        success: true,
        message: `Flexメッセージ送信：成功 ${successCount} / 失敗 ${errorCount}`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        error: '予期しないエラーが発生しました', 
        details: error?.message || String(error) 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
