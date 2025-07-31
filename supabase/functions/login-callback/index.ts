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
        client_id: Deno.env.get('LINE_CHANNEL_ID')!,
        client_secret: Deno.env.get('LINE_CHANNEL_SECRET')!,
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

    // ユーザーをSupabaseに登録またはログイン
    const { data: user, error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'line',
      options: {
        redirectTo: `${Deno.env.get('SITE_URL')}/dashboard`,
      },
    })

    if (authError) {
      throw authError
    }

    // プロファイル情報を更新
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.user?.id,
        display_name: profile.displayName,
        line_user_id: profile.userId,
        updated_at: new Date().toISOString(),
      })

    if (profileError) {
      console.error('プロファイル更新エラー:', profileError)
    }

    // ダッシュボードにリダイレクト
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${Deno.env.get('SITE_URL')}/dashboard`,
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