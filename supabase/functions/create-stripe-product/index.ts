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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    const { name, description, unitAmount, currency, interval, metadata = {}, isTest = false } = await req.json();

    if (!name || !unitAmount || !currency) {
      throw new Error("Missing required fields: name, unitAmount, currency");
    }

    console.log(`Creating ${isTest ? 'test' : 'live'} product:`, { name, unitAmount, currency, interval });

    // Get user's Stripe credentials
    const { data: stripeCredentials, error: credentialsError } = await supabaseClient
      .from('stripe_credentials')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (credentialsError || !stripeCredentials) {
      throw new Error("Stripe credentials not found");
    }

    // Use test or live keys based on isTest flag
    const stripeSecretKey = isTest 
      ? stripeCredentials.test_secret_key 
      : stripeCredentials.live_secret_key;

    if (!stripeSecretKey) {
      throw new Error(`Stripe ${isTest ? 'test' : 'live'} secret key not configured`);
    }

   const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

const productData: any = {
  name,
  metadata,
  default_price_data: {
    unit_amount: Math.round(unitAmount),
    currency: (currency || "jpy").toLowerCase(),
  },
};

    // Only include description if it's not empty
    if (description && description.trim() !== '') {
      productData.description = description;
    }

      // Add recurring data for subscriptions
      if (interval) {
        productData.default_price_data.recurring = { interval };
        
        // Add trial period for subscription_with_trial products
        if (metadata.product_type === 'subscription_with_trial' && metadata.trial_period_days) {
          productData.default_price_data.recurring.trial_period_days = parseInt(metadata.trial_period_days);
        }
      }

      // Add trial period for subscription_with_trial even without interval (one-time trial)
      if (metadata.product_type === 'subscription_with_trial' && metadata.trial_period_days && !interval) {
        // For subscription_with_trial without interval, we still need recurring data
        productData.default_price_data.recurring = { 
          interval: 'month', // Default to monthly if not specified
          trial_period_days: parseInt(metadata.trial_period_days) 
        };
      }

    const stripeProduct = await stripe.products.create(productData);
    
    console.log(`Successfully created ${isTest ? 'test' : 'live'} Stripe product:`, stripeProduct.id);

    return new Response(
      JSON.stringify({
        ok: true,
        product: stripeProduct,
        productId: stripeProduct.id,
        priceId: stripeProduct.default_price
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating Stripe product:", error);
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