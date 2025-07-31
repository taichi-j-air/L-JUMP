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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('LINE Webhook received:', req.method)

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    const body = await req.text()
    console.log('Webhook body:', body)

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
        await handleMessage(event, supabase)
      } else if (event.type === 'follow') {
        await handleFollow(event, supabase)
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

async function handleMessage(event: LineEvent, supabase: any) {
  try {
    const { message, replyToken, source } = event
    
    if (!message || !message.text) {
      console.log('No text message to process')
      return
    }

    console.log(`Message from ${source.userId}: ${message.text}`)

    // Check if this user is already a friend, if not add them
    await ensureFriendExists(source.userId, supabase)

    // Example: Auto-reply with a simple text message
    await sendReplyMessage(replyToken, `受信しました: ${message.text}`, supabase)

  } catch (error) {
    console.error('Error handling message:', error)
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

async function handleFollow(event: LineEvent, supabase: any) {
  try {
    const { source } = event
    console.log(`User ${source.userId} followed the bot`)

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
      const { error: insertError } = await supabase
        .from('line_friends')
        .insert({
          user_id: profile.user_id,
          line_user_id: source.userId,
          display_name: userProfile.displayName,
          picture_url: userProfile.pictureUrl,
          added_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('Error inserting friend:', insertError)
      } else {
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
      }
    }

  } catch (error) {
    console.error('Error handling follow:', error)
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