import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type PlanType = "free" | "silver" | "gold" | "developer"
type DbPlanType = "free" | "basic" | "premium" | "developer"

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

const coerceBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true" || normalized === "1") return true
    if (normalized === "false" || normalized === "0") return false
  }
  if (typeof value === "number") {
    return value !== 0
  }
  return false
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

    const body = await req.json()
    const userPlanIdRaw = body.user_plan_id ?? body.userPlanId ?? null
    const rawTargetType = body.target_plan_type ?? body.targetPlanType ?? body.rawTargetType
    const rawIsYearly = body.is_yearly ?? body.isYearly

    const allowedPlanInputs = new Set(["free", "silver", "gold", "developer", "basic", "premium"])
    const rawTargetString =
      typeof rawTargetType === "string" ? rawTargetType.trim().toLowerCase() : null

    if (!rawTargetString || !allowedPlanInputs.has(rawTargetString)) {
      throw new Error("リクエストに必要な項目が不足しています")
    }

    const userPlanId =
      typeof userPlanIdRaw === "string" && userPlanIdRaw.trim().length > 0
        ? userPlanIdRaw
        : null

    const targetPlanType: PlanType = normalizePlanTypeValue(rawTargetString)
    const targetDbPlanType = toDbPlanType(rawTargetString)
    const useYearly = coerceBoolean(rawIsYearly)

    console.log("[stripe-manage-plan] Request body:", {
      rawTargetType,
      userPlanId,
      targetPlanType,
      targetDbPlanType,
      is_yearly: useYearly,
    })

    let currentPlan: any = null

    if (userPlanId) {
      const { data, error } = await supabaseService
        .from("user_plans")
        .select("*")
        .eq("id", userPlanId)
        .maybeSingle()

      if (error) {
        throw new Error("現在のプラン情報が見つかりません")
      }

      currentPlan = data
    }

    if (!currentPlan) {
      const { data, error } = await supabaseService
        .from("user_plans")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle()

      if (error) {
        throw new Error("現在のプラン情報が見つかりません")
      }

      currentPlan = data
    }

    if (currentPlan && currentPlan.user_id !== userId) {
      throw new Error("ご本人のプランのみ変更できます")
    }

    const currentPlanType = currentPlan
      ? normalizePlanTypeValue(currentPlan.plan_type)
      : "free"
    const currentRank = PLAN_RANK[currentPlanType] ?? 0
    const targetRank = PLAN_RANK[targetPlanType] ?? 0

    if (targetRank > currentRank) {
      throw new Error("アップグレードは本エンドポイントでは処理できません")
    }

    const { data: targetPlanConfig, error: targetPlanError } = await supabaseService
      .from("plan_configs")
      .select("plan_type, name, monthly_price, yearly_price, features")
      .eq("plan_type", targetDbPlanType)
      .maybeSingle()

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

    const currentSubscriptionId = normalizeSubscriptionId(currentPlan?.stripe_subscription_id)

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
      if (currentSubscriptionId) {
        targetStripeAuth = await detectStripeKey(
          {
            test: stripeCredentials.test_secret_key,
            live: stripeCredentials.live_secret_key,
          },
          {
            subscriptionId: currentSubscriptionId,
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
    let subscriptionId: string | null = currentSubscriptionId
    let customerId: string | null = currentPlan?.stripe_customer_id ?? null
    let periodEnd: string | null = null

    if (targetPlanType === "free") {
      if (currentSubscriptionId && targetStripeAuth) {
        try {
          await stripeRequest(
            targetStripeAuth.apiKey,
            "DELETE",
            `subscriptions/${encodeURIComponent(currentSubscriptionId)}`,
            {
              invoice_now: "false",
              prorate: "true",
            }
          )
        } catch (cancelError) {
          if (
            cancelError instanceof Error &&
            /unrecognized request url/i.test(cancelError.message)
          ) {
            console.warn(
              "[stripe-manage-plan] Subscription cancel endpoint unavailable, assuming subscription already inactive:",
              currentSubscriptionId
            )
          } else if (
            cancelError instanceof Error &&
            /no such subscription/i.test(cancelError.message)
          ) {
            console.warn(
              "[stripe-manage-plan] Subscription already canceled in Stripe:",
              currentSubscriptionId
            )
          } else {
            throw cancelError
          }
        }
      }
      subscriptionId = null
      resultMessage = "フリープランへ変更しました"
    } else {
      if (!targetStripeAuth) {
        throw new Error("Stripeクライアントを初期化できませんでした")
      }
      if (!currentSubscriptionId) {
        throw new Error("アクティブなStripeサブスクリプションが見つかりません")
      }

      const subscription = await stripeRequest(
        targetStripeAuth.apiKey,
        "GET",
        `subscriptions/${encodeURIComponent(currentSubscriptionId)}`
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

    if (targetPlanType === "free") {
      // フリープランへの変更の場合、既存のプランを非アクティブ化し、新しいフリープランを作成する
      if (currentPlan?.id) {
        const { error: deactivateError } = await supabaseService
          .from("user_plans")
          .update({
            is_active: false,
            plan_end_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            stripe_subscription_id: null,
          })
          .eq("id", currentPlan.id);

        if (deactivateError) {
          throw new Error(`現在のプランの非アクティブ化に失敗しました: ${deactivateError.message}`);
        }
      }

      // 新しいフリープランレコードを挿入
      const { error: insertError } = await supabaseService
        .from("user_plans")
        .insert({
          user_id: userId,
          plan_type: "free",
          is_yearly: false,
          monthly_revenue: 0,
          is_active: true,
          plan_start_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        // もしユーザーが既にアクティブなフリープランを持っている場合、ユニーク制約違反が起こる可能性がある
        // その場合は特にエラーとせず、処理を続行する
        if (insertError.code !== '23505') { // unique_violation
          throw new Error(`フリープランの作成に失敗しました: ${insertError.message}`);
        }
      }
    } else {
      // 有料プラン間の変更
      const planRecordPayload = {
        plan_type: targetDbPlanType,
        is_yearly: useYearly,
        monthly_revenue: useYearly ? yearlyPrice : monthlyPrice,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        plan_start_date: new Date().toISOString(),
        plan_end_date: periodEnd,
        updated_at: new Date().toISOString(),
        is_active: true,
      };

      if (currentPlan?.id) {
        const { error: updateError } = await supabaseService
          .from("user_plans")
          .update(planRecordPayload)
          .eq("id", currentPlan.id);

        if (updateError) {
          throw new Error(`プラン情報の更新に失敗しました: ${updateError.message}`);
        }
      } else {
        const { error: insertError } = await supabaseService
          .from("user_plans")
          .insert({
            ...planRecordPayload,
            user_id: userId,
          });

        if (insertError) {
          throw new Error(`プラン情報の作成に失敗しました: ${insertError.message}`);
        }
      }
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
