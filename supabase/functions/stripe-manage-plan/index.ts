import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
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

const detectStripeClient = async (
  keys: { test?: string | null; live?: string | null },
  options: { priceId?: string; subscriptionId?: string }
) => {
  const tryKey = async (key: string | null | undefined, isLive: boolean) => {
    if (!key) return null
    const client = new Stripe(key, { apiVersion: "2024-06-20" })
    try {
      if (options.priceId) {
        await client.prices.retrieve(options.priceId)
      } else if (options.subscriptionId) {
        await client.subscriptions.retrieve(options.subscriptionId)
      } else {
        return null
      }
      return { stripe: client, isLiveMode: isLive }
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

    if (!userPlanId || !rawTargetType) {
      throw new Error("リクエストに必要な項目が不足しています")
    }

    const targetPlanType = String(rawTargetType) as PlanType
    if (!["free", "silver", "gold"].includes(targetPlanType)) {
      throw new Error("指定されたプラン種別はダウングレード対象外です")
    }

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

    const { data: currentPlanConfig } = await supabaseService
      .from("plan_configs")
      .select("plan_type, features")
      .eq("plan_type", currentPlanType)
      .maybeSingle()

    const targetStripeSettings = parseStripeSettings(targetPlanConfig.features)
    const currentStripeSettings = parseStripeSettings(currentPlanConfig?.features)

    const managerUserId =
      targetStripeSettings.managerUserId ?? currentStripeSettings.managerUserId
    if (!managerUserId) {
      throw new Error("Stripeの管理者ユーザーIDが設定されていません")
    }

    const { data: stripeCredentials, error: credentialError } = await supabaseService
      .from("stripe_credentials")
      .select("test_secret_key, live_secret_key")
      .eq("user_id", managerUserId)
      .maybeSingle()

    if (credentialError || !stripeCredentials) {
      throw new Error("Stripe認証情報を取得できませんでした")
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

    let targetStripeClient:
      | { stripe: Stripe; isLiveMode: boolean }
      | null = null

    if (targetPlanType === "free") {
      if (currentPlan.stripe_subscription_id) {
        targetStripeClient = await detectStripeClient(
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
      targetStripeClient = await detectStripeClient(
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
      if (currentPlan.stripe_subscription_id && targetStripeClient) {
        await targetStripeClient.stripe.subscriptions.cancel(currentPlan.stripe_subscription_id, {
          invoice_now: false,
          prorate: true,
        })
      }
      subscriptionId = null
      resultMessage = "フリープランへ変更しました"
    } else {
      if (!targetStripeClient) {
        throw new Error("Stripeクライアントを初期化できませんでした")
      }
      if (!currentPlan.stripe_subscription_id) {
        throw new Error("アクティブなStripeサブスクリプションが見つかりません")
      }

      const subscription = await targetStripeClient.stripe.subscriptions.retrieve(
        currentPlan.stripe_subscription_id
      )
      const primaryItem = subscription.items.data[0]
      if (!primaryItem?.id) {
        throw new Error("Stripeサブスクリプションにプラン項目が見つかりません")
      }

      const updatedSubscription = await targetStripeClient.stripe.subscriptions.update(
        subscription.id,
        {
          items: [{ id: primaryItem.id, price: priceId }],
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
