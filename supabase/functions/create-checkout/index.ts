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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.json();
    
    // Check if this is a product purchase (has priceId) or plan subscription
    if (body.priceId) {
      // Handle product purchase
      const { priceId, successUrl, cancelUrl, metadata = {} } = body;
      
      console.log("Create product checkout request:", { priceId, successUrl, cancelUrl, metadata });

      // Get the product from metadata to determine which Stripe account to use
      if (!metadata.product_id) {
        throw new Error('Product ID is required in metadata');
      }

      // Get product details
      const { data: product, error: productError } = await supabaseClient
        .from('products')
        .select('*, user_id')
        .eq('id', metadata.product_id)
        .single();

      if (productError || !product) {
        throw new Error('Product not found');
      }

      // Get user's Stripe credentials
      const { data: credentials, error: credError } = await supabaseClient
        .from('stripe_credentials')
        .select('test_secret_key, live_secret_key')
        .eq('user_id', product.user_id)
        .single();

      if (credError || !credentials) {
        throw new Error('Stripe credentials not found. Please configure your Stripe settings first.');
      }

      // Determine if this is a test product
      const isTestProduct = product.name.includes('テスト') || product.name.includes('test');
      const secretKey = isTestProduct ? credentials.test_secret_key : credentials.live_secret_key;
      
      if (!secretKey) {
        throw new Error(`Stripe ${isTestProduct ? 'test' : 'live'} secret key not configured.`);
      }

      // Initialize Stripe with the user's secret key
      const stripe = new Stripe(secretKey, {
        apiVersion: "2023-10-16",
      });

      console.log(`Using Stripe ${isTestProduct ? 'test' : 'live'} mode for checkout`);

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: product.product_type === 'one_time' ? 'payment' : 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: metadata,
        billing_address_collection: 'required',
        customer_creation: 'always',
      });

      console.log("Product checkout session created:", session.id);

      return new Response(JSON.stringify({ 
        url: session.url 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // Handle plan subscription (original logic)
      const authHeader = req.headers.get("Authorization")!;
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      const user = data.user;
      if (!user?.email) throw new Error("User not authenticated or email not available");

      const { plan_type, is_yearly, amount, success_url, cancel_url } = body;

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
        apiVersion: "2023-10-16" 
      });

      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [
          {
            price_data: {
              currency: "jpy",
              product_data: { 
                name: `${plan_type === 'basic' ? 'ベーシック' : 'プレミアム'}プラン${is_yearly ? '（年額）' : '（月額）'}` 
              },
              unit_amount: amount,
              ...(is_yearly ? {} : { recurring: { interval: "month" } })
            },
            quantity: 1,
          },
        ],
        mode: is_yearly ? "payment" : "subscription",
        success_url: success_url || `${req.headers.get("origin")}/plan-settings?success=true`,
        cancel_url: cancel_url || `${req.headers.get("origin")}/plan-settings?canceled=true`,
        metadata: {
          user_id: user.id,
          plan_type: plan_type,
          is_yearly: is_yearly.toString()
        }
      });

      console.log("Plan checkout session created:", session.id);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});