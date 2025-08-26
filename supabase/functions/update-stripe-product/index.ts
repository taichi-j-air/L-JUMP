// supabase/functions/update-stripe-product/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    // --- Supabase (service role) ---
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // --- Auth (frontからのinvokeで付与されるJWT) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) throw new Error("Invalid user token");

    // --- Request body ---
    const {
      stripeProductId,
      stripePriceId,
      name,
      description,
      unitAmount,                 // number (円)
      currency = "jpy",           // 例: "jpy"
      interval,                   // "month" | "year" | undefined（undefined = 単発）
      metadata = {},              // { product_id, product_type, ... } など
      isTest = false,
    } = await req.json();

    if (!stripeProductId || !stripePriceId) {
      throw new Error("stripeProductId and stripePriceId are required");
    }
    if (typeof unitAmount !== "number") {
      throw new Error("unitAmount must be a number");
    }

    // --- Stripe credentials per user ---
    const { data: creds, error: credErr } = await supabase
      .from("stripe_credentials")
      .select("test_secret_key, live_secret_key")
      .eq("user_id", user.id)
      .single();
    if (credErr || !creds) throw new Error("Stripe credentials not found");

    const secretKey = isTest ? creds.test_secret_key : creds.live_secret_key;
    if (!secretKey) throw new Error(`Stripe ${isTest ? "test" : "live"} secret key not configured`);

    // --- Stripe client ---
    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    console.log("[update] payload:", {
      stripeProductId, stripePriceId, name, unitAmount, currency, interval, isTest,
    });

    // 1) Product 本体の更新（name / description / metadata）
    const productUpdate: Record<string, any> = { name, metadata };
    if (description && description.trim()) productUpdate.description = description.trim();
    await stripe.products.update(stripeProductId, productUpdate);

    // 2) 既存Priceを取得し、価格/通貨/課金種別の差分を判定
    const currentPrice = await stripe.prices.retrieve(stripePriceId);

    const nextCurrency = (currency || "jpy").toLowerCase();
    const nextAmount = Math.round(unitAmount);
    const currentCurrency = (currentPrice.currency || "jpy").toLowerCase();
    const currentAmount = currentPrice.unit_amount ?? 0;

    const currentIsRecurring = !!currentPrice.recurring;
    const nextIsRecurring = !!interval; // interval 指定があれば継続

    const recurringChanged =
      currentIsRecurring !== nextIsRecurring ||
      (nextIsRecurring && currentPrice.recurring?.interval !== interval);

    const amountChanged = currentAmount !== nextAmount;
    const currencyChanged = currentCurrency !== nextCurrency;

    const priceChanged = amountChanged || currencyChanged || recurringChanged;

    let newPriceId = stripePriceId;

    // 3) 価格関連が変わる場合：新Priceを作って default_price に切替、旧Priceは非アクティブ化
    if (priceChanged) {
      const priceData: any = {
        currency: nextCurrency,
        unit_amount: nextAmount,
        product: stripeProductId,
        metadata,
      };
      if (nextIsRecurring) {
        priceData.recurring = { interval };
        
        // Add trial period for subscription_with_trial products
        if (metadata.product_type === 'subscription_with_trial' && metadata.trial_period_days) {
          priceData.recurring.trial_period_days = parseInt(metadata.trial_period_days);
        }
      }

      const newPrice = await stripe.prices.create(priceData);
      newPriceId = newPrice.id;

      // Product の default_price を新Priceに切替
      await stripe.products.update(stripeProductId, { default_price: newPriceId });

      // 旧Priceを可能なら無効化（defaultから外した後なら多くの場合OK）
      try {
        if (stripePriceId !== newPriceId) {
          await stripe.prices.update(stripePriceId, { active: false });
        }
      } catch (e) {
        console.log("Deactivate old price failed (ignored):", (e as Error).message);
      }

      // DBの products.stripe_price_id を最新に揃える（metadataにproduct_idがある場合のみ）
      const productIdFromMeta = metadata?.product_id as string | undefined;
      if (productIdFromMeta) {
        await supabase
          .from("products")
          .update({ stripe_price_id: newPriceId, updated_at: new Date().toISOString() })
          .eq("id", productIdFromMeta)
          .eq("user_id", user.id);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      productId: stripeProductId,
      priceId: newPriceId,
      priceChanged,
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("update-stripe-product error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
