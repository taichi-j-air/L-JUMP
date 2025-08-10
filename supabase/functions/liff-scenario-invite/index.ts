import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight 対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // LIFF/外部からの起動パラメータ取得。codeが無い/プレースホルダの場合は liff.state を参照
  const url = new URL(req.url)
  let inviteCode = url.searchParams.get('code')
  const liffState = url.searchParams.get('liff.state')
  if (!inviteCode || inviteCode === 'YOUR_INVITE_CODE') {
    try {
      if (liffState) {
        const state = new URLSearchParams(decodeURIComponent(liffState))
        inviteCode = state.get('inviteCode') || state.get('code') || inviteCode
      }
    } catch (_) {
      // no-op
    }
  }

  if (!inviteCode || inviteCode === 'YOUR_INVITE_CODE') {
    return new Response(JSON.stringify({ error: 'Invite code is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    console.log('=== LIFF SCENARIO INVITE ===')
    console.log('招待コード:', inviteCode)
    console.log('User-Agent:', req.headers.get('user-agent'))

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Step 1: 招待コード検証
    const { data: inviteData, error: inviteError } = await supabase
      .from('scenario_invite_codes')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .maybeSingle()

    if (inviteError || !inviteData) {
      return new Response(`Invalid invite code: ${inviteCode}`, {
        status: 404,
        headers: corsHeaders
      })
    }

    // Step 2: シナリオ情報取得
    const { data: scenarioData, error: scenarioError } = await supabase
      .from('step_scenarios')
      .select('user_id')
      .eq('id', inviteData.scenario_id)
      .maybeSingle()

    if (scenarioError || !scenarioData) {
      return new Response('Scenario not found', {
        status: 404,
        headers: corsHeaders
      })
    }

    // Step 3: プロファイル情報取得（LIFF設定）
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('liff_id, line_login_channel_id')
      .eq('user_id', scenarioData.user_id)
      .maybeSingle()

    if (profileError || !profileData?.liff_id || !profileData?.line_login_channel_id) {
      return new Response('LIFF configuration not found', {
        status: 404,
        headers: corsHeaders
      })
    }

    // Step 4: クリックログ記録（省略可）
    // …（省略）…

    // Step 5: LIFF URL生成＆302リダイレクト
    const liffUrl = `https://liff.line.me/${profileData.liff_id}`
                  + `?inviteCode=${inviteCode}`
                  + `&scenarioId=${inviteData.scenario_id}`

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': liffUrl
      }
    })

  } catch (error: any) {
    console.error('💥 CRITICAL ERROR', error)
    return new Response(JSON.stringify({
      error: 'Server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
