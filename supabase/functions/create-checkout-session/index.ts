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
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { 
      status: 405, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { product_id, uid, utm_source, utm_medium, utm_campaign } = await req.json();

    if (!product_id) {
      throw new Error("product_id is required");
    }

    console.log('create-checkout-session payload', { product_id, uid, utm_source, utm_medium, utm_campaign });

    // Get product and settings
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select(`
        *,
        product_settings (*)
      `)
      .eq('id', product_id)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      throw new Error("Product not found or inactive");
    }

    // Get user's Stripe credentials
    const { data: stripeCredentials, error: credentialsError } = await supabaseClient
      .from('stripe_credentials')
      .select('*')
      .eq('user_id', product.user_id)
      .single();

    if (credentialsError || !stripeCredentials) {
      throw new Error("Stripe credentials not found for product owner");
    }

    // Determine live mode by checking the price
    const testStripe = new Stripe(stripeCredentials.test_secret_key || "", { apiVersion: "2024-06-20" });
    const liveStripe = new Stripe(stripeCredentials.live_secret_key || "", { apiVersion: "2024-06-20" });
    
    let stripe: Stripe;
    let detectedLivemode: boolean;

    try {
      await testStripe.prices.retrieve(product.stripe_price_id);
      stripe = testStripe;
      detectedLivemode = false;
    } catch {
      try {
        await liveStripe.prices.retrieve(product.stripe_price_id);
        stripe = liveStripe;
        detectedLivemode = true;
      } catch {
        throw new Error("Price not found in either test or live mode");
      }
    }

    console.log('create-checkout-session detected_livemode', detectedLivemode);

    // Generate nonce for security
    const nonce = crypto.randomUUID();

    // Prepare metadata
    const metadata: Record<string, string> = {
      product_id: product_id,
      manager_user_id: product.user_id,
      product_type: product.product_type,
      nonce: nonce,
    };

    if (uid) metadata.uid = uid;
    if (utm_source) metadata.utm_source = utm_source;
    if (utm_medium) metadata.utm_medium = utm_medium;
    if (utm_campaign) metadata.utm_campaign = utm_campaign;

    // Get settings
    const settings = product.product_settings?.[0] || {};
    const origin = req.headers.get("origin") || "https://rtjxurmuaawyzjcdkqxt.lovable.app";
    const successUrl = settings.success_redirect_url || `${origin}/checkout/success`;
    const cancelUrl = settings.cancel_redirect_url || `${origin}/checkout/cancel`;

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [{
        price: product.stripe_price_id,
        quantity: 1,
      }],
      mode: product.product_type === 'one_time' ? 'payment' : 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata,
      client_reference_id: uid || 'no-uid',
      customer_creation: 'always',
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Store order record
    await supabaseClient
      .from('orders')
      .insert({
        user_id: product.user_id,
        product_id: product_id,
        status: 'pending',
        amount: product.amount,
        currency: product.currency,
        friend_uid: uid,
        livemode: detectedLivemode,
        stripe_session_id: session.id,
        metadata: metadata,
      });

    console.log('[create-checkout-session] Created session:', session.id);

    return new Response(
      JSON.stringify({
        ok: true,
        url: session.url,
        id: session.id
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});