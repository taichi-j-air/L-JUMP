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
    console.log('=== SCENARIO RESTORE START ===');
    
    const { line_user_id, target_scenario_id, page_share_code } = await req.json();

    if (!line_user_id || !target_scenario_id) {
      return new Response(JSON.stringify({ 
        error: 'line_user_id and target_scenario_id are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('友達情報を取得:', line_user_id);
    const { data: friendData, error: friendErr } = await supabase
      .from('line_friends')
      .select('id, user_id')
      .eq('line_user_id', line_user_id)
      .maybeSingle();

    if (friendErr || !friendData) {
      console.error('友達が見つかりません:', friendErr);
      return new Response(JSON.stringify({ error: 'Friend not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✓ 友達ID:', friendData.id);

    // 既存のシナリオ配信を停止（exited状態に）
    console.log('既存配信を停止中...');
    const { error: stopError } = await supabase
      .from('step_delivery_tracking')
      .update({ 
        status: 'exited', 
        updated_at: new Date().toISOString() 
      })
      .eq('friend_id', friendData.id)
      .in('status', ['waiting', 'ready', 'delivered']);

    if (stopError) {
      console.error('配信停止エラー:', stopError);
    } else {
      console.log('✓ 既存配信を停止しました');
    }

    // 対象シナリオのステップを取得
    console.log('ステップ情報を取得中...');
    const { data: steps, error: stepsErr } = await supabase
      .from('steps')
      .select('id, step_order')
      .eq('scenario_id', target_scenario_id)
      .order('step_order');

    if (stepsErr) {
      console.error('ステップ取得エラー:', stepsErr);
      return new Response(JSON.stringify({ error: 'Failed to get steps' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✓ ステップ数:', steps?.length || 0);

    // 新しいトラッキングレコードを作成
    if (steps && steps.length > 0) {
      const trackingData = steps.map((step, index) => ({
        scenario_id: target_scenario_id,
        step_id: step.id,
        friend_id: friendData.id,
        status: index === 0 ? 'ready' : 'waiting',
        scheduled_delivery_at: index === 0 ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      console.log('トラッキングレコードを作成中...');
      const { error: insertErr } = await supabase
        .from('step_delivery_tracking')
        .insert(trackingData);

      if (insertErr) {
        console.error('トラッキング作成エラー:', insertErr);
        return new Response(JSON.stringify({ error: 'Failed to create tracking' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('✓ トラッキングレコードを作成しました');
    }

    // シナリオ友達ログに記録
    console.log('シナリオログに記録中...');
    const { error: logErr } = await supabase
      .from('scenario_friend_logs')
      .insert({
        scenario_id: target_scenario_id,
        friend_id: friendData.id,
        line_user_id: line_user_id,
        invite_code: 'restore_access',
        registration_source: 'restore_access'
      });

    if (logErr) {
      console.log('ログ記録エラー（既存レコードの可能性）:', logErr);
    } else {
      console.log('✓ シナリオログに記録しました');
    }

    // ページアクセス権限をリセット（該当するページがある場合）
    if (page_share_code) {
      console.log('ページアクセス権限をリセット中:', page_share_code);
      const { error: accessErr } = await supabase
        .from('friend_page_access')
        .upsert({
          user_id: friendData.user_id,
          friend_id: friendData.id,
          page_share_code: page_share_code,
          access_enabled: true,
          access_source: 'restore',
          first_access_at: null,
          timer_start_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'unique_friend_page'
        });

      if (accessErr) {
        console.error('アクセス権限リセットエラー:', accessErr);
      } else {
        console.log('✓ ページアクセス権限をリセットしました');
      }
    }

    console.log('=== SCENARIO RESTORE COMPLETED ===');

    return new Response(JSON.stringify({
      success: true,
      friend_id: friendData.id,
      scenario_id: target_scenario_id,
      steps_registered: steps?.length || 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('scenario-restore error:', err);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: (err as Error)?.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
