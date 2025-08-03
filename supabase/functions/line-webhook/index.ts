import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  validateLineUserId, 
  validateInviteCode, 
  sanitizeTextInput,
  rateLimiter,
  createSecureHeaders,
  createErrorResponse
} from '../_shared/security.ts'

const corsHeaders = createSecureHeaders({
  'x-line-signature': 'x-line-signature'
})

interface LineMessage {
  id: string
  type: string
  text?: string
  timestamp: number
}

interface LineEvent {
  type: string
  message?: LineMessage
  replyToken: string
  source: {
    userId: string
    type: string
  }
  timestamp: number
}

interface LineWebhookBody {
  destination: string
  events: LineEvent[]
}

serve(async (req) => {
  console.log('=== LINE Webhook Function Called ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request received')
    return new Response(null, { headers: corsHeaders })
  }

  // Rate limiting check
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rateAllowed = await rateLimiter.isAllowed(`webhook:${clientIP}`, 100, 60000); // 100 requests per minute
  
  if (!rateAllowed) {
    console.warn('Rate limit exceeded for IP:', clientIP);
    return createErrorResponse('Rate limit exceeded', 429);
  }

  // LINEの検証リクエストに対する簡単なレスポンス
  if (req.method === 'GET') {
    console.log('GET request received - possibly LINE verification')
    return new Response('LINE Webhook is working!', { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  // Validate request method
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

  try {
    console.log('Processing POST request from LINE')
    
    // Validate content type
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return createErrorResponse('Invalid content type', 400);
    }

    const body = await req.text()
    console.log('Raw body received:', body)
    console.log('Body length:', body.length)

    if (!body || body.length === 0) {
      return createErrorResponse('Empty request body', 400);
    }

    let webhookData: LineWebhookBody;
    try {
      webhookData = JSON.parse(body);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return createErrorResponse('Invalid JSON format', 400);
    }

    // Validate webhook payload structure
    if (!webhookData || !Array.isArray(webhookData.events)) {
      return createErrorResponse('Invalid webhook payload structure', 400);
    }
    
    // Verify LINE signature (basic validation)
    const signature = req.headers.get('x-line-signature')
    if (!signature) {
      console.error('No LINE signature found')
      return new Response('No signature', { 
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Process each event with validation
    for (const event of webhookData.events) {
      console.log('Processing event:', event.type)
      
      // Validate event structure
      if (!event || !event.type || !event.source?.userId) {
        console.warn('Invalid event structure, skipping:', event);
        continue;
      }

      // Validate LINE user ID format
      if (!validateLineUserId(event.source.userId)) {
        console.warn('Invalid LINE user ID format:', event.source.userId);
        continue;
      }
      
      if (event.type === 'message' && event.message) {
        await handleMessage(event, supabase, req)
      } else if (event.type === 'follow') {
        await handleFollow(event, supabase, req)
      } else if (event.type === 'unfollow') {
        await handleUnfollow(event, supabase, req)
      } else {
        console.log('Unhandled event type:', event.type)
      }
    }

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})

async function handleMessage(event: LineEvent, supabase: any, req: Request) {
  try {
    const { message, replyToken, source } = event
    
    if (!message || !message.text) {
      console.log('No text message to process')
      return
    }

    // Sanitize message text to prevent XSS
    const sanitizedText = sanitizeTextInput(message.text);
    if (!sanitizedText) {
      console.warn('Message text failed sanitization, skipping');
      return;
    }

    console.log(`Message from ${source.userId}: ${sanitizedText}`)

    // Check if this user is already a friend, if not add them
    await ensureFriendExists(source.userId, supabase)

    // Save incoming message to database with sanitized text
    await saveIncomingMessage(source.userId, sanitizedText, supabase)

    // Example: Auto-reply with a simple text message
    await sendReplyMessage(replyToken, `受信しました: ${sanitizedText}`, supabase)

  } catch (error) {
    console.error('Error handling message:', error)
  }
}

async function saveIncomingMessage(userId: string, messageText: string, supabase: any) {
  try {
    // Find the profile that owns this LINE bot
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .not('line_channel_access_token', 'is', null)
      .limit(1)

    if (profileError || !profiles || profiles.length === 0) {
      console.error('No profile found for saving message:', profileError)
      return
    }

    const profile = profiles[0]

    // Get the friend record
    const { data: friend, error: friendError } = await supabase
      .from('line_friends')
      .select('id')
      .eq('user_id', profile.user_id)
      .eq('line_user_id', userId)
      .single()

    if (friendError || !friend) {
      console.error('Friend not found for message saving:', friendError)
      return
    }

    // Save the message
    const { error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: profile.user_id,
        friend_id: friend.id,
        message_text: messageText,
        message_type: 'incoming',
        sent_at: new Date().toISOString()
      })

    if (messageError) {
      console.error('Error saving incoming message:', messageError)
    } else {
      console.log('Incoming message saved successfully')
    }

  } catch (error) {
    console.error('Error in saveIncomingMessage:', error)
  }
}

async function sendReplyMessage(replyToken: string, text: string, supabase: any) {
  try {
    // Get a LINE channel access token from any configured profile
    // This is a simplified approach - in production you'd want to match
    // the webhook destination to the correct profile
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('line_channel_access_token')
      .not('line_channel_access_token', 'is', null)
      .limit(1)

    if (error || !profiles || profiles.length === 0) {
      console.error('No LINE access token found:', error)
      return
    }

    const accessToken = profiles[0].line_channel_access_token

    const replyData = {
      replyToken: replyToken,
      messages: [
        {
          type: 'text',
          text: text
        }
      ]
    }

    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(replyData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('LINE API error:', response.status, errorText)
      return
    }

    console.log('Reply sent successfully')

  } catch (error) {
    console.error('Error sending reply:', error)
  }
}

async function handleFollow(event: LineEvent, supabase: any, req: Request) {
  try {
    const { source } = event
    console.log(`User ${source.userId} followed the bot`)

    // Extract invite code from various sources
    const url = new URL(req.url)
    let inviteCode = url.searchParams.get('state') || url.searchParams.get('invite')
    
    // Also check headers and URL path for invite code
    if (!inviteCode) {
      inviteCode = req.headers.get('x-invite-code')
    }
    
    console.log('Invite code from follow event:', inviteCode)

    // Get user profile using LINE Messaging API
    const userProfile = await getLineUserProfile(source.userId, supabase)
    
    if (userProfile) {
      console.log('Processing friend addition for user:', userProfile.displayName)
      
      // Check if invite code is provided - use scenario registration function
      if (inviteCode) {
        console.log('友達追加を招待コード経由で処理します:', inviteCode)
        
        try {
          // Use the new scenario registration function
          const { data: registrationResult, error: registrationError } = await supabase
            .rpc('register_friend_to_scenario', {
              p_line_user_id: source.userId,
              p_invite_code: inviteCode,
              p_display_name: userProfile.displayName,
              p_picture_url: userProfile.pictureUrl
            })
          
          if (registrationError) {
            console.error('シナリオ登録エラー:', registrationError)
          } else {
            console.log('シナリオ登録結果:', registrationResult)
            
            if (registrationResult && registrationResult.success) {
              console.log('友達をシナリオに正常に登録しました')
              
              // Start step delivery process in background
              EdgeRuntime.waitUntil(
                startStepDelivery(supabase, registrationResult.scenario_id, registrationResult.friend_id)
              )
            } else {
              console.error('シナリオ登録に失敗:', registrationResult?.error)
            }
          }
        } catch (error) {
          console.error('招待コード処理中にエラー:', error)
        }
      } else {
        // Regular friend addition without invite code
        console.log('通常の友達追加を処理します（招待コードなし）')
        
        // Find the profile that owns this LINE bot
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('user_id, friends_count')
          .not('line_channel_access_token', 'is', null)
          .limit(1)

        if (error || !profiles || profiles.length === 0) {
          console.error('No profile found for this LINE bot:', error)
          return
        }

        const profile = profiles[0]

        // Insert friend data
        const { data: friendData, error: insertError } = await supabase
          .from('line_friends')
          .insert({
            user_id: profile.user_id,
            line_user_id: source.userId,
            display_name: userProfile.displayName,
            picture_url: userProfile.pictureUrl,
            added_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error inserting friend:', insertError)
          return
        }

        // Update friends count
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            friends_count: (profile.friends_count || 0) + 1 
          })
          .eq('user_id', profile.user_id)

        if (updateError) {
          console.error('Error updating friends count:', updateError)
        }

        console.log('通常の友達追加が完了しました:', userProfile.displayName)
      }
    } else {
      console.error('LINE APIからユーザープロファイルを取得できませんでした')
    }

  } catch (error) {
    console.error('Error handling follow:', error)
  }
}

// Step delivery process for scenario-based friend additions
async function startStepDelivery(supabase: any, scenarioId: string, friendId: string) {
  try {
    console.log('ステップ配信プロセスを開始:', { scenarioId, friendId })
    
    // Get the first step that should be delivered (status = 'ready')
    const { data: readySteps, error: stepsError } = await supabase
      .from('step_delivery_tracking')
      .select(`
        *,
        steps!inner (
          id, step_order, delivery_type, delivery_seconds, delivery_minutes, delivery_hours, delivery_days,
          step_messages (
            id, content, message_type, media_url, message_order,
            flex_messages (content)
          )
        )
      `)
      .eq('scenario_id', scenarioId)
      .eq('friend_id', friendId)
      .eq('status', 'ready')
      .order('steps.step_order')
      .limit(1)
    
    if (stepsError) {
      console.error('配信準備完了ステップの取得エラー:', stepsError)
      return
    }
    
    if (!readySteps || readySteps.length === 0) {
      console.log('配信準備完了のステップが見つかりません')
      return
    }
    
    const firstStep = readySteps[0]
    console.log('最初のステップを配信します:', firstStep.steps.step_order)
    
    // Deliver the first step immediately if it's set for immediate delivery
    if (firstStep.steps.delivery_type === 'immediately' || 
        (firstStep.steps.delivery_days === 0 && 
         firstStep.steps.delivery_hours === 0 && 
         firstStep.steps.delivery_minutes === 0 &&
         firstStep.steps.delivery_seconds === 0)) {
      
      await deliverStepMessages(supabase, firstStep)
    } else {
      console.log('遅延配信ステップのため、スケジュール処理が必要です')
      // For delayed delivery, you would implement scheduling logic here
    }
    
  } catch (error) {
    console.error('ステップ配信プロセスエラー:', error)
  }
}

// Deliver messages for a specific step
async function deliverStepMessages(supabase: any, stepTracking: any) {
  try {
    console.log('ステップメッセージを配信中:', stepTracking.step_id)
    
    const messages = stepTracking.steps.step_messages || []
    if (messages.length === 0) {
      console.log('配信するメッセージがありません')
      
      // Mark as delivered even without messages
      await markStepAsDelivered(supabase, stepTracking.id, stepTracking.scenario_id, stepTracking.friend_id, stepTracking.steps.step_order)
      return
    }
    
    // Sort messages by order
    const sortedMessages = messages.sort((a: any, b: any) => a.message_order - b.message_order)
    
    // Get LINE user ID and access token for sending
    const { data: friendInfo, error: friendError } = await supabase
      .from('line_friends')
      .select('line_user_id, profiles!inner(line_channel_access_token)')
      .eq('id', stepTracking.friend_id)
      .single()
    
    if (friendError || !friendInfo) {
      console.error('友達情報の取得に失敗:', friendError)
      return
    }
    
    const lineUserId = friendInfo.line_user_id
    const accessToken = friendInfo.profiles.line_channel_access_token
    
    if (!accessToken) {
      console.error('LINE アクセストークンが見つかりません')
      return
    }
    
    // Send each message
    for (const message of sortedMessages) {
      try {
        await sendLineMessage(accessToken, lineUserId, message)
        console.log('メッセージ送信完了:', message.id)
        
        // Add small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error('メッセージ送信エラー:', message.id, error)
      }
    }
    
    // Mark step as delivered and prepare next step
    await markStepAsDelivered(supabase, stepTracking.id, stepTracking.scenario_id, stepTracking.friend_id, stepTracking.steps.step_order)
    
  } catch (error) {
    console.error('ステップメッセージ配信エラー:', error)
  }
}

// Send a single message via LINE API
async function sendLineMessage(accessToken: string, userId: string, message: any) {
  try {
    let lineMessage: any
    
    switch (message.message_type) {
      case 'text':
        lineMessage = {
          type: 'text',
          text: message.content
        }
        break
        
      case 'media':
        // Handle media messages
        if (message.media_url) {
          // For images
          if (message.media_url.match(/\.(jpg|jpeg|png|gif)$/i)) {
            lineMessage = {
              type: 'image',
              originalContentUrl: message.media_url,
              previewImageUrl: message.media_url
            }
          } else {
            // For other media, send as text with URL
            lineMessage = {
              type: 'text',
              text: `メディア: ${message.media_url}`
            }
          }
        } else {
          lineMessage = {
            type: 'text',
            text: message.content
          }
        }
        break
        
      case 'flex':
        lineMessage = {
          type: 'flex',
          altText: 'フレックスメッセージ',
          contents: message.flex_messages?.content || JSON.parse(message.content || '{}')
        }
        break
        
      default:
        lineMessage = {
          type: 'text',
          text: message.content
        }
    }
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [lineMessage]
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('LINE API エラー:', response.status, errorText)
      throw new Error(`LINE API error: ${response.status}`)
    }
    
    console.log('LINE メッセージ送信成功')
    
  } catch (error) {
    console.error('LINE メッセージ送信エラー:', error)
    throw error
  }
}

// Mark step as delivered and prepare the next step
async function markStepAsDelivered(supabase: any, trackingId: string, scenarioId: string, friendId: string, currentStepOrder: number) {
  try {
    // Mark current step as delivered
    const { error: updateError } = await supabase
      .from('step_delivery_tracking')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('id', trackingId)
    
    if (updateError) {
      console.error('配信ステータス更新エラー:', updateError)
      return
    }
    
    console.log('ステップを配信完了としてマーク:', currentStepOrder)
    
    // Find and prepare the next step
    const { data: nextSteps, error: nextError } = await supabase
      .from('step_delivery_tracking')
      .select('id, steps!inner(step_order)')
      .eq('scenario_id', scenarioId)
      .eq('friend_id', friendId)
      .eq('status', 'waiting')
      .gt('steps.step_order', currentStepOrder)
      .order('steps.step_order')
      .limit(1)
    
    if (nextError) {
      console.error('次ステップ検索エラー:', nextError)
      return
    }
    
    if (nextSteps && nextSteps.length > 0) {
      const nextStep = nextSteps[0]
      
      // Mark next step as ready
      const { error: readyError } = await supabase
        .from('step_delivery_tracking')
        .update({ status: 'ready' })
        .eq('id', nextStep.id)
      
      if (readyError) {
        console.error('次ステップ準備エラー:', readyError)
      } else {
        console.log('次のステップを準備しました:', nextStep.steps.step_order)
      }
    } else {
      console.log('すべてのステップが完了しました')
    }
    
  } catch (error) {
    console.error('ステップ完了処理エラー:', error)
  }
}

async function handleUnfollow(event: LineEvent, supabase: any, req: Request) {
  try {
    const { source } = event
    console.log(`User ${source.userId} unfollowed the bot`)

    // Find the profile that owns this LINE bot
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, friends_count')
      .not('line_channel_access_token', 'is', null)
      .limit(1)

    if (error || !profiles || profiles.length === 0) {
      console.error('No profile found for this LINE bot:', error)
      return
    }

    const profile = profiles[0]

    // Remove friend from database
    const { error: deleteError } = await supabase
      .from('line_friends')
      .delete()
      .eq('user_id', profile.user_id)
      .eq('line_user_id', source.userId)

    if (deleteError) {
      console.error('Error removing friend:', deleteError)
    } else {
      // Update friends count
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          friends_count: Math.max(0, (profile.friends_count || 1) - 1) 
        })
        .eq('user_id', profile.user_id)

      if (updateError) {
        console.error('Error updating friends count:', updateError)
      }

      console.log('Friend removed successfully:', source.userId)
    }

  } catch (error) {
    console.error('Error handling unfollow:', error)
  }
}

