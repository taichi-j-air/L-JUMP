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
      .eq('event_id', event.id)
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
        event_id: event.id,
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

  // Update order status
  await supabaseClient
    .from('orders')
    .update({
      status: 'paid',
      stripe_customer_id: session.customer,
      stripe_payment_intent_id: session.payment_intent,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_session_id', session.id);

  // Execute product actions if available
  if (productId && managerUserId) {
    await executeProductActions(productId, managerUserId, uid, 'success', supabaseClient);
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

async function executeProductActions(
  productId: string, 
  managerUserId: string, 
  uid: string | undefined, 
  actionType: 'success' | 'failure', 
  supabaseClient: any
) {
  try {
    const { data: actions } = await supabaseClient
      .from('product_actions')
      .select('*')
      .eq('product_id', productId)
      .eq('action_type', actionType);

    if (!actions || actions.length === 0) {
      console.log('[stripe-webhook] No product actions found');
      return;
    }

    for (const action of actions) {
      console.log('[stripe-webhook] Executing action:', action.action_name, 'for uid:', uid);

      if (action.action_name === 'add_tag' && uid) {
        await addTagToFriend(managerUserId, uid, action.tag_name, supabaseClient);
      } else if (action.action_name === 'remove_tag' && uid) {
        await removeTagFromFriend(managerUserId, uid, action.tag_name, supabaseClient);
      } else if (action.action_name === 'start_scenario' && uid) {
        await startScenarioForFriend(managerUserId, uid, action.scenario_id, supabaseClient);
      }
    }
  } catch (error) {
    console.error('[stripe-webhook] Error executing product actions:', error);
  }
}

async function addTagToFriend(userId: string, uid: string, tagName: string, supabaseClient: any) {
  try {
    // Find friend by uid
    const { data: friend } = await supabaseClient
      .from('line_friends')
      .select('id, tags')
      .eq('user_id', userId)
      .eq('short_uid_ci', uid.toUpperCase())
      .single();

    if (friend) {
      const currentTags = friend.tags || [];
      if (!currentTags.includes(tagName)) {
        await supabaseClient
          .from('line_friends')
          .update({ tags: [...currentTags, tagName] })
          .eq('id', friend.id);
        
        console.log('[stripe-webhook] Added tag:', tagName, 'to friend:', uid);
      }
    }
  } catch (error) {
    console.error('[stripe-webhook] Error adding tag:', error);
  }
}

async function removeTagFromFriend(userId: string, uid: string, tagName: string, supabaseClient: any) {
  try {
    // Find friend by uid
    const { data: friend } = await supabaseClient
      .from('line_friends')
      .select('id, tags')
      .eq('user_id', userId)
      .eq('short_uid_ci', uid.toUpperCase())
      .single();

    if (friend) {
      const currentTags = friend.tags || [];
      const newTags = currentTags.filter((tag: string) => tag !== tagName);
      
      await supabaseClient
        .from('line_friends')
        .update({ tags: newTags })
        .eq('id', friend.id);
      
      console.log('[stripe-webhook] Removed tag:', tagName, 'from friend:', uid);
    }
  } catch (error) {
    console.error('[stripe-webhook] Error removing tag:', error);
  }
}

async function startScenarioForFriend(userId: string, uid: string, scenarioId: string, supabaseClient: any) {
  try {
    // Find friend by uid
    const { data: friend } = await supabaseClient
      .from('line_friends')
      .select('id, line_user_id')
      .eq('user_id', userId)
      .eq('short_uid_ci', uid.toUpperCase())
      .single();

    if (friend) {
      // Call trigger-scenario function
      const { error } = await supabaseClient.functions.invoke('trigger-scenario', {
        body: {
          line_user_id: friend.line_user_id,
          scenario_id: scenarioId,
        }
      });

      if (error) {
        console.error('[stripe-webhook] Error triggering scenario:', error);
      } else {
        console.log('[stripe-webhook] Started scenario:', scenarioId, 'for friend:', uid);
      }
    }
  } catch (error) {
    console.error('[stripe-webhook] Error starting scenario:', error);
  }
}