import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== ENHANCED STEP DELIVERY START ===");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method === 'POST') {
      const { action, data } = await req.json();

      switch (action) {
        case 'process_ready_steps':
          return await processReadySteps(supabase);
        
        case 'register_scenario_friend':
          return await registerScenarioFriend(supabase, data);
        
        case 'trigger_scenario_delivery':
          return await triggerScenarioDelivery(supabase, data);
        
        case 'get_delivery_stats':
          return await getDeliveryStats(supabase, data);
        
        case 'apply_transition_to_completed':
          return await applyTransitionToCompleted(supabase, data);
        
        default:
          throw new Error('Invalid action');
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enhanced step delivery error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Process ready steps for delivery
async function processReadySteps(supabase: any) {
  console.log("Processing ready steps...");

  // Get all ready steps
  const { data: readySteps, error: stepError } = await supabase
    .from('step_delivery_tracking')
    .select(`
      *,
      steps!inner (
        name,
        step_order,
        scenario_id
      ),
      line_friends!inner (
        line_user_id,
        display_name,
        user_id
      ),
      step_scenarios!inner (
        name,
        user_id,
        profiles!inner (
          line_channel_access_token
        )
      )
    `)
    .eq('status', 'ready')
    .lte('scheduled_delivery_at', new Date().toISOString());

  if (stepError) {
    throw new Error(`Failed to fetch ready steps: ${stepError.message}`);
  }

  console.log(`Found ${readySteps?.length || 0} ready steps`);

  let processedCount = 0;
  let errorCount = 0;

  for (const tracking of readySteps || []) {
    try {
      // Get step messages
      const { data: messages } = await supabase
        .from('step_messages')
        .select('*')
        .eq('step_id', tracking.step_id)
        .order('message_order');

      // Send messages via LINE
      const accessToken = tracking.step_scenarios.profiles.line_channel_access_token;
      
      if (!accessToken) {
        console.warn(`No access token for scenario ${tracking.step_scenarios.name}`);
        continue;
      }

      // Get friend's short_uid for UID parameter
      const { data: friendData } = await supabase
        .from('line_friends')
        .select('short_uid')
        .eq('id', tracking.friend_id)
        .single()

      for (const message of messages || []) {
        // Process message to add UID parameters to form links
        const processedMessage = { ...message };
        if (message.message_type === 'text' && friendData?.short_uid) {
          processedMessage.content = addUidToFormLinks(message.content, friendData.short_uid);
        }
        
        await sendLineMessage(
          tracking.line_friends.line_user_id,
          processedMessage,
          accessToken
        );
      }

      // Update tracking status
      await supabase
        .from('step_delivery_tracking')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', tracking.id);

      // Log delivery
      await supabase
        .from('step_delivery_logs')
        .insert({
          step_id: tracking.step_id,
          friend_id: tracking.friend_id,
          scenario_id: tracking.scenario_id,
          delivery_status: 'delivered',
          delivered_at: new Date().toISOString()
        });

      processedCount++;
      console.log(`Delivered step ${tracking.steps.step_order} to ${tracking.line_friends.display_name}`);

    } catch (error) {
      console.error(`Failed to deliver step ${tracking.id}:`, error);
      
      // Update error tracking
      await supabase
        .from('step_delivery_tracking')
        .update({
          error_count: tracking.error_count + 1,
          last_error: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', tracking.id);

      errorCount++;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed: processedCount,
      errors: errorCount,
      message: `Processed ${processedCount} steps with ${errorCount} errors`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Register friend to scenario with enhanced tracking
async function registerScenarioFriend(supabase: any, data: any) {
  const { lineUserId, scenarioName, campaignId, registrationSource, displayName, pictureUrl } = data;

  console.log(`Registering friend ${lineUserId} to scenario ${scenarioName}`);

  const { data: result, error } = await supabase.rpc('register_friend_with_scenario', {
    p_line_user_id: lineUserId,
    p_display_name: displayName,
    p_picture_url: pictureUrl,
    p_scenario_name: scenarioName,
    p_campaign_id: campaignId,
    p_registration_source: registrationSource
  });

  if (error) {
    throw new Error(`Failed to register friend: ${error.message}`);
  }

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Trigger immediate scenario delivery
async function triggerScenarioDelivery(supabase: any, data: any) {
  const { lineUserId, scenarioId } = data;

  const { data: result, error } = await supabase.rpc('trigger_scenario_delivery_for_friend', {
    p_line_user_id: lineUserId,
    p_scenario_id: scenarioId
  });

  if (error) {
    throw new Error(`Failed to trigger delivery: ${error.message}`);
  }

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get delivery statistics
async function getDeliveryStats(supabase: any, data: any) {
  const { userId, scenarioId } = data;

  // Get scenario stats
  const { data: stats, error } = await supabase
    .from('step_delivery_tracking')
    .select(`
      status,
      campaign_id,
      registration_source,
      step_scenarios!inner (
        name,
        user_id
      )
    `)
    .eq('scenario_id', scenarioId)
    .eq('step_scenarios.user_id', userId);

  if (error) {
    throw new Error(`Failed to get stats: ${error.message}`);
  }

  // Aggregate stats
  const aggregated = stats.reduce((acc: any, item: any) => {
    acc.total++;
    acc.byStatus[item.status] = (acc.byStatus[item.status] || 0) + 1;
    
    if (item.campaign_id) {
      acc.byCampaign[item.campaign_id] = (acc.byCampaign[item.campaign_id] || 0) + 1;
    }
    
    if (item.registration_source) {
      acc.bySource[item.registration_source] = (acc.bySource[item.registration_source] || 0) + 1;
    }
    
    return acc;
  }, {
    total: 0,
    byStatus: {},
    byCampaign: {},
    bySource: {}
  });

  return new Response(
    JSON.stringify({
      success: true,
      stats: aggregated
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Apply a newly-created scenario transition to friends who already completed the source scenario
async function applyTransitionToCompleted(supabase: any, data: any) {
  const { fromScenarioId, toScenarioId } = data || {}
  if (!fromScenarioId || !toScenarioId) {
    return new Response(JSON.stringify({ success: false, error: 'fromScenarioId and toScenarioId are required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  console.log('Applying transition to completed friends', { fromScenarioId, toScenarioId })

  // Load steps for both scenarios
  const [{ data: fromSteps, error: fromStepsErr }, { data: toSteps, error: toStepsErr }] = await Promise.all([
    supabase.from('steps').select('id').eq('scenario_id', fromScenarioId),
    supabase.from('steps').select('id, step_order, delivery_type, delivery_days, delivery_hours, delivery_minutes, delivery_seconds, specific_time, delivery_time_of_day').eq('scenario_id', toScenarioId).order('step_order', { ascending: true })
  ])
  if (fromStepsErr) throw new Error(`Failed to load from-steps: ${fromStepsErr.message}`)
  if (toStepsErr) throw new Error(`Failed to load to-steps: ${toStepsErr.message}`)
  const totalFromSteps = (fromSteps || []).length
  if (totalFromSteps === 0 || (toSteps || []).length === 0) {
    return new Response(JSON.stringify({ success: true, moved: 0, skipped: 0, reason: 'No steps to process' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Fetch tracking rows for the source scenario
  const { data: trackingRows, error: trErr } = await supabase
    .from('step_delivery_tracking')
    .select('friend_id, status')
    .eq('scenario_id', fromScenarioId)
  if (trErr) throw new Error(`Failed to load tracking for from-scenario: ${trErr.message}`)

  // Determine friends who completed all steps (all delivered; ignore exited here)
  const byFriend: Record<string, { delivered: number; hasWaitingOrReady: boolean }> = {}
  for (const r of trackingRows || []) {
    const fid = (r as any).friend_id as string
    const st = (r as any).status as string
    if (!byFriend[fid]) byFriend[fid] = { delivered: 0, hasWaitingOrReady: false }
    if (st === 'delivered') byFriend[fid].delivered++
    if (st === 'waiting' || st === 'ready') byFriend[fid].hasWaitingOrReady = true
  }
  const completedFriendIds = Object.entries(byFriend)
    .filter(([_, v]) => v.delivered >= totalFromSteps && !v.hasWaitingOrReady)
    .map(([fid]) => fid)

  if (completedFriendIds.length === 0) {
    return new Response(JSON.stringify({ success: true, moved: 0, skipped: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Exclude friends already registered to destination scenario
  const { data: existingTo, error: existErr } = await supabase
    .from('step_delivery_tracking')
    .select('friend_id')
    .eq('scenario_id', toScenarioId)
    .in('friend_id', completedFriendIds)
  if (existErr) throw new Error(`Failed to check existing destination: ${existErr.message}`)
  const alreadySet = new Set((existingTo || []).map((r: any) => r.friend_id))
  const targets = completedFriendIds.filter(fid => !alreadySet.has(fid))

  if (targets.length === 0) {
    return new Response(JSON.stringify({ success: true, moved: 0, skipped: completedFriendIds.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Get line_user_id for logs
  const { data: friends, error: friendErr } = await supabase
    .from('line_friends')
    .select('id, line_user_id')
    .in('id', targets)
  if (friendErr) throw new Error(`Failed to load friends: ${friendErr.message}`)
  const lineIdByFriend = new Map<string, string>()
  for (const f of friends || []) lineIdByFriend.set((f as any).id, (f as any).line_user_id)

  // Mark source scenario rows as exited
  const { error: exitErr } = await supabase
    .from('step_delivery_tracking')
    .update({ status: 'exited', updated_at: new Date().toISOString() })
    .eq('scenario_id', fromScenarioId)
    .in('friend_id', targets)
  if (exitErr) throw new Error(`Failed to mark exited: ${exitErr.message}`)

  // Prepare destination tracking inserts
  function computeFirstSchedule(now: Date, step: any): string {
    const type = step.delivery_type
    const days = step.delivery_days || 0
    const hours = step.delivery_hours || 0
    const minutes = step.delivery_minutes || 0
    const seconds = step.delivery_seconds || 0
    if (type === 'specific_time' && step.specific_time) return step.specific_time
    if (type === 'time_of_day' && step.delivery_time_of_day) {
      const base = new Date(now)
      base.setHours(parseInt(step.delivery_time_of_day.split(':')[0] || '0', 10), parseInt(step.delivery_time_of_day.split(':')[1] || '0', 10), 0, 0)
      if (base <= now) base.setDate(base.getDate() + 1)
      return base.toISOString()
    }
    // relative or relative_to_previous: base on now for first step
    const ms = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000
    const when = new Date(now.getTime() + ms)
    return when.toISOString()
  }

  const now = new Date()
  const firstStep = (toSteps || [])[0]
  const firstScheduled = computeFirstSchedule(now, firstStep)

  const inserts: any[] = []
  for (const fid of targets) {
    for (const s of toSteps || []) {
      const isFirst = (s as any).step_order === 0
      inserts.push({
        scenario_id: toScenarioId,
        step_id: (s as any).id,
        friend_id: fid,
        status: isFirst ? 'ready' : 'waiting',
        scheduled_delivery_at: isFirst ? firstScheduled : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  }

  const { error: insErr } = await supabase.from('step_delivery_tracking').insert(inserts)
  if (insErr) throw new Error(`Failed to insert destination tracking: ${insErr.message}`)

  // Write scenario_friend_logs with placeholder invite_code
  const logs: any[] = []
  for (const fid of targets) {
    logs.push({
      scenario_id: toScenarioId,
      friend_id: fid,
      line_user_id: lineIdByFriend.get(fid) || null,
      invite_code: 'system_transition',
      added_at: new Date().toISOString()
    })
  }
  const { error: logErr } = await supabase.from('scenario_friend_logs').insert(logs)
  if (logErr) console.warn('Failed to insert scenario_friend_logs for transition:', logErr?.message)

  return new Response(JSON.stringify({ success: true, moved: targets.length, skipped: completedFriendIds.length - targets.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// UIDパラメーター付与処理
function addUidToFormLinks(message: string, friendShortUid: string | null): string {
  if (!friendShortUid) return message;
  
  // フォームリンクのパターンを検出
  const formLinkPattern = /(https?:\/\/[^\/]+\/form\/[a-f0-9\-]+)/gi;
  
  return message.replace(formLinkPattern, (match) => {
    try {
      const url = new URL(match);
      url.searchParams.set('uid', friendShortUid);
      return url.toString();
    } catch (error) {
      console.error('Error processing form URL:', error);
      return match; // Return original URL if parsing fails
    }
  });
}

// Send LINE message
async function sendLineMessage(userId: string, message: any, accessToken: string) {
  let lineMessage: any;

  switch (message.message_type) {
    case 'text':
      lineMessage = {
        type: 'text',
        text: message.content
      };
      break;
    
    case 'media':
    case 'image':
      if (message.media_url) {
        lineMessage = {
          type: 'image',
          originalContentUrl: message.media_url,
          previewImageUrl: message.media_url
        };
      }
      break;
    
    case 'flex':
      if (message.flex_message_id) {
        // Get flex message content
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: flexData } = await supabase
          .from('flex_messages')
          .select('content')
          .eq('id', message.flex_message_id)
          .single();
        if (flexData?.content) {
          lineMessage = {
            type: 'flex',
            altText: message.alt_text || 'Flex Message',
            contents: flexData.content
          };
        }
      }
      // fallback when content is inline JSON string
      if (!lineMessage && message.content) {
        try {
          const parsed = typeof message.content === 'string' ? JSON.parse(message.content) : message.content
          lineMessage = {
            type: 'flex',
            altText: message.alt_text || 'Flex Message',
            contents: parsed
          }
        } catch (_) {
          // ignore parse error
        }
      }
      break;
      
    default:
      lineMessage = {
        type: 'text',
        text: message.content || 'メッセージが設定されていません'
      };
  }

  if (!lineMessage) {
    throw new Error('Invalid message format');
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE API error: ${response.status} ${errorText}`);
  }

  console.log(`Message sent to ${userId}: ${message.message_type}`);
}