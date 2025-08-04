import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Scheduled step delivery checker started')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find steps that are ready for delivery (scheduled time has passed)
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
        ),
        line_friends!inner (
          line_user_id,
          profiles!inner (line_channel_access_token)
        )
      `)
      .eq('status', 'ready')
      .lte('scheduled_delivery_at', new Date().toISOString())
      .order('scheduled_delivery_at', { ascending: true })
      .limit(50) // Process up to 50 steps at a time

    if (stepsError) {
      console.error('Error fetching ready steps:', stepsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch ready steps' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${readySteps?.length || 0} steps ready for delivery`)

    let deliveredCount = 0
    let errorCount = 0

    if (readySteps && readySteps.length > 0) {
      // Process each ready step
      for (const stepTracking of readySteps) {
        try {
          console.log(`Processing step delivery for tracking ID: ${stepTracking.id}`)
          
          // Mark step as delivering to avoid duplicate processing
          const { error: markingError } = await supabase
            .from('step_delivery_tracking')
            .update({ status: 'delivering' })
            .eq('id', stepTracking.id)

          if (markingError) {
            console.error('Error marking step as delivering:', markingError)
            errorCount++
            continue
          }

          // Deliver the step messages
          await deliverStepMessages(supabase, stepTracking)
          deliveredCount++

        } catch (error) {
          console.error(`Error processing step ${stepTracking.id}:`, error)
          errorCount++
          
          // Reset status to ready for retry later
          await supabase
            .from('step_delivery_tracking')
            .update({ status: 'ready' })
            .eq('id', stepTracking.id)
        }
      }
    }

    const result = {
      message: 'Scheduled delivery check completed',
      delivered: deliveredCount,
      errors: errorCount,
      total_checked: readySteps?.length || 0,
      timestamp: new Date().toISOString()
    }

    console.log('Delivery summary:', result)

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Scheduled delivery error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Deliver messages for a specific step
async function deliverStepMessages(supabase: any, stepTracking: any) {
  try {
    console.log('Delivering step messages:', stepTracking.step_id)
    
    const messages = stepTracking.steps.step_messages || []
    if (messages.length === 0) {
      console.log('No messages to deliver for this step')
      
      // Mark as delivered even without messages
      await markStepAsDelivered(supabase, stepTracking.id, stepTracking.scenario_id, stepTracking.friend_id, stepTracking.steps.step_order)
      return
    }
    
    // Sort messages by order
    const sortedMessages = messages.sort((a: any, b: any) => a.message_order - b.message_order)
    
    const lineUserId = stepTracking.line_friends.line_user_id
    const accessToken = stepTracking.line_friends.profiles.line_channel_access_token
    
    if (!accessToken) {
      console.error('LINE access token not found')
      throw new Error('LINE access token not found')
    }
    
    // Send each message
    for (const message of sortedMessages) {
      try {
        await sendLineMessage(accessToken, lineUserId, message)
        console.log('Message sent successfully:', message.id)
        
        // Add small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error('Message send error:', message.id, error)
        throw error // Re-throw to handle at step level
      }
    }
    
    // Mark step as delivered and prepare next step
    await markStepAsDelivered(supabase, stepTracking.id, stepTracking.scenario_id, stepTracking.friend_id, stepTracking.steps.step_order)
    
  } catch (error) {
    console.error('Step message delivery error:', error)
    throw error
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
        if (message.media_url) {
          if (message.media_url.match(/\.(jpg|jpeg|png|gif)$/i)) {
            lineMessage = {
              type: 'image',
              originalContentUrl: message.media_url,
              previewImageUrl: message.media_url
            }
          } else {
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
      console.error('LINE API error:', response.status, errorText)
      throw new Error(`LINE API error: ${response.status}`)
    }
    
    console.log('LINE message sent successfully')
    
  } catch (error) {
    console.error('LINE message send error:', error)
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
      console.error('Status update error:', updateError)
      throw updateError
    }
    
    console.log('Step marked as delivered:', currentStepOrder)
    
    // Find and prepare the next step
    const { data: nextSteps, error: nextError } = await supabase
      .from('step_delivery_tracking')
      .select(`
        id, 
        steps!inner(step_order),
        scheduled_delivery_at
      `)
      .eq('scenario_id', scenarioId)
      .eq('friend_id', friendId)
      .eq('status', 'waiting')
      .gt('steps.step_order', currentStepOrder)
      .order('steps.step_order')
      .limit(1)
    
    if (nextError) {
      console.error('Next step search error:', nextError)
      return
    }
    
    if (nextSteps && nextSteps.length > 0) {
      const nextStep = nextSteps[0]
      
      // Mark next step as ready only if its scheduled time has passed or is immediate
      const now = new Date()
      const scheduledTime = new Date(nextStep.scheduled_delivery_at)
      
      if (scheduledTime <= now) {
        const { error: readyError } = await supabase
          .from('step_delivery_tracking')
          .update({ status: 'ready' })
          .eq('id', nextStep.id)
        
        if (readyError) {
          console.error('Next step preparation error:', readyError)
        } else {
          console.log('Next step prepared for immediate delivery:', nextStep.steps.step_order)
        }
      } else {
        console.log(`Next step scheduled for later: ${nextStep.steps.step_order} at ${scheduledTime}`)
      }
    } else {
      console.log('All steps completed for this scenario')
    }
    
  } catch (error) {
    console.error('Step completion processing error:', error)
    throw error
  }
}