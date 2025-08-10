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

    // Parse optional filters from request body (non-fatal)
    let body: any = {}
    try {
      if (req.method === 'POST') {
        body = await req.json().catch(() => ({}))
      }
    } catch (_) {
      body = {}
    }

    // Allow scoping by scenario or friend, or process only recent updates for login-trigger
    const scenarioIdFilter = body?.scenario_id ?? null
    const friendIdFilter = body?.friend_id ?? null
    const lineUserIdFilter = body?.line_user_id ?? null
    const recentOnly = body?.trigger === 'login_success'

    // Get current time
    const now = new Date().toISOString()
    console.log(`⏰ Current time: ${now}`, { scenarioIdFilter, friendIdFilter, recentOnly, lineUserIdFilter })

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

    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    // Optionally resolve friend IDs from line_user_id once to reuse
    let friendIdsFilter: string[] | null = null
    if (lineUserIdFilter) {
      const { data: friendRows } = await supabase
        .from('line_friends')
        .select('id')
        .eq('line_user_id', lineUserIdFilter)
      if (friendRows && friendRows.length > 0) {
        friendIdsFilter = friendRows.map((f: any) => f.id)
      } else {
        console.log('No friend found for provided line_user_id, nothing to process')
      }
    }

    // 1) Flip waiting -> ready where scheduled time has arrived
    let waitingToReady = supabase
      .from('step_delivery_tracking')
      .update({ status: 'ready', updated_at: now })
      .eq('status', 'waiting')
      .not('friend_id', 'is', null)
      .lte('scheduled_delivery_at', now)
    if (recentOnly) waitingToReady = waitingToReady.gte('updated_at', cutoff)
    if (scenarioIdFilter) waitingToReady = waitingToReady.eq('scenario_id', scenarioIdFilter)
    if (friendIdFilter) waitingToReady = waitingToReady.eq('friend_id', friendIdFilter)
    if (friendIdsFilter) waitingToReady = waitingToReady.in('friend_id', friendIdsFilter)
    await waitingToReady.select('id')

    // 2) Claim ready rows for delivery
    let query = supabase
      .from('step_delivery_tracking')
      .update({ status: 'delivering', updated_at: now })
      .eq('status', 'ready')
      .not('friend_id', 'is', null)
      .lte('scheduled_delivery_at', now)

    if (recentOnly) {
      query = query.gte('updated_at', cutoff)
    }
    if (scenarioIdFilter) {
      query = query.eq('scenario_id', scenarioIdFilter)
    }
    if (friendIdFilter) {
      query = query.eq('friend_id', friendIdFilter)
    }
    if (friendIdsFilter) {
      query = query.in('friend_id', friendIdsFilter)
    }

    const { data: stepsToDeliver, error: fetchError } = await query
      .order('scheduled_delivery_at', { ascending: true })
      .limit(100)
      .select('*')

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

    // Schedule next check if we processed the maximum, or if a waiting step is due soon
    if (stepsToDeliver && stepsToDeliver.length === 100) {
      console.log('🔄 Scheduling next check due to max steps processed')
      EdgeRuntime.waitUntil(scheduleNextCheck(supabase, 2))
    } else {
      // Check for any waiting steps due within the next 60 seconds
      let upcomingQuery = supabase
        .from('step_delivery_tracking')
        .select('scheduled_delivery_at')
        .eq('status', 'waiting')
        .not('friend_id', 'is', null)
        .lte('scheduled_delivery_at', new Date(Date.now() + 60000).toISOString())
        .order('scheduled_delivery_at', { ascending: true })
        .limit(1)
      if (scenarioIdFilter) upcomingQuery = upcomingQuery.eq('scenario_id', scenarioIdFilter)
      if (friendIdFilter) upcomingQuery = upcomingQuery.eq('friend_id', friendIdFilter)
      if (friendIdsFilter) upcomingQuery = upcomingQuery.in('friend_id', friendIdsFilter)
      const { data: upcoming } = await upcomingQuery
      if (upcoming && upcoming.length > 0) {
        const dueAt = new Date(upcoming[0].scheduled_delivery_at)
        const delay = Math.max(1, Math.min(55, Math.ceil((dueAt.getTime() - Date.now()) / 1000) + 1))
        console.log(`⏭️ Scheduling next check in ${delay}s for upcoming delivery at ${dueAt.toISOString()}`)
        EdgeRuntime.waitUntil(scheduleNextCheck(supabase, delay))
      }
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

    // Guard: invalid tracking without friend
    if (!stepTracking.friend_id) {
      await supabase
        .from('step_delivery_tracking')
        .update({ status: 'failed', last_error: 'Missing friend_id', updated_at: new Date().toISOString() })
        .eq('id', stepTracking.id)
      console.warn('Skipped tracking without friend_id:', stepTracking.id)
      return
    }

    // Deliver the current step
    await deliverStepMessages(supabase, stepTracking)

    // After completion, attempt to cascade deliver subsequent immediate steps for the same friend/scenario
    let guard = 0
    const nowIso = () => new Date().toISOString()
    while (guard < 5) { // hard cap to avoid infinite loops
      guard++
      const { data: nextReady, error: nextErr } = await supabase
        .from('step_delivery_tracking')
        .select('*')
        .eq('scenario_id', stepTracking.scenario_id)
        .eq('friend_id', stepTracking.friend_id)
        .eq('status', 'ready')
        .lte('scheduled_delivery_at', nowIso())
        .order('scheduled_delivery_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (nextErr || !nextReady) break

      // claim
      const { data: claimed, error: claimErr } = await supabase
        .from('step_delivery_tracking')
        .update({ status: 'delivering', updated_at: nowIso() })
        .eq('id', nextReady.id)
        .select('*')
        .maybeSingle()
      if (claimErr || !claimed) break

      await deliverStepMessages(supabase, claimed)
    }
  } catch (error) {
    console.error(`Error processing step ${stepTracking.id}:`, error)

    const errMsg = (error && (error as any).message) ? String((error as any).message) : ''
    if (!stepTracking.friend_id || errMsg.includes('Friend not found')) {
      await supabase
        .from('step_delivery_tracking')
        .update({ status: 'failed', last_error: errMsg || 'Friend not found', updated_at: new Date().toISOString() })
        .eq('id', stepTracking.id)
    } else {
      // Reset status to ready for retry later (with backoff)
      const retryTime = new Date(Date.now() + 30000)
      await supabase
        .from('step_delivery_tracking')
        .update({ 
          status: 'ready',
          scheduled_delivery_at: retryTime.toISOString(),
          next_check_at: new Date(retryTime.getTime() - 5000).toISOString()
        })
        .eq('id', stepTracking.id)
    }

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

      // Validate and prepare flex content when applicable
      let preparedMessage: any = { ...message }
      if (message.message_type === 'flex') {
        try {
          // Prefer referenced flex_messages.content when available
          if (message.flex_message_id) {
            const { data: flex, error: flexErr } = await supabase
              .from('flex_messages')
              .select('content')
              .eq('id', message.flex_message_id)
              .maybeSingle()
            if (!flexErr && flex?.content) {
              preparedMessage = { ...preparedMessage, _flexContent: flex.content }
            }
          }
          if (!preparedMessage._flexContent && message.content && typeof message.content === 'string') {
            preparedMessage = { ...preparedMessage, _flexContent: JSON.parse(message.content) }
          }
        } catch {
          console.warn('Invalid flex content JSON for message', message.id)
        }
      }

      try {
        await sendLineMessage(accessToken, lineUserId, preparedMessage)
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
        
      case 'flex': {
        let altText = message.alt_text || 'フレックスメッセージ'
        let flexPayload: any = message._flexContent || (message.content ? JSON.parse(message.content) : {})
        // If saved as full LINE message { type: 'flex', altText, contents }, unwrap
        if (flexPayload && typeof flexPayload === 'object' && flexPayload.type === 'flex') {
          if (flexPayload.altText) altText = flexPayload.altText
          if (flexPayload.contents) flexPayload = flexPayload.contents
        }
        lineMessage = {
          type: 'flex',
          altText,
          contents: flexPayload || {}
        }
        break
      }

        
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
      .select('id, delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds, delivery_time_of_day, specific_time, delivery_relative_to_previous')
      .eq('scenario_id', scenarioId)
      .eq('step_order', currentStepOrder + 1)
      .maybeSingle()
    
    if (nextStepErr) {
      console.error('Next step fetch error:', nextStepErr)
      return
    }

    if (!nextStep) {
      console.log('All steps completed for this scenario')
      // シナリオ遷移設定がある場合は遷移
      const { data: transition, error: transErr } = await supabase
        .from('scenario_transitions')
        .select('to_scenario_id')
        .eq('from_scenario_id', scenarioId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (transErr) {
        console.warn('Transition fetch error:', transErr)
        return
      }
      if (!transition?.to_scenario_id) {
        return
      }

      // 現在のシナリオは離脱扱いにする
      await supabase
        .from('step_delivery_tracking')
        .update({ status: 'exited', updated_at: new Date().toISOString() })
        .eq('scenario_id', scenarioId)
        .eq('friend_id', friendId)
        .neq('status', 'exited')

      // 遷移先の最初のステップ詳細を取得
      const { data: firstStep, error: firstErr } = await supabase
        .from('steps')
        .select('id, delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds, delivery_time_of_day, specific_time, delivery_relative_to_previous')
        .eq('scenario_id', transition.to_scenario_id)
        .order('step_order', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (firstErr || !firstStep) {
        console.warn('No first step for transition scenario:', transition.to_scenario_id, firstErr)
        return
      }

      // 友だちの登録時刻
      const { data: friendRow } = await supabase
        .from('line_friends')
        .select('added_at')
        .eq('id', friendId)
        .maybeSingle()

      // delivery_typeのマッピング
      let effectiveType = (firstStep as any).delivery_type as string
      if (effectiveType === 'immediate') effectiveType = 'immediately'
      if (effectiveType === 'specific') effectiveType = 'specific_time'
      if (effectiveType === 'time_of_day') effectiveType = 'relative_to_previous'
      if (effectiveType === 'relative' && (firstStep as any).delivery_relative_to_previous) effectiveType = 'relative_to_previous'

      // 次回配信時刻を算出
      let scheduledIso: string | null = null
      try {
        const { data: sched } = await supabase.rpc('calculate_scheduled_delivery_time', {
          p_friend_added_at: friendRow?.added_at || null,
          p_delivery_type: effectiveType,
          p_delivery_seconds: (firstStep as any).delivery_seconds || 0,
          p_delivery_minutes: (firstStep as any).delivery_minutes || 0,
          p_delivery_hours: (firstStep as any).delivery_hours || 0,
          p_delivery_days: (firstStep as any).delivery_days || 0,
          p_specific_time: (firstStep as any).specific_time || null,
          p_previous_step_delivered_at: deliveredAt,
          p_delivery_time_of_day: (firstStep as any).delivery_time_of_day || null,
        })
        if (sched) scheduledIso = new Date(sched).toISOString()
      } catch (_) {}

      const now = new Date()
      const scheduled = scheduledIso ? new Date(scheduledIso) : now
      const isReady = scheduled <= now

      // 既存があれば更新、なければ作成
      const { data: existing, error: exErr } = await supabase
        .from('step_delivery_tracking')
        .select('id')
        .eq('scenario_id', transition.to_scenario_id)
        .eq('friend_id', friendId)
        .eq('step_id', firstStep.id)
        .maybeSingle()
      if (exErr) {
        console.warn('Transition existing check error:', exErr)
      }
      if (!existing) {
        await supabase
          .from('step_delivery_tracking')
          .insert({
            scenario_id: transition.to_scenario_id,
            step_id: firstStep.id,
            friend_id: friendId,
            status: isReady ? 'ready' : 'waiting',
            scheduled_delivery_at: (isReady ? now : scheduled).toISOString(),
            next_check_at: new Date((isReady ? now : scheduled).getTime() - 5000).toISOString(),
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
      } else {
        await supabase
          .from('step_delivery_tracking')
          .update({
            status: isReady ? 'ready' : 'waiting',
            scheduled_delivery_at: (isReady ? now : scheduled).toISOString(),
            next_check_at: new Date((isReady ? now : scheduled).getTime() - 5000).toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', existing.id)
      }
      return
    }

    // Find or create tracking row for next step
    const { data: nextTracking } = await supabase
      .from('step_delivery_tracking')
      .select('id')
      .eq('scenario_id', scenarioId)
      .eq('friend_id', friendId)
      .eq('step_id', nextStep.id)
      .maybeSingle()

    let nextId = nextTracking?.id as string | undefined
    if (!nextId) {
      console.log('No tracking row for next step, creating one')
      const { data: prevTracking } = await supabase
        .from('step_delivery_tracking')
        .select('campaign_id, registration_source')
        .eq('id', trackingId)
        .maybeSingle()
      const baseNow = new Date().toISOString()
      const { data: inserted, error: insErr } = await supabase
        .from('step_delivery_tracking')
        .insert({
          scenario_id: scenarioId,
          step_id: nextStep.id,
          friend_id: friendId,
          status: 'waiting',
          campaign_id: prevTracking?.campaign_id || null,
          registration_source: prevTracking?.registration_source || null,
          created_at: baseNow,
          updated_at: baseNow,
        })
        .select('id')
        .maybeSingle()
      if (insErr || !inserted) {
        console.error('Failed to create next tracking row:', insErr)
        const { data: existing } = await supabase
          .from('step_delivery_tracking')
          .select('id')
          .eq('scenario_id', scenarioId)
          .eq('friend_id', friendId)
          .eq('step_id', nextStep.id)
          .maybeSingle()
        nextId = existing?.id
      } else {
        nextId = inserted.id
      }
    }

    // Calculate precise scheduled time for the next step using DB function
    let updates: any = { updated_at: new Date().toISOString() }

    try {
      // Fetch base friend info for calculation
      const { data: friend, error: friendErr } = await supabase
        .from('line_friends')
        .select('added_at')
        .eq('id', friendId)
        .maybeSingle()

      if (friendErr) {
        console.warn('Failed to fetch friend for scheduling, defaulting to ready', friendErr)
        const now = new Date()
        updates.status = 'ready'
        updates.scheduled_delivery_at = now.toISOString()
        updates.next_check_at = new Date(now.getTime() - 5000).toISOString()
      } else {
        // Map UI delivery_type to DB function expected values
        let effectiveType = nextStep.delivery_type as string
        if (effectiveType === 'immediate') effectiveType = 'immediately'
        if (effectiveType === 'specific') effectiveType = 'specific_time'
        if (effectiveType === 'time_of_day') effectiveType = 'relative_to_previous'
        if (effectiveType === 'relative' && (nextStep as any).delivery_relative_to_previous) effectiveType = 'relative_to_previous'

        const { data: newScheduledTime, error: calcError } = await supabase.rpc('calculate_scheduled_delivery_time', {
          p_friend_added_at: friend?.added_at || null,
          p_delivery_type: effectiveType,
          p_delivery_seconds: nextStep.delivery_seconds || 0,
          p_delivery_minutes: nextStep.delivery_minutes || 0,
          p_delivery_hours: nextStep.delivery_hours || 0,
          p_delivery_days: nextStep.delivery_days || 0,
          p_specific_time: nextStep.specific_time || null,
          p_previous_step_delivered_at: deliveredAt,
          p_delivery_time_of_day: nextStep.delivery_time_of_day || null
        })

        if (!calcError && newScheduledTime) {
          const scheduled = new Date(newScheduledTime)
          const now = new Date()
          if (scheduled <= now) {
            updates.status = 'ready'
            updates.scheduled_delivery_at = now.toISOString()
            updates.next_check_at = new Date(now.getTime() - 5000).toISOString()
          } else {
            updates.status = 'waiting'
            updates.scheduled_delivery_at = scheduled.toISOString()
            updates.next_check_at = new Date(scheduled.getTime() - 5000).toISOString()
          }
        } else {
          console.warn('Failed to calculate next scheduled time, defaulting to ready', calcError)
          const now = new Date()
          updates.status = 'ready'
          updates.scheduled_delivery_at = now.toISOString()
          updates.next_check_at = new Date(now.getTime() - 5000).toISOString()
        }
      }
    } catch (calcCatch) {
      console.warn('Scheduling calculation error, defaulting to ready', calcCatch)
      const now = new Date()
      updates.status = 'ready'
      updates.scheduled_delivery_at = now.toISOString()
      updates.next_check_at = new Date(now.getTime() - 5000).toISOString()
    }

    const { error: prepErr } = await supabase
      .from('step_delivery_tracking')
      .update(updates)
      .eq('id', nextId as string)

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