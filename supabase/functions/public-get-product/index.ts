// supabase/functions/public-get-product/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { product_id } = await req.json();
    if (!product_id) throw new Error("product_id is required");

    // ── 重要：実在のカラム名に合わせる ──
    // products: price / currency / stripe_price_id / product_type / is_active / user_id
    // product_settings: landing_page_title / landing_page_content / landing_page_image_url
    //                  button_text / button_color / success_redirect_url / cancel_redirect_url
    const { data: product, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        description,
        stripe_price_id,
        product_type,
        price,
        currency,
        is_active,
        user_id,
        product_settings!inner (
          landing_page_title,
          landing_page_content,
          landing_page_image_url,
          button_text,
          button_color,
          success_redirect_url,
          cancel_redirect_url
        )
      `)
      .eq("id", product_id)
      .eq("is_active", true)
      .order('created_at', { referencedTable: 'product_settings', ascending: false })
      .single();

    if (error || !product) throw new Error("Product not found or inactive");

    const settings = (product as any).product_settings?.[0] ?? {};
    const productData = {
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      stripe_price_id: product.stripe_price_id,
      product_type: product.product_type,
      price: product.price,
      currency: product.currency,
      is_active: product.is_active,
      user_id: product.user_id,
      landing_page_title: settings.landing_page_title ?? "",
      landing_page_content: settings.landing_page_content ?? "",
      landing_page_image_url: settings.landing_page_image_url ?? "",
      button_text: settings.button_text ?? "",
      button_color: settings.button_color ?? "",
      success_redirect_url: settings.success_redirect_url ?? "",
      cancel_redirect_url: settings.cancel_redirect_url ?? "",
    };

    console.log("[public-get-product] ok:", {
      id: productData.id,
      name: productData.name,
    });

    return new Response(
      JSON.stringify({ success: true, product: productData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    console.error("Error fetching product:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
