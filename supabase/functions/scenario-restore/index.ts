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

    let finalScenarioId = target_scenario_id;

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
    } else {
      // 0 STEPシナリオの場合：遷移先チェック（オプショナル）
      console.log('⚠ 0 STEPシナリオ検出、遷移先を確認中...');
      const { data: transition, error: transErr } = await supabase
        .from('scenario_transitions')
        .select('to_scenario_id')
        .eq('from_scenario_id', target_scenario_id)
        .order('created_at')
        .limit(1)
        .maybeSingle();

      if (!transErr && transition?.to_scenario_id) {
        console.log('✓ 遷移先シナリオを検出:', transition.to_scenario_id);

        // 遷移先の既存トラッキングを削除
        const { error: delErr } = await supabase
          .from('step_delivery_tracking')
          .delete()
          .eq('scenario_id', transition.to_scenario_id)
          .eq('friend_id', friendData.id);

        if (delErr) {
          console.warn('遷移先の既存トラッキング削除エラー:', delErr);
        }

        // 遷移先のステップを取得して登録
        const { data: nextSteps, error: nextErr } = await supabase
          .from('steps')
          .select('id, step_order')
          .eq('scenario_id', transition.to_scenario_id)
          .order('step_order');

        if (!nextErr && nextSteps && nextSteps.length > 0) {
          const nextTrackingData = nextSteps.map((step, index) => ({
            scenario_id: transition.to_scenario_id,
            step_id: step.id,
            friend_id: friendData.id,
            status: index === 0 ? 'ready' : 'waiting',
            scheduled_delivery_at: index === 0 ? new Date().toISOString() : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

          const { error: nextInsertErr } = await supabase
            .from('step_delivery_tracking')
            .insert(nextTrackingData);

          if (nextInsertErr) {
            console.error('遷移先トラッキング作成エラー:', nextInsertErr);
          } else {
            console.log('✓ 遷移先シナリオのトラッキングを作成しました');
            finalScenarioId = transition.to_scenario_id;

            // 遷移先のログ記録
            await supabase
              .from('scenario_friend_logs')
              .insert({
                scenario_id: transition.to_scenario_id,
                friend_id: friendData.id,
                line_user_id: line_user_id,
                invite_code: 'system_transition',
                registration_source: 'restore_0step_transition'
              });
          }
        } else {
          console.log('⚠ 遷移先シナリオにステップがありません');
        }
      } else {
        console.log('⚠ 遷移先が設定されていません。ログのみ記録します。');
      }
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

    // 復元後に即時配信を起動
    try {
      console.log('📨 scheduled-step-deliveryを起動中...');
      const { data: deliveryData, error: deliveryError } = await supabase.functions.invoke('scheduled-step-delivery', {
        body: { line_user_id, trigger: 'restore' }
      });
      
      if (deliveryError) {
        console.warn('⚠ 配信起動エラー（復元は成功）:', deliveryError);
      } else {
        console.log('✅ 配信起動成功:', deliveryData);
      }
    } catch (e) {
      console.warn('⚠ 配信起動失敗（復元は成功扱い）:', e);
    }

    console.log('=== SCENARIO RESTORE COMPLETED ===');

    return new Response(JSON.stringify({
      success: true,
      friend_id: friendData.id,
      scenario_id: finalScenarioId,
      original_scenario_id: target_scenario_id,
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
