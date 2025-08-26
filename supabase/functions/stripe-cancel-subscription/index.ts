import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
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
    const { customerId } = await req.json();

    if (!customerId) {
      throw new Error("customerId is required");
    }

    // Supabase クライアント（サービスロール）
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // カスタマーのライブモードとユーザーIDを確認（注文履歴から判定）
    const { data: orders, error: ordersError } = await supabaseClient
      .from('orders')
      .select('livemode, user_id')
      .eq('stripe_customer_id', customerId)
      .limit(1);

    if (ordersError || !orders || orders.length === 0) {
      throw new Error("Customer orders not found");
    }

    const isLiveMode = orders[0].livemode;
    const userId = orders[0].user_id;

    // ユーザーのStripe認証情報を取得
    const { data: stripeCredentials, error: credentialsError } = await supabaseClient
      .from('stripe_credentials')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (credentialsError) {
      console.error(`[stripe-cancel-subscription] Stripe credentials error: ${credentialsError.message}`);
      throw new Error("Failed to retrieve Stripe credentials");
    }

    if (!stripeCredentials) {
      throw new Error("Stripe credentials not found for user. Please configure Stripe settings first.");
    }

    // Stripe 初期化
    const stripeKey = isLiveMode 
      ? stripeCredentials.live_secret_key
      : stripeCredentials.test_secret_key;
    
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured for user");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // アクティブなサブスクリプションを取得
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 10
    });

    if (subscriptions.data.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "No active subscriptions found for this customer",
        already_canceled: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const cancelledSubscriptions = [];

    // すべてのアクティブなサブスクリプションを解約
    for (const subscription of subscriptions.data) {
      const cancelledSubscription = await stripe.subscriptions.cancel(subscription.id);
      cancelledSubscriptions.push({
        id: cancelledSubscription.id,
        status: cancelledSubscription.status,
        cancelled_at: cancelledSubscription.canceled_at
      });
    }

    // 該当する注文のステータスを即座に subscription_canceled に更新
    await supabaseClient
      .from('orders')
      .update({
        status: 'subscription_canceled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_customer_id', customerId)
      .eq('status', 'paid');

    // サブスクライバー テーブルも即座に非アクティブ化
    const { data: subscribers } = await supabaseClient
      .from('subscribers')
      .select('*')
      .eq('stripe_customer_id', customerId)
      .eq('subscribed', true);

    if (subscribers && subscribers.length > 0) {
      await supabaseClient
        .from('subscribers')
        .update({
          subscribed: false,
          subscription_end: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);
      
      console.log('[stripe-cancel-subscription] Updated subscriber status to inactive');
    }

    console.log(`[stripe-cancel-subscription] Cancelled subscriptions and updated DB for customer: ${customerId}`);

    return new Response(JSON.stringify({
      success: true,
      customerId,
      cancelledSubscriptions
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[stripe-cancel-subscription] Error: ${errorMessage}`);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});