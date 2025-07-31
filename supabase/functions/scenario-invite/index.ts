import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const inviteCode = url.searchParams.get('code')

    if (!inviteCode) {
      return new Response('招待コードが見つかりません', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // Supabaseクライアントを初期化
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 招待コードを検索
    const { data: inviteData, error: inviteError } = await supabase
      .from('scenario_invite_codes')
      .select(`
        *,
        step_scenarios:scenario_id (
          name,
          user_id,
          profiles:user_id (
            line_channel_id,
            line_api_status
          )
        )
      `)
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .single()

    if (inviteError || !inviteData) {
      console.error('招待コード検索エラー:', inviteError)
      return new Response('無効な招待コードです', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // 使用制限チェック
    if (inviteData.max_usage && inviteData.usage_count >= inviteData.max_usage) {
      return new Response('この招待コードは使用上限に達しています', { 
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    const profile = inviteData.step_scenarios?.profiles
    if (!profile?.line_channel_id || profile.line_api_status !== 'active') {
      return new Response('このBOTは現在利用できません', { 
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // LINE友達追加URLを生成
    const lineAddFriendUrl = `https://line.me/R/ti/p/@${profile.line_channel_id}`

    // 使用回数をインクリメント
    await supabase
      .from('scenario_invite_codes')
      .update({ usage_count: inviteData.usage_count + 1 })
      .eq('id', inviteData.id)

    // ログを記録
    await supabase
      .from('scenario_friend_logs')
      .insert({
        scenario_id: inviteData.scenario_id,
        invite_code: inviteCode,
        added_at: new Date().toISOString()
      })

    // LINE友達追加ページにリダイレクト
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': lineAddFriendUrl
      }
    })

  } catch (error) {
    console.error('エラー:', error)
    return new Response('サーバーエラーが発生しました', { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
})