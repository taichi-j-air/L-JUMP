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
    console.log('Send LINE message request received')

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

    // Get user's LINE access token and delivery count
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('line_channel_access_token, delivery_count, monthly_message_used')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.line_channel_access_token) {
      console.error('No LINE access token found:', profileError)
      return new Response('LINE API not configured', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Validate LINE User ID format
    if (!to || typeof to !== 'string' || to.startsWith('test_')) {
      console.error('Invalid LINE User ID:', to)
      return new Response('Invalid LINE User ID. Cannot send message to test users.', { 
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
    const addUidToFormLinks = (message: string, friendShortUid: string | null): string => {
      if (!friendShortUid) return message
      
      // フォームリンクのパターンを検出
      const formLinkPattern = /(https?:\/\/[^\/]+\/form\/[a-f0-9\-]+)/gi
      
  return message.replace(formLinkPattern, (match) => {
    try {
      const url = new URL(match)
      // Check if uid parameter already exists to prevent duplication
      if (!url.searchParams.has('uid')) {
        url.searchParams.set('uid', friendShortUid)
      }
      return url.toString()
    } catch (error) {
      console.error('Error processing form URL:', error)
      return match // Return original URL if parsing fails
    }
  })
    }

    // Process message to add UID parameters to form links
    const processedMessage = addUidToFormLinks(message, friendData?.short_uid || null)

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

    console.log('Sending LINE message:', lineApiData)

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${profile.line_channel_access_token}`
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

    console.log('Message sent successfully to:', to)

    // Update delivery count and monthly message used
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        delivery_count: (profile.delivery_count || 0) + 1,
        monthly_message_used: (profile.monthly_message_used || 0) + 1
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating delivery count:', updateError)
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Message sent successfully'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(`Internal server error: ${error.message}`, { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})