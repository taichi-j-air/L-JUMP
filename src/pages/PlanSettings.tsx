import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
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

const PLAN_ICON_MAP: Record<PlanType, { icon: LucideIcon; color: string }> = {
  free: { icon: Star, color: "text-gray-500" },
  silver: { icon: Zap, color: "text-blue-500" },
  gold: { icon: Crown, color: "text-amber-500" },
  developer: { icon: Shield, color: "text-purple-600" },
}

const PUBLIC_PLAN_ORDER: PlanType[] = ["free", "silver", "gold"]
const PLAN_RANK: Record<PlanType, number> = {
  free: 0,
  silver: 1,
  gold: 2,
  developer: 3,
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(price || 0)

const formatLimit = (value: number | null, suffix: string) =>
  value === null ? "無制限" : `${value.toLocaleString()}${suffix}`

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
  }, [user])

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plan_configs")
        .select("*")
        .eq("is_active", true)

      if (error) throw error

      const formattedPlans: PlanCard[] =
        data
          ?.map((plan: any) => {
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
          .filter((plan) => PUBLIC_PLAN_ORDER.includes(plan.type))
          .sort(
            (a, b) => PUBLIC_PLAN_ORDER.indexOf(a.type) - PUBLIC_PLAN_ORDER.indexOf(b.type)
          ) || []

      setPlans(formattedPlans)
    } catch (error) {
      console.error("Error loading plans:", error)
      toast.error("プラン情報の取得に失敗しました")
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
      await handleDowngrade(selectedPlan)
    } else {
      await handleStripeCheckout(selectedPlan)
    }
  }

  const createFreePlanRecord = async () => {
    if (!user) return
    setProcessing(true)
    try {
      if (currentPlan) {
        await supabase.from("user_plans").update({ is_active: false }).eq("id", currentPlan.id)
      }

      const { data, error } = await supabase
        .from("user_plans")
        .insert({
          user_id: user.id,
          plan_type: "free",
          is_yearly: false,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      setCurrentPlan(data)
      await loadPlans()
      toast.success("フリープランに変更しました")
    } catch (error) {
      console.error("Error changing to free plan:", error)
      toast.error("プランの変更に失敗しました")
    } finally {
      setProcessing(false)
    }
  }

  const handleDowngrade = async (plan: PlanCard) => {
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
          target_plan_type: plan.type,
          is_yearly: isYearly,
        },
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error(data?.error || "プラン変更に失敗しました")
      }

      await loadCurrentPlan()
      await loadPlans()
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
          success_url: `${window.location.origin}/plan-settings?success=true`,
          cancel_url: `${window.location.origin}/plan-settings?canceled=true`,
        },
      })

      if (error) throw error

      if (data?.url) {
        window.open(data.url, "_blank")
      }
    } catch (error) {
      console.error("Error creating checkout session:", error)
      toast.error("決済処理の開始に失敗しました")
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

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (!user) {
    return <div className="p-4">ログインが必要です</div>
  }

  const activePlanType: PlanType | null = currentPlan
    ? normalizePlanType(currentPlan.plan_type)
    : null

  const planDictionary = Object.fromEntries(plans.map((plan) => [plan.type, plan]))

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
    </div>
  )
}
