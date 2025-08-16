import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // JWTトークンからユーザー情報を取得
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { userId } = await req.json()

    // 対象ユーザーのLINE認証情報を取得
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('line_channel_access_token, line_bot_id, display_name')
      .eq('user_id', userId)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!profile.line_channel_access_token) {
      return new Response(
        JSON.stringify({ error: 'LINE channel access token not configured' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // LINE Messaging APIからBot情報を取得
    const lineApiResponse = await fetch('https://api.line.me/v2/bot/info', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${profile.line_channel_access_token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!lineApiResponse.ok) {
      console.error('LINE API error:', await lineApiResponse.text())
      return new Response(
        JSON.stringify({ error: 'Failed to fetch bot info from LINE API' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const botInfo = await lineApiResponse.json()
    
    // Bot名をプロファイルに更新
    const officialLineName = botInfo.displayName || botInfo.basicId || '未取得'
    
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ 
        display_name: officialLineName,
        line_bot_id: botInfo.basicId || profile.line_bot_id 
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        officialLineName: officialLineName,
        basicId: botInfo.basicId,
        userId: userId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in get-line-bot-info function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})