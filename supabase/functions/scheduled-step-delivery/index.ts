import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Utility functions from send-flex-message
function clone(value: any): any {
  return JSON.parse(JSON.stringify(value));
}

function sanitize(comp: any): any {
  if (!comp || typeof comp !== 'object') return comp;
  const c = clone(comp);
  const t = c.type;
  const disallowed: Record<string, string[]> = {
    box: ['action','url','height','style','borderColor','cornerRadius','backgroundColor'],
    button: ['height','borderColor','cornerRadius'],
    filler: ['action','url','height','style','borderColor','cornerRadius','backgroundColor'],
    icon: ['action','url','height','style','borderColor','cornerRadius','backgroundColor'],
    image: ['height','cornerRadius','backgroundColor'],
    separator: ['action','url','height','style','borderColor','cornerRadius','backgroundColor'],
    spacer: ['action','url','height','style','borderColor','cornerRadius','backgroundColor'],
    text: ['url','height','borderColor','cornerRadius','backgroundColor'],
  };
  if (t && disallowed[t]) {
    disallowed[t].forEach(k => delete c[k]);
  }
  for (const key in c) {
    if (c[key] && typeof c[key] === 'object') {
      if (Array.isArray(c[key])) {
        c[key] = c[key].map((item: any) => sanitize(item));
      } else {
        c[key] = sanitize(c[key]);
      }
    }
  }
  return c;
}

