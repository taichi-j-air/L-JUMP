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

      for (const message of messages || []) {
        await sendLineMessage(
          tracking.line_friends.line_user_id,
          message,
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
            altText: 'Flex Message',
            contents: flexData.content
          };
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