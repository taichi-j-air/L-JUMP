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

    if (!inviteCode) {
      return new Response('Invite code not found', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

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

    // シナリオ情報取得
    const { data: scenarioData, error: scenarioError } = await supabase
      .from('step_scenarios')
      .select('user_id')
      .eq('id', inviteData.scenario_id)
      .single()

    if (scenarioError || !scenarioData) {
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

    if (profileError || !profileData || !profileData.line_login_channel_id) {
      return new Response('Bot configuration not found', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    // クリックログ記録
    try {
      await supabase.from('invite_clicks').insert({
        invite_code: inviteCode,
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        referer: req.headers.get('referer') || null
      })
    } catch (clickError) {
      console.warn('クリックログ記録失敗:', clickError)
    }

    // デバイス判定
    const userAgent = req.headers.get('user-agent') || ''
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent)

    console.log('デバイス判定:', { isMobile, userAgent: userAgent.substring(0, 50) })

    if (isMobile) {
      // スマホ: 直接LINE Loginにリダイレクト
      const callbackUrl = `${supabaseUrl}/functions/v1/login-callback`
      const loginUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
      
      loginUrl.searchParams.set('response_type', 'code')
      loginUrl.searchParams.set('client_id', profileData.line_login_channel_id)
      loginUrl.searchParams.set('redirect_uri', callbackUrl)
      loginUrl.searchParams.set('state', inviteCode)
      loginUrl.searchParams.set('scope', 'profile openid')
      loginUrl.searchParams.set('bot_prompt', 'normal')

      console.log('スマホ: LINE Loginリダイレクト')
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': loginUrl.toString() }
      })
    } else {
      // PC: 独自QRページにリダイレクト
      const frontendUrl = 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com'
      const qrPageUrl = `${frontendUrl}/invite/${inviteCode}`

      console.log('PC: QRページリダイレクト')
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': qrPageUrl }
      })
    }

  } catch (error) {
    console.error('Critical error:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})