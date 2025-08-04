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
    const body = await req.json().catch(() => ({}))
    const { offset = 0 } = body
    
    console.log('High-frequency step delivery checker started with offset:', offset)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date()
    const checkTime = new Date(now.getTime() + (offset * 1000)) // Add offset for staggered checks

    // Find steps that are ready for delivery with high precision
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
      .lte('scheduled_delivery_at', now.toISOString())
      .order('scheduled_delivery_at', { ascending: true })
      .limit(100) // Process up to 100 steps at a time for better performance

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
    const deliveryPromises: Promise<void>[] = []

    if (readySteps && readySteps.length > 0) {
      // Process steps in parallel for better performance
      for (const stepTracking of readySteps) {
        deliveryPromises.push(
          processStepDelivery(supabase, stepTracking)
            .then(() => {
              deliveredCount++
              console.log(`Successfully delivered step ${stepTracking.id}`)
            })
            .catch((error) => {
              errorCount++
              console.error(`Failed to deliver step ${stepTracking.id}:`, error)
            })
        )
      }

      // Wait for all deliveries to complete
      await Promise.allSettled(deliveryPromises)
    }

    // Schedule next check cycle if there are more steps to process
    if (readySteps && readySteps.length === 100) {
      // If we processed the maximum, there might be more - trigger another check
      EdgeRuntime.waitUntil(
        scheduleNextCheck(supabase, 5) // Check again in 5 seconds
      )
    }

    const result = {
      message: 'High-frequency delivery check completed',
      delivered: deliveredCount,
      errors: errorCount,
      total_checked: readySteps?.length || 0,
      timestamp: now.toISOString(),
      offset: offset
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

// Process a single step delivery
async function processStepDelivery(supabase: any, stepTracking: any): Promise<void> {
  try {
    console.log(`Processing step delivery for tracking ID: ${stepTracking.id}`)
    
    // Mark step as delivering to avoid duplicate processing
    const { error: markingError } = await supabase
      .from('step_delivery_tracking')
      .update({ 
        status: 'delivering',
        updated_at: new Date().toISOString()
      })
      .eq('id', stepTracking.id)
      .eq('status', 'ready') // Only update if still ready (prevents race conditions)

    if (markingError) {
      console.error('Error marking step as delivering:', markingError)
      throw markingError
    }

    // Deliver the step messages
    await deliverStepMessages(supabase, stepTracking)

  } catch (error) {
    console.error(`Error processing step ${stepTracking.id}:`, error)
    
    // Reset status to ready for retry later (with exponential backoff)
    const retryTime = new Date(Date.now() + 30000) // Retry in 30 seconds
    await supabase
      .from('step_delivery_tracking')
      .update({ 
        status: 'ready',
        scheduled_delivery_at: retryTime.toISOString(),
        next_check_at: new Date(retryTime.getTime() - 5000).toISOString()
      })
      .eq('id', stepTracking.id)
    
    throw error
  }
}

// Schedule next check for continuous processing
async function scheduleNextCheck(supabase: any, delaySeconds: number): Promise<void> {
  try {
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
    
    const response = await fetch('https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/scheduled-step-delivery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({ source: 'self-trigger' })
    })
    
    if (!response.ok) {
      console.error('Failed to trigger next check:', response.status)
    }
  } catch (error) {
    console.error('Error scheduling next check:', error)
  }
}

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
    
    // Send messages with minimal delay for better timing
    for (let i = 0; i < sortedMessages.length; i++) {
      const message = sortedMessages[i]
      try {
        await sendLineMessage(accessToken, lineUserId, message)
        console.log('Message sent successfully:', message.id)
        
        // Only add delay between multiple messages, not after the last one
        if (i < sortedMessages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300)) // Reduced to 300ms
        }
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

// Mark step as delivered and prepare the next step with precise timing
async function markStepAsDelivered(supabase: any, trackingId: string, scenarioId: string, friendId: string, currentStepOrder: number) {
  try {
    const deliveredAt = new Date().toISOString()
    
    // Mark current step as delivered
    const { error: updateError } = await supabase
      .from('step_delivery_tracking')
      .update({
        status: 'delivered',
        delivered_at: deliveredAt,
        updated_at: deliveredAt
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
      const now = new Date()
      const scheduledTime = new Date(nextStep.scheduled_delivery_at)
      
      // Mark next step as ready if its time has come, or update timing
      if (scheduledTime <= now) {
        const { error: readyError } = await supabase
          .from('step_delivery_tracking')
          .update({ 
            status: 'ready',
            updated_at: now.toISOString()
          })
          .eq('id', nextStep.id)
        
        if (readyError) {
          console.error('Next step preparation error:', readyError)
        } else {
          console.log('Next step prepared for immediate delivery:', nextStep.steps.step_order)
        }
      } else {
        console.log(`Next step scheduled for: ${nextStep.steps.step_order} at ${scheduledTime}`)
      }
    } else {
      console.log('All steps completed for this scenario')
    }
    
  } catch (error) {
    console.error('Step completion processing error:', error)
    throw error
  }
}