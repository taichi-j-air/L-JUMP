import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleRefundCreated } from "./process-actions.ts";

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
  const uid = metadata.uid;
  const productId = metadata.product_id;
  const managerUserId = metadata.manager_user_id;

    // Update order status to paid and process actions
    const { data: updatedOrder } = await supabaseClient
      .from('orders')
      .update({ 
        status: 'paid',
        stripe_payment_intent_id: session.payment_intent,
        stripe_customer_id: session.customer,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_session_id', session.id)
      .select()
      .single();

    console.log(`[stripe-webhook] Order updated to paid status`);

    // Process success actions (tags and scenarios)
    if (metadata.uid && metadata.product_id && metadata.manager_user_id) {
      try {
        await processPaymentSuccessActions(
          supabaseClient,
          metadata.manager_user_id,
          metadata.product_id,
          metadata.uid
        );
      } catch (error) {
        console.error('[stripe-webhook] Failed to process success actions:', error);
      }
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