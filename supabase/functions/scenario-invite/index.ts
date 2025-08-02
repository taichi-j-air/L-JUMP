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
    console.log('User-Agent:', req.headers.get('user-agent')?.substring(0, 100))

    if (!inviteCode) {
      return new Response('Invite code not found', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing environment variables')
      return new Response('Configuration error', { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Step 1: 招待コード検証
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

    // Step 2: シナリオのuser_id取得
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

    // Step 3: そのユーザーのLINE設定取得（O3指摘：user_id指定が重要）
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('line_login_channel_id, line_api_status, add_friend_url, user_id')
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
      return new Response('Bot is currently unavailable', { 
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    // Step 4: クリックログ記録（デバイス判定付き）
    const userAgent = req.headers.get('user-agent') || ''
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    
    try {
      await supabase.from('invite_clicks').insert({
        invite_code: inviteCode,
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: userAgent,
        referer: req.headers.get('referer') || null,
        device_type: isMobile ? 'mobile' : 'desktop'
      })
      console.log('クリックログ記録成功')
    } catch (clickError) {
      console.warn('クリックログ記録失敗（処理続行）:', clickError)
    }

    // Step 5: 友だち追加URLに直接リダイレクト
    if (!profileData.add_friend_url) {
      return new Response('Friend URL not configured', { 
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const addFriendURL = profileData.add_friend_url       // 例: https://lin.ee/AbC123
    const deeplink = `${addFriendURL}?code=${inviteCode}` // 追跡パラメータ

    console.log('[scenario-invite] Redirect →', deeplink)

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: deeplink }
    })

  } catch (error) {
    console.error('=== CRITICAL ERROR ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    
    return new Response(JSON.stringify({ 
      error: 'Server error', 
      details: error.message 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})