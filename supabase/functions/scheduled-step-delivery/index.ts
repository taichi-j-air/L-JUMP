import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('🕐 Scheduled step delivery function started at:', new Date().toISOString())

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get current time
    const now = new Date().toISOString()
    console.log(`⏰ Current time: ${now}`)

    // まず全てのtrackingレコードを確認
    const { data: allTracking, error: allError } = await supabase
      .from('step_delivery_tracking')
      .select('*')
      
    console.log('📊 All tracking records:', allTracking?.length || 0)
    if (allTracking) {
      console.log('📋 Status breakdown:', allTracking.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      }, {}))
    }

    // Find ready steps that need to be delivered
    const { data: stepsToDeliver, error: fetchError } = await supabase
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
      .lte('scheduled_delivery_at', now)
      .order('scheduled_delivery_at', { ascending: true })
      .limit(100)

    if (fetchError) {
      console.error('❌ Error fetching steps to deliver:', fetchError)
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📨 Found ${stepsToDeliver?.length || 0} steps ready for delivery`)

    if (stepsToDeliver) {
      for (const step of stepsToDeliver) {
        console.log(`⏳ Step ${step.step_id} scheduled for ${step.scheduled_delivery_at}`)
      }
    }

    let deliveredCount = 0
    let errorCount = 0

    if (stepsToDeliver && stepsToDeliver.length > 0) {
      // Process steps in parallel
      const deliveryPromises = stepsToDeliver.map((stepTracking) =>
        processStepDelivery(supabase, stepTracking)
          .then(() => {
            deliveredCount++
            console.log(`✅ Successfully delivered step ${stepTracking.id}`)
          })
          .catch((error) => {
            errorCount++
            console.error(`❌ Failed to deliver step ${stepTracking.id}:`, error)
          })
      )

      await Promise.allSettled(deliveryPromises)
    }

    // Schedule next check if we processed the maximum
    if (stepsToDeliver && stepsToDeliver.length === 100) {
      console.log('🔄 Scheduling next check due to max steps processed')
      EdgeRuntime.waitUntil(scheduleNextCheck(supabase, 2))
    }

    const result = {
      success: true,
      delivered: deliveredCount,
      errors: errorCount,
      totalChecked: stepsToDeliver?.length || 0,
      timestamp: now
    }

    console.log('📈 Delivery summary:', result)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('💥 Scheduled delivery error:', error)
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
        steps!inner(step_order, delivery_type),
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
      
      // If next step uses relative_to_previous delivery, recalculate its scheduled time
      if (nextStep.steps.delivery_type === 'relative_to_previous') {
        await recalculateRelativeStepTiming(supabase, nextStep.id, scenarioId, friendId, deliveredAt)
      }
      
      const now = new Date()
      // Re-fetch the potentially updated scheduled time
      const { data: updatedStep } = await supabase
        .from('step_delivery_tracking')
        .select('scheduled_delivery_at')
        .eq('id', nextStep.id)
        .single()
      
      const scheduledTime = new Date(updatedStep?.scheduled_delivery_at || nextStep.scheduled_delivery_at)
      
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

// Recalculate timing for steps that are relative to previous step
async function recalculateRelativeStepTiming(supabase: any, stepTrackingId: string, scenarioId: string, friendId: string, previousStepDeliveredAt: string) {
  try {
    console.log('Recalculating relative step timing for:', stepTrackingId)
    
    // Get step details and friend info
    const { data: stepData, error: stepError } = await supabase
      .from('step_delivery_tracking')
      .select(`
        steps!inner(
          delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds, delivery_time_of_day
        ),
        line_friends!inner(added_at)
      `)
      .eq('id', stepTrackingId)
      .single()
    
    if (stepError || !stepData) {
      console.error('Error fetching step data for recalculation:', stepError)
      return
    }
    
    const step = stepData.steps
    const friendAddedAt = stepData.line_friends.added_at
    
    // Calculate new scheduled time using the updated function
    const { data: newScheduledTime, error: calcError } = await supabase
      .rpc('calculate_scheduled_delivery_time', {
        p_friend_added_at: friendAddedAt,
        p_delivery_type: step.delivery_type,
        p_delivery_seconds: step.delivery_seconds || 0,
        p_delivery_minutes: step.delivery_minutes || 0,
        p_delivery_hours: step.delivery_hours || 0,
        p_delivery_days: step.delivery_days || 0,
        p_specific_time: null,
        p_previous_step_delivered_at: previousStepDeliveredAt,
        p_delivery_time_of_day: step.delivery_time_of_day
      })
    
    if (calcError) {
      console.error('Error calculating new scheduled time:', calcError)
      return
    }
    
    // Update the scheduled delivery time
    const { error: updateError } = await supabase
      .from('step_delivery_tracking')
      .update({
        scheduled_delivery_at: newScheduledTime,
        next_check_at: new Date(new Date(newScheduledTime).getTime() - 5000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', stepTrackingId)
    
    if (updateError) {
      console.error('Error updating scheduled time:', updateError)
    } else {
      console.log(`Updated relative step timing to: ${newScheduledTime}`)
    }
    
  } catch (error) {
    console.error('Error in recalculateRelativeStepTiming:', error)
  }
}