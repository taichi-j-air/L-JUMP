import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-line-signature',
}

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
  console.log('User-Agent:', req.headers.get('user-agent'))
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request received')
    return new Response(null, { headers: corsHeaders })
  }

  // LINEの検証リクエストに対する簡単なレスポンス
  if (req.method === 'GET') {
    console.log('GET request received - possibly LINE verification')
    return new Response('LINE Webhook is working!', { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  try {
    console.log('Processing POST request from LINE')
    
    if (req.method !== 'POST') {
      console.log('Method not allowed:', req.method)
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    const body = await req.text()
    console.log('Raw body received:', body)
    console.log('Body length:', body.length)

    const webhookData: LineWebhookBody = JSON.parse(body)
    
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

    // Process each event
    for (const event of webhookData.events) {
      console.log('Processing event:', event.type)
      
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

    console.log(`Message from ${source.userId}: ${message.text}`)

    // Check if this user is already a friend, if not add them
    await ensureFriendExists(source.userId, supabase)

    // Save incoming message to database
    await saveIncomingMessage(source.userId, message.text, supabase)

    // Example: Auto-reply with a simple text message
    await sendReplyMessage(replyToken, `受信しました: ${message.text}`, supabase)

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

    // Extract invite code from URL state parameter if present
    // In real LINE webhook, we need to detect this from the webhook URL or context
    // For now, we'll log this and check if there's any context available
    const url = new URL(req.url)
    const inviteCode = url.searchParams.get('state')
    
    console.log('Invite code from follow event:', inviteCode)

    // Get user profile using LINE Messaging API
    const userProfile = await getLineUserProfile(source.userId, supabase)
    
    if (userProfile) {
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

      console.log('Friend added successfully:', userProfile.displayName)

      // If there's an invite code, record the friend acquisition
      if (inviteCode) {
        console.log('Processing invite code for new friend:', inviteCode)
        
        // Find the scenario associated with this invite code
        const { data: inviteData, error: inviteError } = await supabase
          .from('scenario_invite_codes')
          .select('scenario_id, usage_count')
          .eq('invite_code', inviteCode)
          .eq('is_active', true)
          .single()

        if (inviteData && !inviteError) {
          // Record the friend acquisition in scenario_friend_logs
          const { error: logError } = await supabase
            .from('scenario_friend_logs')
            .insert({
              scenario_id: inviteData.scenario_id,
              invite_code: inviteCode,
              line_user_id: source.userId,
              friend_id: friendData.id,
              added_at: new Date().toISOString()
            })

          if (logError) {
            console.error('Error recording friend acquisition:', logError)
          } else {
            console.log('Friend acquisition recorded for invite code:', inviteCode)
          }

          // Increment usage count for the invite code
          const { error: incrementError } = await supabase
            .from('scenario_invite_codes')
            .update({ 
              usage_count: inviteData.usage_count + 1 
            })
            .eq('invite_code', inviteCode)

          if (incrementError) {
            console.error('Error incrementing invite code usage:', incrementError)
          } else {
            console.log('Invite code usage count incremented')
          }
        } else {
          console.error('Invalid or inactive invite code:', inviteCode, inviteError)
        }
      }
    }

  } catch (error) {
    console.error('Error handling follow:', error)
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