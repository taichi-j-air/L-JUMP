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
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Supabase接続完了')

    // 招待コード検証
    const { data: inviteData, error: inviteError } = await supabase
      .from('scenario_invite_codes')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .single()

    if (inviteError || !inviteData) {
      console.error('招待コード検索エラー:', inviteError)
      return new Response('Invalid invite code', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    // 使用制限チェック
    if (inviteData.max_usage && inviteData.usage_count >= inviteData.max_usage) {
      console.error('使用上限到達')
      return new Response('Invite code usage limit reached', { 
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    // シナリオ情報取得
    const { data: scenarioData, error: scenarioError } = await supabase
      .from('step_scenarios')
      .select('user_id')
      .eq('id', inviteData.scenario_id)
      .single()

    if (scenarioError || !scenarioData) {
      console.error('シナリオ検索エラー:', scenarioError)
      return new Response('Invalid scenario', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    // プロファイル情報取得
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('line_login_channel_id, line_api_status')
      .eq('user_id', scenarioData.user_id)
      .single()

    if (profileError || !profileData) {
      console.error('プロファイル検索エラー:', profileError)
      return new Response('Bot configuration not found', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    if (!profileData.line_login_channel_id || !['active', 'configured'].includes(profileData.line_api_status)) {
      console.error('BOT利用不可:', {
        hasChannelId: !!profileData.line_login_channel_id,
        apiStatus: profileData.line_api_status
      })
      return new Response('Bot is currently unavailable', { 
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    // クリックログ記録
    try {
      await supabase
        .from('invite_clicks')
        .insert({
          invite_code: inviteCode,
          ip: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
          referer: req.headers.get('referer') || null
        })
      console.log('クリックログ記録成功')
    } catch (clickError) {
      console.warn('クリックログ記録失敗（処理続行）:', clickError)
    }

    // デバイス判定：User-Agentからモバイルデバイスを検出
    const userAgent = req.headers.get('user-agent') || ''
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent)

    console.log('デバイス判定:', { userAgent: userAgent.substring(0, 50), isMobile })

    // スマホからのアクセスの場合は直接LINE Loginにリダイレクト
    if (isMobile) {
      const callbackUrl = `${supabaseUrl}/functions/v1/login-callback`
      const loginUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
      
      loginUrl.searchParams.set('response_type', 'code')
      loginUrl.searchParams.set('client_id', profileData.line_login_channel_id)
      loginUrl.searchParams.set('redirect_uri', callbackUrl)
      loginUrl.searchParams.set('state', inviteCode)
      loginUrl.searchParams.set('scope', 'profile openid')
      loginUrl.searchParams.set('bot_prompt', 'normal')

      console.log('スマホ: LINE Loginにリダイレクト:', loginUrl.toString())

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': loginUrl.toString()
        }
      })
    } else {
      // PCの場合は独自QRページにリダイレクト
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 
                          'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com'
      
      const qrPageUrl = `${frontendUrl}/invite/${inviteCode}`

      console.log('PC: QRページにリダイレクト:', qrPageUrl)

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': qrPageUrl
        }
      })
    }

  } catch (error) {
    console.error('=== CRITICAL ERROR ===')
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: 'Server error', 
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