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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { product_id } = await req.json();

    if (!product_id) {
      throw new Error("product_id is required");
    }

    // Get product with settings
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select(`
        id,
        name,
        description,
        image_url,
        stripe_price_id,
        product_type,
        amount,
        currency,
        is_active,
        user_id,
        product_settings (
          submit_button_text,
          submit_button_variant,
          submit_button_bg_color,
          submit_button_text_color,
          accent_color,
          success_redirect_url,
          cancel_redirect_url
        )
      `)
      .eq('id', product_id)
      .eq('is_active', true)
      .single();

    if (productError) {
      throw new Error(`Product not found: ${productError.message}`);
    }

    // Flatten the response
    const productData = {
      ...product,
      ...(product.product_settings?.[0] || {})
    };
    delete productData.product_settings;

    console.log('[public-get-product] Retrieved product:', productData.name);

    return new Response(
      JSON.stringify({
        success: true,
        product: productData
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error fetching product:", error);
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