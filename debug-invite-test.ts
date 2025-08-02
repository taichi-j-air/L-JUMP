// テスト用の招待コード確認スクリプト
// このコードをSupabase SQL Editorで実行して、データの状態を確認できます

/*
-- 1. scenario_invite_codes テーブルの状態確認
SELECT 
  sic.*,
  ss.name as scenario_name,
  ss.user_id as scenario_user_id
FROM scenario_invite_codes sic
LEFT JOIN step_scenarios ss ON ss.id = sic.scenario_id
WHERE sic.is_active = true
ORDER BY sic.created_at DESC;

-- 2. profiles テーブルの状態確認
SELECT 
  user_id,
  line_channel_id,
  line_api_status,
  add_friend_url
FROM profiles
WHERE line_channel_id IS NOT NULL;

-- 3. 特定の招待コードをテスト（'fif76que'を実際のコードに置き換え）
SELECT 
  sic.*,
  ss.name as scenario_name,
  ss.user_id,
  p.line_channel_id,
  p.line_api_status,
  p.add_friend_url
FROM scenario_invite_codes sic
JOIN step_scenarios ss ON ss.id = sic.scenario_id
JOIN profiles p ON p.user_id = ss.user_id
WHERE sic.invite_code = 'fif76que'
  AND sic.is_active = true;
*/

// Edge Function コード (scenario-invite/index.ts)
export const scenarioInviteCode = `
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

    console.log('招待コード処理開始:', { inviteCode, url: req.url })

    if (!inviteCode) {
      return new Response('招待コードが見つかりません', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // シンプルな分割クエリ方式に変更
    const { data: inviteCodeData, error: inviteError } = await supabase
      .from('scenario_invite_codes')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .single()

    if (inviteError || !inviteCodeData) {
      console.error('招待コード検索エラー:', inviteError)
      return new Response('無効な招待コードです', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // シナリオ情報を取得
    const { data: scenarioData, error: scenarioError } = await supabase
      .from('step_scenarios')
      .select('name, user_id')
      .eq('id', inviteCodeData.scenario_id)
      .single()

    if (scenarioError || !scenarioData) {
      console.error('シナリオ検索エラー:', scenarioError)
      return new Response('無効なシナリオです', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // プロファイル情報を取得
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('line_channel_id, line_api_status, add_friend_url')
      .eq('user_id', scenarioData.user_id)
      .single()

    if (profileError || !profileData) {
      console.error('プロファイル検索エラー:', profileError)
      return new Response('BOT設定が見つかりません', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // 使用制限チェック
    if (inviteCodeData.max_usage && inviteCodeData.usage_count >= inviteCodeData.max_usage) {
      return new Response('この招待コードは使用上限に達しています', { 
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    if (!profileData.line_channel_id || profileData.line_api_status !== 'active') {
      return new Response('このBOTは現在利用できません', { 
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // 友達追加URLを生成
    let baseUrl = profileData.add_friend_url || \`https://line.me/R/ti/p/@\${profileData.line_channel_id}\`
    
    // URLに招待コードパラメータを追加
    try {
      const friendUrl = new URL(baseUrl)
      friendUrl.searchParams.set('state', inviteCode)
      baseUrl = friendUrl.toString()
    } catch (urlError) {
      console.error('URL生成エラー:', urlError)
      // URLが無効な場合はデフォルトを使用
      baseUrl = \`https://line.me/R/ti/p/@\${profileData.line_channel_id}?state=\${inviteCode}\`
    }

    console.log('最終的な友達追加URL:', baseUrl)

    // クリックログを記録
    const { error: clickError } = await supabase
      .from('invite_clicks')
      .insert({
        invite_code: inviteCode,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        referer: req.headers.get('referer') || null
      })

    if (clickError) {
      console.error('クリックログ挿入エラー:', clickError)
    }

    // リダイレクト
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': baseUrl
      }
    })

  } catch (error) {
    console.error('処理エラー:', error)
    return new Response('サーバーエラーが発生しました', { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
})
`;

// LINE Webhook コード (line-webhook/index.ts) - 主要部分
export const lineWebhookHandleFollow = \`
async function handleFollow(event: LineEvent, supabase: any, req: Request) {
  try {
    const { source } = event
    console.log(\`User \${source.userId} followed the bot\`)

    // 招待コードを複数の方法で取得を試行
    const url = new URL(req.url)
    let inviteCode = url.searchParams.get('state') || 
                     url.searchParams.get('invite') ||
                     req.headers.get('x-invite-code')
    
    console.log('検出された招待コード:', inviteCode)

    const userProfile = await getLineUserProfile(source.userId, supabase)
    
    if (userProfile && inviteCode) {
      console.log('招待コード経由での友達追加を処理します')
      
      const { data: registrationResult, error: registrationError } = await supabase
        .rpc('register_friend_to_scenario', {
          p_line_user_id: source.userId,
          p_invite_code: inviteCode,
          p_display_name: userProfile.displayName,
          p_picture_url: userProfile.pictureUrl
        })
      
      if (registrationError) {
        console.error('シナリオ登録エラー:', registrationError)
      } else {
        console.log('シナリオ登録成功:', registrationResult)
        
        if (registrationResult?.success) {
          // ステップ配信を開始
          EdgeRuntime.waitUntil(
            startStepDelivery(supabase, registrationResult.scenario_id, registrationResult.friend_id)
          )
        }
      }
    } else {
      console.log('通常の友達追加を処理します')
      // 通常の友達追加処理
    }
    
  } catch (error) {
    console.error('Follow処理エラー:', error)
  }
}
\`;