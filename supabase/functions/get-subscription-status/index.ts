import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

type PlanType = "free" | "silver" | "gold" | "developer"
type DbPlanType = "free" | "basic" | "premium" | "developer"

interface StripeSettings {
  productId?: string
  monthlyPriceId?: string
  yearlyPriceId?: string
  managerUserId?: string
}

const normalizePlanTypeValue = (raw: string | null | undefined): PlanType => {
  const normalized = (raw ?? "").toLowerCase()
  switch (normalized) {
    case "silver":
    case "basic":
      return "silver"
    case "gold":
    case "premium":
      return "gold"
    case "developer":
      return "developer"
    case "free":
    default:
      return "free"
  }
}

const toDbPlanType = (value: string | null | undefined): DbPlanType => {
  const normalized = normalizePlanTypeValue(value)
  switch (normalized) {
    case "silver":
      return "basic"
    case "gold":
      return "premium"
    case "developer":
      return "developer"
    case "free":
    default:
      return "free"
  }
}

const normalizeSubscriptionId = (input?: string | null) => {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/cancel$/i, "")
}

const parseStripeSettings = (raw: unknown): StripeSettings => {
  if (!raw || typeof raw !== "object") {
    return {}
  }

  const source = raw as Record<string, unknown>
  const stripeRaw = source.stripe
  if (!stripeRaw || typeof stripeRaw !== "object") {
    return {}
  }

  const stripe = stripeRaw as Record<string, unknown>

  const result: StripeSettings = {}
  if (typeof stripe.productId === "string") result.productId = stripe.productId.trim()
  if (typeof stripe.monthlyPriceId === "string") result.monthlyPriceId = stripe.monthlyPriceId.trim()
  if (typeof stripe.yearlyPriceId === "string") result.yearlyPriceId = stripe.yearlyPriceId.trim()
  if (typeof stripe.managerUserId === "string") result.managerUserId = stripe.managerUserId.trim()

  return result
}

const toFormBody = (params: Record<string, string | number | boolean | null | undefined>) => {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    body.append(key, String(value))
  }
  return body.toString()
}

