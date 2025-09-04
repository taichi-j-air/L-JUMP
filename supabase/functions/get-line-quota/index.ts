import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Getting LINE quota information')

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ 
        error: 'Method not allowed. Use POST.' 
      }), { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Parse request body
    const { channelId } = await req.json()
    
    if (!channelId) {
      return new Response(JSON.stringify({ 
        error: 'channelId is required in request body' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Initialize Supabase client
    const supabaseUrl = "https://rtjxurmuaawyzjcdkqxt.supabase.co"
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseServiceKey) {
      console.error('Missing Supabase service key')
      return new Response(JSON.stringify({ 
        error: 'Server configuration error' 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user by channel ID first
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('line_channel_id', channelId)
      .single()

    if (userError || !userProfile?.user_id) {
      console.error('No user found for channelId:', channelId, userError)
      return new Response(JSON.stringify({ 
        error: 'User not found for this channel' 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Get secure LINE credentials
    const { data: credentials, error: credError } = await supabase
      .rpc('get_line_credentials_for_user', { p_user_id: userProfile.user_id })
      .single()

    if (credError || !credentials?.channel_access_token) {
      console.error('No LINE credentials found for userId:', userProfile.user_id, credError)
      return new Response(JSON.stringify({ 
        error: 'LINE API not configured for this channel' 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const headers = {
      'Authorization': `Bearer ${credentials.channel_access_token}`,
      'Content-Type': 'application/json'
    }

    // Parallel execution of LINE API calls
    const [quotaResponse, consumptionResponse] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', { headers }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', { headers })
    ])

    // Handle quota API response
    let quotaData = null
    if (!quotaResponse.ok) {
      const errorText = await quotaResponse.text()
      console.error('Quota API error:', quotaResponse.status, errorText)
      return new Response(JSON.stringify({ 
        error: `Quota API error: ${quotaResponse.status} - ${errorText}` 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
    quotaData = await quotaResponse.json()
    console.log('Quota data received:', quotaData)

    // Handle consumption API response
    let consumptionData = { totalUsage: 0 }
    if (!consumptionResponse.ok) {
      const errorText = await consumptionResponse.text()
      console.error('Consumption API error:', consumptionResponse.status, errorText)
      return new Response(JSON.stringify({ 
        error: `Consumption API error: ${consumptionResponse.status} - ${errorText}` 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
    consumptionData = await consumptionResponse.json()
    console.log('Consumption data received:', consumptionData)

    // Format response according to specification
    const result = {
      limit: quotaData.value || 200,
      used: consumptionData.totalUsage || 0,
      remain: (quotaData.value || 200) - (consumptionData.totalUsage || 0),
      error: null
    }

    // Update profile with latest quota information
    await supabase
      .from('profiles')
      .update({
        monthly_message_limit: result.limit,
        monthly_message_used: result.used,
        quota_updated_at: new Date().toISOString()
      })
      .eq('line_channel_id', channelId)

    return new Response(JSON.stringify(result), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ 
      error: `Internal server error: ${error.message}` 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})