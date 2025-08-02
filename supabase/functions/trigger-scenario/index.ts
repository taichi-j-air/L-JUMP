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
    const lineUserId = url.searchParams.get('line_user_id')
    const inviteCode = url.searchParams.get('invite_code')

    console.log('=== SCENARIO TRIGGER START ===')
    console.log('LINE User ID:', lineUserId)
    console.log('Invite Code:', inviteCode)

    if (!lineUserId || !inviteCode) {
      return new Response('Missing parameters', { 
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

    // 招待コードからシナリオIDを取得
    const { data: inviteData, error: inviteError } = await supabase
      .from('scenario_invite_codes')
      .select('scenario_id')
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

    const scenarioId = inviteData.scenario_id

    // 手動配信トリガーを実行
    const { data: triggerResult, error: triggerError } = await supabase
      .rpc('trigger_scenario_delivery_for_friend', {
        p_line_user_id: lineUserId,
        p_scenario_id: scenarioId
      })

    if (triggerError) {
      console.error('配信トリガーエラー:', triggerError)
      return new Response('Delivery trigger failed', { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    console.log('配信トリガー結果:', triggerResult)

    if (triggerResult?.success) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Scenario delivery triggered',
        steps_triggered: triggerResult.steps_triggered
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: triggerResult?.error || 'Unknown error'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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