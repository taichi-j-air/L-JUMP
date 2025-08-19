import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { SubscriberDetailDialog } from "@/components/SubscriberDetailDialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, RefreshCw, CreditCard, Users, TrendingUp, DollarSign, Search, Plus, ToggleLeft, Calendar, X, Copy, Trash2, ToggleRight } from "lucide-react"
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
  unique_subscription_users: number
  unique_onetime_users: number
  canceled_orders: number
  refunded_orders: number
}

interface Friend {
  id: string
  display_name: string
  short_uid: string
  line_user_id: string
}

interface SubscriberDetail {
  id: string
  display_name: string
  short_uid: string
  line_user_id: string
  orders: Array<{
    id: string
    product_name?: string
    product_type: string
    amount: number
    currency: string
    status: string
    created_at: string
  }>
  total_amount: number
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
    pending_orders: 0,
    unique_subscription_users: 0,
    unique_onetime_users: 0,
    canceled_orders: 0,
    refunded_orders: 0,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("all")
  const [subscriberDetails, setSubscriberDetails] = useState<SubscriberDetail[]>([])
  const [showSubscriberDetailDialog, setShowSubscriberDetailDialog] = useState(false)
  const [selectedSubscriber, setSelectedSubscriber] = useState<SubscriberDetail | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [friendUid, setFriendUid] = useState("")
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [manualAmount, setManualAmount] = useState("")
  const [manualProductName, setManualProductName] = useState("")
  const [manualDate, setManualDate] = useState("")
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [isRefundMode, setIsRefundMode] = useState(false)
  const [isLiveMode, setIsLiveMode] = useState(false)

