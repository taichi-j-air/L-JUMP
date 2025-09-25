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
    console.log('Send test message request received')

    if (req.method !== 'POST') {
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

    const requestBody = await req.json()
    const { to, message } = requestBody

    if (!to || !message) {
      return new Response('Missing required fields: to, message', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
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

    // Get secure LINE credentials
    const { data: credentials, error: credError } = await supabase
      .rpc('get_line_credentials_for_user', { p_user_id: user.id });

    if (credError || !credentials?.channel_access_token) {
      console.error('No LINE access token found:', credError)
      return new Response('LINE API not configured', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Get friend's short_uid for UID parameter
    const { data: friendData } = await supabase
      .from('line_friends')
      .select('short_uid')
      .eq('line_user_id', to)
      .eq('user_id', user.id)
      .single()

    // UIDパラメーター付与処理
    const addUidToTestMessage = (message: string, friendShortUid: string | null): string => {
      if (!friendShortUid) return message
      
      // [UID]変数をshort_uidで置換
      return message.replace(/\[UID\]/g, friendShortUid);
    }

    // Process message to add UID parameters
    const processedMessage = addUidToTestMessage(message, friendData?.short_uid || null)

    // Send message via LINE API
    const lineApiData = {
      to: to,
      messages: [
        {
          type: 'text',
          text: processedMessage
        }
      ]
    }

    console.log('Sending test message:', lineApiData)

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${credentials.channel_access_token}`
      },
      body: JSON.stringify(lineApiData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('LINE API error:', response.status, errorText)
      return new Response(`Failed to send message: ${errorText}`, { 
        status: response.status, 
        headers: corsHeaders 
      })
    }

    console.log('Test message sent successfully to:', to)

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Test message sent successfully'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(`Internal server error: ${(error as Error)?.message || 'Unknown error'}`, { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})