const stripeRequest = async (
  apiKey: string,
  method: string,
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>
) => {
  const url = new URL(`https://api.stripe.com/v1/${path}`)
  let body: string | undefined

  if (params) {
    if (method === "GET" || method === "DELETE") {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue
        url.searchParams.append(key, String(value))
      }
    } else {
      body = toFormBody(params)
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[get-subscription-status] Stripe API error (${response.status}): ${errorText}`)
    throw new Error(`Stripe API error (${response.status})`)
  }

  try {
    return await response.json()
  } catch (err) {
    console.error("[get-subscription-status] Failed to parse Stripe response:", err)
    throw new Error("Failed to parse Stripe response")
  }
}

const detectStripeKey = async (
  keys: { test?: string | null; live?: string | null },
  options: { priceId?: string | null; subscriptionId?: string | null }
) => {
  const tryKey = async (key: string | null | undefined, isLive: boolean) => {
    if (!key) return null
    try {
      if (options.subscriptionId) {
        await stripeRequest(key, "GET", `subscriptions/${encodeURIComponent(options.subscriptionId)}`)
      } else if (options.priceId) {
        await stripeRequest(key, "GET", `prices/${encodeURIComponent(options.priceId)}`)
      } else {
        return null
      }
      return { apiKey: key, isLiveMode: isLive }
    } catch (error) {
      console.log(
        `[get-subscription-status] Unable to access resource with ${isLive ? "live" : "test"} key:`,
        error instanceof Error ? error.message : error
      )
      return null
    }
  }

  let detected = await tryKey(keys.test, false)
  if (!detected) {
    detected = await tryKey(keys.live, true)
  }

  if (!detected) {
    throw new Error("Stripeリソースにアクセスできません。Stripe設定を確認してください。")
  }

  return detected
}

 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders })
   }
 
   if (req.method !== "POST" && req.method !== "GET") {
     return new Response(JSON.stringify({ success: false, error: "Method Not Allowed" }), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
       status: 405,
     })
   }
 
   const supabaseService = createClient(
     Deno.env.get("SUPABASE_URL") ?? "",
     Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
     { auth: { persistSession: false } }
   )
 
   try {
     const authHeader = req.headers.get("Authorization")
     if (!authHeader) {
       throw new Error("認証情報が見つかりません")
     }
 
     const token = authHeader.replace("Bearer ", "")
     const { data: userData, error: userError } = await supabaseService.auth.getUser(token)
     if (userError || !userData?.user?.id) {
       throw new Error("ユーザー情報を取得できませんでした")
     }
     const userId = userData.user.id

    const { data: currentPlan, error: planError } = await supabaseService
      .from("user_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle()

    if (planError) {
      throw new Error(`プラン情報の取得に失敗しました: ${planError.message}`)
    }

    if (!currentPlan) {
      return new Response(
        JSON.stringify({ success: false, error: "アクティブなプランが見つかりません" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    const subscriptionId = normalizeSubscriptionId(currentPlan.stripe_subscription_id)
    if (!subscriptionId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "アクティブなStripeサブスクリプションが見つかりません",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    const currentPlanType = normalizePlanTypeValue(currentPlan.plan_type)
    const dbPlanType = toDbPlanType(currentPlan.plan_type)

    const { data: planConfig, error: planConfigError } = await supabaseService
      .from("plan_configs")
      .select("plan_type, name, monthly_price, yearly_price, features")
      .eq("plan_type", dbPlanType)
      .maybeSingle()

    if (planConfigError) {
      throw new Error(`プラン設定の取得に失敗しました: ${planConfigError.message}`)
    }

    const stripeSettings = parseStripeSettings(planConfig?.features)

    const { data: credentials, error: credentialError } = await supabaseService
      .from("platform_stripe_credentials")
      .select("test_secret_key, live_secret_key")
      .maybeSingle()

    if (credentialError) {
      throw new Error(`Stripe認証情報の取得に失敗しました: ${credentialError.message}`)
    }

    if (!credentials) {
      throw new Error("Stripeキーが登録されていません。先に設定を行ってください。")
    }

    const useYearly = Boolean(currentPlan.is_yearly)
    const priceId = useYearly ? stripeSettings.yearlyPriceId : stripeSettings.monthlyPriceId

    const stripeAuth = await detectStripeKey(
      {
        test: credentials.test_secret_key ?? null,
        live: credentials.live_secret_key ?? null,
      },
      { priceId: priceId ?? null, subscriptionId }
    )

    const subscription = await stripeRequest(
      stripeAuth.apiKey,
      "GET",
      `subscriptions/${encodeURIComponent(subscriptionId)}`
    )

    const primaryItem = subscription?.items?.data?.[0] ?? null
    const currentPeriodStart =
      typeof subscription.current_period_start === "number"
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null
    const currentPeriodEnd =
      typeof subscription.current_period_end === "number"
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null

    if (currentPeriodEnd && currentPlan.id) {
      await supabaseService
        .from("user_plans")
        .update({ plan_end_date: currentPeriodEnd, updated_at: new Date().toISOString() })
        .eq("id", currentPlan.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          current_plan_type: currentPlanType,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          interval:
            primaryItem?.price?.recurring?.interval ??
            currentPlan.is_yearly
              ? "year"
              : "month",
          interval_count: primaryItem?.price?.recurring?.interval_count ?? 1,
          unit_amount: typeof primaryItem?.price?.unit_amount === "number" ? primaryItem.price.unit_amount : null,
          currency: primaryItem?.price?.currency ?? "jpy",
          live_mode: stripeAuth.isLiveMode,
          plan_label: planConfig?.name ?? null,
          plan_price: useYearly
            ? Number(planConfig?.yearly_price ?? 0)
            : Number(planConfig?.monthly_price ?? 0),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[get-subscription-status] Error:", message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
