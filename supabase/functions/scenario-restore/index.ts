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
    const { line_user_id, target_scenario_id, page_share_code } = body || {};

    if (!line_user_id || !target_scenario_id) {
      return new Response(JSON.stringify({ 
        error: "line_user_id and target_scenario_id are required" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 友達情報を取得
    const { data: friendData, error: friendErr } = await supabase
      .from("line_friends")
      .select("id, user_id")
      .eq("line_user_id", line_user_id)
      .maybeSingle();

    if (friendErr || !friendData) {
      return new Response(JSON.stringify({ error: "Friend not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 既存のシナリオ配信を停止
    await supabase
      .from("step_delivery_tracking")
      .update({ status: "exited", updated_at: new Date().toISOString() })
      .eq("friend_id", friendData.id)
      .in("status", ["waiting", "ready", "delivered"]);

    // 新しいシナリオに登録
    const { data: steps } = await supabase
      .from("steps")
      .select("id, step_order")
      .eq("scenario_id", target_scenario_id)
      .order("step_order");

    if (steps && steps.length > 0) {
      const trackingData = steps.map((step, index) => ({
        scenario_id: target_scenario_id,
        step_id: step.id,
        friend_id: friendData.id,
        status: index === 0 ? "ready" : "waiting",
        scheduled_delivery_at: index === 0 ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      await supabase
        .from("step_delivery_tracking")
        .insert(trackingData);
    }

    // シナリオ友達ログに記録
    await supabase
      .from("scenario_friend_logs")
      .insert({
        scenario_id: target_scenario_id,
        friend_id: friendData.id,
        line_user_id: line_user_id,
        invite_code: "restore_access",
      });

    // ページアクセス権限をリセット（該当するページがある場合）
    if (page_share_code) {
      await supabase
        .from("friend_page_access")
        .upsert({
          user_id: friendData.user_id,
          friend_id: friendData.id,
          page_share_code: page_share_code,
          access_enabled: true,
          access_source: "restore",
          first_access_at: null, // リセット
          timer_start_at: new Date().toISOString(), // 新しい開始時刻
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "friend_id,page_share_code"
        });
    }

    console.log("Scenario restoration successful:", {
      friend_id: friendData.id,
      line_user_id,
      target_scenario_id,
      page_share_code,
    });

    return new Response(JSON.stringify({
      success: true,
      friend_id: friendData.id,
      scenario_id: target_scenario_id,
      steps_registered: steps?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("scenario-restore error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});