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

    if (req.method !== 'GET' && req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Missing authorization header', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // Initialize Supabase client
    const supabaseUrl = "https://rtjxurmuaawyzjcdkqxt.supabase.co"
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseServiceKey) {
      console.error('Missing Supabase service key')
      return new Response('Server configuration error', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Authentication error:', authError)
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // Get user's LINE access token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('line_channel_access_token')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.line_channel_access_token) {
      console.error('No LINE access token found:', profileError)
      return new Response(JSON.stringify({ 
        error: 'LINE API not configured' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Get quota information from LINE API
    const response = await fetch('https://api.line.me/v2/bot/message/quota', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.line_channel_access_token}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('LINE API error:', response.status, errorText)
      return new Response(JSON.stringify({ 
        error: 'Failed to get quota information',
        details: errorText
      }), { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const quotaData = await response.json()
    console.log('Quota data received:', quotaData)

    // Get consumption information
    const consumptionResponse = await fetch('https://api.line.me/v2/bot/message/quota/consumption', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.line_channel_access_token}`
      }
    })

    let consumptionData = null
    if (consumptionResponse.ok) {
      consumptionData = await consumptionResponse.json()
      console.log('Consumption data received:', consumptionData)
    }

    return new Response(JSON.stringify({
      quota: quotaData,
      consumption: consumptionData
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})