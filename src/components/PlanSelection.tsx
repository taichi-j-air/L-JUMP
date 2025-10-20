import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Star, Zap, Crown, Shield } from "lucide-react"
import type { LucideIcon } from "lucide-react"
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

interface PlanSelectionProps {
  selectedPlan: PlanType | ""
  onPlanSelect: (plan: PlanType) => void
}

const PLAN_ICON_MAP: Record<PlanType, { icon: LucideIcon; color: string }> = {
  free: { icon: Star, color: "text-gray-500" },
  silver: { icon: Zap, color: "text-blue-500" },
  gold: { icon: Crown, color: "text-amber-500" },
  developer: { icon: Shield, color: "text-purple-600" },
}

const PLAN_ORDER: PlanType[] = ["free", "silver", "gold"]

const formatLimit = (value: number | null, suffix: string) =>
  value === null ? `無制限` : `${value.toLocaleString()}${suffix}`

const buildLimitHighlights = (limits: PlanFeatureConfig["limits"]) => [
  `シナリオ ${formatLimit(limits.scenarioStepLimit, "ステップ")}`,
  `Flex保存 ${formatLimit(limits.flexMessageTemplateLimit, "通")}`,
  `会員サイト ${formatLimit(limits.memberSiteLimit, "件")}`,
  `コンテンツブロック（合計） ${formatLimit(limits.totalContentBlockLimit, "個")}`,
  `サイト毎ブロック ${formatLimit(limits.contentBlockPerSiteLimit, "個")}`,
]

export function PlanSelection({ selectedPlan, onPlanSelect }: PlanSelectionProps) {
  const [plans, setPlans] = useState<PlanCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
            .filter((plan) => PLAN_ORDER.includes(plan.type))
            .sort((a, b) => PLAN_ORDER.indexOf(a.type) - PLAN_ORDER.indexOf(b.type)) || []

        setPlans(formattedPlans)
      } catch (error) {
        console.error("Error loading plans:", error)
      } finally {
        setLoading(false)
      }
    }

    loadPlans()
  }, [])

  if (loading) {
    return <div className="py-8 text-center">プラン情報を読み込み中...</div>
  }

  if (plans.length === 0) {
    return <div className="py-8 text-center">利用可能なプランがありません</div>
  }

  return (
    <div className="space-y-4">
      <Label>
        プランを選択してください <span className="text-red-500">*</span>
      </Label>
      <RadioGroup
        value={selectedPlan}
        onValueChange={(value) => onPlanSelect(value as PlanType)}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon
            const highlights = [
              ...plan.featureConfig.marketingHighlights,
              ...buildLimitHighlights(plan.featureConfig.limits),
            ]
            const displayHighlights = highlights.slice(0, 4)
            const isRecommended = plan.type === "silver"

            return (
              <Card
                key={plan.type}
                className={`relative cursor-pointer transition-all hover:shadow-lg ${
                  selectedPlan === plan.type ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => onPlanSelect(plan.type)}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                    <span className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
                      おすすめ
                    </span>
                  </div>
                )}
                <CardHeader className="text-center">
                  <div className="mb-2 flex items-center justify-center">
                    <Icon className={`h-8 w-8 ${plan.color}`} />
                  </div>
                  <CardTitle className="text-lg">
                    {plan.name || PLAN_TYPE_LABELS[plan.type]}
                  </CardTitle>
                  <div className="text-3xl font-bold">
                    ¥{plan.monthlyPrice.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground">月額</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {displayHighlights.map((highlight, index) => (
                      <p key={index} className="text-center text-sm">
                        {highlight}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center justify-center">
                    <RadioGroupItem value={plan.type} id={`plan-${plan.type}`} />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </RadioGroup>
    </div>
  )
}
