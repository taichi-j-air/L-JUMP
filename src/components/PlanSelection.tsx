import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Star, Zap, Crown } from "lucide-react"

interface Plan {
  type: 'free' | 'basic' | 'premium' | 'developer'
  name: string
  monthly_price: number
  yearly_price: number
  features: string[]
  icon: any
  color: string
}

interface PlanSelectionProps {
  selectedPlan: string
  onPlanSelect: (plan: string) => void
}

export function PlanSelection({ selectedPlan, onPlanSelect }: PlanSelectionProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('plan_configs')
          .select('*')
          .eq('is_active', true)
          .order('monthly_price', { ascending: true })

        if (error) throw error

        const formattedPlans = data?.map(plan => ({
          type: plan.plan_type as 'free' | 'basic' | 'premium' | 'developer',
          name: plan.name,
          monthly_price: Number(plan.monthly_price),
          yearly_price: Number(plan.yearly_price),
          features: plan.features as string[],
          icon: plan.plan_type === 'free' ? Star : plan.plan_type === 'basic' ? Zap : Crown,
          color: plan.plan_type === 'free' ? 'text-gray-500' : plan.plan_type === 'basic' ? 'text-blue-500' : 'text-purple-500'
        })) || []

        setPlans(formattedPlans)
      } catch (error) {
        console.error('Error loading plans:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPlans()
  }, [])

  if (loading) {
    return <div className="text-center py-8">プラン情報を読み込み中...</div>
  }

  if (plans.length === 0) {
    return <div className="text-center py-8">利用可能なプランがありません</div>
  }

  return (
    <div className="space-y-4">
      <Label>プランを選択してください <span className="text-red-500">*</span></Label>
      <RadioGroup value={selectedPlan} onValueChange={onPlanSelect}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isRecommended = plan.type === 'basic' || plan.type === 'premium'
            
            return (
              <Card 
                key={plan.type}
                className={`cursor-pointer transition-all hover:shadow-lg relative ${
                  selectedPlan === plan.type ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => onPlanSelect(plan.type)}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                      おすすめ
                    </span>
                  </div>
                )}
                <CardHeader className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Icon className={`w-8 h-8 ${plan.color}`} />
                  </div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="text-3xl font-bold">¥{plan.monthly_price.toLocaleString()}</div>
                  <p className="text-sm text-muted-foreground">月額</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {plan.features.slice(0, 3).map((feature, index) => (
                      <p key={index} className="text-sm text-center">
                        {feature}
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