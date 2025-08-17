import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@13.0.0";

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
    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the user from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Invalid user token");
    }

    // Parse the request body
    const { 
      stripeProductId,
      stripePriceId,
      name, 
      description, 
      unitAmount, 
      currency = 'jpy',
      interval,
      metadata = {},
      isTest = false 
    } = await req.json();

    console.log("Update Stripe product request:", { 
      stripeProductId, 
      stripePriceId,
      name, 
      description, 
      unitAmount, 
      currency, 
      interval, 
      metadata, 
      isTest 
    });

    // Get user's Stripe credentials
    const { data: credentials, error: credError } = await supabaseClient
      .from('stripe_credentials')
      .select('test_secret_key, live_secret_key')
      .eq('user_id', user.id)
      .single();

    if (credError || !credentials) {
      throw new Error('Stripe credentials not found. Please configure your Stripe settings first.');
    }

    const secretKey = isTest ? credentials.test_secret_key : credentials.live_secret_key;
    if (!secretKey) {
      throw new Error(`Stripe ${isTest ? 'test' : 'live'} secret key not configured.`);
    }

    // Initialize Stripe with the user's secret key
    const stripe = new Stripe(secretKey, {
      apiVersion: "2023-10-16",
    });

    console.log(`Using Stripe ${isTest ? 'test' : 'live'} mode`);

    // Update Stripe product
    const productUpdate: any = {
      name: name,
      metadata: metadata
    };

    // Only include description if it's not empty
    if (description && description.trim()) {
      productUpdate.description = description;
    }

    await stripe.products.update(stripeProductId, productUpdate);

    // Create new price if amount or currency changed
    let newPriceId = stripePriceId;
    
    // Get current price to compare
    const currentPrice = await stripe.prices.retrieve(stripePriceId);
    const priceChanged = currentPrice.unit_amount !== unitAmount || currentPrice.currency !== currency;
    
    if (priceChanged) {
      // Create new price
      const priceData: any = {
        currency: currency,
        unit_amount: unitAmount,
        product: stripeProductId,
        metadata: metadata
      };

      if (interval) {
        priceData.recurring = { interval };
      }

      const newPrice = await stripe.prices.create(priceData);
      newPriceId = newPrice.id;

      // Deactivate old price
      await stripe.prices.update(stripePriceId, { active: false });
    }

    console.log("Stripe product updated successfully");

    return new Response(JSON.stringify({ 
      ok: true, 
      productId: stripeProductId,
      priceId: newPriceId,
      priceChanged: priceChanged
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error updating Stripe product:", error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message || "Unknown error occurred" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});