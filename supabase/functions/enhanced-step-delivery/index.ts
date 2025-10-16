import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Utility functions
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

const replaceTokens = (
  n: any,
  uid: string | null,
  lineName: string | null,
  lineNameSan: string | null,
): any => {
  if (n == null) return n;
  if (Array.isArray(n)) return n.map((x) => replaceTokens(x, uid, lineName, lineNameSan));
  if (typeof n === "object") {
    return Object.fromEntries(
      Object.entries(n).map(([k, v]) => [k, replaceTokens(v, uid, lineName, lineNameSan)]),
    );
  }
  if (typeof n === "string") {
    let result = n;
    if (uid) {
      result = result.replace(/\[UID\]/g, uid);
    }
    if (lineNameSan) {
      result = result.replace(/\[LINE_NAME_SAN\]/g, lineNameSan);
    }
    if (lineName) {
      result = result.replace(/\[LINE_NAME\]/g, lineName);
    }
    return result;
  }
  return n;
};

function sanitize(node: any): any {
  if (node == null) return node;
  if (Array.isArray(node)) return node.map(sanitize);

  if (typeof node === "object") {
    const invalid: Record<string, Set<string>> = {
      text: new Set(["backgroundColor", "padding", "borderRadius", "borderWidth", "borderColor", "className"]),
      image: new Set(["className"]),
      box: new Set(["className"]),
      button: new Set(["className"]),
    };

    const t = node.type as string | undefined;
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      if (t && invalid[t]?.has(k)) continue;
      out[k] = sanitize(v);
    }
    return out;
  }
  return node;
}

function normalize(input: any) {
  if (!input) return null;

  let normalized: any = null;

  if (input.type === "flex" && input.contents) {
    normalized = { type: "flex", altText: input.altText?.trim() || "お知らせ", contents: sanitize(input.contents) };
  } else if (["bubble", "carousel"].includes(input.type)) {
    normalized = { type: "flex", altText: "お知らせ", contents: sanitize(input) };
  } else if (input.contents && ["bubble", "carousel"].includes(input.contents.type)) {
    normalized = { type: "flex", altText: input.altText?.trim() || "お知らせ", contents: sanitize(input.contents) };
  }

  if (!normalized) return null;

  if (input.styles?.body?.backgroundColor && normalized.contents?.type === 'bubble' && normalized.contents.body) {
    normalized.contents.body.backgroundColor = input.styles.body.backgroundColor;
  }

  return normalized;
}

