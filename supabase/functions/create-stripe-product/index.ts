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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    const { productId, isTest = false } = await req.json();

    // Get product details
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single();

    if (productError || !product) {
      throw new Error("Product not found");
    }

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

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Create Stripe product
    const stripeProduct = await stripe.products.create({
      name: product.name,
      description: product.description || undefined,
    });

    // Create Stripe price
    const priceData: any = {
      unit_amount: Math.round(product.price),
      currency: product.currency.toLowerCase(),
      product: stripeProduct.id,
    };

    if (product.product_type === 'subscription' || product.product_type === 'subscription_with_trial') {
      priceData.recurring = {
        interval: product.interval || 'month',
      };
    }

    const stripePrice = await stripe.prices.create(priceData);

    // Update product with Stripe IDs
    const { error: updateError } = await supabaseClient
      .from('products')
      .update({
        stripe_product_id: stripeProduct.id,
        stripe_price_id: stripePrice.id,
      })
      .eq('id', productId);

    if (updateError) {
      throw new Error("Failed to update product with Stripe IDs");
    }

    return new Response(
      JSON.stringify({
        success: true,
        stripeProductId: stripeProduct.id,
        stripePriceId: stripePrice.id,
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