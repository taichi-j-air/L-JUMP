// Helper function to process payment success actions
export async function processPaymentSuccessActions(
  supabaseClient: any,
  managerUserId: string,
  productId: string,
  friendUid: string
) {
  console.log('[stripe-webhook] Processing success actions for:', { managerUserId, productId, friendUid });

  // Get friend by UID
  const { data: friend, error: friendError } = await supabaseClient
    .from('line_friends')
    .select('id, line_user_id')
    .eq('user_id', managerUserId)
    .ilike('short_uid', friendUid)
    .single();

  if (friendError || !friend) {
    console.error('[stripe-webhook] Friend not found:', friendError);
    return;
  }

  console.log('[stripe-webhook] Found friend:', friend.id);

  // Get product actions
  const { data: actions, error: actionsError } = await supabaseClient
    .from('product_actions')
    .select('*')
    .eq('product_id', productId)
    .eq('action_type', 'success');

  if (actionsError) {
    console.error('[stripe-webhook] Failed to get product actions:', actionsError);
    return;
  }

  if (!actions || actions.length === 0) {
    console.log('[stripe-webhook] No success actions configured for product:', productId);
    return;
  }

  const action = actions[0];

  // Process tag operations
  if (action.add_tag_ids && action.add_tag_ids.length > 0) {
    try {
      for (const tagId of action.add_tag_ids) {
        await supabaseClient
          .from('friend_tags')
          .upsert({
            user_id: managerUserId,
            friend_id: friend.id,
            tag_id: tagId
          });
      }
      console.log('[stripe-webhook] Added tags:', action.add_tag_ids);
    } catch (error) {
      console.error('[stripe-webhook] Failed to add tags:', error);
    }
  }

  if (action.remove_tag_ids && action.remove_tag_ids.length > 0) {
    try {
      await supabaseClient
        .from('friend_tags')
        .delete()
        .eq('user_id', managerUserId)
        .eq('friend_id', friend.id)
        .in('tag_id', action.remove_tag_ids);
      console.log('[stripe-webhook] Removed tags:', action.remove_tag_ids);
    } catch (error) {
      console.error('[stripe-webhook] Failed to remove tags:', error);
    }
  }

  // Process scenario transition
  if (action.target_scenario_id) {
    try {
      // Stop existing scenarios if replace_all
      if (action.scenario_action === 'replace_all') {
        await supabaseClient
          .from('step_delivery_tracking')
          .update({ status: 'exited', updated_at: new Date().toISOString() })
          .eq('friend_id', friend.id)
          .in('status', ['waiting', 'ready', 'delivered']);
        console.log('[stripe-webhook] Stopped existing scenarios for replace_all');
      }

      // Register friend to new scenario
      await supabaseClient
        .from('scenario_friend_logs')
        .upsert({
          scenario_id: action.target_scenario_id,
          friend_id: friend.id,
          line_user_id: friend.line_user_id,
          invite_code: 'payment_success'
        });

      // Create step tracking for new scenario
      const { data: steps, error: stepsError } = await supabaseClient
        .from('steps')
        .select('id, step_order')
        .eq('scenario_id', action.target_scenario_id)
        .order('step_order');

      if (!stepsError && steps) {
        for (const step of steps) {
          await supabaseClient
            .from('step_delivery_tracking')
            .upsert({
              scenario_id: action.target_scenario_id,
              step_id: step.id,
              friend_id: friend.id,
              status: step.step_order === 0 ? 'ready' : 'waiting',
              scheduled_delivery_at: step.step_order === 0 ? new Date().toISOString() : null
            });
        }
        console.log('[stripe-webhook] Created step tracking for scenario:', action.target_scenario_id);
        
        // Trigger scenario delivery for the first step
        if (steps.length > 0) {
          try {
            const { error: triggerError } = await supabaseClient.functions.invoke('scheduled-step-delivery', {
              body: {
                line_user_id: friend.line_user_id,
                scenario_id: action.target_scenario_id,
                trigger_source: 'payment_success'
              }
            });
            if (triggerError) {
              console.error('[stripe-webhook] Failed to trigger scenario delivery:', triggerError);
            } else {
              console.log('[stripe-webhook] Triggered scenario delivery');
            }
          } catch (triggerError) {
            console.error('[stripe-webhook] Error triggering scenario delivery:', triggerError);
          }
        }
      }
    } catch (error) {
      console.error('[stripe-webhook] Failed to process scenario transition:', error);
    }
  }

  console.log('[stripe-webhook] Success actions processed successfully');
}

// 返金処理用のハンドラー関数を追加
export async function handleRefundCreated(event: any, supabaseClient: any) {
  const refund = event.data.object;
  
  console.log('[stripe-webhook] Refund created:', {
    refundId: refund.id,
    paymentIntentId: refund.payment_intent,
    amount: refund.amount,
    reason: refund.reason
  });

  // PaymentIntentIDから注文を検索して返金済みに更新
  if (refund.payment_intent) {
    const { data: updatedOrder, error } = await supabaseClient
      .from('orders')
      .update({
        status: 'refunded',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', refund.payment_intent)
      .select()
      .single();

    if (error) {
      console.error('[stripe-webhook] Error updating order for refund:', error);
    } else if (updatedOrder) {
      console.log('[stripe-webhook] Order updated to refunded:', updatedOrder.id);
    } else {
      console.log('[stripe-webhook] No matching order found for refund');
    }
  }
}