  const itemsPerPage = 20

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadData(user)
    }
  }, [isLiveMode])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setUser(session.user)
      await loadData(session.user)
    }
    setLoading(false)
  }

  const loadData = async (currentUser?: User) => {
    const activeUser = currentUser || user
    if (!activeUser) return

    try {
      // Load orders with product info (filtered by mode)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          products (
            name,
            product_type,
            price,
            currency
          )
        `)
        .eq('user_id', activeUser.id)
        .eq('livemode', isLiveMode)
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      const ordersWithProductInfo = ordersData?.map(order => ({
        ...order,
        product_name: (order as any).products?.name || '不明な商品',
        product_type: (order as any).products?.product_type || 'unknown'
      })) || []

      setOrders(ordersWithProductInfo)

      // Calculate stats
      const totalOrders = ordersWithProductInfo.length
      const totalRevenue = ordersWithProductInfo
        .filter(order => order.status === 'paid')
        .reduce((sum, order) => sum + (order.amount || 0), 0)

      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      const monthlyRevenue = ordersWithProductInfo
        .filter(order => {
          const orderDate = new Date(order.created_at)
          return order.status === 'paid' &&
                 orderDate.getMonth() === currentMonth &&
                 orderDate.getFullYear() === currentYear
        })
        .reduce((sum, order) => sum + (order.amount || 0), 0)

      const subscriptionOrders = ordersWithProductInfo.filter(order => 
        (order as any).product_type === 'subscription'
      )
      // サブスクは実際のStripe状況に関係なくpaidのもののみカウント（実際は0）
      const activeSubscriptions = 0 // 実際のサブスク数は0
      const totalSubscriptions = subscriptionOrders.filter(order => order.status === 'paid').length

      const oneTimeOrders = ordersWithProductInfo.filter(order => 
        (order as any).product_type === 'one_time'
      )
      const successfulOneTime = oneTimeOrders.filter(order => order.status === 'paid').length
      const totalOneTime = oneTimeOrders.length

      const pendingOrders = ordersWithProductInfo.filter(order => order.status === 'pending').length
      const canceledOrders = ordersWithProductInfo.filter(order => order.status === 'canceled').length
      const refundedOrders = ordersWithProductInfo.filter(order => order.status === 'refunded').length

      // Calculate unique users
      const uniqueSubscriptionUsers = new Set(
        subscriptionOrders
          .filter(order => order.status === 'paid')
          .map(order => order.friend_uid)
          .filter(uid => uid)
      ).size

      const uniqueOnetimeUsers = new Set(
        oneTimeOrders
          .filter(order => order.status === 'paid')
          .map(order => order.friend_uid)
          .filter(uid => uid)
      ).size

      setStats({
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        monthly_revenue: monthlyRevenue,
        active_subscriptions: activeSubscriptions,
        total_subscriptions: totalSubscriptions,
        successful_one_time: successfulOneTime,
        total_one_time: totalOneTime,
        pending_orders: pendingOrders,
        unique_subscription_users: uniqueSubscriptionUsers,
        unique_onetime_users: uniqueOnetimeUsers,
        canceled_orders: canceledOrders,
        refunded_orders: refundedOrders,
      })

      // Load friends
      const { data: friendsData, error: friendsError } = await supabase
        .from('line_friends')
        .select('id, display_name, short_uid, line_user_id')
        .eq('user_id', activeUser.id)
        .order('display_name')

      if (friendsError) throw friendsError
      setFriends(friendsData || [])

      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, product_type, currency')
        .eq('user_id', activeUser.id)
        .eq('is_active', true)
        .order('name')

      if (productsError) throw productsError
      setProducts(productsData || [])

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('データの読み込みに失敗しました')
    }
  }

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.stripe_session_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (order as any).product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.friend_uid?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesProduct = productFilter === "all" || order.product_id === productFilter

    return matchesSearch && matchesStatus && matchesProduct
  })

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage)

  const formatPrice = (amount: number | null, currency: string = 'jpy') => {
    if (!amount) return '¥0'
    if (currency.toLowerCase() === 'jpy') {
      return `¥${amount.toLocaleString()}`
    }
    return `${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`
  }

  const getStatusBadge = (status: string, productType?: string) => {
    const statusMap = {
      'paid': { label: '支払い完了', variant: 'default' as const },
      'pending': { label: '保留中', variant: 'secondary' as const },
      'canceled': { label: '取消済', variant: 'outline' as const },
      'refunded': { label: '返金済', variant: 'destructive' as const },
      'subscription_canceled': { label: '解約済', variant: 'outline' as const }
    }
    
    // サブスクリプション商品でpaidの場合は、実際は解約済みなので解約済バッジを表示
    if (status === 'paid' && productType === 'subscription') {
      return <Badge variant="outline">解約済</Badge>
    }
    
    const statusConfig = statusMap[status] || { label: status, variant: 'secondary' as const }
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
  }

  const handleCancelSubscription = async (customerId: string) => {
    if (!customerId) {
      toast.error('既に解約済みまたはカスタマーIDが見つかりません')
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('stripe-cancel-subscription', {
        body: { customer_id: customerId }
      })

      if (error) throw error

      if (data.success) {
        toast.success('サブスクリプションを解約しました')
        await loadData()
      }
    } catch (error: any) {
      console.error('Error canceling subscription:', error)
      if (error.message?.includes('No active subscriptions found') || error.message?.includes('already_canceled')) {
        toast.info('このカスタマーは既に解約済みです')
      } else {
        toast.error(`サブスクリプションの解約に失敗しました: ${error.message || error}`)
      }
    }
  }

  const handleFriendSearch = () => {
    const friend = friends.find(f => f.short_uid === friendUid.toUpperCase())
    if (friend) {
      setSelectedFriend(friend)
    } else {
      toast.error('指定されたUIDの友達が見つかりません')
      setSelectedFriend(null)
    }
  }

  const handleCopyUID = (uid: string) => {
    navigator.clipboard.writeText(uid)
    toast.success('UIDをコピーしました')
  }

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
        .eq('user_id', user?.id)

      if (error) throw error

      // UI からも即座に削除
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId))
      
      toast.success('注文履歴を削除しました')
      await loadData() // データを再読み込み
    } catch (error) {
      console.error('Error deleting order:', error)
      toast.error('削除に失敗しました')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error('削除する注文を選択してください')
      return
    }

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', selectedOrderIds)
        .eq('user_id', user?.id)

      if (error) throw error

      // UI からも即座に削除
      setOrders(prevOrders => prevOrders.filter(order => !selectedOrderIds.includes(order.id)))
      
      toast.success(`${selectedOrderIds.length}件の注文履歴を削除しました`)
      setSelectedOrderIds([])
      await loadData() // データを再読み込み
    } catch (error) {
      console.error('Error bulk deleting orders:', error)
      toast.error('一括削除に失敗しました')
    }
  }

  const handleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([])
    } else {
      setSelectedOrderIds(filteredOrders.map(order => order.id))
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
      const amount = parseInt(manualAmount)

      if (isNaN(amount) || amount <= 0) {
        toast.error('有効な金額を入力してください')
        return
      }

      const orderData = {
        user_id: user?.id,
        product_id: selectedProduct?.id || null,
        friend_uid: selectedFriend.short_uid,
        amount: isRefundMode ? -Math.abs(amount) : Math.abs(amount),
        currency: selectedProduct?.currency || 'jpy',
        status: isRefundMode ? 'refunded' : 'paid',
        livemode: isLiveMode,
        stripe_session_id: `manual_${Date.now()}`,
        metadata: {
          manual_entry: true,
          product_name: manualProductName,
          friend_display_name: selectedFriend.display_name,
          entry_type: isRefundMode ? 'refund' : 'payment'
        },
        created_at: orderDate,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])

      if (error) {
        console.error('Insert error:', error)
        throw error
      }

      console.log('Manual order added:', data)
      toast.success(`${selectedFriend.display_name}の${isRefundMode ? '返金' : '注文'}を手動追加しました`)
      setShowAddDialog(false)
      handleClearForm()
      await loadData()
    } catch (error: any) {
      console.error('Error adding order manually:', error)
      toast.error(`手動追加に失敗しました: ${error.message || error}`)
    }
  }

  const handleClearForm = () => {
    setFriendUid("")
    setSelectedFriend(null)
    setManualAmount("")
    setManualProductName("")
    setManualDate("")
    setSelectedProduct(null)
    setIsRefundMode(false)
  }

  const handleViewSubscriber = (subscriberDetail: SubscriberDetail) => {
    setSelectedSubscriber(subscriberDetail)
    setShowSubscriberDetailDialog(true)
  }

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (!user) {
    return <div className="p-4">ログインが必要です</div>
  }

  return (
    <>
      <div className="space-y-6">
        <AppHeader user={user} />
        
        <div className="container mx-auto px-4">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                決済管理
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Stripe決済の管理と分析
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge variant={isLiveMode ? "default" : "secondary"} className="text-xs">
                  {isLiveMode ? "本番環境" : "テスト環境"}
                </Badge>
              </div>
              <Button
                onClick={() => setIsLiveMode(!isLiveMode)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                {isLiveMode ? (
                  <ToggleRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ToggleLeft className="h-4 w-4 text-orange-500" />
                )}
                {isLiveMode ? "本番" : "テスト"}に切替
              </Button>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  総売上
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold">{formatPrice(stats.total_revenue)}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  今月売上
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold">{formatPrice(stats.monthly_revenue)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  サブスク会員
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold">0人</div>
                <div className="text-xs text-muted-foreground">
                  (全員解約済み)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  総注文数
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-bold">{stats.total_orders}件</div>
              </CardContent>
            </Card>
          </div>

          {/* Order History */}
          <Card>
            <CardHeader className="p-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">注文履歴 ({filteredOrders.length}件)</CardTitle>
                <div className="flex gap-2">
                  <Dialog open={showAddDialog} onOpenChange={(open) => {
                    setShowAddDialog(open)
                    if (!open) handleClearForm() // ダイアログを閉じたらリセット
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        手動追加
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <Button 
                        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                        onClick={() => setShowAddDialog(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <DialogHeader>
                        <DialogTitle>{isRefundMode ? '返金手動追加' : '注文手動追加'}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>処理種別</Label>
                          <div className="flex gap-2 mt-1">
                            <Button
                              type="button"
                              variant={!isRefundMode ? "default" : "outline"}
                              onClick={() => setIsRefundMode(false)}
                              className="flex-1"
                            >
                              支払い追加
                            </Button>
                            <Button
                              type="button"
                              variant={isRefundMode ? "default" : "outline"}
                              onClick={() => setIsRefundMode(true)}
                              className="flex-1"
                            >
                              返金追加
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="friend-uid">友達UID</Label>
                          <div className="flex gap-2">
                            <Input
                              id="friend-uid"
                              value={friendUid}
                              onChange={(e) => setFriendUid(e.target.value)}
                              placeholder="UIDを入力（例: ABC123）"
                              className="uppercase"
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

                        <div className="flex gap-2">
                          <Button 
                            onClick={handleAddOrderManually} 
                            className="flex-1"
                            disabled={!selectedFriend || !manualAmount || !manualProductName}
                          >
                            {isRefundMode ? '返金追加' : '支払い追加'}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline"
                            onClick={handleClearForm}
                            className="px-4"
                          >
                            クリア
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button onClick={() => loadData()} variant="outline" size="sm">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    更新
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {/* Search and Filter */}
            <div className="px-4 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="セッションID、商品名、UIDで検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 text-xs"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全ステータス</SelectItem>
                    <SelectItem value="paid">支払い完了</SelectItem>
                    <SelectItem value="pending">保留中</SelectItem>
                    <SelectItem value="canceled">取消済</SelectItem>
                    <SelectItem value="refunded">返金済</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger className="w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全商品</SelectItem>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Bulk Actions */}
              {selectedOrderIds.length > 0 && (
                <div className="flex gap-2 items-center p-2 bg-muted/50 rounded-lg">
                  <span className="text-xs text-muted-foreground">
                    {selectedOrderIds.length}件選択中
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="text-xs">
                        <Trash2 className="h-3 w-3 mr-1" />
                        一括削除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>注文履歴を削除しますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                          選択した{selectedOrderIds.length}件の注文履歴を削除します。この操作は取り消せません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
                          削除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>

            <CardContent className="p-0">
              {/* Order Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="text-xs">セッションID</TableHead>
                      <TableHead className="text-xs">商品</TableHead>
                      <TableHead className="text-xs">金額</TableHead>
                      <TableHead className="text-xs">ステータス</TableHead>
                      <TableHead className="text-xs">UID</TableHead>
                      <TableHead className="text-xs">作成日時</TableHead>
                      <TableHead className="text-xs">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/30 text-xs">
                        <TableCell>
                          <Checkbox
                            checked={selectedOrderIds.includes(order.id)}
                            onCheckedChange={() => handleSelectOrder(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-1">
                            <span className="max-w-24 truncate">
                              {order.stripe_session_id}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyUID(order.stripe_session_id)}
                              className="h-5 w-5 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{(order as any).product_name}</div>
                            <Badge variant="outline" className="text-xs mt-1">
                              {(order as any).product_type === 'subscription' ? 'サブスク' : '単発'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono">{formatPrice(order.amount, order.currency)}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.livemode ? 'Live' : 'Test'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(order.status, (order as any).product_type)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono">{order.friend_uid || '-'}</span>
                            {order.friend_uid && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyUID(order.friend_uid!)}
                                className="h-5 w-5 p-0"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            {new Date(order.created_at).toLocaleDateString('ja-JP')}
                            <br />
                            {new Date(order.created_at).toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {order.status === 'paid' && (order as any).product_type === 'subscription' && order.stripe_customer_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelSubscription(order.stripe_customer_id!)}
                                className="text-xs"
                              >
                                <ToggleLeft className="h-3 w-3 mr-1" />
                                解約
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="text-xs">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>注文履歴を削除しますか？</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    この注文履歴を削除します。この操作は取り消せません。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteOrder(order.id)} className="bg-destructive text-destructive-foreground">
                                    削除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setCurrentPage(pageNum)}
                              isActive={pageNum === currentPage}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <SubscriberDetailDialog 
          open={showSubscriberDetailDialog}
          onOpenChange={setShowSubscriberDetailDialog}
          subscriber={selectedSubscriber}
        />
      </div>
    </>
  )
}
