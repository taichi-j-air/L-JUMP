import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreditCard, Search, RefreshCw, DollarSign, Users, Calendar, Ban, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/integrations/supabase/client"
import { AppHeader } from "@/components/AppHeader"
import { User } from "@supabase/supabase-js"

interface PaymentRecord {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  lineUserId?: string
  productName: string
  amount: number
  currency: string
  status: 'succeeded' | 'pending' | 'failed' | 'canceled' | 'refunded'
  paymentDate: string
  subscriptionId?: string
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'unpaid'
  nextBillingDate?: string
  totalPaid: number
  subscriptionDuration?: string
}

interface CustomerStats {
  totalCustomers: number
  activeSubscriptions: number
  totalRevenue: number
  monthlyRevenue: number
}

export default function PaymentManagement() {
  const [user, setUser] = useState<User | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [stats, setStats] = useState<CustomerStats>({
    totalCustomers: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    monthlyRevenue: 0
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<PaymentRecord | null>(null)
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUser(user)
      loadPayments()
      loadStats()
    }
    checkUser()
  }, [])

  const loadPayments = async () => {
    setLoading(true)
    try {
      // In a real implementation, you would load payment data from Stripe and your database
      // For now, we'll use mock data
      const mockPayments: PaymentRecord[] = [
        {
          id: '1',
          customerId: 'cus_test123',
          customerName: '田中太郎',
          customerEmail: 'tanaka@example.com',
          lineUserId: 'U1234567890',
          productName: 'プレミアムプラン',
          amount: 2980,
          currency: 'JPY',
          status: 'succeeded',
          paymentDate: '2024-01-15T00:00:00Z',
          subscriptionId: 'sub_test123',
          subscriptionStatus: 'active',
          nextBillingDate: '2024-02-15T00:00:00Z',
          totalPaid: 8940,
          subscriptionDuration: '3ヶ月'
        },
        {
          id: '2',
          customerId: 'cus_test456',
          customerName: '佐藤花子',
          customerEmail: 'sato@example.com',
          lineUserId: 'U0987654321',
          productName: '追加シナリオパック',
          amount: 5000,
          currency: 'JPY',
          status: 'succeeded',
          paymentDate: '2024-01-10T00:00:00Z',
          totalPaid: 5000,
          subscriptionDuration: '-'
        }
      ]
      setPayments(mockPayments)
    } catch (error) {
      console.error('Failed to load payments:', error)
      toast.error('決済データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      // Load statistics from your database
      setStats({
        totalCustomers: 45,
        activeSubscriptions: 28,
        totalRevenue: 134200,
        monthlyRevenue: 38600
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleRefund = async (paymentId: string) => {
    if (!confirm('この決済を返金してもよろしいですか？')) return

    try {
      // Process refund through Stripe API
      toast.success('返金処理を開始しました')
      loadPayments() // Reload data
    } catch (error) {
      console.error('Refund failed:', error)
      toast.error('返金処理に失敗しました')
    }
  }

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm('このサブスクリプションをキャンセルしてもよろしいですか？')) return

    try {
      // Cancel subscription through Stripe API
      toast.success('サブスクリプションをキャンセルしました')
      loadPayments() // Reload data
    } catch (error) {
      console.error('Subscription cancellation failed:', error)
      toast.error('サブスクリプションのキャンセルに失敗しました')
    }
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.productName.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency
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
      case 'past_due':
        return 'destructive'
      case 'refunded':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'succeeded': return '成功'
      case 'pending': return '処理中'
      case 'failed': return '失敗'
      case 'canceled': return 'キャンセル'
      case 'refunded': return '返金済み'
      case 'active': return '有効'
      case 'past_due': return '延滞'
      case 'unpaid': return '未払い'
      default: return status
    }
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6" />
          <h1 className="text-2xl font-bold">決済管理</h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-500/10 rounded-lg mr-4">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">総顧客数</p>
                  <p className="text-2xl font-bold">{stats.totalCustomers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-500/10 rounded-lg mr-4">
                  <RefreshCw className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">アクティブサブスク</p>
                  <p className="text-2xl font-bold">{stats.activeSubscriptions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-500/10 rounded-lg mr-4">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">総売上</p>
                  <p className="text-2xl font-bold">{formatPrice(stats.totalRevenue, 'JPY')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-500/10 rounded-lg mr-4">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">月間売上</p>
                  <p className="text-2xl font-bold">{formatPrice(stats.monthlyRevenue, 'JPY')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>決済一覧</CardTitle>
            <CardDescription>
              すべての決済とサブスクリプションの管理
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="顧客名、メール、商品名で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべてのステータス</SelectItem>
                  <SelectItem value="succeeded">成功</SelectItem>
                  <SelectItem value="pending">処理中</SelectItem>
                  <SelectItem value="failed">失敗</SelectItem>
                  <SelectItem value="refunded">返金済み</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={loadPayments} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                更新
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>顧客情報</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>金額</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>決済日</TableHead>
                  <TableHead>累計課金額</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <div className="font-semibold">{payment.customerName}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.customerEmail}
                        </div>
                        {payment.lineUserId && (
                          <div className="text-xs text-muted-foreground">
                            LINE: {payment.lineUserId}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.productName}</div>
                        {payment.subscriptionStatus && (
                          <Badge 
                            variant={getStatusColor(payment.subscriptionStatus)}
                            className="text-xs mt-1"
                          >
                            {getStatusLabel(payment.subscriptionStatus)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatPrice(payment.amount, payment.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(payment.status)}>
                        {getStatusLabel(payment.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(payment.paymentDate).toLocaleDateString('ja-JP')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-semibold">
                          {formatPrice(payment.totalPaid, payment.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          継続期間: {payment.subscriptionDuration}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedCustomer(payment)
                            setIsCustomerDialogOpen(true)
                          }}
                        >
                          詳細
                        </Button>
                        {payment.status === 'succeeded' && (
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleRefund(payment.id)}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            返金
                          </Button>
                        )}
                        {payment.subscriptionStatus === 'active' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleCancelSubscription(payment.subscriptionId!)}
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            停止
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Customer Detail Dialog */}
        <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>顧客詳細情報</DialogTitle>
            </DialogHeader>
            
            {selectedCustomer && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">顧客情報</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>名前:</strong> {selectedCustomer.customerName}</p>
                      <p><strong>メール:</strong> {selectedCustomer.customerEmail}</p>
                      {selectedCustomer.lineUserId && (
                        <p><strong>LINE ID:</strong> {selectedCustomer.lineUserId}</p>
                      )}
                      <p><strong>Stripe ID:</strong> {selectedCustomer.customerId}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">決済情報</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>商品:</strong> {selectedCustomer.productName}</p>
                      <p><strong>金額:</strong> {formatPrice(selectedCustomer.amount, selectedCustomer.currency)}</p>
                      <p><strong>累計課金額:</strong> {formatPrice(selectedCustomer.totalPaid, selectedCustomer.currency)}</p>
                      <p><strong>継続期間:</strong> {selectedCustomer.subscriptionDuration}</p>
                    </div>
                  </div>
                </div>

                {selectedCustomer.subscriptionId && (
                  <div>
                    <h4 className="font-semibold mb-2">サブスクリプション情報</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>サブスク ID:</strong> {selectedCustomer.subscriptionId}</p>
                      <p><strong>ステータス:</strong> 
                        <Badge variant={getStatusColor(selectedCustomer.subscriptionStatus!)} className="ml-2">
                          {getStatusLabel(selectedCustomer.subscriptionStatus!)}
                        </Badge>
                      </p>
                      {selectedCustomer.nextBillingDate && (
                        <p><strong>次回請求日:</strong> {new Date(selectedCustomer.nextBillingDate).toLocaleDateString('ja-JP')}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}