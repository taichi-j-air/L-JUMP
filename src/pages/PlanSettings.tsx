import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, Crown, Zap, Star } from "lucide-react"
import { toast } from "sonner"

interface Plan {
  type: 'free' | 'basic' | 'premium' | 'developer'
  name: string
  price: string
  features: string[]
  icon: any
  color: string
}

const plans: Plan[] = [
  {
    type: 'free',
    name: 'フリープラン',
    price: '¥0/月',
    features: [
      '基本的な機能のみ',
      '月間メッセージ数制限あり',
      'シナリオ数制限あり',
      'サポートなし'
    ],
    icon: Star,
    color: 'text-gray-500'
  },
  {
    type: 'basic',
    name: 'ベーシックプラン',
    price: '¥2,980/月',
    features: [
      '全機能利用可能',
      '月間メッセージ数 10,000通',
      'シナリオ数無制限',
      'メールサポート',
      'フォーム機能',
      'タグ管理'
    ],
    icon: Zap,
    color: 'text-blue-500'
  },
  {
    type: 'premium',
    name: 'プレミアムプラン',
    price: '¥9,800/月',
    features: [
      'ベーシックプランの全機能',
      '月間メッセージ数 50,000通',
      '優先サポート',
      '高度な分析機能',
      'API利用可能',
      'カスタムブランディング'
    ],
    icon: Crown,
    color: 'text-purple-500'
  }
]

export default function PlanSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
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

    if (user) {
      loadCurrentPlan()
    }
  }, [user])

  const handlePlanChange = async (planType: string) => {
    if (!user) return

    try {
      // 現在のプランを無効化
      if (currentPlan) {
        await supabase
          .from('user_plans')
          .update({ is_active: false })
          .eq('id', currentPlan.id)
      }

      // 新しいプランを作成
      const { data, error } = await supabase
        .from('user_plans')
        .insert({
          user_id: user.id,
          plan_type: planType as 'free' | 'basic' | 'premium' | 'developer',
          is_active: true
        })
        .select()
        .single()

      if (error) throw error

      setCurrentPlan(data)
      toast.success('プランを変更しました')
    } catch (error) {
      console.error('Error updating plan:', error)
      toast.error('プランの変更に失敗しました')
    }
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
                <span className="text-muted-foreground">
                  開始日: {new Date(currentPlan.plan_start_date).toLocaleDateString('ja-JP')}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

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
                  <div className={`text-2xl font-bold ${plan.color}`}>{plan.price}</div>
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
                    disabled={isCurrentPlan || plan.type === 'free'}
                    onClick={() => handlePlanChange(plan.type)}
                  >
                    {isCurrentPlan ? '現在のプラン' : plan.type === 'free' ? '無料プラン' : 'このプランにする'}
                  </Button>
                  
                  {plan.type !== 'free' && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      ※実際の課金は実装されていません
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