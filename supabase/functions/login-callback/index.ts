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

    // 修正: 正しいカラム名を使用
    const { data: lineSettings, error: settingsError } = await supabase
      .from('profiles')
      .select('line_channel_id, line_channel_secret, user_id')
      .not('line_channel_id', 'is', null)
      .not('line_channel_secret', 'is', null)
      .limit(1)
      .single()

    if (settingsError || !lineSettings) {
      console.error('LINE設定エラー:', settingsError)
      const referer = req.headers.get('referer') || req.headers.get('Referer') || ''
      const siteUrl = referer ? new URL(referer).origin : 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com'
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `${siteUrl}/error?type=no_line_settings` 
        }
      })
    }

    console.log('LINE設定を取得しました:', { 
      channelId: lineSettings.line_channel_id,
      hasSecret: !!lineSettings.line_channel_secret 
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
      client_secret: '***'
    })

    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    })

    console.log('Token response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('LINEトークン取得エラー:', errorText)
      const referer = req.headers.get('referer') || req.headers.get('Referer') || ''
      const siteUrl = referer ? new URL(referer).origin : 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com'
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `${siteUrl}/error?type=token_error&message=${encodeURIComponent(errorText)}` 
        }
      })
    }

    const tokenData = await tokenResponse.json()
    console.log('Token data received:', { hasAccessToken: !!tokenData.access_token })
    const accessToken = tokenData.access_token

    // LINEプロファイル情報を取得
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!profileResponse.ok) {
      console.error('LINEプロファイル取得エラー')
      const referer = req.headers.get('referer') || req.headers.get('Referer') || ''
      const siteUrl = referer ? new URL(referer).origin : 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com'
      return new Response(null, {
        status: 302,
        headers: { 
          ...corsHeaders,
          'Location': `${siteUrl}/error?type=profile_error` 
        }
      })
    }

    const profile = await profileResponse.json()
    console.log('Profile received:', { userId: profile.userId, displayName: profile.displayName })

    // 修正: line_friendsテーブルに友だち情報を保存
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
    }

    // リファラーからサイトURLを取得
    const referer = req.headers.get('referer') || req.headers.get('Referer') || ''
    const siteUrl = referer ? new URL(referer).origin : 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com'

    // 成功ページにリダイレクト
    const redirectUrl = new URL(`${siteUrl}/`)
    redirectUrl.searchParams.set('line_login', 'success')
    redirectUrl.searchParams.set('user_name', profile.displayName)

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl.toString(),
      },
    })

  } catch (error) {
    console.error('ログインコールバックエラー:', error)
    const referer = req.headers.get('referer') || req.headers.get('Referer') || ''
    const siteUrl = referer ? new URL(referer).origin : 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com'
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders,
        'Location': `${siteUrl}/error?type=server_error&message=${encodeURIComponent(error.message)}` 
      }
    })
  }
})