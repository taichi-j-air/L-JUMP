import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      friend_id, 
      page_share_code, 
      action, 
      scenario_id = null, 
      step_id = null, 
      timer_start_at = null 
    } = body || {};

    if (!friend_id || !page_share_code || !action) {
      return new Response(JSON.stringify({ 
        error: "friend_id, page_share_code, and action are required" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 友達アクセス制御の管理
    const { data, error } = await supabase.rpc('manage_friend_page_access', {
      p_friend_id: friend_id,
      p_page_share_code: page_share_code,
      p_action: action,
      p_scenario_id: scenario_id,
      p_step_id: step_id,
      p_timer_start_at: timer_start_at
    });

    if (error) {
      console.error("Friend page access management error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Friend page access managed successfully:", data);
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("manage-friend-page-access error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});