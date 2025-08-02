import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const inviteCode = url.searchParams.get('code')

    console.log('=== SCENARIO INVITE START ===')
    console.log('招待コード:', inviteCode)
    console.log('URL:', req.url)

    if (!inviteCode) {
      console.error('招待コードが見つかりません')
      return new Response('Invite code not found', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Supabase接続完了')

    // 招待コード検証（シンプルな分割クエリ）
    console.log('招待コード検索開始...')
    const { data: inviteData, error: inviteError } = await supabase
      .from('scenario_invite_codes')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .single()

    if (inviteError || !inviteData) {
      console.error('招待コード検索エラー:', inviteError)
      return new Response(`Invalid invite code: ${inviteCode}`, { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    console.log('招待コードデータ:', inviteData)

    // シナリオ情報取得
    console.log('シナリオ情報取得開始...')
    const { data: scenarioData, error: scenarioError } = await supabase
      .from('step_scenarios')
      .select('name, user_id')
      .eq('id', inviteData.scenario_id)
      .single()

    if (scenarioError || !scenarioData) {
      console.error('シナリオ検索エラー:', scenarioError)
      return new Response('Invalid scenario', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    console.log('シナリオデータ:', scenarioData)

    // プロファイル情報取得
    console.log('プロファイル情報取得開始...')
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('line_channel_id, line_api_status, add_friend_url')
      .eq('user_id', scenarioData.user_id)
      .single()

    if (profileError || !profileData) {
      console.error('プロファイル検索エラー:', profileError)
      return new Response('BOT configuration not found', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    console.log('プロファイルデータ:', {
      channelId: profileData.line_channel_id,
      status: profileData.line_api_status
    })

    // 使用制限チェック
    if (inviteData.max_usage && inviteData.usage_count >= inviteData.max_usage) {
      console.error('使用上限到達')
      return new Response('Invite code usage limit reached', { 
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    if (!profileData.line_channel_id || (profileData.line_api_status !== 'active' && profileData.line_api_status !== 'configured')) {
      console.error('BOT利用不可:', {
        hasChannelId: !!profileData.line_channel_id,
        apiStatus: profileData.line_api_status
      })
      return new Response('This BOT is currently unavailable', { 
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }

    // LINEログインURL生成（stateパラメータに招待コードを含める）
    const baseUrl = Deno.env.get('SUPABASE_URL')!
    const loginUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
    loginUrl.searchParams.set('response_type', 'code')
    loginUrl.searchParams.set('client_id', profileData.line_channel_id)
    loginUrl.searchParams.set('redirect_uri', `${baseUrl}/functions/v1/login-callback`)
    loginUrl.searchParams.set('state', inviteCode)
    loginUrl.searchParams.set('scope', 'profile openid')
    loginUrl.searchParams.set('bot_prompt', 'aggressive')
    
    const finalUrl = loginUrl.toString()
    console.log('LINEログインURL生成:', finalUrl)

    // クリックログ記録（エラーが出てもスキップ）
    try {
      await supabase
        .from('invite_clicks')
        .insert({
          invite_code: inviteCode, // シンプルにTEXTで保存
          ip: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
          referer: req.headers.get('referer') || null
        })
      console.log('クリックログ記録成功')
    } catch (clickError) {
      console.warn('クリックログ記録失敗（処理続行）:', clickError)
    }

    // リダイレクト
    console.log('リダイレクト実行:', finalUrl)
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': finalUrl
      }
    })

  } catch (error) {
    console.error('=== CRITICAL ERROR ===')
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: 'サーバーエラー', 
        details: error.message,
        type: error.name 
      }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})