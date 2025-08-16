import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Edit, Plus, Trash2, Save } from "lucide-react"
import { toast } from "sonner"

interface PlanConfig {
  id: string
  plan_type: 'free' | 'basic' | 'premium' | 'developer'
  name: string
  monthly_price: number
  yearly_price: number
  message_limit: number
  features: string[]
  is_active: boolean
}

export default function PlanManagement() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<PlanConfig[]>([])
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (user) {
      loadPlans()
    }
  }, [user])

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plan_configs')
        .select('*')
        .order('monthly_price', { ascending: true })

      if (error) throw error
      
      const formattedPlans = data?.map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : []
      })) || []
      
      setPlans(formattedPlans)
    } catch (error) {
      console.error('Error loading plans:', error)
      toast.error('プラン情報の取得に失敗しました')
    }
  }

  const handleSavePlan = async () => {
    if (!editingPlan) return

    try {
      if (editingPlan.id === 'new') {
        // 新規作成
        const { error } = await supabase
          .from('plan_configs')
          .insert({
            plan_type: editingPlan.plan_type,
            name: editingPlan.name,
            monthly_price: editingPlan.monthly_price,
            yearly_price: editingPlan.yearly_price,
            message_limit: editingPlan.message_limit,
            features: editingPlan.features,
            is_active: editingPlan.is_active
          })

        if (error) throw error
        toast.success('プランを作成しました')
      } else {
        // 更新
        const { error } = await supabase
          .from('plan_configs')
          .update({
            name: editingPlan.name,
            monthly_price: editingPlan.monthly_price,
            yearly_price: editingPlan.yearly_price,
            message_limit: editingPlan.message_limit,
            features: editingPlan.features,
            is_active: editingPlan.is_active
          })
          .eq('id', editingPlan.id)

        if (error) throw error
        toast.success('プランを更新しました')
      }

      setIsDialogOpen(false)
      setEditingPlan(null)
      loadPlans()
    } catch (error) {
      console.error('Error saving plan:', error)
      toast.error('プランの保存に失敗しました')
    }
  }

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('このプランを削除しますか？')) return

    try {
      const { error } = await supabase
        .from('plan_configs')
        .delete()
        .eq('id', planId)

      if (error) throw error
      toast.success('プランを削除しました')
      loadPlans()
    } catch (error) {
      console.error('Error deleting plan:', error)
      toast.error('プランの削除に失敗しました')
    }
  }

  const openEditDialog = (plan?: PlanConfig) => {
    if (plan) {
      setEditingPlan({ ...plan })
    } else {
      setEditingPlan({
        id: 'new',
        plan_type: 'basic',
        name: '',
        monthly_price: 0,
        yearly_price: 0,
        message_limit: 0,
        features: [],
        is_active: true
      })
    }
    setIsDialogOpen(true)
  }

  const updateEditingPlan = (updates: Partial<PlanConfig>) => {
    if (!editingPlan) return
    setEditingPlan({ ...editingPlan, ...updates })
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(price)
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
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">プラン管理</h1>
            <p className="text-muted-foreground">料金プランの作成・編集・削除を行います。</p>
          </div>
          <Button onClick={() => openEditDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            新規プラン作成
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>プラン一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>プラン名</TableHead>
                    <TableHead>タイプ</TableHead>
                    <TableHead>月額料金</TableHead>
                    <TableHead>年額料金</TableHead>
                    <TableHead>メッセージ制限</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{plan.plan_type}</Badge>
                      </TableCell>
                      <TableCell>{formatPrice(plan.monthly_price)}</TableCell>
                      <TableCell>{formatPrice(plan.yearly_price)}</TableCell>
                      <TableCell>{plan.message_limit.toLocaleString()}通</TableCell>
                      <TableCell>
                        <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                          {plan.is_active ? 'アクティブ' : '無効'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(plan)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeletePlan(plan.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* 編集ダイアログ */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPlan?.id === 'new' ? 'プラン作成' : 'プラン編集'}
              </DialogTitle>
            </DialogHeader>
            {editingPlan && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">プラン名</Label>
                    <Input
                      id="name"
                      value={editingPlan.name}
                      onChange={(e) => updateEditingPlan({ name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan_type">プランタイプ</Label>
                    <select
                      id="plan_type"
                      className="w-full px-3 py-2 border rounded-md"
                      value={editingPlan.plan_type}
                      onChange={(e) => updateEditingPlan({ plan_type: e.target.value as any })}
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                      <option value="developer">Developer</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthly_price">月額料金 (円)</Label>
                    <Input
                      id="monthly_price"
                      type="number"
                      value={editingPlan.monthly_price}
                      onChange={(e) => updateEditingPlan({ monthly_price: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearly_price">年額料金 (円)</Label>
                    <Input
                      id="yearly_price"
                      type="number"
                      value={editingPlan.yearly_price}
                      onChange={(e) => updateEditingPlan({ yearly_price: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message_limit">月間メッセージ制限</Label>
                  <Input
                    id="message_limit"
                    type="number"
                    value={editingPlan.message_limit}
                    onChange={(e) => updateEditingPlan({ message_limit: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="features">機能 (1行に1つ)</Label>
                  <textarea
                    id="features"
                    className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                    value={editingPlan.features.join('\n')}
                    onChange={(e) => updateEditingPlan({ features: e.target.value.split('\n').filter(f => f.trim()) })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={editingPlan.is_active}
                    onChange={(e) => updateEditingPlan({ is_active: e.target.checked })}
                  />
                  <Label htmlFor="is_active">アクティブ</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={handleSavePlan}>
                    <Save className="h-4 w-4 mr-2" />
                    保存
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}