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

    const { stripeProductId, productId, isTest = false } = await req.json();

    if (!stripeProductId) {
      throw new Error("Missing required field: stripeProductId");
    }

    console.log(`Deleting ${isTest ? 'test' : 'live'} Stripe product:`, stripeProductId);

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

    try {
      // Archive (soft delete) the product in Stripe
      // Note: Stripe doesn't allow hard deletion if the product has active subscriptions
      await stripe.products.update(stripeProductId, { active: false });
      console.log(`Successfully archived Stripe product: ${stripeProductId}`);

      // If productId is provided, also deactivate in Supabase
      if (productId) {
        await supabaseClient
          .from('products')
          .update({ is_active: false })
          .eq('id', productId)
          .eq('user_id', user.id);
        console.log(`Deactivated product in Supabase: ${productId}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Product successfully archived in Stripe",
          note: "Existing subscriptions will continue until cancelled by customers"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );

    } catch (stripeError: any) {
      console.error("Stripe product deletion error:", stripeError);
      
      if (stripeError.code === 'resource_missing') {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Product not found in Stripe (may already be deleted)"
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          }
        );
      }

      throw stripeError;
    }

  } catch (error) {
    console.error("Error deleting Stripe product:", error);
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