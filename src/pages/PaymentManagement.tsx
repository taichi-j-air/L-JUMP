import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { CardDescription } from "@/components/ui/card"
import { Eye, RefreshCw, CreditCard, Users, TrendingUp, DollarSign, Search } from "lucide-react"
import { toast } from "sonner"

interface PaymentRecord {
  id: string
  customer_email: string
  customer_name: string
  amount: number
  currency: string
  status: 'succeeded' | 'pending' | 'failed' | 'refunded'
  subscription_status?: 'active' | 'canceled' | 'past_due' | 'unpaid'
  plan_type: 'basic' | 'premium'
  payment_method: string
  created_at: string
  subscription_id?: string
}

interface CustomerStats {
  total_customers: number
  active_subscriptions: number
  monthly_revenue: number
  yearly_revenue: number
}

export default function PaymentManagement() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [stats, setStats] = useState<CustomerStats>({
    total_customers: 0,
    active_subscriptions: 0,
    monthly_revenue: 0,
    yearly_revenue: 0
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedCustomer, setSelectedCustomer] = useState<PaymentRecord | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (user) {
      loadPayments()
      loadStats()
    }
  }, [user])

  const loadPayments = async () => {
    try {
      // プレースホルダー: 実際の実装ではStripe APIから決済データを取得
      const mockPayments: PaymentRecord[] = [
        {
          id: "pm_1234567890",
          customer_email: "user1@example.com",
          customer_name: "田中太郎",
          amount: 2980,
          currency: "jpy",
          status: "succeeded",
          subscription_status: "active",
          plan_type: "basic",
          payment_method: "card",
          created_at: "2024-01-15T10:30:00Z",
          subscription_id: "sub_1234567890"
        },
        {
          id: "pm_1234567891",
          customer_email: "user2@example.com", 
          customer_name: "佐藤花子",
          amount: 9800,
          currency: "jpy",
          status: "succeeded",
          subscription_status: "active",
          plan_type: "premium",
          payment_method: "card",
          created_at: "2024-01-14T15:45:00Z",
          subscription_id: "sub_1234567891"
        }
      ]
      setPayments(mockPayments)
    } catch (error) {
      console.error('Error loading payments:', error)
      toast.error('決済データの取得に失敗しました')
    }
  }

  const loadStats = async () => {
    try {
      // プレースホルダー: 実際の実装ではStripe APIから統計データを取得
      const mockStats: CustomerStats = {
        total_customers: 150,
        active_subscriptions: 120,
        monthly_revenue: 450000,
        yearly_revenue: 5400000
      }
      setStats(mockStats)
    } catch (error) {
      console.error('Error loading stats:', error)
      toast.error('統計データの取得に失敗しました')
    }
  }

  const handleRefund = async (paymentId: string) => {
    try {
      // プレースホルダー: 実際の実装ではStripe APIで返金処理
      console.log('Processing refund for payment:', paymentId)
      toast.success('返金処理を開始しました')
      loadPayments() // データを再読み込み
    } catch (error) {
      console.error('Error processing refund:', error)
      toast.error('返金処理に失敗しました')
    }
  }

  const handleCancelSubscription = async (subscriptionId: string) => {
    try {
      // プレースホルダー: 実際の実装ではStripe APIでサブスクリプション解約
      console.log('Canceling subscription:', subscriptionId)
      toast.success('サブスクリプションの解約処理を開始しました')
      loadPayments() // データを再読み込み
    } catch (error) {
      console.error('Error canceling subscription:', error)
      toast.error('サブスクリプションの解約に失敗しました')
    }
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = !searchTerm || 
      payment.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
      case 'active':
        return 'default'
      case 'pending':
        return 'secondary'
      case 'failed':
      case 'canceled':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'succeeded': return '成功'
      case 'pending': return '保留中'
      case 'failed': return '失敗'
      case 'refunded': return '返金済み'
      case 'active': return 'アクティブ'
      case 'canceled': return '解約済み'
      case 'past_due': return '支払い遅延'
      case 'unpaid': return '未払い'
      default: return status
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
        <div className="mb-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            決済管理
          </h1>
          <p className="text-sm text-muted-foreground">
            Stripe決済とサブスクリプションを管理します。
          </p>
        </div>

        {/* 統計カード - コンパクト版 */}
        <div className="grid gap-3 md:grid-cols-4 mb-4">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">総顧客数</p>
                <p className="text-lg font-bold">{stats.total_customers}</p>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">アクティブ契約</p>
                <p className="text-lg font-bold">{stats.active_subscriptions}</p>
              </div>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">月間売上</p>
                <p className="text-lg font-bold">{formatPrice(stats.monthly_revenue, 'jpy')}</p>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">年間売上</p>
                <p className="text-lg font-bold">{formatPrice(stats.yearly_revenue, 'jpy')}</p>
              </div>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
        </div>

        {/* 決済履歴 */}
        <Card>
          <CardHeader className="p-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">決済履歴 ({filteredPayments.length}件)</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs">
                  手動追加
                </Button>
                <Button onClick={loadPayments} variant="outline" size="sm">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  更新
                </Button>
              </div>
            </div>
            
            {/* 検索・フィルター */}
            <div className="flex gap-2 mt-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="顧客名またはメールアドレスで検索"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="ステータス" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="succeeded">成功</SelectItem>
                  <SelectItem value="pending">保留中</SelectItem>
                  <SelectItem value="failed">失敗</SelectItem>
                  <SelectItem value="refunded">返金済み</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="py-2">顧客</TableHead>
                    <TableHead className="py-2">プラン</TableHead>
                    <TableHead className="py-2">金額</TableHead>
                    <TableHead className="py-2">決済状況</TableHead>
                    <TableHead className="py-2">契約状況</TableHead>
                    <TableHead className="py-2">決済日</TableHead>
                    <TableHead className="py-2">アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id} className="text-xs">
                      <TableCell className="py-2">
                        <div>
                          <div className="font-medium text-xs">{payment.customer_name}</div>
                          <div className="text-xs text-muted-foreground">{payment.customer_email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="secondary" className="text-xs">{payment.plan_type}</Badge>
                      </TableCell>
                      <TableCell className="py-2 font-medium text-xs">
                        {formatPrice(payment.amount, payment.currency)}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={getStatusColor(payment.status)} className="text-xs">
                          {getStatusLabel(payment.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        {payment.subscription_status && (
                          <Badge variant={getStatusColor(payment.subscription_status)} className="text-xs">
                            {getStatusLabel(payment.subscription_status)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {new Date(payment.created_at).toLocaleDateString('ja-JP')}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => setSelectedCustomer(payment)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>顧客詳細</DialogTitle>
                              </DialogHeader>
                              {selectedCustomer && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-sm font-medium">顧客名</label>
                                      <p className="text-sm">{selectedCustomer.customer_name}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">メールアドレス</label>
                                      <p className="text-sm">{selectedCustomer.customer_email}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">プラン</label>
                                      <p className="text-sm">{selectedCustomer.plan_type}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">金額</label>
                                      <p className="text-sm">{formatPrice(selectedCustomer.amount, selectedCustomer.currency)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">決済状況</label>
                                      <p className="text-sm">{getStatusLabel(selectedCustomer.status)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">契約状況</label>
                                      <p className="text-sm">{selectedCustomer.subscription_status ? getStatusLabel(selectedCustomer.subscription_status) : 'N/A'}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">累計課金額</label>
                                      <p className="text-sm font-bold text-green-600">{formatPrice(50000, 'jpy')}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          {payment.status === 'succeeded' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleRefund(payment.id)}
                            >
                              返金
                            </Button>
                          )}
                          {payment.subscription_id && payment.subscription_status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleCancelSubscription(payment.subscription_id!)}
                            >
                              解約
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}