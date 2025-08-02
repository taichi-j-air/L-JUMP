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
    console.log('=== LOGIN CALLBACK START ===')
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    
    console.log('Received params:', { 
      code: code?.substring(0, 10) + '...', 
      state, 
      error 
    })

    if (error) {
      console.error('LINE認証エラー:', error)
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?line_error=' + error
        }
      })
    }
    
    if (!code) {
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?error=no_code'
        }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // stateまたはcodeから招待コードを取得してuser_idを特定
    const inviteCode = url.searchParams.get('state')  // 従来
      ?? url.searchParams.get('code')                 // lin.ee から戻った場合
    
    let scenarioUserId = null
    if (inviteCode) {
      // O4修正: .select()の引数を正しい文字列形式に
      const { data: inviteData } = await supabase
        .from('scenario_invite_codes')
        .select('scenario_id, step_scenarios!inner(user_id)')
        .eq('invite_code', inviteCode)
        .eq('is_active', true)
        .single()
      
      scenarioUserId = inviteData?.step_scenarios?.user_id
      console.log('Scenario user_id from invite:', scenarioUserId)
    }

    // 特定のuser_idのLINE設定を取得
    let lineSettings = null
    if (scenarioUserId) {
      const { data: settings } = await supabase
        .from('profiles')
        .select('line_login_channel_id, line_login_channel_secret, user_id, display_name')
        .eq('user_id', scenarioUserId)
        .single()
      lineSettings = settings
    }

    // フォールバック: user_id指定で見つからない場合は従来方式
    if (!lineSettings) {
      const { data: fallbackSettings } = await supabase
        .from('profiles')
        .select('line_login_channel_id, line_login_channel_secret, user_id, display_name')
        .not('line_login_channel_id', 'is', null)
        .not('line_login_channel_secret', 'is', null)
        .limit(1)
        .single()
      lineSettings = fallbackSettings
    }

    if (!lineSettings?.line_login_channel_id) {
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?error=no_line_settings'
        }
      })
    }

    // O4修正: redirect_uriの定義をテンプレートリテラルに
    const redirectUri = Deno.env.get('LINE_LOGIN_REDIRECT_URI') || 
                        `${supabaseUrl}/functions/v1/login-callback`

    // O3+O4修正: LINE設定の詳細確認ログ
    console.log('=== LINE設定詳細確認 ===')
    console.log('Channel ID:', lineSettings?.line_login_channel_id?.substring(0, 10) + '...')
    console.log('Channel Secret存在:', !!lineSettings?.line_login_channel_secret)
    console.log('Channel Secret長さ:', lineSettings?.line_login_channel_secret?.length)
    console.log('User ID:', lineSettings?.user_id)
    console.log('redirect_uri:', redirectUri)
    console.log('Environment vars:', {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasServiceRole: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      hasRedirectUri: !!Deno.env.get('LINE_LOGIN_REDIRECT_URI')
    })

    const tokenParams = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: lineSettings.line_login_channel_id,
      client_secret: lineSettings.line_login_channel_secret,
    }
    
    console.log('Token request:', {
      redirect_uri: redirectUri,
      client_id: lineSettings.line_login_channel_id?.substring(0, 10) + '...'
    })

    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    })

    // O3修正: トークン取得エラーの詳細取得
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      let errorDetails = 'token_failed'
      
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.error_description || errorJson.error || 'token_failed'
        console.error('Token取得エラー詳細:', {
          status: tokenResponse.status,
          error: errorJson.error,
          error_description: errorJson.error_description,
          fullResponse: errorText
        })
      } catch {
        console.error('Token取得エラー:', errorText)
      }
      
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?error=${encodeURIComponent(errorDetails)}`
        }
      })
    }

    const tokenData = await tokenResponse.json()
    
    // O4修正: Authorizationヘッダーをテンプレートリテラルに
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    if (!profileResponse.ok) {
      const profileErrorText = await profileResponse.text()
      console.error('Profile取得エラー:', profileErrorText)
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?error=profile_failed'
        }
      })
    }

    const profile = await profileResponse.json()
    console.log('Profile:', { userId: profile.userId, displayName: profile.displayName })

    // 友だち情報保存
    const { data: existingFriend } = await supabase
      .from('line_friends')
      .select('id')
      .eq('line_user_id', profile.userId)
      .eq('user_id', lineSettings.user_id)
      .single()

    if (!existingFriend) {
      await supabase.from('line_friends').insert({
        user_id: lineSettings.user_id,
        line_user_id: profile.userId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl || null,
      })
    }

    // 成功リダイレクト
    const successUrl = new URL('https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/')
    
    // 招待コードがある場合のみシナリオ登録処理を実行
    if (inviteCode && inviteCode !== 'login') {
      const { data: registrationResult, error: registrationError } = await supabase
        .rpc('register_friend_to_scenario', {
          p_line_user_id: profile.userId,
          p_invite_code: inviteCode,
          p_display_name: profile.displayName,
          p_picture_url: profile.pictureUrl || null
        })
      
      if (registrationResult?.success) {
        successUrl.searchParams.set('line_login', 'success')
        successUrl.searchParams.set('scenario_registered', 'true')
        successUrl.searchParams.set('user_name', profile.displayName)
      } else {
        console.error('シナリオ登録失敗:', registrationError)
        successUrl.searchParams.set('line_login', 'error')
        successUrl.searchParams.set('error', 'scenario_failed')
      }
    } else {
      // 通常のログインテストの場合
      successUrl.searchParams.set('line_login', 'success')
      successUrl.searchParams.set('user_name', profile.displayName)
    }

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, 'Location': successUrl.toString() }
    })

  } catch (error) {
    console.error('Critical error:', error)
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders,
        'Location': 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?error=server_error'
      }
    })
  }
})