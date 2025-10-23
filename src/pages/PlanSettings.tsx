import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User, FunctionsHttpError } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Check, Star, Zap, Crown, Shield, CreditCard } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  PLAN_TYPE_LABELS,
  PlanFeatureConfig,
  PlanType,
  normalizePlanType,
  parsePlanFeatureConfig,
} from "@/types/plans"

interface PlanCard {
  type: PlanType
  name: string
  monthlyPrice: number
  yearlyPrice: number
  featureConfig: PlanFeatureConfig
  icon: LucideIcon
  color: string
}

interface UsageStats {
  steps: number
  flexMessages: number
  memberSites: number
  totalContentBlocks: number
  maxContentBlocksPerSite: number
}

interface SubscriptionInfo {
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  unitAmount: number | null
  currency: string | null
  interval: string | null
  intervalCount: number | null
  liveMode: boolean
  planLabel: string | null
  planPrice: number | null
}

const PLAN_ICON_MAP: Record<PlanType, { icon: LucideIcon; color: string }> = {
  free: { icon: Star, color: "text-gray-500" },
  basic: { icon: Zap, color: "text-blue-500" },
  premium: { icon: Crown, color: "text-amber-500" },
  developer: { icon: Shield, color: "text-purple-600" },
}

const PUBLIC_PLAN_ORDER: PlanType[] = ["free", "basic", "premium"]
const PLAN_RANK: Record<PlanType, number> = {
  free: 0,
  basic: 1,
  premium: 2,
  developer: 3,
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(price || 0)

const formatLimit = (value: number | null, suffix: string) =>
  value === null ? "無制限" : `${value.toLocaleString()}${suffix}`

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
])

const formatCurrency = (value: number, currency: string = "JPY") => {
  const code = currency.toUpperCase()
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(code)
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: code,
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(value)
}

const toCurrencyAmount = (amount: number, currency: string | null | undefined) => {
  const code = (currency ?? "JPY").toUpperCase()
  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return amount
  }
  return amount / 100
}

const buildLimitHighlights = (limits: PlanFeatureConfig["limits"]) => [
  `シナリオ ${formatLimit(limits.scenarioStepLimit, "ステップ")}`,
  `Flex保存 ${formatLimit(limits.flexMessageTemplateLimit, "通")}`,
  `会員サイト ${formatLimit(limits.memberSiteLimit, "件")}`,
  `コンテンツブロック合計 ${formatLimit(limits.totalContentBlockLimit, "個")}`,
  `サイト毎ブロック ${formatLimit(limits.contentBlockPerSiteLimit, "個")}`,
]

const comparisonRows: { label: string; accessor: keyof PlanFeatureConfig["limits"]; suffix: string }[] =
  [
    { label: "シナリオ総ステップ数", accessor: "scenarioStepLimit", suffix: "ステップ" },
    { label: "Flexメッセージ保存数", accessor: "flexMessageTemplateLimit", suffix: "通" },
    { label: "会員サイト作成数", accessor: "memberSiteLimit", suffix: "件" },
    { label: "コンテンツブロック（合計）", accessor: "totalContentBlockLimit", suffix: "個" },
    { label: "サイト毎のコンテンツブロック", accessor: "contentBlockPerSiteLimit", suffix: "個" },
  ]

