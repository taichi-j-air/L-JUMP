import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
      throw new Error("Order not found");
    }

    if (order.status !== 'paid') {
      throw new Error("Only paid orders can be refunded");
    }

    // Stripe Payment Intent ID を確認（手動追加の場合は存在しない可能性）
    if (!order.stripe_payment_intent_id) {
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
    const { data: stripeCredentials, error: credentialsError } = await supabaseClient
      .from('stripe_credentials')
      .select('stripe_secret_key_live, stripe_secret_key_test')
      .eq('user_id', order.user_id)
      .maybeSingle();

    if (credentialsError || !stripeCredentials) {
      throw new Error("Stripe credentials not found");
    }

    // テストモードかライブモードかを判定
    const isTestMode = order.stripe_payment_intent_id?.startsWith('pi_test_') || false;
    const stripeSecretKey = isTestMode ? 
      stripeCredentials.stripe_secret_key_test : 
      stripeCredentials.stripe_secret_key_live;

    if (!stripeSecretKey) {
      throw new Error(`Stripe ${isTestMode ? 'test' : 'live'} secret key not configured`);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

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