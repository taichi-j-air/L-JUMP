import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// UIDパラメーター付与処理
function addUidToFlexContent(flexMessage: any, friendShortUid: string | null): any {
  if (!friendShortUid || !flexMessage) return flexMessage;
  
  const processText = (text: string): string => {
    if (!text) return text;
    // [UID]変数をshort_uidで置換
    return text.replace(/\[UID\]/g, friendShortUid);
  };

  const processAction = (action: any): any => {
    if (!action) return action;
    if (action.uri) {
      action.uri = processText(action.uri);
    }
    return action;
  };

  const processElement = (element: any): any => {
    if (!element) return element;
    
    if (element.text) {
      element.text = processText(element.text);
    }
    if (element.action) {
      element.action = processAction(element.action);
    }
    if (element.contents) {
      element.contents = element.contents.map(processElement);
    }
    if (element.body) {
      element.body = processElement(element.body);
    }
    if (element.footer) {
      element.footer = processElement(element.footer);
    }
    
    return element;
  };

  return processElement(flexMessage);
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

    // Get user's LINE API configuration and friends
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

    // Get all friends for individual messaging with UID replacement
    const { data: friends, error: friendsError } = await supabase
      .from('line_friends')
      .select('line_user_id, short_uid')
      .eq('user_id', userId)

    if (friendsError) {
      console.error('Friends fetch error:', friendsError)
      return new Response(
        JSON.stringify({ error: '友達リストの取得に失敗しました' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!friends || friends.length === 0) {
      return new Response(
        JSON.stringify({ error: '送信対象の友達が見つかりません' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Send individual messages to each friend with UID replacement
    const results = []
    
    for (const friend of friends) {
      try {
        const processedFlexMessage = addUidToFlexContent(flexMessage, friend.short_uid)
        
        const messagePayload = {
          to: friend.line_user_id,
          messages: [processedFlexMessage]
        }

        console.log('Sending message payload:', JSON.stringify(messagePayload, null, 2))

        const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${profile.line_channel_access_token}`,
          },
          body: JSON.stringify(messagePayload)
        })

        if (lineResponse.ok) {
          console.log(`Message sent successfully to ${friend.line_user_id}`)
          results.push({ lineUserId: friend.line_user_id, success: true })
        } else {
          const errorText = await lineResponse.text()
          console.error(`LINE API error for ${friend.line_user_id}:`, errorText)
          results.push({ lineUserId: friend.line_user_id, success: false, error: errorText })
        }
      } catch (error) {
        console.error(`Error sending to ${friend.line_user_id}:`, error.message)
        results.push({ lineUserId: friend.line_user_id, success: false, error: error.message })
      }
    }

    const successCount = results.filter(r => r.success).length
    const errorCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Flexメッセージを${successCount}人に送信しました${errorCount > 0 ? ` (${errorCount}人にエラー)` : ''}`,
        results: {
          total: friends.length,
          success: successCount,
          error: errorCount,
          details: results
        }
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