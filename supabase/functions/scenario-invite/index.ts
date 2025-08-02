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
      return new Response('Invite code not found', { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 招待コード検証とプロファイル取得
    const { data: inviteData } = await supabase
      .from('scenario_invite_codes')
      .select(`
        scenario_id,
        step_scenarios!inner (
          user_id,
          profiles!inner (
            add_friend_url,
            line_login_channel_id
          )
        )
      `)
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .single()

    if (!inviteData) {
      return new Response('Invalid invite code', { status: 404 })
    }

    const profileData = inviteData.step_scenarios.profiles
    
    // クリックログ記録
    const userAgent = req.headers.get('user-agent') || ''
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    
    await supabase.from('invite_clicks').insert({
      invite_code: inviteCode,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: userAgent,
      device_type: isMobile ? 'mobile' : 'desktop'
    })

    // 重要：LINEアプリで直接開くURLに修正
    let redirectUrl

    if (profileData.add_friend_url) {
      // lin.ee URL方式（LINEアプリが直接起動）
      redirectUrl = `${profileData.add_friend_url}?inv=${inviteCode}`
      console.log('[scenario-invite] LINEアプリ直起動 (lin.ee):', redirectUrl)
    } else {
      // LINEログイン方式だがアプリ起動を強制
      const redirectUri = `${supabaseUrl}/functions/v1/login-callback`
      const loginUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
      
      loginUrl.searchParams.set('response_type', 'code')
      loginUrl.searchParams.set('client_id', profileData.line_login_channel_id)
      loginUrl.searchParams.set('redirect_uri', redirectUri)
      loginUrl.searchParams.set('state', inviteCode)
      loginUrl.searchParams.set('scope', 'profile openid')
      loginUrl.searchParams.set('bot_prompt', 'aggressive')
      
      // 重要：LINEアプリ強制起動パラメータ
      if (isMobile) {
        loginUrl.searchParams.set('initial_amr_display', 'lineapp')
        loginUrl.searchParams.set('ui_locales', 'ja')
      }
      
      redirectUrl = loginUrl.toString()
      console.log('[scenario-invite] LINEアプリ強制起動 (OAuth):', redirectUrl)
    }

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, 'Location': redirectUrl }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})