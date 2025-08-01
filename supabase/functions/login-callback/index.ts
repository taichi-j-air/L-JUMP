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
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    
    if (!code) {
      throw new Error('認証コードが見つかりません')
    }

    // Supabaseクライアントを初期化
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // stateからuser_idを取得（実際の実装では適切な方法で取得）
    // 今回は最初に設定されたLINE設定を使用
    const { data: lineSettings, error: settingsError } = await supabase
      .from('profiles')
      .select('line_channel_id, line_channel_secret')
      .not('line_channel_id', 'is', null)
      .not('line_channel_secret', 'is', null)
      .limit(1)
      .single()

    if (settingsError || !lineSettings) {
      throw new Error('LINE設定が見つかりません。先にLINE Login設定を完了してください。')
    }

    // LINEからアクセストークンを取得
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${supabaseUrl}/functions/v1/login-callback`,
        client_id: lineSettings.line_channel_id,
        client_secret: lineSettings.line_channel_secret,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('LINEトークン取得に失敗しました')
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // LINEプロファイル情報を取得
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!profileResponse.ok) {
      throw new Error('LINEプロファイル取得に失敗しました')
    }

    const profile = await profileResponse.json()

    // リファラーからサイトURLを取得
    const referer = req.headers.get('referer') || req.headers.get('Referer') || ''
    const siteUrl = referer ? new URL(referer).origin : 'https://74048ab5-8d5a-425a-ab29-bd5cc50dc2fe.lovableproject.com'

    // LINEユーザーIDで既存プロファイルを検索
    const { data: existingProfile, error: profileSearchError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('line_user_id', profile.userId)
      .single()

    let userId;
    
    if (existingProfile && !profileSearchError) {
      // 既存ユーザーの場合
      userId = existingProfile.user_id;
      console.log('既存ユーザーが見つかりました:', userId);
    } else {
      // 新規ユーザーの場合、一時的なアクセストークンを生成してリダイレクト
      // 実際のユーザー認証は別途実装が必要
      console.log('新規ユーザーです:', profile.userId);
      
      // プロファイル情報を作成/更新
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          display_name: profile.displayName,
          line_user_id: profile.userId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'line_user_id'
        })

      if (profileError) {
        console.error('プロファイル更新エラー:', profileError)
      }
    }

    // LINEユーザー情報をクエリパラメータに含めてリダイレクト
    const redirectUrl = new URL(`${siteUrl}/`)
    redirectUrl.searchParams.set('line_user_id', profile.userId)
    redirectUrl.searchParams.set('display_name', profile.displayName)
    redirectUrl.searchParams.set('line_login', 'success')

    // ダッシュボードにリダイレクト
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl.toString(),
      },
    })

  } catch (error) {
    console.error('ログインコールバックエラー:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})