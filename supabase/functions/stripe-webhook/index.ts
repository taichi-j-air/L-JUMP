import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleRefundCreated, processPaymentSuccessActions } from "./process-actions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("Missing Stripe signature");
    }

    // For now, we'll parse the event without signature verification
    // In production, you should verify the signature
    const event = JSON.parse(body) as Stripe.Event;
    
    console.log('[stripe-webhook] Event received:', event.type, 'livemode:', event.livemode, 'id:', event.id);

    // Check for duplicate events
    const { data: existingEvent } = await supabaseClient
      .from('stripe_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent) {
      console.log('[stripe-webhook] Event already processed:', event.id);
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Store event for idempotency
    await supabaseClient
      .from('stripe_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        livemode: event.livemode,
        processed_at: new Date().toISOString(),
      });

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, supabaseClient);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event, supabaseClient);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event, supabaseClient);
        break;
      
      case 'checkout.session.expired':
        await handleCheckoutExpired(event, supabaseClient);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event, supabaseClient);
        break;
      
      case 'charge.dispute.created':
      case 'payment_intent.requires_action':
        await handlePaymentRequiresAction(event, supabaseClient);
        break;
        
      case 'charge.refunded':
      case 'refund.created':
        await handleRefundCreated(event, supabaseClient);
        break;
        
      case 'customer.subscription.deleted':
      case 'customer.subscription.updated':
        await handleSubscriptionEvent(event, supabaseClient);
        break;
        
      case 'invoice.payment_failed':
        await handleSubscriptionPaymentFailed(event, supabaseClient);
        break;
      
      default:
        console.log('[stripe-webhook] Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('[stripe-webhook] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

async function handleCheckoutCompleted(event: Stripe.Event, supabaseClient: any) {
  const session = event.data.object as Stripe.Checkout.Session;
  
  console.log('[stripe-webhook] Checkout completed:', {
    sessionId: session.id,
    metadata: session.metadata,
    clientReferenceId: session.client_reference_id,
  });

  const metadata = session.metadata || {};
  const purchaserId = metadata.purchaser_id || session.client_reference_id;
  const planType = metadata.plan_type;

  const stripeCustomerId = typeof session.customer === "string"
    ? session.customer
    : session.customer && "id" in session.customer
      ? session.customer.id!
      : null;

  await supabaseClient
    .from('orders')
    .update({ 
      status: 'paid',
      stripe_payment_intent_id: session.payment_intent,
      stripe_customer_id: stripeCustomerId,
      metadata,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_session_id', session.id);

  console.log('[stripe-webhook] Order marked paid for session', session.id);

  if (planType && purchaserId) {
    try {
      await activatePurchasedPlan({
        supabaseClient,
        userId: purchaserId,
        planType,
        billingCycle: metadata.billing_cycle,
        subscriptionId: typeof session.subscription === "string" ? session.subscription : null,
        customerId: stripeCustomerId,
        amountMetadata: metadata.plan_amount,
      });
    } catch (error) {
      console.error('[stripe-webhook] Failed to activate purchased plan:', error);
    }
    return;
  }

  const uid = metadata.uid;
  const productId = metadata.product_id;
  const managerUserId = metadata.manager_user_id;

  if (uid && productId && managerUserId) {
    try {
      console.log('[stripe-webhook] Processing legacy payment success actions');

      let paymentAmount = 0;
      if (session.amount_total) {
        paymentAmount = session.amount_total;
      }

      await processPaymentSuccessActions(
        supabaseClient,
        managerUserId,
        productId,
        uid,
        paymentAmount
      );
      console.log('[stripe-webhook] Legacy payment success actions completed');
    } catch (error) {
      console.error('[stripe-webhook] Failed legacy success actions:', error);
    }
  } else {
    console.log('[stripe-webhook] No matching metadata for checkout completion handling');
  }
}

async function handlePaymentSucceeded(event: Stripe.Event, supabaseClient: any) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  console.log('[stripe-webhook] Payment succeeded:', {
    paymentIntentId: paymentIntent.id,
    metadata: paymentIntent.metadata,
  });

  // Update order if exists
  await supabaseClient
    .from('orders')
    .update({
      status: 'paid',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);
}

async function handlePaymentFailed(event: Stripe.Event, supabaseClient: any) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  console.log('[stripe-webhook] Payment failed:', {
    paymentIntentId: paymentIntent.id,
    lastPaymentError: paymentIntent.last_payment_error,
  });

  // Update order status
  await supabaseClient
    .from('orders')
    .update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);
}

async function handleCheckoutExpired(event: Stripe.Event, supabaseClient: any) {
  const session = event.data.object as Stripe.Checkout.Session;
  
  console.log('[stripe-webhook] Checkout expired:', session.id);

  // Update order status
  await supabaseClient
    .from('orders')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_session_id', session.id);
}

async function handleInvoicePaymentSucceeded(event: Stripe.Event, supabaseClient: any) {
  const invoice = event.data.object as Stripe.Invoice;
  
  console.log('[stripe-webhook] Invoice payment succeeded:', {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription,
    customerId: invoice.customer,
  });

  // Handle recurring payments - could trigger scenarios here
}

async function handlePaymentRequiresAction(event: Stripe.Event, supabaseClient: any) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  console.log('[stripe-webhook] Payment requires action:', {
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status
  });

  // 注文ステータスを更新（問題ありとして）
  await supabaseClient
    .from('orders')
    .update({
      status: 'requires_action',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);
}

async function handleSubscriptionEvent(event: Stripe.Event, supabaseClient: any) {
  const subscription = event.data.object as Stripe.Subscription;
  
  console.log('[stripe-webhook] Subscription event:', {
    eventType: event.type,
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
  });

  const customerId = typeof subscription.customer === 'string' 
    ? subscription.customer 
    : subscription.customer?.id;

  if (!customerId) {
    console.error('[stripe-webhook] No customer ID found in subscription');
    return;
  }

  // サブスクリプションがキャンセル・期限切れになった場合
  if (event.type === 'customer.subscription.deleted' || 
      (event.type === 'customer.subscription.updated' && subscription.status === 'canceled')) {
    
    console.log('[stripe-webhook] Subscription cancelled, updating order status');
    
    // 該当カスタマーの有料サブスクリプション注文を cancelled に更新
    await supabaseClient
      .from('orders')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId)
      .eq('status', 'paid');

    // サブスクライバー テーブルがあれば非アクティブ化
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
      
      console.log('[stripe-webhook] Updated subscriber status to inactive');
    }
  }
  
  // サブスクリプションが再アクティブになった場合
  if (event.type === 'customer.subscription.updated' && subscription.status === 'active') {
    console.log('[stripe-webhook] Subscription reactivated');
    
    // 注文ステータスを paid に戻す
    await supabaseClient
      .from('orders')
      .update({
        status: 'paid',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId)
      .in('status', ['canceled', 'expired']);

    // サブスクライバー テーブルも再アクティブ化
    const { data: subscribers } = await supabaseClient
      .from('subscribers')
      .select('*')
      .eq('stripe_customer_id', customerId);

    if (subscribers && subscribers.length > 0) {
      await supabaseClient
        .from('subscribers')
        .update({
          subscribed: true,
          subscription_end: subscription.current_period_end 
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);
      
      console.log('[stripe-webhook] Updated subscriber status to active');
    }
  }
}

async function handleSubscriptionPaymentFailed(event: Stripe.Event, supabaseClient: any) {
  const invoice = event.data.object as Stripe.Invoice;
  
  console.log('[stripe-webhook] Subscription payment failed:', {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription,
    customerId: invoice.customer,
    attemptCount: invoice.attempt_count,
  });

  const customerId = typeof invoice.customer === 'string' 
    ? invoice.customer 
    : invoice.customer?.id;

  if (customerId) {
    // 支払い失敗の場合、注文ステータスを更新（最終的な自動解約はStripe側で行われる）
    await supabaseClient
      .from('orders')
      .update({
        status: 'payment_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId)
      .eq('status', 'paid');
  }
}

interface ActivatePlanParams {
  supabaseClient: any
  userId: string
  planType: string
  billingCycle?: string | null
  subscriptionId: string | null
  customerId: string | null
  amountMetadata?: string
}

async function activatePurchasedPlan({
  supabaseClient,
  userId,
  planType,
  billingCycle,
  subscriptionId,
  customerId,
  amountMetadata,
}: ActivatePlanParams) {
  const isYearly = (billingCycle || '').toLowerCase() === 'yearly'

  const { data: planConfig, error: planError } = await supabaseClient
    .from('plan_configs')
    .select('plan_type, monthly_price, yearly_price')
    .eq('plan_type', planType)
    .maybeSingle()

  if (planError) {
    console.error('[stripe-webhook] Failed to load plan config:', planError.message)
    throw planError
  }

  const planAmount = isYearly
    ? Number(planConfig?.yearly_price ?? planConfig?.monthly_price ?? amountMetadata ?? 0)
    : Number(planConfig?.monthly_price ?? amountMetadata ?? 0)

  const normalizedAmount = Number.isFinite(planAmount) ? planAmount : 0

  await supabaseClient
    .from('user_plans')
    .update({
      is_active: false,
      plan_end_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('is_active', true)

  await supabaseClient.from('user_plans').insert({
    user_id: userId,
    plan_type: planType,
    is_yearly: isYearly,
    is_active: true,
    plan_start_date: new Date().toISOString(),
    plan_end_date: null,
    monthly_revenue: normalizedAmount,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
  })

  console.log('[stripe-webhook] Activated plan for user', {
    userId,
    planType,
    isYearly,
    subscriptionId,
  })
}