async function ensureFriendExists(userId: string, supabase: any) {
  try {
    // Find the profile that owns this LINE bot
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, line_channel_access_token, friends_count')
      .not('line_channel_access_token', 'is', null)
      .limit(1)

    if (error || !profiles || profiles.length === 0) {
      console.error('No profile found for this LINE bot:', error)
      return
    }

    const profile = profiles[0]

    // Check if friend already exists
    const { data: existingFriend, error: friendError } = await supabase
      .from('line_friends')
      .select('id')
      .eq('user_id', profile.user_id)
      .eq('line_user_id', userId)
      .single()

    if (existingFriend) {
      console.log('Friend already exists:', userId)
      return
    }

    // Get user profile from LINE API
    const userProfile = await getLineUserProfile(userId, supabase)
    
    if (userProfile) {
      console.log('Got user profile:', userProfile)
      
      // Insert friend data
      const insertData = {
        user_id: profile.user_id,
        line_user_id: userId,
        display_name: userProfile.displayName,
        picture_url: userProfile.pictureUrl,
        added_at: new Date().toISOString()
      }
      
      console.log('Inserting friend data:', insertData)
      
      const { error: insertError } = await supabase
        .from('line_friends')
        .insert(insertData)

      if (insertError) {
        console.error('Error inserting friend:', insertError)
      } else {
        console.log('Friend inserted successfully')
        
        // Update friends count
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            friends_count: (profile.friends_count || 0) + 1 
          })
          .eq('user_id', profile.user_id)

        if (updateError) {
          console.error('Error updating friends count:', updateError)
        } else {
          console.log('Friends count updated successfully')
        }

        console.log('Friend added successfully:', userProfile.displayName)
      }
    } else {
      console.error('Could not get user profile from LINE API')
    }

  } catch (error) {
    console.error('Error ensuring friend exists:', error)
  }
}

async function getLineUserProfile(userId: string, supabase: any) {
  try {
    // Get a LINE channel access token
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('line_channel_access_token')
      .not('line_channel_access_token', 'is', null)
      .limit(1)

    if (error || !profiles || profiles.length === 0) {
      console.error('No LINE access token found:', error)
      return null
    }

    const accessToken = profiles[0].line_channel_access_token

    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      console.error('LINE API error getting profile:', response.status)
      return null
    }

    const profile = await response.json()
    return profile

  } catch (error) {
    console.error('Error getting user profile:', error)
    return null
  }
}