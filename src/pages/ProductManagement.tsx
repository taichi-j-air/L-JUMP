import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit, Plus, Trash2, Save, CreditCard, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface Product {
  id: string
  name: string
  description: string
  price: number
  currency: string
  payment_type: 'one_time' | 'subscription' | 'subscription_trial'
  trial_days?: number
  subscription_interval?: 'month' | 'year'
  is_active: boolean
  stripe_price_id?: string
  payment_page_url?: string
  button_text: string
  button_color: string
  created_at: string
}

export default function ProductManagement() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (user) {
      loadProducts()
    }
  }, [user])

  const loadProducts = async () => {
    try {
      // プレースホルダー: 実際の実装では商品データをデータベースから取得
      const mockProducts: Product[] = [
        {
          id: "prod_1",
          name: "ベーシックプラン",
          description: "月額2,980円のベーシックプラン",
          price: 2980,
          currency: "JPY",
          payment_type: "subscription",
          subscription_interval: "month",
          is_active: true,
          button_text: "今すぐ購入",
          button_color: "#0cb386",
          created_at: "2024-01-15T10:30:00Z"
        },
        {
          id: "prod_2", 
          name: "プレミアムプラン（7日間トライアル）",
          description: "7日間無料トライアル付きプレミアムプラン",
          price: 9800,
          currency: "JPY",
          payment_type: "subscription_trial",
          trial_days: 7,
          subscription_interval: "month",
          is_active: true,
          button_text: "無料で試す",
          button_color: "#f59e0b",
          created_at: "2024-01-14T15:45:00Z"
        }
      ]
      setProducts(mockProducts)
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('商品データの取得に失敗しました')
    }
  }

  const handleSaveProduct = async () => {
    if (!editingProduct) return

    try {
      // プレースホルダー: 実際の実装では商品データをデータベースに保存
      console.log('Saving product:', editingProduct)
      toast.success(editingProduct.id === 'new' ? '商品を作成しました' : '商品を更新しました')
      setIsDialogOpen(false)
      setEditingProduct(null)
      loadProducts()
    } catch (error) {
      console.error('Error saving product:', error)
      toast.error('商品の保存に失敗しました')
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('この商品を削除しますか？')) return

    try {
      // プレースホルダー: 実際の実装では商品をデータベースから削除
      console.log('Deleting product:', productId)
      toast.success('商品を削除しました')
      loadProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('商品の削除に失敗しました')
    }
  }

  const openEditDialog = (product?: Product) => {
    if (product) {
      setEditingProduct({ ...product })
    } else {
      setEditingProduct({
        id: 'new',
        name: '',
        description: '',
        price: 0,
        currency: 'JPY',
        payment_type: 'one_time',
        is_active: true,
        button_text: '今すぐ購入',
        button_color: '#0cb386',
        created_at: new Date().toISOString()
      })
    }
    setIsDialogOpen(true)
  }

  const updateEditingProduct = (updates: Partial<Product>) => {
    if (!editingProduct) return
    setEditingProduct({ ...editingProduct, ...updates })
  }

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency,
    }).format(price)
  }

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'one_time': return '単発課金'
      case 'subscription': return 'サブスク課金'
      case 'subscription_trial': return 'トライアル付きサブスク'
      default: return type
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
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6" />
              商品管理
            </h1>
            <p className="text-muted-foreground">決済商品の作成・編集・管理を行います。</p>
          </div>
          <Button onClick={() => openEditDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            新規商品作成
          </Button>
        </div>

        {/* 決済ページ情報カード */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>決済ページについて</CardTitle>
            <CardDescription>LINEアカウントBAN対策について</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">決済フロー</h3>
              <div className="text-sm text-yellow-700 space-y-2">
                <p>1. ユーザーが商品ページにアクセス</p>
                <p>2. 商品詳細・料金確認 → 「購入へ進む」ボタン</p>
                <p>3. ブラウザ経由でStripe決済ページに移動（BAN対策）</p>
                <p>4. 決済完了後、サービス利用開始</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 商品一覧 */}
        <Card>
          <CardHeader>
            <CardTitle>商品一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品名</TableHead>
                    <TableHead>料金</TableHead>
                    <TableHead>決済タイプ</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>決済ページ</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">{product.description}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(product.price, product.currency)}
                        {product.subscription_interval && (
                          <div className="text-xs text-muted-foreground">
                            / {product.subscription_interval === 'month' ? '月' : '年'}
                          </div>
                        )}
                        {product.trial_days && (
                          <div className="text-xs text-green-600">
                            {product.trial_days}日間無料
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getPaymentTypeLabel(product.payment_type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? 'default' : 'secondary'}>
                          {product.is_active ? 'アクティブ' : '無効'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {product.payment_page_url ? (
                          <Button size="sm" variant="outline" asChild>
                            <a href={product.payment_page_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">未設定</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(product)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeleteProduct(product.id)}
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
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct?.id === 'new' ? '商品作成' : '商品編集'}
              </DialogTitle>
            </DialogHeader>
            {editingProduct && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">商品名</Label>
                    <Input
                      id="name"
                      value={editingProduct.name}
                      onChange={(e) => updateEditingProduct({ name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">価格</Label>
                    <Input
                      id="price"
                      type="number"
                      value={editingProduct.price}
                      onChange={(e) => updateEditingProduct({ price: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">商品説明</Label>
                  <Textarea
                    id="description"
                    value={editingProduct.description}
                    onChange={(e) => updateEditingProduct({ description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment_type">決済タイプ</Label>
                    <Select
                      value={editingProduct.payment_type}
                      onValueChange={(value: any) => updateEditingProduct({ payment_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">単発課金</SelectItem>
                        <SelectItem value="subscription">サブスク課金</SelectItem>
                        <SelectItem value="subscription_trial">トライアル付きサブスク</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editingProduct.payment_type.startsWith('subscription') && (
                    <div className="space-y-2">
                      <Label htmlFor="subscription_interval">課金間隔</Label>
                      <Select
                        value={editingProduct.subscription_interval}
                        onValueChange={(value: any) => updateEditingProduct({ subscription_interval: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="month">月額</SelectItem>
                          <SelectItem value="year">年額</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {editingProduct.payment_type === 'subscription_trial' && (
                  <div className="space-y-2">
                    <Label htmlFor="trial_days">トライアル期間（日数）</Label>
                    <Input
                      id="trial_days"
                      type="number"
                      value={editingProduct.trial_days || 0}
                      onChange={(e) => updateEditingProduct({ trial_days: Number(e.target.value) })}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="button_text">ボタンテキスト</Label>
                    <Input
                      id="button_text"
                      value={editingProduct.button_text}
                      onChange={(e) => updateEditingProduct({ button_text: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="button_color">ボタンカラー</Label>
                    <Input
                      id="button_color"
                      type="color"
                      value={editingProduct.button_color}
                      onChange={(e) => updateEditingProduct({ button_color: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_page_url">決済ページURL（オプション）</Label>
                  <Input
                    id="payment_page_url"
                    type="url"
                    value={editingProduct.payment_page_url || ''}
                    onChange={(e) => updateEditingProduct({ payment_page_url: e.target.value })}
                    placeholder="https://example.com/product/123"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={editingProduct.is_active}
                    onChange={(e) => updateEditingProduct({ is_active: e.target.checked })}
                  />
                  <Label htmlFor="is_active">アクティブ</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={handleSaveProduct}>
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