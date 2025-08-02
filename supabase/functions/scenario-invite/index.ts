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

    console.log('=== SCENARIO INVITE FUNCTION START ===')
    console.log('招待コード:', inviteCode)
    console.log('User-Agent:', req.headers.get('user-agent'))

    if (!inviteCode) {
      console.error('❌ 招待コードが見つかりません')
      return new Response('Invite code not found', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ 環境変数が見つかりません')
      return new Response('Configuration error', { 
        status: 500,
        headers: corsHeaders 
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Step 1: 招待コード検証（確実版）
    console.log('🔍 招待コード検索中...')
    const { data: inviteData, error: inviteError } = await supabase
      .from('scenario_invite_codes')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .single()

    console.log('招待コード検索結果:', { 
      found: !!inviteData, 
      error: inviteError?.message,
      scenario_id: inviteData?.scenario_id 
    })

    if (inviteError || !inviteData) {
      return new Response(`Invalid invite code: ${inviteCode}`, { 
        status: 404,
        headers: corsHeaders 
      })
    }

    // Step 2: シナリオ情報取得
    console.log('🔍 シナリオ情報取得中...')
    const { data: scenarioData, error: scenarioError } = await supabase
      .from('step_scenarios')
      .select('user_id, name')
      .eq('id', inviteData.scenario_id)
      .single()

    console.log('シナリオ検索結果:', { 
      found: !!scenarioData, 
      error: scenarioError?.message,
      user_id: scenarioData?.user_id 
    })

    if (scenarioError || !scenarioData) {
      return new Response('Scenario not found', { 
        status: 404,
        headers: corsHeaders 
      })
    }

    // Step 3: プロファイル情報取得（LINE Login + Bot設定）
    console.log('🔍 プロファイル情報取得中...')
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('line_login_channel_id, line_login_channel_secret, display_name')
      .eq('user_id', scenarioData.user_id)
      .single()

    console.log('プロファイル検索結果:', { 
      found: !!profileData,
      hasChannelId: !!profileData?.line_login_channel_id,
      hasChannelSecret: !!profileData?.line_login_channel_secret,
      hasBotId: !!profileData?.line_bot_id,
      hasAddFriendUrl: !!profileData?.add_friend_url,
      error: profileError?.message 
    })

    if (profileError || !profileData || !profileData.line_login_channel_id) {
      return new Response('LINE Login configuration not found', { 
        status: 404,
        headers: corsHeaders 
      })
    }

    // Step 4: クリックログ記録
    const userAgent = req.headers.get('user-agent') || ''
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    
    try {
      await supabase.from('invite_clicks').insert({
        invite_code: inviteCode,
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: userAgent,
        device_type: isMobile ? 'mobile' : 'desktop'
      })
      console.log('✅ クリックログ記録成功')
    } catch (clickError) {
      console.warn('⚠️ クリックログ記録失敗（処理続行）:', clickError)
    }

    // Step 5: 純粋なOAuth認証URL生成（デバイス問わず）
    const redirectUri = 'https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/login-callback'
    
    const authUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', profileData.line_login_channel_id)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', `${inviteCode}:${scenarioData.user_id}`)
    authUrl.searchParams.set('scope', 'profile openid')
    authUrl.searchParams.set('bot_prompt', 'aggressive')
    
    // モバイル用の最適化パラメータのみ
    if (isMobile) {
      authUrl.searchParams.set('initial_amr_display', 'lineapp')
      authUrl.searchParams.set('ui_locales', 'ja')
    }

    const finalOAuthUrl = authUrl.toString()

    console.log('🔗 純粋OAuth URL生成')
    console.log('Device:', isMobile ? 'Mobile' : 'Desktop')
    console.log('OAuth URL:', finalOAuthUrl)
    console.log('招待コード:', inviteCode)
    console.log('シナリオID:', inviteData.scenario_id)
    console.log('期待動作: OAuth認証 → 友だち追加 → シナリオ登録')

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': finalOAuthUrl
      }
    })

  } catch (error) {
    console.error('💥 CRITICAL ERROR')
    console.error('Message:', error.message)
    console.error('Stack:', error.stack)
    
    return new Response(JSON.stringify({ 
      error: 'Server error',
      details: error.message,
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})