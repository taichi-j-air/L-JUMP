import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type PlanType = "free" | "silver" | "gold" | "developer"

interface StripeSettings {
  productId?: string
  monthlyPriceId?: string
  yearlyPriceId?: string
  managerUserId?: string
}

const PLAN_RANK: Record<PlanType, number> = {
  free: 0,
  silver: 1,
  gold: 2,
  developer: 3,
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
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? toFormBody(params) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Stripe API error (${response.status}): ${errorText}`)
  }

  return await response.json()
}

const detectStripeKey = async (
  keys: { test?: string | null; live?: string | null },
  options: { priceId?: string; subscriptionId?: string }
) => {
  const tryKey = async (key: string | null | undefined, isLive: boolean) => {
    if (!key) return null
    try {
      if (options.priceId) {
        await stripeRequest(key, "GET", `prices/${encodeURIComponent(options.priceId)}`)
      } else if (options.subscriptionId) {
        await stripeRequest(key, "GET", `subscriptions/${encodeURIComponent(options.subscriptionId)}`)
      } else {
        return null
      }
      return { apiKey: key, isLiveMode: isLive }
    } catch (error) {
      console.log(
        `[stripe-manage-plan] Unable to access resource with ${isLive ? "live" : "test"} key:`,
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
    throw new Error("Stripe価格またはサブスクリプションにアクセスできません。Stripe設定を確認してください。")
  }

  return detected
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
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

    const { user_plan_id: userPlanId, target_plan_type: rawTargetType, is_yearly: isYearly } =
      await req.json()

    console.log("[stripe-manage-plan] Request body:", { rawTargetType, userPlanId, is_yearly: isYearly })

    let normalizedTarget: PlanType | null = null
    if (rawTargetType) {
      const rawStr = String(rawTargetType).trim().toLowerCase()
      if (rawStr === "free" || rawStr === "silver" || rawStr === "gold") {
        normalizedTarget = rawStr as PlanType
      }
    }

    if (!userPlanId || !normalizedTarget) {
      throw new Error("リクエストに必要な項目が不足しています")
    }

    const targetPlanType: PlanType = normalizedTarget

    const { data: currentPlan, error: planError } = await supabaseService
      .from("user_plans")
      .select("*")
      .eq("id", userPlanId)
      .single()

    if (planError || !currentPlan) {
      throw new Error("現在のプラン情報が見つかりません")
    }

    if (currentPlan.user_id !== userId) {
      throw new Error("ご本人のプランのみ変更できます")
    }

    const currentPlanType = currentPlan.plan_type as PlanType
    const currentRank = PLAN_RANK[currentPlanType] ?? 0
    const targetRank = PLAN_RANK[targetPlanType] ?? 0

    if (targetRank > currentRank) {
      throw new Error("アップグレードは本エンドポイントでは処理できません")
    }

    const { data: targetPlanConfig, error: targetPlanError } = await supabaseService
      .from("plan_configs")
      .select("plan_type, name, monthly_price, yearly_price, features")
      .eq("plan_type", targetPlanType)
      .single()

    if (targetPlanError || !targetPlanConfig) {
      throw new Error("変更先のプラン設定が見つかりません")
    }

    const targetStripeSettings = parseStripeSettings(targetPlanConfig.features)
    const { data: stripeCredentials, error: credentialError } = await supabaseService
      .from("platform_stripe_credentials")
      .select("test_secret_key, live_secret_key")
      .single()

    if (credentialError) {
      throw new Error("Stripe認証情報の取得に失敗しました")
    }

    if (!stripeCredentials) {
      throw new Error("Stripeキーが登録されていません。先にプラン管理で設定してください")
    }

    const monthlyPrice = Number(targetPlanConfig.monthly_price ?? 0)
    const yearlyPrice = Number(targetPlanConfig.yearly_price ?? 0)
    const useYearly = Boolean(isYearly)

    const priceId =
      targetPlanType === "free"
        ? undefined
        : useYearly
        ? targetStripeSettings.yearlyPriceId
        : targetStripeSettings.monthlyPriceId

    if (targetPlanType !== "free" && !priceId) {
      throw new Error("Stripe Price ID が設定されていません")
    }

    let targetStripeAuth:
      | { apiKey: string; isLiveMode: boolean }
      | null = null

    if (targetPlanType === "free") {
      if (currentPlan.stripe_subscription_id) {
        targetStripeAuth = await detectStripeKey(
          {
            test: stripeCredentials.test_secret_key,
            live: stripeCredentials.live_secret_key,
          },
          {
            subscriptionId: currentPlan.stripe_subscription_id,
          }
        )
      }
    } else {
      targetStripeAuth = await detectStripeKey(
        {
          test: stripeCredentials.test_secret_key,
          live: stripeCredentials.live_secret_key,
        },
        {
          priceId,
        }
      )
    }

    let resultMessage = ""
    let subscriptionId: string | null = currentPlan.stripe_subscription_id
    let customerId: string | null = currentPlan.stripe_customer_id
    let periodEnd: string | null = null

    if (targetPlanType === "free") {
      if (currentPlan.stripe_subscription_id && targetStripeAuth) {
        await stripeRequest(
          targetStripeAuth.apiKey,
          "DELETE",
          `subscriptions/${encodeURIComponent(currentPlan.stripe_subscription_id)}`,
          {
            invoice_now: "false",
            prorate: "true",
          }
        )
      }
      subscriptionId = null
      resultMessage = "フリープランへ変更しました"
    } else {
      if (!targetStripeAuth) {
        throw new Error("Stripeクライアントを初期化できませんでした")
      }
      if (!currentPlan.stripe_subscription_id) {
        throw new Error("アクティブなStripeサブスクリプションが見つかりません")
      }

      const subscription = await stripeRequest(
        targetStripeAuth.apiKey,
        "GET",
        `subscriptions/${encodeURIComponent(currentPlan.stripe_subscription_id)}`
      )
      const primaryItem = subscription.items.data[0]
      if (!primaryItem?.id) {
        throw new Error("Stripeサブスクリプションにプラン項目が見つかりません")
      }

      const updatedSubscription = await stripeRequest(
        targetStripeAuth.apiKey,
        "POST",
        `subscriptions/${encodeURIComponent(subscription.id)}`,
        {
          [`items[0][id]`]: primaryItem.id,
          [`items[0][price]`]: priceId,
          proration_behavior: "create_prorations",
        }
      )

      subscriptionId = updatedSubscription.id
      const customer = updatedSubscription.customer
      customerId = typeof customer === "string" ? customer : customer?.id ?? null
      if (updatedSubscription.current_period_end) {
        periodEnd = new Date(updatedSubscription.current_period_end * 1000).toISOString()
      }
      resultMessage = `${targetPlanConfig.name}へ変更しました`
    }

    const { error: updateError } = await supabaseService
      .from("user_plans")
      .update({
        plan_type: targetPlanType,
        is_yearly: targetPlanType === "free" ? false : useYearly,
        monthly_revenue: targetPlanType === "free" ? 0 : useYearly ? yearlyPrice : monthlyPrice,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        plan_start_date: new Date().toISOString(),
        plan_end_date: periodEnd,
        updated_at: new Date().toISOString(),
        is_active: true,
      })
      .eq("id", currentPlan.id)

    if (updateError) {
      throw new Error("プラン情報の更新に失敗しました")
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: resultMessage,
        plan_type: targetPlanType,
        is_yearly: targetPlanType === "free" ? false : useYearly,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("[stripe-manage-plan] Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "不明なエラーが発生しました",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    )
  }
})
