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
    console.log('=== LIFF HANDLER ===')
    
    const { inviteCode, scenarioId, accessToken } = await req.json()
    
    console.log('受信データ:', { 
      inviteCode, 
      scenarioId, 
      hasAccessToken: !!accessToken 
    })

    if (!inviteCode || !scenarioId || !accessToken) {
      return new Response(JSON.stringify({ 
        error: 'Missing required parameters' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Step 1: LINEプロファイル取得
    console.log('🔍 LINEプロファイル取得中...')
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!profileResponse.ok) {
      console.error('❌ LINEプロファイル取得失敗:', await profileResponse.text())
      return new Response(JSON.stringify({ 
        error: 'Failed to get LINE profile' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const lineProfile = await profileResponse.json()
    console.log('✅ LINEプロファイル取得成功:', {
      userId: lineProfile.userId,
      displayName: lineProfile.displayName
    })

    // Step 2: シナリオに友だちを登録
    console.log('📝 シナリオに友だち登録中...')
    const { data: registrationResult, error: registrationError } = await supabase
      .rpc('register_friend_to_scenario', {
        p_line_user_id: lineProfile.userId,
        p_invite_code: inviteCode,
        p_display_name: lineProfile.displayName,
        p_picture_url: lineProfile.pictureUrl
      })

    console.log('登録結果:', { 
      success: registrationResult?.success,
      error: registrationError?.message || registrationResult?.error
    })

    if (registrationError || !registrationResult?.success) {
      return new Response(JSON.stringify({ 
        error: registrationResult?.error || 'Registration failed',
        details: registrationError?.message
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Step 3: シナリオ配信をトリガー
    console.log('🚀 シナリオ配信トリガー中...')
    const { data: triggerResult, error: triggerError } = await supabase
      .rpc('trigger_scenario_delivery_for_friend', {
        p_line_user_id: lineProfile.userId,
        p_scenario_id: scenarioId
      })

    console.log('配信トリガー結果:', {
      success: triggerResult?.success,
      stepsTriggered: triggerResult?.steps_triggered
    })

    return new Response(JSON.stringify({ 
      success: true,
      message: 'シナリオ登録が完了しました',
      registration: registrationResult,
      delivery: triggerResult,
      profile: {
        userId: lineProfile.userId,
        displayName: lineProfile.displayName
      }
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 CRITICAL ERROR')
    console.error('Message:', error.message)
    console.error('Stack:', error.stack)
    
    return new Response(JSON.stringify({ 
      error: 'Server error',
      details: error.message,
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})