function normalize(raw: any): any {
  if (!raw) return null;
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : clone(raw);
    if (!data) return null;

    let altText = data.altText || 'Flex Message';
    let contents = data.contents;

    if (data.type === 'flex' && contents) {
      // already normalized
    } else if (data.type === 'bubble' || data.type === 'carousel') {
      contents = data;
    } else if (contents && (contents.type === 'bubble' || contents.type === 'carousel')) {
      // data is wrapper
    } else {
      return null;
    }

    return {
      type: 'flex',
      altText,
      contents: sanitize(contents)
    };
  } catch (e) {
    console.error('Failed to normalize flex message:', e);
    return null;
  }
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
    const startTime = Date.now()
    console.log(`⏰ Current time: ${now}`, { scenarioIdFilter, friendIdFilter, recentOnly, lineUserIdFilter })

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

    // Count waiting steps for dynamic batch sizing
    let countQuery = supabase
      .from('step_delivery_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting')
      .not('friend_id', 'is', null)
      .lte('scheduled_delivery_at', now)
    if (scenarioIdFilter) countQuery = countQuery.eq('scenario_id', scenarioIdFilter)
    if (friendIdFilter) countQuery = countQuery.eq('friend_id', friendIdFilter)
    if (friendIdsFilter) countQuery = countQuery.in('friend_id', friendIdsFilter)
    
    const { count: waitingCount } = await countQuery
    
    // Dynamic batch size: 100-1000 based on waiting count
    const batchSize = Math.min(1000, Math.max(100, Math.floor((waitingCount || 0) / 10)))
    console.log(`📊 Waiting steps: ${waitingCount || 0}, Batch size: ${batchSize}`)

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

    // 2) Claim ready rows for delivery with dynamic batch size
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
      .limit(batchSize)
      .select('*')

    if (fetchError) {
      console.error('❌ Error fetching steps to deliver:', fetchError)
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📨 Found ${stepsToDeliver?.length || 0} steps ready for delivery`)

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

    // Smart scheduling: only check for upcoming deliveries
    let shouldScheduleNext = false
    let nextCheckDelay = 60 // Default to 1 minute
    
    if (stepsToDeliver && stepsToDeliver.length >= batchSize) {
      // Hit batch limit, check again immediately
      shouldScheduleNext = true
      nextCheckDelay = 1
      console.log('🔄 Hit batch limit, scheduling immediate next check')
    } else {
      // Check for any waiting steps due within the next 2 minutes
      let upcomingQuery = supabase
        .from('step_delivery_tracking')
        .select('scheduled_delivery_at, friend_id, scenario_id')
        .eq('status', 'waiting')
        .not('friend_id', 'is', null)
        .lte('scheduled_delivery_at', new Date(Date.now() + 120000).toISOString())
        .order('scheduled_delivery_at', { ascending: true })
        .limit(1)
      if (scenarioIdFilter) upcomingQuery = upcomingQuery.eq('scenario_id', scenarioIdFilter)
      if (friendIdFilter) upcomingQuery = upcomingQuery.eq('friend_id', friendIdFilter)
      if (friendIdsFilter) upcomingQuery = upcomingQuery.in('friend_id', friendIdsFilter)
      
      const { data: upcoming } = await upcomingQuery
      if (upcoming && upcoming.length > 0) {
        const dueAt = new Date(upcoming[0].scheduled_delivery_at)
        const nowDate = new Date()
        const delayMs = dueAt.getTime() - nowDate.getTime()
        
        if (delayMs > 0 && delayMs <= 120000) {
          shouldScheduleNext = true
          // For precise timing: schedule exactly when needed
          nextCheckDelay = Math.max(1, Math.ceil(delayMs / 1000))
          console.log(`⏭️ Next delivery due at ${dueAt.toISOString()}, will trigger in ${nextCheckDelay}s`)
          
          // Trigger self-invocation with precise delay as background task
          const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/scheduled-step-delivery`
          const authHeader = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
          
          // Use background task to ensure execution even after response is sent
          const triggerNextCheck = async () => {
            await new Promise(resolve => setTimeout(resolve, nextCheckDelay * 1000))
            try {
              console.log(`🔔 Triggering scheduled check after ${nextCheckDelay}s delay`)
              const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${authHeader}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  scenario_id: scenarioIdFilter || upcoming[0].scenario_id,
                  friend_id: friendIdFilter || upcoming[0].friend_id,
                  trigger: 'auto_scheduled'
                })
              })
              console.log(`✅ Next check triggered, status: ${response.status}`)
            } catch (err) {
              console.error('❌ Failed to trigger next scheduled check:', err)
            }
          }
          
          // Start background task without awaiting
          EdgeRuntime.waitUntil(triggerNextCheck())
        }
      } else {
        console.log('⏹️ No upcoming deliveries within 2 minutes, skipping next check')
      }
    }

    // Calculate performance metrics
    const processingTime = Date.now() - startTime
    const successRate = deliveredCount > 0 ? (deliveredCount / (deliveredCount + errorCount) * 100).toFixed(1) : 100
    const throughput = processingTime > 0 ? ((deliveredCount / processingTime) * 1000).toFixed(2) : 0

    const result = {
      success: true,
      delivered: deliveredCount,
      errors: errorCount,
      totalChecked: stepsToDeliver?.length || 0,
      batchSize,
      waitingCount: waitingCount || 0,
      processingTimeMs: processingTime,
      successRate: `${successRate}%`,
      throughputPerSec: throughput,
      nextCheckScheduled: shouldScheduleNext,
      nextCheckDelaySeconds: shouldScheduleNext ? nextCheckDelay : null,
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
      JSON.stringify({ error: 'Internal server error', details: (error as Error)?.message || 'Unknown error' }),
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

    // Re-check current status to allow cancellation and avoid duplicates
    const { data: current } = await supabase
      .from('step_delivery_tracking')
      .select('status')
      .eq('id', stepTracking.id)
      .maybeSingle()
    if (!current || current.status !== 'delivering') {
      console.warn('Skipping processing due to status change:', current?.status)
      return
    }

    // Deliver the current step
    await deliverStepMessages(supabase, stepTracking)

    // 修正: カスケード配信ロジックを削除
    // 次のステップの配信は markStepAsDelivered で適切な時刻に設定し、
    // 次回の scheduled-step-delivery 実行時に処理されるようにする

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
    
    // Get friend's short_uid for UID parameter
    const { data: friendData } = await supabase
      .from('line_friends')
      .select('short_uid')
      .eq('id', stepTracking.friend_id)
      .single()

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
              try {
                preparedMessage = { ...preparedMessage, _flexContent: typeof flex.content === 'string' ? JSON.parse(flex.content) : flex.content }
              } catch (e) {
                console.error('Failed to parse flex_messages.content:', e)
              }
            }
          }
          if (!preparedMessage._flexContent && message.content) {
            try {
              preparedMessage = { ...preparedMessage, _flexContent: typeof message.content === 'string' ? JSON.parse(message.content) : message.content }
            } catch (e) {
              console.error('Failed to parse message.content:', e)
            }
          }
        } catch {
          console.warn('Invalid flex content JSON for message', message.id)
        }
      }

      // Process message to add UID parameters to form links
      if (message.message_type === 'text' && friendData?.short_uid) {
        preparedMessage.content = addUidToFormLinks(message.content, friendData.short_uid);
        console.log(`UID変換実行: ${message.content} -> ${preparedMessage.content}`);
      }

      // Cancellation check mid-flight
      const { data: curStatus } = await supabase
        .from('step_delivery_tracking')
        .select('status')
        .eq('id', stepTracking.id)
        .maybeSingle()
      if (!curStatus || curStatus.status === 'exited') {
        console.warn('Delivery canceled mid-flight, stopping further messages')
        return
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

// UIDパラメーター付与処理
function addUidToFormLinks(message: string, friendShortUid: string | null): string {
  console.log(`addUidToFormLinks called with: "${message}", UID: ${friendShortUid}`);
  
  if (!friendShortUid) {
    console.log('No friendShortUid provided, returning original message');
    return message;
  }
  
  // [UID]変数をshort_uidで置換（これが最優先）
  let result = message.replace(/\[UID\]/g, friendShortUid);
  console.log(`After [UID] replacement: "${result}"`);
  
  // レガシー対応：既存のformリンクのパターンも検出してuidパラメーターを付与
  // ただし、[UID]置換済みの場合は重複処理しない
  if (result === message) {
    // [UID]変数がなかった場合のみ、レガシー処理を実行
    const formLinkPattern = /(https?:\/\/[^\/]+\/form\/[a-f0-9\-]+(?:\?[^?\s]*)?)/gi;
    
    result = result.replace(formLinkPattern, (match) => {
      console.log(`Processing form link: ${match}`);
      try {
        const url = new URL(match);
        // Check if uid parameter already exists to prevent duplication
        if (!url.searchParams.has('uid')) {
          url.searchParams.set('uid', friendShortUid);
          console.log(`Added UID parameter: ${url.toString()}`);
          return url.toString();
        } else {
          console.log(`UID parameter already exists: ${match}`);
          return match;
        }
      } catch (error) {
        console.error('Error processing form URL:', error);
        return match; // Return original URL if parsing fails
      }
    });
  }
  
  console.log(`Final result: "${result}"`);
  return result;
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
        const rawContent = message._flexContent || message.content
        if (rawContent) {
          const normalized = normalize(rawContent)
          if (normalized) {
            lineMessage = normalized
          } else {
            throw new Error('Invalid flex message format')
          }
        } else {
          throw new Error('No flex content available')
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
      .select('id, step_order, delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds, delivery_time_of_day, specific_time')
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
        .select('id, step_order, delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds, delivery_time_of_day, specific_time')
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

      // delivery_typeのマッピング（遷移先の最初のステップ）
      let effectiveType = (firstStep as any).delivery_type as string
      console.log(`Transition first step original delivery_type: ${effectiveType}`)
      if (effectiveType === 'immediate') effectiveType = 'immediately'
      else if (effectiveType === 'specific') effectiveType = 'specific_time'
      else if (effectiveType === 'time_of_day') effectiveType = 'time_of_day'
      else if (effectiveType === 'relative') {
        // 遷移先の最初のステップは常に登録時刻からの相対時間として扱う
        effectiveType = 'relative'
      }
      console.log(`Transition first step mapped delivery_type: ${effectiveType}`)

      // 次回配信時刻を算出
      let scheduledIso: string | null = null
      try {
        const rpcParams = {
          p_friend_added_at: deliveredAt, // 遷移時の登録時刻 = 直前の配信完了時刻
          p_delivery_type: effectiveType,
          p_delivery_seconds: (firstStep as any).delivery_seconds || 0,
          p_delivery_minutes: (firstStep as any).delivery_minutes || 0,
          p_delivery_hours: (firstStep as any).delivery_hours || 0,
          p_delivery_days: (firstStep as any).delivery_days || 0,
          p_specific_time: (firstStep as any).specific_time || null,
          p_previous_step_delivered_at: deliveredAt,
          p_delivery_time_of_day: (firstStep as any).delivery_time_of_day || null,
        }
        console.log('Calculating transition schedule with params:', JSON.stringify(rpcParams))
        const { data: sched, error: schedErr } = await supabase.rpc('calculate_scheduled_delivery_time', rpcParams)
        if (schedErr) {
          console.error('Schedule calculation error:', schedErr)
        } else if (sched) {
          scheduledIso = new Date(sched).toISOString()
          console.log(`Transition scheduled time calculated: ${scheduledIso}`)
        }
      } catch (err) {
        console.error('Schedule calculation exception:', err)
      }

      const now = new Date()
      const scheduled = scheduledIso ? new Date(scheduledIso) : new Date(now.getTime() + 30000) // デフォルトは30秒後
      console.log(`Transition scheduled time: ${scheduled.toISOString()}, now: ${now.toISOString()}`)

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
            status: 'waiting',
            scheduled_delivery_at: scheduled.toISOString(),
            next_check_at: new Date(scheduled.getTime() - 5000).toISOString(),
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
      } else {
        await supabase
          .from('step_delivery_tracking')
          .update({
            status: 'waiting',
            scheduled_delivery_at: scheduled.toISOString(),
            next_check_at: new Date(scheduled.getTime() - 5000).toISOString(),
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
        console.warn('Failed to fetch friend for scheduling, using default timing', friendErr)
        // 失敗した場合は30秒後に配信
        const defaultScheduled = new Date(Date.now() + 30000)
        updates.status = 'waiting'
        updates.scheduled_delivery_at = defaultScheduled.toISOString()
        updates.next_check_at = new Date(defaultScheduled.getTime() - 5000).toISOString()
      } else {
        // Map UI delivery_type to DB function expected values
        let effectiveType = nextStep.delivery_type as string
        console.log(`Next step (order ${currentStepOrder + 1}) original delivery_type: ${effectiveType}`)
        
        if (effectiveType === 'immediate') {
          effectiveType = 'immediately'
        } else if (effectiveType === 'specific') {
          effectiveType = 'specific_time'
        } else if (effectiveType === 'time_of_day') {
          effectiveType = 'time_of_day'
        } else if (effectiveType === 'relative') {
          // 2番目以降のステップはrelative_to_previousとして扱う
          const nextStepOrder = (nextStep as any).step_order || (currentStepOrder + 1)
          if (nextStepOrder > 0) {
            effectiveType = 'relative_to_previous'
          }
        }
        console.log(`Next step mapped delivery_type: ${effectiveType}`)

        // シナリオ登録時刻（この友だちがこのシナリオに登録された時刻 = 最初のトラッキング作成時刻）
        const { data: regBase } = await supabase
          .from('step_delivery_tracking')
          .select('created_at')
          .eq('scenario_id', scenarioId)
          .eq('friend_id', friendId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        const baseTime = regBase?.created_at || deliveredAt

        const rpcParams = {
          p_friend_added_at: baseTime,
          p_delivery_type: effectiveType,
          p_delivery_seconds: nextStep.delivery_seconds || 0,
          p_delivery_minutes: nextStep.delivery_minutes || 0,
          p_delivery_hours: nextStep.delivery_hours || 0,
          p_delivery_days: nextStep.delivery_days || 0,
          p_specific_time: nextStep.specific_time || null,
          p_previous_step_delivered_at: deliveredAt,
          p_delivery_time_of_day: nextStep.delivery_time_of_day || null
        }
        console.log(`Calculating next step schedule with params:`, JSON.stringify(rpcParams))
        
        const { data: newScheduledTime, error: calcError } = await supabase.rpc('calculate_scheduled_delivery_time', rpcParams)

        if (calcError) {
          console.error('Failed to calculate next scheduled time:', calcError)
          // 失敗した場合は30秒後に配信
          const defaultScheduled = new Date(Date.now() + 30000)
          updates.status = 'waiting'
          updates.scheduled_delivery_at = defaultScheduled.toISOString()
          updates.next_check_at = new Date(defaultScheduled.getTime() - 5000).toISOString()
        } else if (!newScheduledTime) {
          console.warn('No scheduled time returned from RPC, using default timing')
          // 失敗した場合は30秒後に配信
          const defaultScheduled = new Date(Date.now() + 30000)
          updates.status = 'waiting'
          updates.scheduled_delivery_at = defaultScheduled.toISOString()
          updates.next_check_at = new Date(defaultScheduled.getTime() - 5000).toISOString()
        } else {
          const scheduled = new Date(newScheduledTime)
          const now = new Date()
          console.log(`✓ Next step scheduled for: ${scheduled.toISOString()}, current time: ${now.toISOString()}, diff: ${Math.round((scheduled.getTime() - now.getTime()) / 1000)}s`)

          if (scheduled <= now) {
            // If the calculated time is in the past or now, set to ready for immediate delivery
            updates.status = 'ready'
            updates.scheduled_delivery_at = now.toISOString() 
            updates.next_check_at = now.toISOString()
            console.log('→ Status set to READY (scheduled time is now or in the past)')
          } else {
            // If the calculated time is in the future, set to waiting
            updates.status = 'waiting'
            updates.scheduled_delivery_at = scheduled.toISOString()
            updates.next_check_at = new Date(scheduled.getTime() - 5000).toISOString()
            console.log('→ Status set to WAITING (scheduled for future)')
          }
        }
      }
    } catch (calcCatch) {
      console.warn('Scheduling calculation error, using default timing', calcCatch)
      // 失敗した場合は30秒後に配信
      const defaultScheduled = new Date(Date.now() + 30000)
      updates.status = 'waiting'
      updates.scheduled_delivery_at = defaultScheduled.toISOString()
      updates.next_check_at = new Date(defaultScheduled.getTime() - 5000).toISOString()
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