async function syncStepDeliveryTimers(
  supabase: any,
  params: { scenarioId: string; stepId: string; friendId: string; deliveredAt: string }
) {
  const { scenarioId, stepId, friendId, deliveredAt } = params;
  if (!scenarioId || !stepId || !friendId) {
    console.warn('[enhanced syncStepDeliveryTimers] skipped (missing identifiers)', {
      scenarioId,
      stepId,
      friendId,
    });
    return;
  }

    console.log('[enhanced syncStepDeliveryTimers] start', {
      scenarioId,
      stepId,
      friendId,
      deliveredAt,
    });
  try {
    const { data: pages, error: pageError } = await supabase
      .from('cms_pages')
      .select('share_code, user_id, timer_duration_seconds')
      .eq('timer_enabled', true)
      .eq('timer_mode', 'step_delivery')
      .eq('timer_scenario_id', scenarioId)
      .eq('timer_step_id', stepId);

    if (pageError) {
      console.error('[enhanced syncStepDeliveryTimers] page fetch error', pageError);
      return;
    }

    if (!pages || pages.length === 0) {
      console.log('[enhanced syncStepDeliveryTimers] no matching pages');
      return;
    }

    console.log('[enhanced syncStepDeliveryTimers] pages matched', pages.map((p: any) => p.share_code));

    const updateTimestamp = new Date().toISOString();
    for (const page of pages) {
      const duration = page.timer_duration_seconds ?? 0;
      let timerEndAt: string | null = null;
      if (duration > 0) {
        const startDate = new Date(deliveredAt);
        timerEndAt = new Date(startDate.getTime() + duration * 1000).toISOString();
      }

      const payload = {
        user_id: page.user_id,
        friend_id,
        page_share_code: page.share_code,
        scenario_id: scenarioId,
        step_id: stepId,
        access_enabled: true,
        access_source: 'step_delivery',
        timer_start_at: deliveredAt,
        timer_end_at: timerEndAt,
        first_access_at: null,
        updated_at: updateTimestamp,
      };
      console.log('[enhanced syncStepDeliveryTimers] upserting access', payload);

      const { error: upsertError } = await supabase
        .from('friend_page_access')
        .upsert(
          payload,
          { onConflict: 'friend_id,page_share_code' }
        );

      if (upsertError) {
        console.error('[enhanced syncStepDeliveryTimers] upsert error', upsertError);
      } else {
        console.log('[enhanced syncStepDeliveryTimers] upsert success', {
          friend_id: friendId,
          page_share_code: page.share_code,
        });
      }
    }
  } catch (error) {
    console.error('[enhanced syncStepDeliveryTimers] unexpected error', error);
  }
}

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
      JSON.stringify({ error: (error as Error)?.message || 'Unknown error' }),
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

      // Get secure LINE credentials with fallback
      let accessToken: string | null = null;
      const scenarioUserId = tracking.step_scenarios.user_id;
      
      // 方法1: RPC経由
      try {
        const { data: credentials, error: credError } = await supabase
          .rpc('get_line_credentials_for_user', { p_user_id: scenarioUserId });
        
        if (!credError && credentials?.channel_access_token) {
          accessToken = credentials.channel_access_token;
          console.log(`✓ Token via RPC for scenario ${tracking.step_scenarios.name}`);
        }
      } catch (rpcError) {
        console.warn(`RPC failed for scenario ${tracking.step_scenarios.name}:`, rpcError);
      }

      // 方法2: secure_line_credentials（暗号化・平文両対応）
      if (!accessToken) {
        const { data: cred, error: credErr } = await supabase
          .from("secure_line_credentials")
          .select("encrypted_value")
          .eq("user_id", scenarioUserId)
          .eq("credential_type", "channel_access_token")
          .single();
        
        if (!credErr && cred?.encrypted_value) {
          const token = cred.encrypted_value;
          if (token.startsWith("enc:")) {
            try {
              const encData = atob(token.substring(4));
              const arr = new Uint8Array(encData.length);
              for (let i = 0; i < encData.length; i++) arr[i] = encData.charCodeAt(i);
              const iv = arr.slice(0, 12);
              const enc = arr.slice(12);
              const key = await crypto.subtle.importKey(
                "raw",
                new TextEncoder().encode(scenarioUserId.substring(0, 32).padEnd(32, "0")),
                { name: "AES-GCM" },
                false,
                ["decrypt"]
              );
              const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, enc);
              accessToken = new TextDecoder().decode(dec);
              console.log(`✓ Token decrypted from secure_line_credentials`);
            } catch (e) {
              console.error(`Decryption failed:`, e);
            }
          } else {
            accessToken = token;
            console.log(`✓ Token from secure_line_credentials (plaintext)`);
          }
        }
      }

      // 方法3: profiles（レガシー）
      if (!accessToken) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("line_channel_access_token")
          .eq("user_id", scenarioUserId)
          .single();
        
        if (prof?.line_channel_access_token) {
          accessToken = prof.line_channel_access_token;
          console.log(`✓ Token from profiles (legacy)`);
        }
      }

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
        if (message.message_type === 'text') { // Check for text message type once
          if (typeof processedMessage.content === 'string') {
            const rawDisplayName = tracking.line_friends.display_name?.trim();
            const fallbackName = rawDisplayName && rawDisplayName.length > 0 ? rawDisplayName : "あなた";

            // [LINE_NAME] / [LINE_NAME_SAN] を friend.display_name で置換（未設定時は "あなた"）
            processedMessage.content = processedMessage.content
              .replace(/\[LINE_NAME_SAN\]/g, fallbackName === "あなた" ? "あなた" : `${fallbackName}さん`)
              .replace(/\[LINE_NAME\]/g, fallbackName);

            if (friendData?.short_uid) {
              processedMessage.content = addUidToFormLinks(processedMessage.content, friendData.short_uid);
              console.log(`UID変換実行: ${message.content} -> ${processedMessage.content}`);
            }
          }
        }

        await sendLineMessage(
          tracking.line_friends.line_user_id,
          processedMessage,
          accessToken
        );
      }

      // Update tracking status
      const deliveredAt = new Date().toISOString();
      await supabase
        .from('step_delivery_tracking')
        .update({
          status: 'delivered',
          delivered_at: deliveredAt,
          updated_at: deliveredAt
        })
        .eq('id', tracking.id);

      await syncStepDeliveryTimers(supabase, {
        scenarioId: tracking.scenario_id,
        stepId: tracking.step_id,
        friendId: tracking.friend_id,
        deliveredAt,
      });

      // Log delivery
      await supabase
        .from('step_delivery_logs')
        .insert({
          step_id: tracking.step_id,
          friend_id: tracking.friend_id,
          scenario_id: tracking.scenario_id,
          delivery_status: 'delivered',
          delivered_at: deliveredAt
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
          last_error: (error as Error)?.message || 'Unknown error',
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
    
    case 'flex': {
      if (message.flex_message_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        const { data: flexData } = await supabase
          .from('flex_messages')
          .select('content')
          .eq('id', message.flex_message_id)
          .single();
        if (flexData?.content) {
          // Apply token replacement for Flex messages
          const { data: friendInfo } = await supabase
            .from('line_friends')
            .select('short_uid, display_name')
            .eq('line_user_id', userId)
            .single();
          
          const shortUid = friendInfo?.short_uid || null;
          const rawDisplayName = friendInfo?.display_name?.trim() || '';
          const fallbackName = rawDisplayName.length > 0 ? rawDisplayName : 'あなた';
          const fallbackNameSan = fallbackName === 'あなた' ? 'あなた' : `${fallbackName}さん`;
          
          const withTokens = replaceTokens(clone(flexData.content), shortUid, fallbackName, fallbackNameSan);
          const normalized = normalize(withTokens);
          if (normalized) {
            lineMessage = normalized;
            console.log(`✓ Flex message normalized with tokens for ${userId}`);
          }
        }
      }

      if (!lineMessage && message.content) {
        const normalized = normalize(message.content);
        if (normalized) {
          lineMessage = normalized;
        }
      }
      break;
    }

    case 'restore_access':
      // アクセス解除＆シナリオ再登録メッセージ
      if (message.restore_config) {
        const config = typeof message.restore_config === 'string' 
          ? JSON.parse(message.restore_config) 
          : message.restore_config;
        
        if (config.type === 'button') {
          lineMessage = {
            type: 'text',
            text: config.text || 'アクセスを復活しますか？'
          };
        } else if (config.type === 'image' && config.image_url) {
          lineMessage = {
            type: 'image',
            originalContentUrl: config.image_url,
            previewImageUrl: config.image_url
          };
        }
      }
      if (!lineMessage) {
        lineMessage = {
          type: 'text',
          text: 'アクセスを復活しますか？'
        };
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
