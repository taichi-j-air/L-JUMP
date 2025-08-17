import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the raw body as text
    const body = await req.text();
    console.log("Received webhook:", body);

    // Parse the JSON
    let event;
    try {
      event = JSON.parse(body);
    } catch (error) {
      console.error("Failed to parse webhook body:", error);
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Webhook event type:", event.type);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        console.log("Checkout session completed:", event.data.object);
        // Handle successful payment
        break;
      
      case 'customer.subscription.created':
        console.log("Subscription created:", event.data.object);
        // Handle subscription creation
        break;
      
      case 'customer.subscription.updated':
        console.log("Subscription updated:", event.data.object);
        // Handle subscription updates
        break;
      
      case 'customer.subscription.deleted':
        console.log("Subscription deleted:", event.data.object);
        // Handle subscription cancellation
        break;
      
      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});