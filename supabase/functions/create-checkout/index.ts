// supabase/functions/create-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
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

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header is required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      throw new Error("ユーザー情報の取得に失敗しました");
    }
    const purchaserId = userData.user.id;

    const {
      plan_type,
      is_yearly = false,
      success_url: bodySuccessUrl,
      cancel_url: bodyCancelUrl,
    } = await req.json();

    if (!plan_type) throw new Error("plan_type is required");

    const { data: plan, error: planError } = await supabase
      .from("plan_configs")
      .select("plan_type, name, monthly_price, yearly_price, features, is_active")
      .eq("plan_type", plan_type)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      throw new Error("プランが見つかりません");
    }

    const featureConfig = (plan.features ?? {}) as Record<string, unknown>;
    const stripeConfig =
      typeof featureConfig === "object" && featureConfig !== null
        ? (featureConfig.stripe as Record<string, unknown> | undefined)
        : undefined;

    const priceId =
      stripeConfig && typeof stripeConfig === "object"
        ? (is_yearly
            ? stripeConfig.yearlyPriceId ?? stripeConfig.yearly_price_id
            : stripeConfig.monthlyPriceId ?? stripeConfig.monthly_price_id)
        : undefined;

    if (!priceId || typeof priceId !== "string" || !priceId.trim()) {
      throw new Error("Stripe Price ID が設定されていません");
    }

    const { data: platformKeys, error: keyError } = await supabase
      .from("platform_stripe_credentials")
      .select("test_secret_key, live_secret_key")
      .maybeSingle();

    if (keyError) {
      throw new Error("Stripeキーの取得に失敗しました");
    }
    if (!platformKeys) {
      throw new Error("Stripeキーが登録されていません。開発者設定でキーを保存してください");
    }

    const testStripe = platformKeys.test_secret_key
      ? new Stripe(platformKeys.test_secret_key, { apiVersion: "2024-06-20" })
      : null;
    const liveStripe = platformKeys.live_secret_key
      ? new Stripe(platformKeys.live_secret_key, { apiVersion: "2024-06-20" })
      : null;

    if (!testStripe && !liveStripe) {
      throw new Error("Stripeのシークレットキーが設定されていません");
    }

    let stripe: Stripe | null = null;
    let detectedLivemode = false;
    const tryRetrievePrice = async (client: Stripe | null, live = false) => {
      if (!client) return false;
      try {
        await client.prices.retrieve(priceId.trim());
        stripe = client;
        detectedLivemode = live;
        return true;
      } catch (error) {
        console.log(
          `[create-checkout] Unable to retrieve price ${priceId} in ${live ? "live" : "test"} mode:`,
          error instanceof Error ? error.message : error,
        );
        return false;
      }
    };

    const priceFound = (await tryRetrievePrice(testStripe, false)) || (await tryRetrievePrice(liveStripe, true));
    if (!priceFound || !stripe) {
      throw new Error("Stripe価格がテスト・本番のいずれにも見つかりませんでした");
    }

    const origin =
      req.headers.get("origin") ||
      "https://rtjxurmuaawyzjcdkqxt.lovable.app";
    const successUrl = bodySuccessUrl || `${origin}/checkout/success`;
    const cancelUrl = bodyCancelUrl || `${origin}/checkout/cancel`;

    const billingCycle = is_yearly ? "yearly" : "monthly";
    const metadata: Record<string, string> = {
      plan_type: plan.plan_type,
      plan_name: String(plan.name ?? ""),
      billing_cycle: billingCycle,
      purchaser_id: purchaserId,
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId.trim(), quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      client_reference_id: purchaserId,
      customer_creation: "always",
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    const amount = is_yearly ? Number(plan.yearly_price ?? 0) : Number(plan.monthly_price ?? 0);

    await supabase.from("orders").insert({
      user_id: purchaserId,
      status: "pending",
      amount,
      currency: "JPY",
      livemode: detectedLivemode,
      stripe_session_id: session.id,
      metadata,
    });

    console.log("[create-checkout] Created session:", session.id, {
      plan_type,
      billingCycle,
      detectedLivemode,
    });

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
