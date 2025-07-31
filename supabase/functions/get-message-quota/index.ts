import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id } = await req.json()

    console.log('Getting message quota for user:', user_id)

    // ユーザーのプロファイル取得
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('line_channel_access_token')
      .eq('user_id', user_id)
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      throw new Error('Failed to get user profile')
    }

    if (!profile?.line_channel_access_token) {
      throw new Error('LINE access token not found')
    }

    console.log('Making LINE API calls...')

    // LINE API: 配信上限取得
    const quotaResponse = await fetch('https://api.line.me/v2/bot/message/quota', {
      headers: {
        'Authorization': `Bearer ${profile.line_channel_access_token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!quotaResponse.ok) {
      console.error('Quota response error:', await quotaResponse.text())
      throw new Error('Failed to get quota from LINE API')
    }
    
    const quotaData = await quotaResponse.json()
    console.log('Quota data:', quotaData)

    // LINE API: 配信済み数取得
    const consumptionResponse = await fetch('https://api.line.me/v2/bot/message/quota/consumption', {
      headers: {
        'Authorization': `Bearer ${profile.line_channel_access_token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!consumptionResponse.ok) {
      console.error('Consumption response error:', await consumptionResponse.text())
      throw new Error('Failed to get consumption from LINE API')
    }
    
    const consumptionData = await consumptionResponse.json()
    console.log('Consumption data:', consumptionData)

    // データベース更新
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        monthly_message_limit: quotaData.value || 200,
        monthly_message_used: consumptionData.totalUsage || 0,
        quota_updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)

    if (updateError) {
      console.error('Update error:', updateError)
      throw updateError
    }

    console.log('Successfully updated quota data')

    return new Response(
      JSON.stringify({
        limit: quotaData.value || 200,
        used: consumptionData.totalUsage || 0,
        remaining: (quotaData.value || 200) - (consumptionData.totalUsage || 0)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})