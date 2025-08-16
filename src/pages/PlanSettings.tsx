import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Check, Crown, Zap, Star, CreditCard } from "lucide-react"
import { toast } from "sonner"

interface Plan {
  type: 'free' | 'basic' | 'premium' | 'developer'
  name: string
  monthly_price: number
  yearly_price: number
  features: string[]
  icon: any
  color: string
}

export default function PlanSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<any>(null)
  const [isYearly, setIsYearly] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])

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
      toast.error('プラン情報の取得に失敗しました')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (user) {
      loadCurrentPlan()
      loadPlans()
    }
  }, [user])

  const loadCurrentPlan = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading plan:', error)
      } else {
        setCurrentPlan(data)
      }
    } catch (error) {
      console.error('Error loading plan:', error)
    }
  }

  const handlePlanChange = async (planType: string) => {
    if (!user || processing) return

    if (planType === 'free') {
      // フリープランは直接変更
      setProcessing(true)
      try {
        if (currentPlan) {
          await supabase
            .from('user_plans')
            .update({ is_active: false })
            .eq('id', currentPlan.id)
        }

        const { data, error } = await supabase
          .from('user_plans')
          .insert({
            user_id: user.id,
            plan_type: 'free',
            is_yearly: false,
            is_active: true
          })
          .select()
          .single()

        if (error) throw error

        setCurrentPlan(data)
        toast.success('フリープランに変更しました')
      } catch (error) {
        console.error('Error changing to free plan:', error)
        toast.error('プランの変更に失敗しました')
      } finally {
        setProcessing(false)
      }
    } else {
      // 有料プランはStripe決済
      handleStripeCheckout(planType)
    }
  }

  const handleStripeCheckout = async (planType: string) => {
    if (!user) return

    setProcessing(true)
    try {
      const selectedPlan = plans.find(p => p.type === planType)
      if (!selectedPlan) throw new Error('プランが見つかりません')

      const amount = isYearly ? selectedPlan.yearly_price : selectedPlan.monthly_price

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          plan_type: planType,
          is_yearly: isYearly,
          amount: amount,
          success_url: `${window.location.origin}/plan-settings?success=true`,
          cancel_url: `${window.location.origin}/plan-settings?canceled=true`
        }
      })

      if (error) throw error

      if (data.url) {
        window.open(data.url, '_blank')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      toast.error('決済処理の開始に失敗しました')
    } finally {
      setProcessing(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(price)
  }

  const getDisplayPrice = (plan: Plan) => {
    const price = isYearly ? plan.yearly_price : plan.monthly_price
    const period = isYearly ? '年' : '月'
    return price === 0 ? '無料' : `${formatPrice(price)}/${period}`
  }

  const getYearlyDiscount = (plan: Plan) => {
    if (plan.monthly_price === 0 || plan.yearly_price === 0) return 0
    return Math.round((1 - (plan.yearly_price / 12) / plan.monthly_price) * 100)
  }

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
          <p className="text-muted-foreground">現在のプランを確認し、必要に応じてアップグレードしてください。</p>
        </div>

        {currentPlan && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>現在のプラン</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {plans.find(p => p.type === currentPlan.plan_type)?.name || currentPlan.plan_type}
                </Badge>
                {currentPlan.is_yearly && (
                  <Badge variant="outline">年額契約</Badge>
                )}
                <span className="text-muted-foreground">
                  開始日: {new Date(currentPlan.plan_start_date).toLocaleDateString('ja-JP')}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 年額/月額切り替え */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-4">
              <Label htmlFor="billing-toggle" className={!isYearly ? 'font-semibold' : ''}>
                月額
              </Label>
              <Switch
                id="billing-toggle"
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <Label htmlFor="billing-toggle" className={isYearly ? 'font-semibold' : ''}>
                年額 <Badge variant="secondary" className="ml-1">最大20%オフ</Badge>
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isCurrentPlan = currentPlan?.plan_type === plan.type
            
            return (
              <Card key={plan.type} className={`relative ${isCurrentPlan ? 'border-primary' : ''}`}>
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge variant="default">現在のプラン</Badge>
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-6 w-6 ${plan.color}`} />
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  <div className="space-y-1">
                    <div className={`text-2xl font-bold ${plan.color}`}>
                      {getDisplayPrice(plan)}
                    </div>
                    {isYearly && plan.type !== 'free' && getYearlyDiscount(plan) > 0 && (
                      <div className="text-sm text-green-600">
                        月額より{getYearlyDiscount(plan)}%お得
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{feature}</span>
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
                      <>処理中...</>
                    ) : isCurrentPlan ? (
                      '現在のプラン'
                    ) : plan.type === 'free' ? (
                      'フリープランにする'
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        {isYearly ? '年額で申し込む' : '月額で申し込む'}
                      </>
                    )}
                  </Button>
                  
                  {plan.type !== 'free' && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Stripe決済システムで安全に処理されます
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
                  <tr className="border-b">
                    <th className="text-left p-2">機能</th>
                    <th className="text-center p-2">フリー</th>
                    <th className="text-center p-2">ベーシック</th>
                    <th className="text-center p-2">プレミアム</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2">月間メッセージ数</td>
                    <td className="text-center p-2">100通</td>
                    <td className="text-center p-2">10,000通</td>
                    <td className="text-center p-2">50,000通</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">価格（月額）</td>
                    <td className="text-center p-2">無料</td>
                    <td className="text-center p-2">¥2,980</td>
                    <td className="text-center p-2">¥9,800</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">価格（年額）</td>
                    <td className="text-center p-2">無料</td>
                    <td className="text-center p-2">¥29,800 <span className="text-green-600 text-xs">(17%オフ)</span></td>
                    <td className="text-center p-2">¥98,000 <span className="text-green-600 text-xs">(17%オフ)</span></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">シナリオ数</td>
                    <td className="text-center p-2">3個</td>
                    <td className="text-center p-2">無制限</td>
                    <td className="text-center p-2">無制限</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">サポート</td>
                    <td className="text-center p-2">-</td>
                    <td className="text-center p-2">メール</td>
                    <td className="text-center p-2">優先サポート</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">API利用</td>
                    <td className="text-center p-2">-</td>
                    <td className="text-center p-2">-</td>
                    <td className="text-center p-2">○</td>
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