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

    console.log('招待コード処理開始:', { inviteCode, url: req.url })

    if (!inviteCode) {
      console.error('招待コードが提供されていません')
      return new Response('招待コードが見つかりません', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // Supabaseクライアントを初期化
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Supabaseクライアント初期化完了')

    // クリックログを記録（IP、User-Agent、Refererを取得）
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const referer = req.headers.get('referer') || null

    console.log('クリック情報:', { clientIP, userAgent, referer })

    // クリックログを挿入
    const { error: clickError } = await supabase
      .from('invite_clicks')
      .insert({
        invite_code: inviteCode,
        ip: clientIP,
        user_agent: userAgent,
        referer: referer
      })

    if (clickError) {
      console.error('クリックログ挿入エラー:', clickError)
      // エラーでも処理を続行
    }

    // 招待コードを検索
    const { data: inviteData, error: inviteError } = await supabase
      .from('scenario_invite_codes')
      .select(`
        *,
        step_scenarios!scenario_invite_codes_scenario_id_fkey (
          name,
          user_id,
          profiles!step_scenarios_user_id_fkey (
            line_channel_id,
            line_api_status,
            add_friend_url
          )
        )
      `)
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .single()

    if (inviteError || !inviteData) {
      console.error('招待コード検索エラー:', { inviteError, inviteCode })
      return new Response('無効な招待コードです', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    console.log('招待コードデータ取得成功:', { 
      scenarioName: inviteData.step_scenarios?.name, 
      profileExists: !!inviteData.step_scenarios?.profiles 
    })

    // 使用制限チェック
    if (inviteData.max_usage && inviteData.usage_count >= inviteData.max_usage) {
      return new Response('この招待コードは使用上限に達しています', { 
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    const profile = inviteData.step_scenarios?.profiles
    console.log('プロファイル情報:', { 
      channelId: profile?.line_channel_id, 
      apiStatus: profile?.line_api_status,
      addFriendUrl: profile?.add_friend_url
    })

    if (!profile?.line_channel_id || profile.line_api_status !== 'active') {
      console.error('BOT利用不可:', { 
        hasChannelId: !!profile?.line_channel_id, 
        apiStatus: profile?.line_api_status 
      })
      return new Response('このBOTは現在利用できません', { 
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // 友達追加URLを決定し、招待コードを含むパラメータを追加
    let baseUrl = profile.add_friend_url || `https://line.me/R/ti/p/@${profile.line_channel_id}`
    
    // URLに招待コードパラメータを追加
    const url = new URL(baseUrl)
    url.searchParams.set('state', inviteCode)
    const addFriendUrl = url.toString()
    
    console.log('招待コード付き友達追加URL:', addFriendUrl)

    // モバイル対応：一部のモバイルブラウザで302リダイレクトがブロックされる場合
    const userAgentLower = userAgent.toLowerCase()
    const isMobile = userAgentLower.includes('mobile') || 
                     userAgentLower.includes('android') || 
                     userAgentLower.includes('iphone')

    if (isMobile) {
      // モバイルの場合はHTMLページでメタリフレッシュを使用
      const htmlResponse = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta http-equiv="refresh" content="0;url=${addFriendUrl}">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>LINE友達追加</title>
        </head>
        <body>
          <p>LINE友達追加ページに移動しています...</p>
          <p>自動で移動しない場合は<a href="${addFriendUrl}">こちら</a>をクリックしてください。</p>
          <script>
            setTimeout(function() {
              window.location.href = '${addFriendUrl}';
            }, 100);
          </script>
        </body>
        </html>
      `
      
      return new Response(htmlResponse, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/html; charset=utf-8' 
        }
      })
    } else {
      // デスクトップの場合は302リダイレクト
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': addFriendUrl
        }
      })
    }

  } catch (error) {
    console.error('エラー:', error)
    return new Response('サーバーエラーが発生しました', { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
})