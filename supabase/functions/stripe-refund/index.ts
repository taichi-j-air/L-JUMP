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

    if (!order.stripe_payment_intent_id) {
      throw new Error("No payment intent found for this order");
    }

    // ユーザーのStripe認証情報を取得
    const { data: stripeCredentials, error: credentialsError } = await supabaseClient
      .from('stripe_credentials')
      .select('*')
      .eq('user_id', order.user_id)
      .maybeSingle();

    if (credentialsError) {
      console.error(`[stripe-refund] Stripe credentials error: ${credentialsError.message}`);
      throw new Error("Failed to retrieve Stripe credentials");
    }

    if (!stripeCredentials) {
      throw new Error("Stripe credentials not found for user. Please configure Stripe settings first.");
    }

    // Stripe 初期化
    const stripeKey = order.livemode 
      ? stripeCredentials.live_secret_key
      : stripeCredentials.test_secret_key;
    
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured for user");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

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