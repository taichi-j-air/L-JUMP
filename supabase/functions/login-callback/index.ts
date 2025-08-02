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
    
    console.log('Received params:', { code: code?.substring(0, 10) + '...', state })
    
    if (!code) {
      console.error('認証コードが見つかりません')
      throw new Error('認証コードが見つかりません')
    }

    // Supabaseクライアントを初期化
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Supabase client initialized')

    // LINE設定を取得
    const { data: lineSettings, error: settingsError } = await supabase
      .from('profiles')
      .select('line_channel_id, line_channel_secret, user_id')
      .not('line_channel_id', 'is', null)
      .not('line_channel_secret', 'is', null)
      .limit(1)
      .single()

    console.log('LINE settings query result:', { 
      hasData: !!lineSettings, 
      error: settingsError?.message,
      settingsCount: lineSettings ? 1 : 0
    })

    if (settingsError || !lineSettings) {
      console.error('LINE設定エラー:', settingsError)
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?debug=no_line_settings&error=${encodeURIComponent(settingsError?.message || 'no_data')}` 
        }
      })
    }

    console.log('LINE設定を取得しました:', { 
      channelId: lineSettings.line_channel_id,
      hasSecret: !!lineSettings.line_channel_secret,
      userId: lineSettings.user_id
    })

    // LINEからアクセストークンを取得
    const tokenParams = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: `${supabaseUrl}/functions/v1/login-callback`,
      client_id: lineSettings.line_channel_id,
      client_secret: lineSettings.line_channel_secret,
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
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?debug=token_error&status=${tokenResponse.status}&error=${encodeURIComponent(errorText)}` 
        }
      })
    }

    const tokenData = await tokenResponse.json()
    console.log('Token data received:', { hasAccessToken: !!tokenData.access_token })
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('アクセストークンが空です')
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?debug=empty_token` 
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
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?debug=profile_error&status=${profileResponse.status}&error=${encodeURIComponent(profileErrorText)}` 
        }
      })
    }

    const profile = await profileResponse.json()
    console.log('Profile received:', { userId: profile.userId, displayName: profile.displayName })

    // line_friendsテーブルに友だち情報を保存
    console.log('Saving friend data to database...')
    const { error: friendError } = await supabase
      .from('line_friends')
      .upsert({
        user_id: lineSettings.user_id,
        line_user_id: profile.userId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'line_user_id,user_id'
      })

    if (friendError) {
      console.error('友だち情報保存エラー:', friendError)
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?debug=db_save_error&error=${encodeURIComponent(friendError.message)}` 
        }
      })
    }

    console.log('Friend data saved successfully')

    // 成功ページにリダイレクト
    const redirectUrl = new URL(`https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/`)
    redirectUrl.searchParams.set('line_login', 'success')
    redirectUrl.searchParams.set('user_name', profile.displayName)

    console.log('Redirecting to success page:', redirectUrl.toString())

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl.toString(),
      },
    })

  } catch (error) {
    console.error('ログインコールバックエラー:', error)
    console.error('Error stack:', error.stack)
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders,
        'Location': `https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com/?debug=server_error&message=${encodeURIComponent(error.message)}` 
      }
    })
  }
})