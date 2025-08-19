import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-REFUND] ${step}${detailsStr}`);
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();

    if (!orderId) {
      throw new Error("orderId is required");
    }

    logStep("Processing refund", { orderId });

    // Supabase クライアント（サービスロール）
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 注文情報を取得
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      logStep("ERROR: Order not found", { orderId, error: orderError });
      throw new Error("Order not found");
    }

    logStep("Order found", { 
      id: order.id, 
      status: order.status, 
      amount: order.amount, 
      user_id: order.user_id,
      livemode: order.livemode,
      stripe_payment_intent_id: order.stripe_payment_intent_id 
    });

    if (order.status === 'refunded') {
      logStep("Order already refunded", { orderId });
      return new Response(JSON.stringify({
        success: true,
        message: "Order already refunded",
        refundId: 'already-refunded',
        amount: order.amount
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (order.status !== 'paid') {
      logStep("ERROR: Order not paid", { status: order.status });
      throw new Error("Only paid orders can be refunded");
    }

    // Stripe Payment Intent ID を確認（手動追加の場合は存在しない可能性）
    if (!order.stripe_payment_intent_id) {
      logStep("Manual order detected, updating DB only", { orderId });
      
      // 手動追加の注文の場合、DBの状態のみ変更
      await supabaseClient
        .from('orders')
        .update({ 
          status: 'refunded', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId);

      console.log(`[stripe-refund] Manual order refund processed: ${orderId}`);

      return new Response(JSON.stringify({
        success: true,
        refundId: 'manual-refund',
        amount: order.amount,
        manual: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Stripe認証情報を取得
    console.log(`[stripe-refund] Fetching Stripe credentials for user: ${order.user_id}`);
    
    const { data: stripeCredentials, error: credentialsError } = await supabaseClient
      .from('stripe_credentials')
      .select('test_secret_key, live_secret_key')
      .eq('user_id', order.user_id)
      .maybeSingle();

    console.log(`[stripe-refund] Stripe credentials query result:`, { 
      error: credentialsError, 
      hasCredentials: !!stripeCredentials,
      hasTestKey: !!(stripeCredentials?.test_secret_key),
      hasLiveKey: !!(stripeCredentials?.live_secret_key)
    });

    if (credentialsError || !stripeCredentials) {
      console.error(`[stripe-refund] Stripe credentials not found:`, credentialsError);
      throw new Error("Stripe credentials not found");
    }

    // ライブモード判定（orderのlivemodeフィールドまたはPaymentIntentIDから判定）
    const isLiveMode = order.livemode || (!order.stripe_payment_intent_id?.startsWith('pi_test_'));
    const stripeSecretKey = isLiveMode ? 
      stripeCredentials.live_secret_key : 
      stripeCredentials.test_secret_key;

    console.log(`[stripe-refund] Using ${isLiveMode ? 'live' : 'test'} mode for refund`);

    if (!stripeSecretKey) {
      console.error(`[stripe-refund] Stripe ${isLiveMode ? 'live' : 'test'} secret key not configured`);
      throw new Error(`Stripe ${isLiveMode ? 'live' : 'test'} secret key not configured`);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    console.log(`[stripe-refund] Creating refund for PaymentIntent: ${order.stripe_payment_intent_id}`);

    // 返金処理
    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: order.amount,
      reason: 'requested_by_customer',
      metadata: {
        order_id: orderId,
        user_id: order.user_id
      }
    });

    console.log(`[stripe-refund] Refund created successfully: ${refund.id}`);

    // 注文ステータスを更新
    await supabaseClient
      .from('orders')
      .update({ 
        status: 'refunded', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', orderId);

    console.log(`[stripe-refund] Refund processed: ${refund.id} for order ${orderId}`);

    return new Response(JSON.stringify({
      success: true,
      refundId: refund.id,
      amount: refund.amount
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[stripe-refund] Error: ${errorMessage}`);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});