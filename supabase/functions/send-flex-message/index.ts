import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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
    const { flexMessage, userId } = await req.json()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user's LINE API configuration
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('line_channel_access_token, line_bot_id')
      .eq('user_id', userId)
      .single()

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      return new Response(
        JSON.stringify({ error: 'ユーザープロファイルが見つかりません' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    if (!profile.line_channel_access_token) {
      return new Response(
        JSON.stringify({ error: 'LINE APIアクセストークンが設定されていません' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Send broadcast message via LINE API
    const lineApiUrl = 'https://api.line.me/v2/bot/message/broadcast'
    
    const messagePayload = {
      messages: [flexMessage]
    }

    console.log('Sending to LINE API:', JSON.stringify(messagePayload, null, 2))

    const lineResponse = await fetch(lineApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${profile.line_channel_access_token}`,
      },
      body: JSON.stringify(messagePayload)
    })

    if (!lineResponse.ok) {
      const errorText = await lineResponse.text()
      console.error('LINE API error:', errorText)
      
      return new Response(
        JSON.stringify({ 
          error: 'LINE APIエラーが発生しました',
          details: errorText,
          status: lineResponse.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: lineResponse.status }
      )
    }

    const result = await lineResponse.json()
    console.log('LINE API success:', result)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Flexメッセージを送信しました',
        lineResponse: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: '予期しないエラーが発生しました', 
        details: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})