import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lineUserId, inviteCode } = await req.json();
    
    if (!lineUserId || !inviteCode) {
      return new Response(JSON.stringify({ 
        error: "LINE User ID and invite code are required" 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 招待コードからシナリオ情報を取得
    const { data: inviteData, error: inviteError } = await supabase
      .from('scenario_invite_codes')
      .select(`
        scenario_id,
        step_scenarios!inner (
          user_id
        )
      `)
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .single();

    if (inviteError || !inviteData) {
      return new Response(JSON.stringify({ 
        error: "Invalid invite code" 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // LINE友だち状態をチェック
    const { data: friendData, error: friendError } = await supabase
      .from('line_friends')
      .select('id')
      .eq('line_user_id', lineUserId)
      .eq('user_id', (inviteData.step_scenarios as any)?.user_id)
      .single();

    const isFriend = !!friendData && !friendError;

    // 友だちの場合、シナリオ配信を開始
    if (isFriend) {
      const { error: rpcError } = await supabase.rpc('trigger_scenario_delivery_for_friend', {
        line_user_id: lineUserId,
        scenario_id: inviteData.scenario_id
      });

      if (rpcError) {
        console.error('Failed to trigger scenario:', rpcError);
        return new Response(JSON.stringify({ 
          error: "Failed to start scenario" 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        isFriend: true,
        action: 'scenario_started',
        message: 'シナリオ配信を開始しました'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 友だち未追加の場合
    return new Response(JSON.stringify({
      isFriend: false,
      action: 'add_friend_required',
      message: '友だち追加が必要です'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Check friend status error:', error);
    return new Response(JSON.stringify({ 
      error: "Internal server error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});