export default function PlanSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<any>(null)
  const [isYearly, setIsYearly] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [plans, setPlans] = useState<PlanCard[]>([])
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false)
  const [downgradePlan, setDowngradePlan] = useState<PlanCard | null>(null)
  const [downgradeStep, setDowngradeStep] = useState<1 | 2 | 3>(1)
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    loadCurrentPlan()
    loadPlans()
    loadUsageStats()
  }, [user])

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plan_configs")
        .select("*")
        .eq("is_active", true)

      if (error) throw error

      const formattedPlans: PlanCard[] = (data ?? [])
        .map((plan: any) => {
          const type = normalizePlanType(plan.plan_type)
          const featureConfig = parsePlanFeatureConfig(plan.features, type)
          const visuals = PLAN_ICON_MAP[type]

          return {
            type,
            name: plan.name ?? PLAN_TYPE_LABELS[type],
            monthlyPrice: Number(plan.monthly_price ?? 0),
            yearlyPrice: Number(plan.yearly_price ?? 0),
            featureConfig,
            icon: visuals.icon,
            color: visuals.color,
          }
        })
        .filter((plan): plan is PlanCard => PUBLIC_PLAN_ORDER.includes(plan.type))
        .sort(
          (a, b) => PUBLIC_PLAN_ORDER.indexOf(a.type) - PUBLIC_PLAN_ORDER.indexOf(b.type)
        )

      setPlans(formattedPlans)
    } catch (error) {
      console.error("Error loading plans:", error)
      toast.error("プラン情報の取得に失敗しました")
    }
  }

  const loadUsageStats = async () => {
    if (!user) return

    setUsageLoading(true)
    try {
      const [
        planStatsResult,
        memberSiteStatsResult,
        flexMessageCountResult,
        siteListResult,
      ] = await Promise.all([
        supabase.rpc("get_user_plan_and_step_stats", { p_user_id: user.id }),
        supabase.rpc("get_user_member_site_stats", { p_user_id: user.id }),
        supabase
          .from("flex_messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("member_sites")
          .select("id")
          .eq("user_id", user.id),
      ])

      const steps = planStatsResult.data?.[0]?.current_steps ?? 0
      const memberStats = memberSiteStatsResult.data?.[0] ?? null
      const memberSites = memberStats?.current_sites ?? 0
      const totalContentBlocks = memberStats?.current_total_content ?? 0
      const flexMessages = flexMessageCountResult.count ?? 0

      let maxContentBlocksPerSite = 0
      if (siteListResult.error) {
        console.error("Failed to load member sites for counts:", siteListResult.error)
      }

      if (Array.isArray(siteListResult.data) && siteListResult.data.length > 0) {
        const siteIds = siteListResult.data
          .map((site: any) => site.id)
          .filter((id: any) => typeof id === "string" && id.length > 0)
        if (siteIds.length > 0) {
          const { data: contentRows, error: contentError } = await supabase
            .from("member_site_content")
            .select("site_id")
            .in("site_id", siteIds)

          if (!contentError && Array.isArray(contentRows)) {
            const countsBySite = new Map<string, number>()
            contentRows.forEach((row: any) => {
              const siteId = row.site_id
              if (!siteId) return
              const current = countsBySite.get(siteId) ?? 0
              countsBySite.set(siteId, current + 1)
            })
            if (countsBySite.size > 0) {
              maxContentBlocksPerSite = Math.max(...countsBySite.values())
            }
          } else if (contentError) {
            console.error("Failed to load member site content counts:", contentError)
          }
        }
      }

      setUsageStats({
        steps,
        flexMessages,
        memberSites,
        totalContentBlocks,
        maxContentBlocksPerSite,
      })
    } catch (error) {
      console.error("Failed to load usage stats:", error)
      toast.error("利用状況の取得に失敗しました")
      setUsageStats(null)
    } finally {
      setUsageLoading(false)
    }
  }

  const fetchSubscriptionInfo = async () => {
    setSubscriptionLoading(true)
    setSubscriptionError(null)
    try {
      const { data, error } = await supabase.functions.invoke("get-subscription-status", {
        body: {},
      })

      if (error) {
        throw new Error(error.message || "サブスクリプション情報の取得に失敗しました")
      }

      if (!data?.success) {
        throw new Error(data?.error || "サブスクリプション情報の取得に失敗しました")
      }

      const subscription = data.subscription ?? {}
      const currencyCode = typeof subscription.currency === "string" ? subscription.currency.toUpperCase() : "JPY"
      const planPriceFromStripe = typeof subscription.plan_price === "number" ? subscription.plan_price : null
      setSubscriptionInfo({
        currentPeriodStart: subscription.current_period_start ?? null,
        currentPeriodEnd: subscription.current_period_end ?? null,
        unitAmount:
          typeof subscription.unit_amount === "number" ? subscription.unit_amount : null,
        currency: currencyCode,
        interval: typeof subscription.interval === "string" ? subscription.interval : null,
        intervalCount:
          typeof subscription.interval_count === "number" ? subscription.interval_count : null,
        liveMode: Boolean(subscription.live_mode),
        planLabel: typeof subscription.plan_label === "string" ? subscription.plan_label : null,
        planPrice: planPriceFromStripe,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "サブスクリプション情報の取得に失敗しました"
      console.error("[PlanSettings] fetchSubscriptionInfo error:", message)
      setSubscriptionError(message)
      setSubscriptionInfo(null)
    } finally {
      setSubscriptionLoading(false)
    }
  }

  const loadCurrentPlan = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from("user_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single()

      if (error && error.code !== "PGRST116") {
        console.error("Error loading plan:", error)
      } else {
        setCurrentPlan(data)
      }
    } catch (error) {
      console.error("Error loading plan:", error)
    }
  }

  const closeDowngradeDialog = () => {
    if (processing) return
    setShowDowngradeDialog(false)
    setDowngradePlan(null)
    setDowngradeStep(1)
    setSubscriptionInfo(null)
    setSubscriptionError(null)
    setSubscriptionLoading(false)
  }

  const startDowngradeFlow = async (plan: PlanCard) => {
    setDowngradePlan(plan)
    setDowngradeStep(1)
    setShowDowngradeDialog(true)
    setSubscriptionInfo(null)
    setSubscriptionError(null)
    setSubscriptionLoading(false)
    await loadUsageStats()
  }

  const handlePlanChange = async (planType: PlanType) => {
    if (!user || processing) return

    const selectedPlan = plans.find((p) => p.type === planType)
    if (!selectedPlan) {
      toast.error("プランが見つかりません")
      return
    }

    const activePlanType = currentPlan ? normalizePlanType(currentPlan.plan_type) : null

    // 初回設定（まだ user_plans が無い）
    if (!currentPlan) {
      if (planType === "free") {
        await createFreePlanRecord()
      } else {
        await handleStripeCheckout(selectedPlan)
      }
      return
    }

    const currentRank = activePlanType ? PLAN_RANK[activePlanType] ?? 0 : 0
    const targetRank = PLAN_RANK[planType] ?? 0
    const samePlanType = activePlanType === planType
    const switchingToYearly = samePlanType && !currentPlan.is_yearly && isYearly
    const switchingToMonthly = samePlanType && currentPlan.is_yearly && !isYearly

    if (samePlanType && !switchingToYearly && !switchingToMonthly) {
      toast.info("すでにこのプランをご利用中です")
      return
    }

    const isDowngrade =
      planType === "free" ||
      targetRank < currentRank ||
      (samePlanType && switchingToMonthly)

    if (isDowngrade) {
      await startDowngradeFlow(selectedPlan)
    } else {
      await handleStripeCheckout(selectedPlan)
    }
  }

  const createFreePlanRecord = async () => {
    if (!user) return
    setProcessing(true)
    try {
      const { data, error } = await supabase.functions.invoke("stripe-manage-plan", {
        body: {
          target_plan_type: "free",
          is_yearly: false,
        },
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error(data?.error || "プラン変更に失敗しました")
      }

      await loadCurrentPlan()
      await loadPlans()
      toast.success(data?.message ?? "フリープランに変更しました")
    } catch (error) {
      console.error("Error changing to free plan:", error)
      if (error instanceof FunctionsHttpError) {
        const details = error.context as { error?: string }
        toast.error(details?.error ?? "プランの変更に失敗しました")
      } else {
        toast.error(
          error instanceof Error ? error.message : "プランの変更に失敗しました"
        )
      }
    } finally {
      setProcessing(false)
    }
  }

  const performDowngrade = async (plan: PlanCard) => {
    if (!currentPlan) {
      await createFreePlanRecord()
      return
    }

    if (!currentPlan.id) {
      toast.error("現在のプラン情報が正しく取得できません")
      return
    }

    setProcessing(true)
    try {
      const { data, error } = await supabase.functions.invoke("stripe-manage-plan", {
        body: {
          user_plan_id: currentPlan.id,
          target_plan_type: plan.type?.toLowerCase?.() || plan.type,
          is_yearly: isYearly,
        },
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error(data?.error || "プラン変更に失敗しました")
      }

      await loadCurrentPlan()
      await loadPlans()
      await loadUsageStats()
      setDowngradeStep(1)
      setShowDowngradeDialog(false)
      setDowngradePlan(null)
      toast.success(data?.message ?? `${plan.name}へ変更しました`)
    } catch (error) {
      console.error("Error managing subscription:", error)
      toast.error(error instanceof Error ? error.message : "プランの変更に失敗しました")
    } finally {
      setProcessing(false)
    }
  }

  const handleStripeCheckout = async (plan: PlanCard) => {
    if (!user) return

    setProcessing(true)
    try {
      const amount = isYearly ? plan.yearlyPrice : plan.monthlyPrice

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          plan_type: plan.type,
          is_yearly: isYearly,
          amount,
          success_url: `${window.location.origin}/settings/plan?success=true`,
          cancel_url: `${window.location.origin}/settings/plan?canceled=true`,
        },
      })

      if (error) throw error

      if (data?.url) {
        window.location.href = data.url
        return
      }
    } catch (error) {
      console.error("Error creating checkout session:", error)
      if (error instanceof FunctionsHttpError) {
        const details = error.context as { error?: string }
        toast.error(details?.error ?? "決済処理の開始に失敗しました")
      } else {
        toast.error("決済処理の開始に失敗しました")
      }
    } finally {
      setProcessing(false)
    }
  }

  const getDisplayPrice = (plan: PlanCard) => {
    const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice
    const period = isYearly ? "年" : "月"
    return price === 0 ? "無料" : `${formatPrice(price)}/${period}`
  }

  const getYearlyDiscount = (plan: PlanCard) => {
    if (!plan.monthlyPrice || !plan.yearlyPrice) return 0
    return Math.round((1 - (plan.yearlyPrice / 12) / plan.monthlyPrice) * 100)
  }

  const activePlanType: PlanType | null = currentPlan
    ? normalizePlanType(currentPlan.plan_type)
    : null

  const planDictionary = Object.fromEntries(plans.map((plan) => [plan.type, plan]))

  const isUnlimited = (limit: number | null | undefined) =>
    limit === null || limit === undefined || limit === -1

  const formatLimitValue = (limit: number | null | undefined, suffix: string) =>
    isUnlimited(limit) ? "無制限" : `${limit!.toLocaleString()}${suffix}`

  const formatCurrentValue = (value: number, suffix: string) =>
    `${value.toLocaleString()}${suffix}`

  const downgradeComparisons = downgradePlan && usageStats
    ? [
        {
          key: "scenarioStepLimit",
          label: "シナリオ総ステップ数",
          current: usageStats.steps,
          limit: downgradePlan.featureConfig.limits.scenarioStepLimit,
          suffix: "ステップ",
        },
        {
          key: "flexMessageTemplateLimit",
          label: "Flexメッセージ保存数",
          current: usageStats.flexMessages,
          limit: downgradePlan.featureConfig.limits.flexMessageTemplateLimit,
          suffix: "通",
        },
        {
          key: "memberSiteLimit",
          label: "会員サイト作成数",
          current: usageStats.memberSites,
          limit: downgradePlan.featureConfig.limits.memberSiteLimit,
          suffix: "件",
        },
        {
          key: "contentBlockPerSiteLimit",
          label: "サイト毎のコンテンツブロック",
          current: usageStats.maxContentBlocksPerSite,
          limit: downgradePlan.featureConfig.limits.contentBlockPerSiteLimit,
          suffix: "個",
        },
      ]
    : []

  const unmetConditions = downgradeComparisons.filter(
    (item) => !isUnlimited(item.limit) && item.current > (item.limit ?? 0)
  )

  const canConfirmDowngrade =
    !!downgradePlan &&
    !processing &&
    !usageLoading &&
    downgradeComparisons.length > 0 &&
    unmetConditions.length === 0

  const prorationInfo = useMemo(() => {
    if (!currentPlan || !downgradePlan || !activePlanType) return null
    const planInfo = planDictionary[activePlanType]
    if (!planInfo) return null

    const nextBillingRaw = subscriptionInfo?.currentPeriodEnd ?? currentPlan.plan_end_date
    if (!nextBillingRaw) return null
    const nextBilling = new Date(nextBillingRaw)
    if (Number.isNaN(nextBilling.getTime())) return null

    const today = new Date()
    if (nextBilling <= today) return null

    const startRaw = subscriptionInfo?.currentPeriodStart ?? currentPlan.plan_start_date
    const msPerDay = 1000 * 60 * 60 * 24
    let totalCycleMs: number | null = null
    if (startRaw) {
      const startDate = new Date(startRaw)
      if (!Number.isNaN(startDate.getTime()) && nextBilling > startDate) {
        totalCycleMs = nextBilling.getTime() - startDate.getTime()
      }
    }
    const intervalGuess = subscriptionInfo?.interval ?? (currentPlan.is_yearly ? "year" : "month")
    const intervalCount = subscriptionInfo?.intervalCount && subscriptionInfo.intervalCount > 0
      ? subscriptionInfo.intervalCount
      : 1

    if (!totalCycleMs || totalCycleMs <= 0) {
      const daysPerInterval = intervalGuess === "year" ? 365 : intervalGuess === "week" ? 7 : 30
      totalCycleMs = daysPerInterval * intervalCount * msPerDay
    }

    const remainingMs = nextBilling.getTime() - today.getTime()
    if (remainingMs <= 0) return null

    const remainingDays = Math.ceil(remainingMs / msPerDay)
    const totalDays = Math.max(1, Math.round(totalCycleMs / msPerDay))
    let planPrice: number | null = null
    if (subscriptionInfo?.unitAmount && subscriptionInfo.unitAmount > 0) {
      planPrice = toCurrencyAmount(subscriptionInfo.unitAmount, subscriptionInfo.currency) * intervalCount
    } else if (subscriptionInfo?.planPrice && subscriptionInfo.planPrice > 0) {
      planPrice = subscriptionInfo.planPrice
    } else {
      planPrice = currentPlan.is_yearly ? planInfo.yearlyPrice : planInfo.monthlyPrice
    }

    if (typeof planPrice === "string") {
      const parsed = Number(planPrice)
      planPrice = Number.isFinite(parsed) ? parsed : null
    }

    if (!planPrice || planPrice <= 0) {
      return {
        nextBilling,
        remainingDays,
        totalDays,
        remainingValue: 0,
        planPrice: 0,
        billingPeriodLabel: currentPlan.is_yearly ? "年額" : "月額",
        currency: subscriptionInfo?.currency ?? "jpy",
      }
    }

    const dailyPrice = planPrice / totalDays
    const remainingValue = dailyPrice * Math.min(remainingDays, totalDays)
    const elapsedDays = Math.max(0, totalDays - remainingDays)

    return {
      nextBilling,
      remainingDays,
      totalDays,
      remainingValue,
      planPrice,
      billingPeriodLabel:
        intervalGuess === "year"
          ? "年額"
          : intervalGuess === "week"
            ? "週額"
            : "月額",
      currency: (subscriptionInfo?.currency ?? "JPY").toUpperCase(),
      elapsedDays,
    }
  }, [currentPlan, downgradePlan, activePlanType, planDictionary, subscriptionInfo])

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (!user) {
    return <div className="p-4">ログインが必要です</div>
  }

  return (
    <div className="space-y-6">
      <AppHeader user={user} />

      <div className="container mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">プラン設定</h1>
          <p className="text-muted-foreground">
            現在のプランを確認し、利用状況に合わせてアップグレードまたはダウングレードできます。
          </p>
        </div>

        {activePlanType && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>現在のプラン</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1 text-lg">
                {planDictionary[activePlanType]?.name ?? PLAN_TYPE_LABELS[activePlanType]}
              </Badge>
              {currentPlan?.is_yearly && <Badge variant="outline">年額契約</Badge>}
              {currentPlan?.plan_start_date && (
                <span className="text-muted-foreground">
                  開始日:{" "}
                  {new Date(currentPlan.plan_start_date).toLocaleDateString("ja-JP")}
                </span>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-4">
              <Label htmlFor="billing-toggle" className={!isYearly ? "font-semibold" : ""}>
                月額
              </Label>
              <Switch id="billing-toggle" checked={isYearly} onCheckedChange={setIsYearly} />
              <Label htmlFor="billing-toggle" className={isYearly ? "font-semibold" : ""}>
                年額 <Badge variant="secondary" className="ml-1">割引あり</Badge>
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon
            const highlights = [
              ...plan.featureConfig.marketingHighlights,
              ...buildLimitHighlights(plan.featureConfig.limits),
            ]
            const isCurrentPlan = activePlanType === plan.type

            return (
              <Card key={plan.type} className={isCurrentPlan ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${plan.color}`} />
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  <div className="space-y-1">
                    <div className={`text-2xl font-bold ${plan.color}`}>{getDisplayPrice(plan)}</div>
                    {isYearly && plan.type !== "free" && getYearlyDiscount(plan) > 0 && (
                      <div className="text-sm text-green-600">
                        月額より{getYearlyDiscount(plan)}%お得
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="mb-6 space-y-2">
                    {highlights.slice(0, 6).map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? "outline" : "default"}
                    disabled={isCurrentPlan || processing}
                    onClick={() => handlePlanChange(plan.type)}
                  >
                    {processing ? (
                      "処理中..."
                    ) : isCurrentPlan ? (
                      "現在のプラン"
                    ) : plan.type === "free" ? (
                      "フリープランにする"
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {isYearly ? "年額で申し込む" : "月額で申し込む"}
                      </>
                    )}
                  </Button>
                  {plan.type !== "free" && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Stripeで安全に決済されます
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>プラン比較</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b text-sm">
                    <th className="p-2 text-left">項目</th>
                    {PUBLIC_PLAN_ORDER.map((planType) => (
                      <th key={planType} className="p-2 text-center">
                        {PLAN_TYPE_LABELS[planType]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="border-b text-sm">
                      <td className="p-2">{row.label}</td>
                      {PUBLIC_PLAN_ORDER.map((planType) => {
                        const plan = planDictionary[planType]
                        return (
                          <td key={planType} className="p-2 text-center">
                            {plan
                              ? formatLimit(plan.featureConfig.limits[row.accessor], row.suffix)
                              : "-"}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr className="border-b text-sm">
                    <td className="p-2">月額料金</td>
                    {PUBLIC_PLAN_ORDER.map((planType) => {
                      const plan = planDictionary[planType]
                      return (
                        <td key={planType} className="p-2 text-center">
                          {plan ? formatPrice(plan.monthlyPrice) : "-"}
                        </td>
                      )
                    })}
                  </tr>
                  <tr className="text-sm">
                    <td className="p-2">年額料金</td>
                    {PUBLIC_PLAN_ORDER.map((planType) => {
                      const plan = planDictionary[planType]
                      return (
                        <td key={planType} className="p-2 text-center">
                          {plan ? formatPrice(plan.yearlyPrice) : "-"}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      <AlertDialog
        open={showDowngradeDialog}
        onOpenChange={(open) => {
          if (!open) {
            closeDowngradeDialog()
          } else {
            setShowDowngradeDialog(true)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {downgradePlan ? `${downgradePlan.name}へダウングレード` : "ダウングレード"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {downgradeStep === 1
                ? "下位プランの条件を満たす必要があります。現在の利用状況と上限を確認してください。"
                : downgradeStep === 2
                ? "次回の決済日までの残り期間と日割りの金額をご確認ください。"
                : "本当にダウングレードしてよろしいでしょうか？"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 text-sm">
            {downgradeStep === 1 ? (
              usageLoading ? (
                <div className="text-muted-foreground">利用状況を取得しています...</div>
              ) : !usageStats || !downgradePlan ? (
                <div className="text-destructive">
                  利用状況を取得できませんでした。時間を置いて再度お試しください。
                </div>
              ) : (
                <>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="p-2 text-left">項目</th>
                        <th className="p-2 text-right">現在の利用状況</th>
                        <th className="p-2 text-right">{downgradePlan.name} 上限</th>
                        <th className="p-2 text-center">状態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {downgradeComparisons.map((item) => {
                        const exceeds = !isUnlimited(item.limit) && item.current > (item.limit ?? 0)
                        return (
                          <tr
                            key={item.key}
                            className={`border-b last:border-none ${exceeds ? "text-destructive font-semibold" : ""}`}
                          >
                            <td className="p-2">{item.label}</td>
                            <td className="p-2 text-right">{formatCurrentValue(item.current, item.suffix)}</td>
                            <td className="p-2 text-right">{formatLimitValue(item.limit, item.suffix)}</td>
                            <td className="p-2 text-center">{exceeds ? "要削減" : "OK"}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {unmetConditions.length > 0 ? (
                    <div className="text-destructive text-sm">
                      以下の項目が上限を超えています。減らしてからダウングレードしてください。
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      条件を満たしています。次のステップへ進めます。
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    プラン変更後は下位プランの上限が適用され、超過分は利用できなくなる場合があります。
                  </p>
                </>
              )
            ) : downgradeStep === 2 ? (
              subscriptionLoading ? (
                <div className="text-muted-foreground">決済情報を確認しています...</div>
              ) : subscriptionError ? (
                <div className="text-destructive text-sm">{subscriptionError}</div>
              ) : prorationInfo ? (
                <div className="space-y-2">
                  {downgradePlan && (
                    <p>
                      対象プラン: {downgradePlan.name}（{prorationInfo.billingPeriodLabel}）
                    </p>
                  )}
                  {subscriptionInfo?.plan_label && (
                    <p className="text-muted-foreground">
                      Stripe側プラン名: {subscriptionInfo.plan_label}
                    </p>
                  )}
                  <p>次回の決済予定日: {prorationInfo.nextBilling.toLocaleDateString("ja-JP")}</p>
                  <p>
                    残り日数: {prorationInfo.remainingDays}日 / {prorationInfo.totalDays}日（{prorationInfo.billingPeriodLabel}）
                  </p>
                  <p>経過日数: {prorationInfo.elapsedDays}日</p>
                  <p>
                    現在のプラン料金: {formatCurrency(prorationInfo.planPrice, prorationInfo.currency ?? "JPY")} / {prorationInfo.billingPeriodLabel}
                  </p>
                  <p>
                    今ダウングレードすると約 {formatCurrency(prorationInfo.remainingValue, prorationInfo.currency ?? "JPY")} 分の利用価値が失われます。
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ※ 実際の金額は Stripe の決済状況により多少前後する場合があります。
                  </p>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  金額の算出ができませんでしたが、ダウングレードを続行できます。
                </div>
              )
            ) : (
              <div className="space-y-2">
                <p>
                  下位プランへの変更後は、利用可能な機能・上限が即時に切り替わります。超過分のデータは利用できなくなる可能性があります。
                </p>
                <p>
                  よろしければ「ダウングレード」を押して手続きを完了してください。
                </p>
              </div>
            )}
          </div>
          <AlertDialogFooter className="flex justify-end gap-2">
            {downgradeStep === 1 ? (
              <>
                <Button variant="outline" onClick={closeDowngradeDialog} disabled={processing}>
                  キャンセル
                </Button>
                <Button
                  onClick={() => {
                    if (!canConfirmDowngrade || processing) return
                    setDowngradeStep(2)
                    fetchSubscriptionInfo()
                  }}
                  disabled={!canConfirmDowngrade || processing}
                >
                  ダウングレードに進む
                </Button>
              </>
            ) : downgradeStep === 2 ? (
              <>
                <Button variant="outline" onClick={closeDowngradeDialog} disabled={processing || subscriptionLoading}>
                  考え直す
                </Button>
                <Button onClick={() => setDowngradeStep(3)} disabled={processing || subscriptionLoading}>
                  はい、進める
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={closeDowngradeDialog} disabled={processing}>
                  いいえ
                </Button>
                <Button
                  onClick={async () => {
                    if (downgradePlan) {
                      await performDowngrade(downgradePlan)
                    }
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={processing}
                >
                  ダウングレード
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
