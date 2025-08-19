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
import { Eye, RefreshCw, CreditCard, Users, TrendingUp, DollarSign, Search, Plus, ToggleLeft, Calendar, X, Copy, Trash2, Filter } from "lucide-react"
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
    refunded_orders: 0
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCanceledOrders, setShowCanceledOrders] = useState(false)
  const [showRefundedOrders, setShowRefundedOrders] = useState(false)
  const [showExpiredOrders, setShowExpiredOrders] = useState(false)
  const [userTotals, setUserTotals] = useState<Record<string, number>>({})
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
  const [showSubscriberDialog, setShowSubscriberDialog] = useState(false)
  const [subscriberPage, setSubscriberPage] = useState(1)
  const [subscriberSort, setSubscriberSort] = useState<'name' | 'date'>('name')
  const [activeSubscribers, setActiveSubscribers] = useState<SubscriberDetail[]>([])
  const [selectedSubscriber, setSelectedSubscriber] = useState<SubscriberDetail | null>(null)
  const [showSubscriberDetailDialog, setShowSubscriberDetailDialog] = useState(false)
  const [isRefundMode, setIsRefundMode] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [filterYear, setFilterYear] = useState("")
  const [filterMonth, setFilterMonth] = useState("")
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  // Function to load all data and refresh stats
  const loadData = async () => {
    try {
      if (!user) return;
      await Promise.all([
        loadOrders(),
        loadFriends(), 
        loadProducts()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('データの読み込みに失敗しました');
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, showTestMode]);

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

      // 統計を計算（返金済みを除外）
      const successful = data?.filter(order => order.status === 'paid') || []
      const refunded = data?.filter(order => order.status === 'refunded') || []
      
      const totalRevenue = successful.reduce((sum, order) => sum + (order.amount || 0), 0)
      const totalRefunded = refunded.reduce((sum, order) => sum + (order.amount || 0), 0)
      const netRevenue = totalRevenue - totalRefunded
      
      // 今月の売上を計算（返金を考慮）
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      
      const monthlyPaid = successful
        .filter(order => {
          const orderDate = new Date(order.created_at)
          return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear
        })
        .reduce((sum, order) => sum + (order.amount || 0), 0)
        
      const monthlyRefunded = refunded
        .filter(order => {
          const orderDate = new Date(order.created_at)
          return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear
        })
        .reduce((sum, order) => sum + (order.amount || 0), 0)
        
      const monthlyRevenue = monthlyPaid - monthlyRefunded

      // サブスクリプション統計（解約済み・返金済みを正しく除外）
      const subscriptionOrders = data?.filter(order => {
        const metadata = order.metadata as any
        return metadata?.product_type === 'subscription' && order.status !== 'pending'
      }) || []
      // アクティブなサブスクリプションは 'paid' で 'canceled' や 'refunded' でないもの
      const activeSubscriptions = subscriptionOrders.filter(order => 
        order.status === 'paid'
      ).length
      const totalSubscriptions = subscriptionOrders.length
      
      // ユニークなサブスク加入者数（現在アクティブな会員のみ）
      const activeSubscriberIds = new Set(
        subscriptionOrders.filter(order => 
          order.status === 'paid'
        )
          .map(order => order.friend_uid)
          .filter(Boolean)
      )
      
      // アクティブなサブスクライバーの詳細情報を取得
      const activeSubDetails: SubscriberDetail[] = friends
        .filter(friend => activeSubscriberIds.has(friend.short_uid))
        .map(friend => {
          const friendOrders = data?.filter(order => 
            order.friend_uid === friend.short_uid && 
            (order.metadata as any)?.product_type === 'subscription'
          ) || []
          
          const friendTotalAmount = friendOrders
            .filter(order => order.status === 'paid')
            .reduce((sum, order) => sum + (order.amount || 0), 0) -
            friendOrders
            .filter(order => order.status === 'refunded')
            .reduce((sum, order) => sum + (order.amount || 0), 0)
            
          return {
            ...friend,
            orders: friendOrders.map(order => ({
              id: order.id,
              product_name: (order.metadata as any)?.product_name || getProductName(order),
              product_type: (order.metadata as any)?.product_type || 'subscription',
              amount: order.amount,
              currency: order.currency,
              status: order.status,
              created_at: order.created_at
            })),
            total_amount: friendTotalAmount
          }
        })
      setActiveSubscribers(activeSubDetails)
      
      const uniqueSubscriptionUsers = activeSubDetails.length

      // 単発決済統計（保留中を除く）
      const oneTimeOrders = data?.filter(order => {
        const metadata = order.metadata as any
        return metadata?.product_type === 'one_time' && order.status !== 'pending'
      }) || []
      const successfulOneTime = oneTimeOrders.filter(order => order.status === 'paid').length
      const totalOneTime = oneTimeOrders.length
      
      // ユニークな単発決済ユーザー数
      const uniqueOneTimeUsers = new Set(
        oneTimeOrders.filter(order => order.status === 'paid')
          .map(order => order.friend_uid)
          .filter(Boolean)
      ).size
      
      // 解約・返金統計
      const canceledOrders = data?.filter(order => order.status === 'canceled').length || 0
      const refundedOrders = data?.filter(order => order.status === 'refunded').length || 0
      
       // ユーザーごとの累計課金額計算（返金分を除外）
       const totals: Record<string, number> = {}
       successful.forEach(order => {
         const userId = order.friend_uid || 'unknown'
         totals[userId] = (totals[userId] || 0) + (order.amount || 0)
       })
       // 返金分を差し引く
       refunded.forEach(order => {
         const userId = order.friend_uid || 'unknown'
         totals[userId] = (totals[userId] || 0) - (order.amount || 0)
       })
       setUserTotals(totals)
       
       setStats({
         total_orders: data?.length || 0,
         total_revenue: netRevenue, // 返金を考慮した純売上
         monthly_revenue: monthlyRevenue,
         active_subscriptions: activeSubscriptions,
         total_subscriptions: totalSubscriptions,
        successful_one_time: successfulOneTime,
        total_one_time: totalOneTime,
        pending_orders: data?.filter(order => order.status === 'pending').length || 0,
        unique_subscription_users: uniqueSubscriptionUsers,
        unique_onetime_users: uniqueOneTimeUsers,
        canceled_orders: canceledOrders,
        refunded_orders: refundedOrders
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
      console.log('Processing refund for order:', orderId)
      
      // Stripe返金処理のエッジ関数を呼び出し
      const { data, error } = await supabase.functions.invoke('stripe-refund', {
        body: { orderId }
      })

      console.log('Refund response:', { data, error })

      if (error) {
        console.error('Refund error:', error)
        throw error
      }

      if (data?.success) {
        if (data.manual) {
          toast.success('手動注文の返金処理が完了しました')
        } else {
          toast.success(`返金処理が完了しました (返金ID: ${data.refundId})`)
        }
        
        // データを再読み込みして統計と表示を更新
        await loadData();
      } else {
        throw new Error(data?.error || '返金処理に失敗しました')
      }
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
        toast.success('サブスクリプションの解約が完了しました')
        // データを再読み込みして統計と表示を更新
        await loadData()
      } else {
        // 解約済みの場合は適切なメッセージを表示
        if (data?.already_canceled || data?.error?.includes('No active subscriptions found')) {
          toast.info('このカスタマーは既に解約済みです')
        } else {
          throw new Error(data?.error || '解約処理に失敗しました')
        }
      }
    } catch (error) {
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

      // 手動で注文/返金を追加
      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: user?.id,
          product_id: selectedProduct?.id,
          friend_uid: selectedFriend.short_uid,
          amount: amount,
          currency: selectedProduct?.currency || 'jpy',
          status: isRefundMode ? 'refunded' : 'paid',
          livemode: !showTestMode,
          metadata: {
            product_name: manualProductName,
            product_type: selectedProduct?.product_type || 'one_time',
            manual_entry: true,
            refund_type: isRefundMode ? 'manual' : undefined
          },
          stripe_session_id: `manual_${Date.now()}`,
          stripe_customer_id: null,
          stripe_payment_intent_id: null,
          created_at: orderDate,
          updated_at: new Date().toISOString()
        })
        .select()

      if (error) {
        console.error('Insert error:', error)
        throw error
      }

      console.log('Manual order added:', data)
      toast.success(`${selectedFriend.display_name}の${isRefundMode ? '返金' : '注文'}を手動追加しました`)
      setShowAddDialog(false)
      handleClearForm()
      await loadData()
    } catch (error) {
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

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.stripe_session_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.friend_uid?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    
    // 保留中の表示/非表示フィルター
    const matchesPendingFilter = !showPendingOrders || order.status === 'pending'
    
    // 解約済みの表示/非表示フィルター
    const matchesCanceledFilter = !showCanceledOrders || order.status === 'canceled'
    
    // 返金済みの表示/非表示フィルター
    const matchesRefundedFilter = !showRefundedOrders || order.status === 'refunded'
    
    // 期限切れの表示/非表示フィルター
    const matchesExpiredFilter = !showExpiredOrders || order.status === 'expired'
    
    // 年月フィルター
    const orderDate = new Date(order.created_at)
    const matchesYear = !filterYear || filterYear === "all" || orderDate.getFullYear().toString() === filterYear
    const matchesMonth = !filterMonth || filterMonth === "all" || (orderDate.getMonth() + 1).toString().padStart(2, '0') === filterMonth
    
    return matchesSearch && matchesStatus && matchesPendingFilter && matchesCanceledFilter && matchesRefundedFilter && matchesExpiredFilter && matchesYear && matchesMonth
  })

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // 年のオプション生成
  const availableYears = Array.from(new Set(orders.map(order => new Date(order.created_at).getFullYear()))).sort((a, b) => b - a)

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
        <span className="bg-destructive text-white px-1 py-0.5 rounded text-xs font-medium">
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

  const getStatusStyle = (status: string) => {
    if (status === 'paid') {
      return { backgroundColor: 'hsl(142, 71%, 45%)', color: 'white' }
    }
    return undefined
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return '成功'
      case 'pending': return '保留中'
      case 'failed': return '失敗'
      case 'refunded': return '返金済み'
      case 'canceled': return '解約済み'
      case 'expired': return '期限切れ'
      default: return status
    }
  }

  const getUserTotal = (order: OrderRecord) => {
    const userId = order.friend_uid || 'unknown'
    return userTotals[userId] || 0
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
            <Button
              variant="ghost"
              className="w-full h-full p-3 flex items-center justify-between hover:bg-accent transition-colors"
              onClick={() => setShowSubscriberDialog(true)}
            >
              <div>
                <p className="text-xs font-medium text-muted-foreground">サブスク会員数</p>
                <p className="text-lg font-bold">{stats.active_subscriptions}/{stats.unique_subscription_users}</p>
              </div>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Card>

          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">単発決済数</p>
                <p className="text-lg font-bold">{stats.successful_one_time}/{stats.unique_onetime_users}</p>
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
                       variant="ghost" 
                       size="icon" 
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
                            onClick={handleClearForm} 
                            variant="outline"
                            className="flex-1"
                          >
                            クリア
                          </Button>
                        </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button onClick={loadData} variant="outline" size="sm">
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
                 <Select value={filterYear} onValueChange={setFilterYear}>
                   <SelectTrigger className="w-24 h-8 text-xs">
                     <SelectValue placeholder="年" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">全年</SelectItem>
                     {availableYears.map(year => (
                       <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                 <Select value={filterMonth} onValueChange={setFilterMonth}>
                   <SelectTrigger className="w-20 h-8 text-xs">
                     <SelectValue placeholder="月" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">全月</SelectItem>
                     {Array.from({length: 12}, (_, i) => (
                       <SelectItem key={i + 1} value={(i + 1).toString().padStart(2, '0')}>
                         {i + 1}月
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
              
              <div className="flex flex-wrap items-center gap-4">
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
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-canceled"
                    checked={showCanceledOrders}
                    onCheckedChange={(checked) => setShowCanceledOrders(checked === true)}
                  />
                  <Label htmlFor="show-canceled" className="text-xs">
                    解約済みの注文を表示
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-refunded"
                    checked={showRefundedOrders}
                    onCheckedChange={(checked) => setShowRefundedOrders(checked === true)}
                  />
                  <Label htmlFor="show-refunded" className="text-xs">
                    返金済みの注文を表示
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-expired"
                    checked={showExpiredOrders}
                    onCheckedChange={(checked) => setShowExpiredOrders(checked === true)}
                  />
                  <Label htmlFor="show-expired" className="text-xs">
                    期限切れの注文を表示
                  </Label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {/* 一括削除ボタン */}
              {selectedOrderIds.length > 0 && (
                <div className="p-4 bg-destructive/10 border-b flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {selectedOrderIds.length}件の注文が選択されています
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-3 w-3 mr-1" />
                        一括削除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>一括削除確認</AlertDialogTitle>
                        <AlertDialogDescription>
                          選択された{selectedOrderIds.length}件の注文履歴を削除しますか？この操作は取り消せません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleBulkDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                        >
                          削除実行
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
              <Table>
                 <TableHeader>
                   <TableRow className="text-xs">
                     <TableHead className="py-2 w-12">
                       <Checkbox
                         checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                         onCheckedChange={handleSelectAll}
                       />
                     </TableHead>
                     <TableHead className="py-2">商品名</TableHead>
                     <TableHead className="py-2">購入者</TableHead>
                     <TableHead className="py-2">金額</TableHead>
                     <TableHead className="py-2">累計課金</TableHead>
                     <TableHead className="py-2">ステータス</TableHead>
                     <TableHead className="py-2">モード</TableHead>
                     <TableHead className="py-2">注文日時</TableHead>
                     <TableHead className="py-2">アクション</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {paginatedOrders.map((order) => (
                     <TableRow key={order.id} className="text-xs">
                       <TableCell className="py-2">
                         <Checkbox
                           checked={selectedOrderIds.includes(order.id)}
                           onCheckedChange={(checked) => {
                             if (checked) {
                               setSelectedOrderIds([...selectedOrderIds, order.id])
                             } else {
                               setSelectedOrderIds(selectedOrderIds.filter(id => id !== order.id))
                             }
                           }}
                         />
                       </TableCell>
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
                         {order.friend_uid && (
                           <div className="flex items-center gap-1 text-xs text-muted-foreground">
                             <span className="font-mono">{order.friend_uid}</span>
                             <Button
                               variant="ghost"
                               size="sm"
                               className="h-4 w-4 p-0"
                               onClick={() => handleCopyUID(order.friend_uid)}
                             >
                               <Copy className="h-3 w-3" />
                             </Button>
                           </div>
                         )}
                         {order.status === 'pending' && (
                           <div className="text-xs text-amber-600">保留中</div>
                         )}
                       </TableCell>
                       <TableCell className="py-2 font-medium text-xs">
                         ¥{order.amount?.toLocaleString('ja-JP') || '0'}
                       </TableCell>
                       <TableCell className="py-2 font-medium text-xs">
                         ¥{getUserTotal(order).toLocaleString('ja-JP')}
                       </TableCell>
                       <TableCell className="py-2">
                         <Badge 
                           variant={getStatusColor(order.status)} 
                           className="text-xs"
                           style={getStatusStyle(order.status)}
                         >
                           {getStatusLabel(order.status)}
                         </Badge>
                       </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={order.livemode ? 'default' : 'secondary'} className="text-xs">
                          {order.livemode ? '本番' : 'テスト'}
                        </Badge>
                      </TableCell>
                       <TableCell className="py-2 text-xs">
                         <div>
                           {new Date(order.created_at).toLocaleDateString('ja-JP')}
                           <div className="text-xs text-muted-foreground">
                             {new Date(order.created_at).toLocaleTimeString('ja-JP', { 
                               hour: '2-digit', 
                               minute: '2-digit',
                               second: '2-digit'
                             })}
                           </div>
                         </div>
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
              {/* 返金ボタンを非表示にしました */}
                             {order.status === 'refunded' && (
                               <Badge variant="destructive" className="text-xs">
                                 返金済
                               </Badge>
                             )}
                             {order.status === 'canceled' && (order.metadata as any)?.product_type === 'subscription' && (
                               <Badge variant="secondary" className="text-xs">
                                 解約済
                               </Badge>
                             )}
                             {order.stripe_customer_id && order.status === 'paid' && (order.metadata as any)?.product_type === 'subscription' && (
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
                            {order.status === 'canceled' && (order.metadata as any)?.product_type === 'subscription' && (
                              <Badge variant="destructive" className="text-xs">
                                解約済
                              </Badge>
                             )}
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   className="h-6 w-6 p-0"
                                 >
                                   <Trash2 className="h-3 w-3" />
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                 <AlertDialogHeader>
                                   <AlertDialogTitle>注文履歴削除確認</AlertDialogTitle>
                                   <AlertDialogDescription>
                                     この注文履歴を削除しますか？この操作は取り消せません。
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                   <AlertDialogAction 
                                     onClick={() => handleDeleteOrder(order.id)}
                                     className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                                   >
                                     削除実行
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
           </CardContent>
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
                     let pageNumber;
                     if (totalPages <= 5) {
                       pageNumber = i + 1;
                     } else if (currentPage <= 3) {
                       pageNumber = i + 1;
                     } else if (currentPage >= totalPages - 2) {
                       pageNumber = totalPages - 4 + i;
                     } else {
                       pageNumber = currentPage - 2 + i;
                     }
                     return (
                       <PaginationItem key={pageNumber}>
                         <PaginationLink
                           onClick={() => setCurrentPage(pageNumber)}
                           isActive={currentPage === pageNumber}
                           className="cursor-pointer"
                         >
                           {pageNumber}
                         </PaginationLink>
                       </PaginationItem>
                     );
                   })}
                   <PaginationItem>
                     <PaginationNext 
                       onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                       className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                     />
                   </PaginationItem>
                 </PaginationContent>
               </Pagination>
               <div className="text-center text-sm text-muted-foreground mt-2">
                 {filteredOrders.length}件中 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredOrders.length)}件を表示
               </div>
             </div>
           )}
         </Card>

        {/* サブスクライバー一覧ダイアログ */}
        <Dialog open={showSubscriberDialog} onOpenChange={setShowSubscriberDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>サブスクリプション会員一覧 ({activeSubscribers.length}名)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Select value={subscriberSort} onValueChange={(value: 'name' | 'date') => setSubscriberSort(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">名前順</SelectItem>
                    <SelectItem value="date">登録順</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-sm text-muted-foreground">
                  ページ {subscriberPage} / {Math.max(1, Math.ceil(activeSubscribers.length / 20))}
                </div>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                     <TableRow>
                       <TableHead>名前</TableHead>
                       <TableHead>UID</TableHead>
                       <TableHead>プラン</TableHead>
                       <TableHead>加入日</TableHead>
                       <TableHead>累計課金</TableHead>
                       <TableHead>詳細</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSubscribers
                      .sort((a, b) => {
                        if (subscriberSort === 'name') {
                          return (a.display_name || '').localeCompare(b.display_name || '')
                        }
                        return a.id.localeCompare(b.id)
                      })
                      .slice((subscriberPage - 1) * 20, subscriberPage * 20)
                       .map((subscriber) => (
                         <TableRow key={subscriber.id}>
                           <TableCell>{subscriber.display_name || '未設定'}</TableCell>
                           <TableCell className="font-mono text-xs">{subscriber.short_uid}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {subscriber.orders
                                  .filter(order => order.status === 'paid')
                                  .map((order, index) => (
                                  <div key={index} className="flex items-center gap-2 text-xs">
                                    <div>
                                      <div className="font-medium">{order.product_name}</div>
                                      <div className="text-muted-foreground">
                                        {new Date(order.created_at).toLocaleDateString('ja-JP')}
                                      </div>
                                    </div>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-5 px-2 text-xs"
                                        >
                                          解約
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>サブスクリプション解約確認</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {subscriber.display_name}のサブスクリプション「{order.product_name}」を解約しますか？
                                            この操作は取り消せません。
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                          <AlertDialogAction 
                                            onClick={() => {
                                              const customerOrder = orders.find(o => 
                                                o.friend_uid === subscriber.short_uid && 
                                                o.stripe_customer_id &&
                                                o.status === 'paid'
                                              );
                                              if (customerOrder?.stripe_customer_id) {
                                                handleCancelSubscription(customerOrder.stripe_customer_id);
                                              } else {
                                                toast.error('Stripeカスタマー情報が見つかりません');
                                              }
                                            }}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                                          >
                                            解約実行
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                           <TableCell>
                             {subscriber.orders.length > 0 && (
                               <div className="text-xs">
                                 {new Date(subscriber.orders[0].created_at).toLocaleDateString('ja-JP')}
                               </div>
                             )}
                           </TableCell>
                           <TableCell className="font-mono text-xs">
                             ¥{subscriber.total_amount.toLocaleString('ja-JP')}
                           </TableCell>
                           <TableCell>
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => {
                                 setSelectedSubscriber(subscriber)
                                 setShowSubscriberDetailDialog(true)
                               }}
                               className="h-6 px-2 text-xs"
                             >
                               詳細
                             </Button>
                           </TableCell>
                         </TableRow>
                       ))}
                     {activeSubscribers.length === 0 && (
                       <TableRow>
                         <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          アクティブなサブスクライバーがいません
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {activeSubscribers.length > 20 && (
                <div className="flex justify-center items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={subscriberPage === 1}
                    onClick={() => setSubscriberPage(p => Math.max(1, p - 1))}
                  >
                    前へ
                  </Button>
                  <span className="text-sm">
                    {subscriberPage} / {Math.ceil(activeSubscribers.length / 20)}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={subscriberPage >= Math.ceil(activeSubscribers.length / 20)}
                    onClick={() => setSubscriberPage(p => p + 1)}
                  >
                    次へ
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        
        <SubscriberDetailDialog 
          open={showSubscriberDetailDialog}
          onOpenChange={setShowSubscriberDetailDialog}
          subscriber={selectedSubscriber}
        />
      </div>
    </div>
  )
}