import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDistanceToNow } from "date-fns"
import { ja } from "date-fns/locale"
import { CreditCard, User, Calendar, DollarSign, Package, X } from "lucide-react"

interface SubscriberOrder {
  id: string
  product_name?: string
  product_type: string
  amount: number
  currency: string
  status: string
  created_at: string
}

interface SubscriberDetail {
  id: string
  display_name: string
  short_uid: string
  line_user_id: string
  orders: SubscriberOrder[]
  total_amount: number
}

interface SubscriberDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscriber: SubscriberDetail | null
}

export function SubscriberDetailDialog({ open, onOpenChange, subscriber }: SubscriberDetailDialogProps) {
  if (!subscriber) return null

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'default'
      case 'pending': return 'secondary'
      case 'failed':
      case 'refunded':
      case 'canceled': return 'destructive'
      default: return 'secondary'
    }
  }

  const activeOrders = subscriber.orders.filter(order => order.status === 'paid')
  const allPlans = [...new Set(subscriber.orders.map(order => order.product_name || 'アンノーン'))]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            サブスクライバー詳細
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* 基本情報 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-4 w-4" />
                  基本情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">ユーザー名</div>
                    <div className="font-medium">{subscriber.display_name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">UID</div>
                    <div className="font-mono text-sm">{subscriber.short_uid}</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">累計課金金額</div>
                  <div className="text-xl font-bold text-primary">
                    {formatPrice(subscriber.total_amount, 'jpy')}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 現在のプラン */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  現在の加入プラン
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeOrders.length === 0 ? (
                  <p className="text-muted-foreground">現在アクティブなプランはありません</p>
                ) : (
                  <div className="space-y-3">
                    {activeOrders.map((order, index) => (
                      <div key={order.id} className={`p-3 border rounded-lg ${index > 0 ? 'border-t mt-2' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{order.product_name || 'アンノーン'}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              加入日: {formatDistanceToNow(new Date(order.created_at), { 
                                addSuffix: true, 
                                locale: ja 
                              })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatPrice(order.amount, order.currency)}</div>
                            <Badge variant={getStatusColor(order.status)}>
                              {getStatusLabel(order.status)}
                            </Badge>
                          </div>
                        </div>
                        {index < activeOrders.length - 1 && <Separator className="mt-3" />}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 全プラン履歴 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  全プラン履歴
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {subscriber.orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{order.product_name || 'アンノーン'}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('ja-JP')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{formatPrice(order.amount, order.currency)}</span>
                        <Badge variant={getStatusColor(order.status)} className="text-xs">
                          {getStatusLabel(order.status)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}