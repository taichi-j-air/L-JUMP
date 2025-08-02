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

    // LINEログインエラーの場合
    if (error) {
      console.error('LINE認証エラー:', error)
      const frontendUrl = Deno.env.get('FRONTEND_URL') || req.headers.get('referer') || 'https://lovable.dev'
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `${frontendUrl}/?line_login=error&line_error=${error}` 
        }
      })
    }
    
    if (!code) {
      console.error('認証コードが見つかりません')
      const frontendUrl = Deno.env.get('FRONTEND_URL') || req.headers.get('referer') || 'https://lovable.dev'
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `${frontendUrl}/?debug=no_code` 
        }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Supabase client initialized')

    // 修正: 正しいカラム名を使用
    const { data: lineSettings, error: settingsError } = await supabase
      .from('profiles')
      .select('line_login_channel_id, line_login_channel_secret, user_id')
      .not('line_login_channel_id', 'is', null)
      .not('line_login_channel_secret', 'is', null)
      .limit(1)
      .single()

    console.log('LINE settings query result:', { 
      hasData: !!lineSettings, 
      error: settingsError?.message,
      channelId: lineSettings?.line_login_channel_id
    })

    if (settingsError || !lineSettings) {
      console.error('LINE設定エラー:', settingsError)
      const frontendUrl = Deno.env.get('FRONTEND_URL') || req.headers.get('referer') || 'https://lovable.dev'
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `${frontendUrl}/?debug=no_line_settings&error=${encodeURIComponent(settingsError?.message || 'no_data')}` 
        }
      })
    }

    // 修正: 動的なredirect_uri生成
    const callbackUrl = Deno.env.get('LINE_LOGIN_CALLBACK_URL') || 
                        `${supabaseUrl}/functions/v1/login-callback`

    const tokenParams = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: callbackUrl,
      client_id: lineSettings.line_login_channel_id,
      client_secret: lineSettings.line_login_channel_secret,
    }
    
    console.log('Requesting token with params:', {
      ...tokenParams,
      client_secret: '***',
      redirect_uri: tokenParams.redirect_uri
    })

    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    })

    console.log('Token response status:', tokenResponse.status)
    console.log('Token response headers:', Object.fromEntries(tokenResponse.headers.entries()))
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('LINEトークン取得エラー:', errorText)
      const frontendUrl = Deno.env.get('FRONTEND_URL') || req.headers.get('referer') || 'https://lovable.dev'
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `${frontendUrl}/?debug=token_error&status=${tokenResponse.status}&error=${encodeURIComponent(errorText)}` 
        }
      })
    }

    const tokenData = await tokenResponse.json()
    console.log('Token data received:', { hasAccessToken: !!tokenData.access_token })
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('アクセストークンが空です')
      const frontendUrl = Deno.env.get('FRONTEND_URL') || req.headers.get('referer') || 'https://lovable.dev'
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `${frontendUrl}/?debug=empty_token` 
        }
      })
    }

    // LINEプロファイル情報を取得
    console.log('Fetching LINE profile...')
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    console.log('Profile response status:', profileResponse.status)

    if (!profileResponse.ok) {
      const profileErrorText = await profileResponse.text()
      console.error('LINEプロファイル取得エラー:', profileErrorText)
      const frontendUrl = Deno.env.get('FRONTEND_URL') || req.headers.get('referer') || 'https://lovable.dev'
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `${frontendUrl}/?debug=profile_error&status=${profileResponse.status}&error=${encodeURIComponent(profileErrorText)}` 
        }
      })
    }

    const profile = await profileResponse.json()
    console.log('Profile received:', { userId: profile.userId, displayName: profile.displayName })

    // 修正: 重複制御を強化した友だち情報保存
    console.log('Saving friend data to database...')
    const { data: existingFriend } = await supabase
      .from('line_friends')
      .select('id')
      .eq('line_user_id', profile.userId)
      .eq('user_id', lineSettings.user_id)
      .single()

    if (!existingFriend) {
      const { error: friendError } = await supabase
        .from('line_friends')
        .insert({
          user_id: lineSettings.user_id,
          line_user_id: profile.userId,
          display_name: profile.displayName,
          picture_url: profile.pictureUrl || null,
        })
        
      if (friendError) {
        console.error('友だち情報保存エラー:', friendError)
        const frontendUrl = Deno.env.get('FRONTEND_URL') || req.headers.get('referer') || 'https://lovable.dev'
        return new Response(null, {
          status: 302,
          headers: { 
            ...corsHeaders,
            'Location': `${frontendUrl}/?debug=db_save_error&error=${encodeURIComponent(friendError.message)}` 
          }
        })
      } else {
        console.log('新規友だち情報を保存しました')
      }
    } else {
      console.log('既存の友だちです:', profile.userId)
    }

    // フロントエンドURL取得の確実な方法
    const getFrontendUrl = () => {
      // Lovableプロジェクトの固定URL（最も確実）
      const lovableProject = '74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com'
      
      // 1. 環境変数チェック（lovable.devは除外）
      const envUrl = Deno.env.get('FRONTEND_URL')
      if (envUrl && envUrl !== 'https://lovable.dev' && !envUrl.includes('lovable.dev')) {
        console.log('環境変数からURL取得:', envUrl)
        return envUrl
      }
      
      // 2. Lovableプロジェクト固定URL
      const finalUrl = `https://${lovableProject}`
      console.log('固定URLを使用:', finalUrl)
      return finalUrl
    }

    // stateパラメータから招待コードを取得してシナリオ登録
    const frontendUrl = getFrontendUrl()
    console.log('=== REDIRECT URL DEBUG ===')
    console.log('Determined frontend URL:', frontendUrl)

    let redirectUrl = new URL(frontendUrl)
    
    if (state) {
      console.log('招待コードでシナリオ登録開始:', state)
      
      const { data: registrationResult, error: registrationError } = await supabase
        .rpc('register_friend_to_scenario', {
          p_line_user_id: profile.userId,
          p_invite_code: state,
          p_display_name: profile.displayName,
          p_picture_url: profile.pictureUrl || null
        })
      
      if (registrationError) {
        console.error('シナリオ登録エラー:', registrationError)
        redirectUrl.searchParams.set('line_login', 'error')
        redirectUrl.searchParams.set('error_type', 'scenario_registration_failed')
        redirectUrl.searchParams.set('error_details', registrationError.message)
      } else if (registrationResult?.success) {
        console.log('シナリオ登録成功:', registrationResult)
        redirectUrl.searchParams.set('line_login', 'success')
        redirectUrl.searchParams.set('scenario_registered', 'true')
        redirectUrl.searchParams.set('user_name', encodeURIComponent(profile.displayName))
        redirectUrl.searchParams.set('scenario_id', registrationResult.scenario_id)
        redirectUrl.searchParams.set('invite_code', state)
      } else {
        console.error('シナリオ登録失敗:', registrationResult)
        redirectUrl.searchParams.set('line_login', 'error')
        redirectUrl.searchParams.set('error_type', 'registration_failed')
        redirectUrl.searchParams.set('error_details', registrationResult?.error || 'unknown_error')
      }
    } else {
      // 通常のLINEログイン（招待コードなし）
      console.log('通常のLINEログイン完了')
      redirectUrl.searchParams.set('line_login', 'success')
      redirectUrl.searchParams.set('user_name', encodeURIComponent(profile.displayName))
    }

    const finalRedirectUrl = redirectUrl.toString()
    console.log('Final redirect URL:', finalRedirectUrl)

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': finalRedirectUrl,
      },
    })

  } catch (error) {
    console.error('ログインコールバックエラー:', error)
    console.error('Error stack:', error.stack)
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://lovable.dev'
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders,
        'Location': `${frontendUrl}/?debug=server_error&message=${encodeURIComponent(error.message)}` 
      }
    })
  }
})