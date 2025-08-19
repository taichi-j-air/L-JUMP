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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, RefreshCw, CreditCard, Users, TrendingUp, DollarSign, Search, Plus, ToggleLeft, Calendar, X } from "lucide-react"
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
  line_user_id?: string
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

interface Friend {
  id: string
  display_name: string
  short_uid: string
  line_user_id: string
}

interface Product {
  id: string
  name: string
  price: number
  product_type: string
  currency: string
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
  const [friends, setFriends] = useState<Friend[]>([])
  const [showPendingOrders, setShowPendingOrders] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [manualAmount, setManualAmount] = useState("")
  const [manualProductName, setManualProductName] = useState("")
  const [manualDate, setManualDate] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

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
      loadProducts()
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

      // サブスクリプション統計（保留中を除く）
      const subscriptionOrders = data?.filter(order => {
        const metadata = order.metadata as any
        return metadata?.product_type?.includes('subscription') && order.status !== 'pending'
      }) || []
      const activeSubscriptions = subscriptionOrders.filter(order => order.status === 'paid').length
      const totalSubscriptions = subscriptionOrders.length

      // 単発決済統計（保留中を除く）
      const oneTimeOrders = data?.filter(order => {
        const metadata = order.metadata as any
        return !metadata?.product_type?.includes('subscription') && order.status !== 'pending'
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

  const loadProducts = async () => {
    try {
      if (!user) return

      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, product_type, currency')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const handleRefund = async (orderId: string) => {
    try {
      // Stripe返金処理のエッジ関数を呼び出し
      const { data, error } = await supabase.functions.invoke('stripe-refund', {
        body: { orderId }
      })

      if (error) throw error

      if (data?.success) {
        // 注文ステータスを返金済みに更新
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId 
              ? { ...order, status: 'refunded' }
              : order
          )
        )
        toast.success('返金処理が完了しました')
      } else {
        throw new Error(data?.error || '返金処理に失敗しました')
      }
      
      loadOrders()
    } catch (error) {
      console.error('Error processing refund:', error)
      toast.error(`返金処理に失敗しました: ${error.message || error}`)
    }
  }

  const handleCancelSubscription = async (customerId: string) => {
    try {
      // Stripeサブスクリプション解約のエッジ関数を呼び出し
      const { data, error } = await supabase.functions.invoke('stripe-cancel-subscription', {
        body: { customerId }
      })

      if (error) throw error

      if (data?.success) {
        // サブスクリプション注文のステータスを解約済みに更新
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.stripe_customer_id === customerId && order.metadata?.product_type?.includes('subscription')
              ? { ...order, status: 'canceled' }
              : order
          )
        )
        toast.success('サブスクリプションの解約が完了しました')
      } else {
        throw new Error(data?.error || '解約処理に失敗しました')
      }

      loadOrders()
    } catch (error) {
      console.error('Error canceling subscription:', error)
      toast.error(`サブスクリプションの解約に失敗しました: ${error.message || error}`)
    }
  }

  const handleFriendSearch = () => {
    const friend = friends.find(f => f.line_user_id === friendUid)
    if (friend) {
      setSelectedFriend(friend)
    } else {
      toast.error('指定されたLINE IDの友達が見つかりません')
      setSelectedFriend(null)
    }
  }

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      setSelectedProduct(product)
      setManualProductName(product.name)
      if (!manualAmount) {
        setManualAmount(product.price.toString())
      }
    }
  }

  const handleAddOrderManually = async () => {
    try {
      if (!selectedFriend || !manualAmount || !manualProductName) {
        toast.error('すべての項目を入力してください')
        return
      }

      const orderDate = manualDate ? new Date(manualDate).toISOString() : new Date().toISOString()

      // 手動で注文を追加
      const { error } = await supabase
        .from('orders')
        .insert({
          user_id: user?.id,
          product_id: selectedProduct?.id,
          line_user_id: selectedFriend.line_user_id,
          friend_uid: selectedFriend.short_uid,
          amount: parseInt(manualAmount),
          currency: selectedProduct?.currency || 'jpy',
          status: 'paid',
          livemode: !showTestMode,
          metadata: {
            product_name: manualProductName,
            product_type: selectedProduct?.product_type,
            manual_entry: true
          },
          stripe_session_id: `manual_${Date.now()}`,
          created_at: orderDate
        })

      if (error) throw error

      toast.success(`${selectedFriend.display_name}の注文を手動追加しました`)
      setShowAddDialog(false)
      setFriendUid("")
      setSelectedFriend(null)
      setManualAmount("")
      setManualProductName("")
      setManualDate("")
      setSelectedProduct(null)
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
    
    // 保留中の表示/非表示フィルター
    const matchesPendingFilter = showPendingOrders || order.status !== 'pending'
    
    return matchesSearch && matchesStatus && matchesPendingFilter
  })

  const getProductName = (order: OrderRecord) => {
    // メタデータに商品名がある場合はそれを使用（削除されても保持される）
    if (order.metadata?.product_name) {
      return order.metadata.product_name
    }
    
    // product_idがある場合、現在の商品リストで検索
    if (order.product_id) {
      const currentProduct = products.find(p => p.id === order.product_id)
      if (currentProduct) {
        return currentProduct.name
      }
      // 商品IDはあるが商品が見つからない場合は削除されている
      return (
        <span className="text-destructive-foreground bg-destructive/20 px-1 py-0.5 rounded text-xs font-medium">
          [削除された商品]
        </span>
      )
    }
    
    return 'アンノーン'
  }

  const getFriendName = (order: OrderRecord) => {
    if (order.friend_uid) {
      const friend = friends.find(f => f.short_uid === order.friend_uid)
      return friend?.display_name || order.friend_uid
    }
    if (order.line_user_id) {
      const friend = friends.find(f => f.line_user_id === order.line_user_id)
      return friend?.display_name || 'LINE友達'
    }
    return '不明'
  }

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
      case 'canceled':
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
      case 'canceled': return '解約済み'
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
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                       onClick={() => setShowAddDialog(false)}
                     >
                       <X className="h-4 w-4" />
                     </Button>
                     <DialogHeader>
                       <DialogTitle>注文手動追加</DialogTitle>
                     </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="friend-line-id">LINE ID</Label>
                        <div className="flex gap-2">
                          <Input
                            id="friend-line-id"
                            value={friendUid}
                            onChange={(e) => setFriendUid(e.target.value)}
                            placeholder="LINE IDを入力"
                          />
                          <Button onClick={handleFriendSearch} size="sm">
                            検索
                          </Button>
                        </div>
                      </div>
                      
                      {selectedFriend && (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="font-medium">{selectedFriend.display_name}</p>
                          <p className="text-sm text-muted-foreground">UID: {selectedFriend.short_uid}</p>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="product-select">商品選択</Label>
                        <Select onValueChange={handleProductSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="商品を選択してください" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map(product => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} (¥{product.price.toLocaleString()})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="product-name">商品名（手動入力）</Label>
                        <Input
                          id="product-name"
                          value={manualProductName}
                          onChange={(e) => setManualProductName(e.target.value)}
                          placeholder="商品名を入力"
                        />
                      </div>

                      <div>
                        <Label htmlFor="amount">金額（円）</Label>
                        <Input
                          id="amount"
                          type="number"
                          value={manualAmount}
                          onChange={(e) => setManualAmount(e.target.value)}
                          placeholder="金額を入力"
                        />
                      </div>

                      <div>
                        <Label htmlFor="manual-date">日付</Label>
                        <Input
                          id="manual-date"
                          type="datetime-local"
                          value={manualDate}
                          onChange={(e) => setManualDate(e.target.value)}
                        />
                      </div>

                      <Button 
                        onClick={handleAddOrderManually} 
                        className="w-full"
                        disabled={!selectedFriend || !manualAmount || !manualProductName}
                      >
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
            <div className="space-y-3 mt-3">
              <div className="flex gap-2">
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
                    <SelectItem value="canceled">解約済み</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-pending"
                  checked={showPendingOrders}
                  onCheckedChange={(checked) => setShowPendingOrders(checked === true)}
                />
                <Label htmlFor="show-pending" className="text-xs">
                  保留中の注文を表示
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="py-2">商品名</TableHead>
                    <TableHead className="py-2">購入者</TableHead>
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
                           <div className="font-medium text-xs">
                             {getProductName(order)}
                           </div>
                           <div className="text-xs text-muted-foreground">{order.stripe_session_id}</div>
                         </div>
                       </TableCell>
                      <TableCell className="py-2">
                        <div className="font-medium text-xs">{getFriendName(order)}</div>
                        {order.status === 'pending' && (
                          <div className="text-xs text-amber-600">保留中</div>
                        )}
                      </TableCell>
                      <TableCell className="py-2 font-medium text-xs">
                        ¥{order.amount?.toLocaleString('ja-JP') || '0'}
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
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                                 onClick={() => setSelectedOrder(null)}
                               >
                                 <X className="h-4 w-4" />
                               </Button>
                               <DialogHeader>
                                 <DialogTitle>注文詳細</DialogTitle>
                               </DialogHeader>
                              {selectedOrder && (
                                <div className="space-y-4">
                                   <div className="grid grid-cols-2 gap-4">
                                     <div>
                                       <label className="text-sm font-medium">商品名</label>
                                       <p className="text-sm">{getProductName(selectedOrder)}</p>
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
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button
                                   size="sm"
                                   variant="destructive"
                                   className="h-6 px-2 text-xs"
                                 >
                                   返金
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>返金確認</AlertDialogTitle>
                                   <AlertDialogDescription>
                                     この注文を返金しますか？この操作は取り消せません。
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                   <AlertDialogAction 
                                     onClick={() => handleRefund(order.id)}
                                     className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                                   >
                                     返金実行
                                   </AlertDialogAction>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
                           )}
                           {order.stripe_customer_id && order.status === 'paid' && order.metadata?.product_type?.includes('subscription') && (
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   className="h-6 px-2 text-xs"
                                 >
                                   解約
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>サブスクリプション解約確認</AlertDialogTitle>
                                   <AlertDialogDescription>
                                     このサブスクリプションを解約しますか？この操作は取り消せません。
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                   <AlertDialogAction 
                                     onClick={() => handleCancelSubscription(order.stripe_customer_id)}
                                     className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                                   >
                                     解約実行
                                   </AlertDialogAction>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
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