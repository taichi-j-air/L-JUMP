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
      .select('*')
      .eq('status', 'ready')
      .or(`scheduled_delivery_at.is.null,scheduled_delivery_at.lte.${now}`)
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
        console.log(`⏳ Step tracking ${step.id} (step_id: ${step.step_id}) scheduled for ${step.scheduled_delivery_at}`)
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
    console.log('Delivering step messages (tracking):', stepTracking.step_id)
    
    // Fetch step info
    const { data: step, error: stepErr } = await supabase
      .from('steps')
      .select('id, step_order, delivery_type, delivery_seconds, delivery_minutes, delivery_hours, delivery_days, delivery_time_of_day')
      .eq('id', stepTracking.step_id)
      .maybeSingle()

    if (stepErr || !step) {
      console.error('No step found for tracking', stepTracking.step_id, stepErr)
      // Mark delivered to avoid infinite loop
      await supabase
        .from('step_delivery_tracking')
        .update({ 
          status: 'delivered', 
          delivered_at: new Date().toISOString(), 
          updated_at: new Date().toISOString(),
          last_error: 'Step not found'
        })
        .eq('id', stepTracking.id)
      return
    }

    // Fetch messages for step
    const { data: messages, error: msgErr } = await supabase
      .from('step_messages')
      .select('id, content, message_type, media_url, message_order, flex_message_id')
      .eq('step_id', step.id)
      .order('message_order', { ascending: true })

    if (msgErr) {
      console.error('Error fetching step messages:', msgErr)
      throw msgErr
    }

    // Fetch friend info
    const { data: friend, error: friendErr } = await supabase
      .from('line_friends')
      .select('line_user_id, user_id, added_at')
      .eq('id', stepTracking.friend_id)
      .maybeSingle()

    if (friendErr || !friend) {
      console.error('Friend not found for tracking', stepTracking.friend_id, friendErr)
      throw friendErr || new Error('Friend not found')
    }

    // Fetch profile to get access token
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('line_channel_access_token')
      .eq('user_id', friend.user_id)
      .maybeSingle()

    if (profErr || !profile?.line_channel_access_token) {
      console.error('LINE access token not found for user:', friend.user_id, profErr)
      throw profErr || new Error('LINE access token not found')
    }

    const accessToken = profile.line_channel_access_token
    const lineUserId = friend.line_user_id

    if (!messages || messages.length === 0) {
      console.log('No messages to deliver for this step')
      await markStepAsDelivered(supabase, stepTracking.id, stepTracking.scenario_id, stepTracking.friend_id, step.step_order)
      return
    }
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]

      // Validate flex content JSON when applicable
      if (message.message_type === 'flex') {
        try {
          if (message.content && typeof message.content === 'string') {
            JSON.parse(message.content)
          }
        } catch {
          console.warn('Invalid flex content JSON for message', message.id)
        }
      }

      try {
        await sendLineMessage(accessToken, lineUserId, message)
        console.log('Message sent successfully:', message.id)
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      } catch (error) {
        console.error('Message send error:', message.id, error)
        throw error
      }
    }

    await markStepAsDelivered(supabase, stepTracking.id, stepTracking.scenario_id, stepTracking.friend_id, step.step_order)

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
    
    // Fetch next step (currentStepOrder + 1)
    const { data: nextStep, error: nextStepErr } = await supabase
      .from('steps')
      .select('id, delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds, delivery_time_of_day')
      .eq('scenario_id', scenarioId)
      .eq('step_order', currentStepOrder + 1)
      .maybeSingle()
    
    if (nextStepErr) {
      console.error('Next step fetch error:', nextStepErr)
      return
    }

    if (!nextStep) {
      console.log('All steps completed for this scenario')
      return
    }

    // Find tracking row for next step
    const { data: nextTracking, error: nextTrackErr } = await supabase
      .from('step_delivery_tracking')
      .select('id')
      .eq('scenario_id', scenarioId)
      .eq('friend_id', friendId)
      .eq('step_id', nextStep.id)
      .eq('status', 'waiting')
      .maybeSingle()

    if (nextTrackErr || !nextTracking) {
      console.log('No waiting tracking row for next step')
      return
    }

    let updates: any = { updated_at: new Date().toISOString() }

    if (nextStep.delivery_type === 'relative_to_previous') {
      // Fetch friend added_at for scheduling base
      const { data: friend, error: friendErr } = await supabase
        .from('line_friends')
        .select('added_at')
        .eq('id', friendId)
        .maybeSingle()

      if (!friendErr) {
        const { data: newScheduledTime, error: calcError } = await supabase.rpc('calculate_scheduled_delivery_time', {
          p_friend_added_at: friend?.added_at,
          p_delivery_type: nextStep.delivery_type,
          p_delivery_seconds: nextStep.delivery_seconds || 0,
          p_delivery_minutes: nextStep.delivery_minutes || 0,
          p_delivery_hours: nextStep.delivery_hours || 0,
          p_delivery_days: nextStep.delivery_days || 0,
          p_specific_time: null,
          p_previous_step_delivered_at: deliveredAt,
          p_delivery_time_of_day: nextStep.delivery_time_of_day
        })

        if (!calcError && newScheduledTime) {
          const scheduled = new Date(newScheduledTime)
          const now = new Date()
          if (scheduled <= now) {
            updates.status = 'ready'
          } else {
            updates.status = 'waiting'
            updates.scheduled_delivery_at = scheduled.toISOString()
            updates.next_check_at = new Date(scheduled.getTime() - 5000).toISOString()
          }
        } else {
          console.warn('Failed to calculate next scheduled time, defaulting to ready', calcError)
          updates.status = 'ready'
        }
      } else {
        console.warn('Failed to fetch friend for scheduling, defaulting to ready', friendErr)
        updates.status = 'ready'
      }
    } else {
      updates.status = 'ready'
    }

    const { error: prepErr } = await supabase
      .from('step_delivery_tracking')
      .update(updates)
      .eq('id', nextTracking.id)

    if (prepErr) {
      console.error('Next step preparation error:', prepErr)
    } else {
      console.log('Next step prepared:', currentStepOrder + 1, updates)
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