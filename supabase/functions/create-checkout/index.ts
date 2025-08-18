// supabase/functions/create-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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

    const { product_id, uid, utm_source, utm_medium, utm_campaign } =
      await req.json();

    if (!product_id) throw new Error("product_id is required");

    console.log("create-checkout-session payload", {
      product_id,
      uid,
      utm_source,
      utm_medium,
      utm_campaign,
    });

    // 商品 + 設定
    const { data: product, error: productError } = await supabase
      .from("products")
      .select(
        `
        id,
        user_id,
        name,
        description,
        stripe_price_id,
        product_type,
        price,
        currency,
        is_active,
        product_settings (
          success_redirect_url,
          cancel_redirect_url
        )
      `,
      )
      .eq("id", product_id)
      .eq("is_active", true)
      .single();

    if (productError || !product) {
      throw new Error("Product not found or inactive");
    }
    if (!product.stripe_price_id) {
      throw new Error("stripe_price_id is not set for this product");
    }

    // 管理者のStripe鍵
    const { data: creds, error: credErr } = await supabase
      .from("stripe_credentials")
      .select("test_secret_key, live_secret_key")
      .eq("user_id", product.user_id)
      .single();
    if (credErr || !creds)
      throw new Error("Stripe credentials not found for product owner");

    const testStripe = new Stripe(creds.test_secret_key || "", {
      apiVersion: "2024-06-20",
    });
    const liveStripe = new Stripe(creds.live_secret_key || "", {
      apiVersion: "2024-06-20",
    });

    // price の livemode から自動判定
    let stripe: Stripe;
    let detectedLivemode = false;
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
    console.log("create-checkout-session detected_livemode", detectedLivemode);

    const nonce = crypto.randomUUID();

    const metadata: Record<string, string> = {
      product_id: product.id,
      manager_user_id: product.user_id,
      product_type: product.product_type,
      nonce,
    };
    if (uid) metadata.uid = uid;
    if (utm_source) metadata.utm_source = utm_source;
    if (utm_medium) metadata.utm_medium = utm_medium;
    if (utm_campaign) metadata.utm_campaign = utm_campaign;

    const settings = (product as any).product_settings?.[0] ?? {};
    const origin =
      req.headers.get("origin") ||
      "https://rtjxurmuaawyzjcdkqxt.lovable.app"; // fallback
    const successUrl = settings.success_redirect_url || `${origin}/checkout/success`;
    const cancelUrl = settings.cancel_redirect_url || `${origin}/checkout/cancel`;

    const mode: Stripe.Checkout.SessionCreateParams.Mode =
      product.product_type === "one_time" ? "payment" : "subscription";

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [{ price: product.stripe_price_id, quantity: 1 }],
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      client_reference_id: uid || "no-uid",
      customer_creation: "always",
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    // 注文レコード（金額はproducts.priceを保存）
    await supabase.from("orders").insert({
      user_id: product.user_id,
      product_id: product.id,
      status: "pending",
      amount: product.price, // ← amount ではなく price を保存
      currency: product.currency,
      friend_uid: uid,
      livemode: detectedLivemode,
      stripe_session_id: session.id,
      metadata,
    });

    console.log("[create-checkout-session] Created session:", session.id);

    return new Response(
      JSON.stringify({ ok: true, url: session.url, id: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    console.error("Error creating checkout session:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
