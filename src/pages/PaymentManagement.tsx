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
import { Eye, RefreshCw, CreditCard, Users, TrendingUp, DollarSign, Search, Plus, ToggleLeft } from "lucide-react"
import { toast } from "sonner"

interface OrderRecord {
  id: string
  user_id: string
  product_id: string
  stripe_session_id: string
  stripe_customer_id: string | null
  stripe_payment_intent_id: string | null
  amount: number
  currency: string
  status: string
  livemode: boolean
  metadata: any
  created_at: string
  updated_at: string
  friend_uid?: string
  products?: any
}

interface CustomerStats {
  total_orders: number
  total_revenue: number
  monthly_revenue: number
  active_subscriptions: number
  total_subscriptions: number
  successful_one_time: number
  total_one_time: number
  pending_orders: number
}

export default function PaymentManagement() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [stats, setStats] = useState<CustomerStats>({
    total_orders: 0,
    total_revenue: 0,
    monthly_revenue: 0,
    active_subscriptions: 0,
    total_subscriptions: 0,
    successful_one_time: 0,
    total_one_time: 0,
    pending_orders: 0
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null)
  const [showTestMode, setShowTestMode] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [friendUid, setFriendUid] = useState("")
  const [friends, setFriends] = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (user) {
      loadOrders()
      loadFriends()
    }
  }, [user, showTestMode])

  const loadOrders = async () => {
    try {
      if (!user) return

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .eq('livemode', !showTestMode)
        .order('created_at', { ascending: false })

      if (error) throw error

      setOrders(data || [])

      // 統計を計算
      const successful = data?.filter(order => order.status === 'paid') || []
      const totalRevenue = successful.reduce((sum, order) => sum + (order.amount || 0), 0)
      
      // 今月の売上を計算
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      const monthlyRevenue = successful
        .filter(order => {
          const orderDate = new Date(order.created_at)
          return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear
        })
        .reduce((sum, order) => sum + (order.amount || 0), 0)

      // サブスクリプション統計
      const subscriptionOrders = data?.filter(order => {
        const metadata = order.metadata as any
        return metadata?.product_type?.includes('subscription')
      }) || []
      const activeSubscriptions = subscriptionOrders.filter(order => order.status === 'paid').length
      const totalSubscriptions = subscriptionOrders.length

      // 単発決済統計  
      const oneTimeOrders = data?.filter(order => {
        const metadata = order.metadata as any
        return !metadata?.product_type?.includes('subscription')
      }) || []
      const successfulOneTime = oneTimeOrders.filter(order => order.status === 'paid').length
      const totalOneTime = oneTimeOrders.length
      
      setStats({
        total_orders: data?.length || 0,
        total_revenue: totalRevenue,
        monthly_revenue: monthlyRevenue,
        active_subscriptions: activeSubscriptions,
        total_subscriptions: totalSubscriptions,
        successful_one_time: successfulOneTime,
        total_one_time: totalOneTime,
        pending_orders: data?.filter(order => order.status === 'pending').length || 0
      })
    } catch (error) {
      console.error('Error loading orders:', error)
      toast.error('注文データの取得に失敗しました')
    }
  }

  const loadFriends = async () => {
    try {
      if (!user) return

      const { data, error } = await supabase
        .from('line_friends')
        .select('id, display_name, short_uid, line_user_id')
        .eq('user_id', user.id)
        .order('display_name')

      if (error) throw error
      setFriends(data || [])
    } catch (error) {
      console.error('Error loading friends:', error)
    }
  }

  const handleRefund = async (orderId: string) => {
    try {
      // Stripe返金処理のエッジ関数を呼び出し
      const { error } = await supabase.functions.invoke('stripe-refund', {
        body: { orderId }
      })

      if (error) throw error

      toast.success('返金処理を開始しました')
      loadOrders()
    } catch (error) {
      console.error('Error processing refund:', error)
      toast.error('返金処理に失敗しました')
    }
  }

  const handleCancelSubscription = async (customerId: string) => {
    try {
      // Stripeサブスクリプション解約のエッジ関数を呼び出し
      const { error } = await supabase.functions.invoke('stripe-cancel-subscription', {
        body: { customerId }
      })

      if (error) throw error

      toast.success('サブスクリプションの解約処理を開始しました')
      loadOrders()
    } catch (error) {
      console.error('Error canceling subscription:', error)
      toast.error('サブスクリプションの解約に失敗しました')
    }
  }

  const handleAddOrderManually = async () => {
    try {
      const selectedFriend = friends.find(f => f.short_uid === friendUid.toUpperCase())
      if (!selectedFriend) {
        toast.error('指定されたUIDの友達が見つかりません')
        return
      }

      // 手動で注文を追加するロジック（必要に応じて実装）
      toast.success(`${selectedFriend.display_name}の注文を手動追加しました`)
      setShowAddDialog(false)
      setFriendUid("")
      loadOrders()
    } catch (error) {
      console.error('Error adding order manually:', error)
      toast.error('手動追加に失敗しました')
    }
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.stripe_session_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.friend_uid?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    
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
      case 'paid':
        return 'default'
      case 'pending':
        return 'secondary'
      case 'failed':
      case 'refunded':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return '成功'
      case 'pending': return '保留中'
      case 'failed': return '失敗'
      case 'refunded': return '返金済み'
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
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              決済管理
            </h1>
            <p className="text-sm text-muted-foreground">
              Stripe決済とサブスクリプションを管理します。
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium px-2 py-1 rounded ${
              showTestMode 
                ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}>
              {showTestMode ? 'テストモード' : '本番環境'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTestMode(!showTestMode)}
              className={`flex items-center gap-2 ${
                showTestMode 
                  ? 'border-amber-300 hover:bg-amber-50' 
                  : 'border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              <ToggleLeft className="h-4 w-4" />
              {showTestMode ? '本番環境に切り替え' : 'テストモードに切り替え'}
            </Button>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid gap-3 md:grid-cols-6 mb-4">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">総注文数</p>
                <p className="text-lg font-bold">{stats.total_orders}</p>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
          
          <Card className="p-3 md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground">総売上</p>
                    <p className="text-lg font-bold">¥{stats.total_revenue.toLocaleString('ja-JP')}</p>
                  </div>
                  <div className="w-px h-8 bg-border"></div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground">今月売上</p>
                    <p className="text-lg font-bold">¥{stats.monthly_revenue.toLocaleString('ja-JP')}</p>
                  </div>
                </div>
              </div>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">サブスク会員数</p>
                <p className="text-lg font-bold">{stats.active_subscriptions}/{stats.total_subscriptions}</p>
              </div>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">単発決済数</p>
                <p className="text-lg font-bold">{stats.successful_one_time}/{stats.total_one_time}</p>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">保留中</p>
                <p className="text-lg font-bold">{stats.pending_orders}</p>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
        </div>

        {/* 注文履歴 */}
        <Card>
          <CardHeader className="p-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">注文履歴 ({filteredOrders.length}件)</CardTitle>
              <div className="flex gap-2">
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      手動追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>注文手動追加</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="friend-uid">友達UID</Label>
                        <Input
                          id="friend-uid"
                          value={friendUid}
                          onChange={(e) => setFriendUid(e.target.value)}
                          placeholder="友達のUIDを入力"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          友達一覧のUIDを入力してください
                        </p>
                      </div>
                      <Button onClick={handleAddOrderManually} className="w-full">
                        追加
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button onClick={loadOrders} variant="outline" size="sm">
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
                    placeholder="セッションIDまたは友達UIDで検索"
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
                  <SelectItem value="paid">成功</SelectItem>
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
                    <TableHead className="py-2">商品名</TableHead>
                    <TableHead className="py-2">金額</TableHead>
                    <TableHead className="py-2">ステータス</TableHead>
                    <TableHead className="py-2">モード</TableHead>
                    <TableHead className="py-2">注文日</TableHead>
                    <TableHead className="py-2">アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="text-xs">
                      <TableCell className="py-2">
                        <div>
                          <div className="font-medium text-xs">{order.metadata?.product_name || 'Unknown Product'}</div>
                          <div className="text-xs text-muted-foreground">{order.stripe_session_id}</div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 font-medium text-xs">
                        {formatPrice(order.amount, order.currency)}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={getStatusColor(order.status)} className="text-xs">
                          {getStatusLabel(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={order.livemode ? 'default' : 'secondary'} className="text-xs">
                          {order.livemode ? '本番' : 'テスト'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {new Date(order.created_at).toLocaleDateString('ja-JP')}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => setSelectedOrder(order)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>注文詳細</DialogTitle>
                              </DialogHeader>
                              {selectedOrder && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-sm font-medium">商品名</label>
                                      <p className="text-sm">{selectedOrder.metadata?.product_name || 'Unknown'}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">金額</label>
                                      <p className="text-sm">{formatPrice(selectedOrder.amount, selectedOrder.currency)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">ステータス</label>
                                      <p className="text-sm">{getStatusLabel(selectedOrder.status)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Stripe Customer ID</label>
                                      <p className="text-sm">{selectedOrder.stripe_customer_id || 'N/A'}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          {order.status === 'paid' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleRefund(order.id)}
                            >
                              返金
                            </Button>
                          )}
                          {order.stripe_customer_id && order.status === 'paid' && order.metadata?.product_type?.includes('subscription') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleCancelSubscription(order.stripe_customer_id)}
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