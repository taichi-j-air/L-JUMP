import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Package, Plus, Edit, Trash2, Eye } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/integrations/supabase/client"
import { AppHeader } from "@/components/AppHeader"
import { User } from "@supabase/supabase-js"

interface Product {
  id: string
  name: string
  description: string
  price: number
  currency: string
  type: 'one_time' | 'subscription'
  interval?: 'month' | 'year'
  active: boolean
  created_at: string
  stripe_price_id?: string
  stripe_product_id?: string
}

export default function ProductManagement() {
  const [user, setUser] = useState<User | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    currency: 'JPY',
    type: 'one_time' as 'one_time' | 'subscription',
    interval: 'month' as 'month' | 'year'
  })

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUser(user)
      loadProducts()
    }
    checkUser()
  }, [])

  const loadProducts = async () => {
    try {
      // In a real implementation, you would load products from your database
      // For now, we'll use mock data
      const mockProducts: Product[] = [
        {
          id: '1',
          name: 'プレミアムプラン',
          description: 'すべての機能を含むプレミアムプラン',
          price: 2980,
          currency: 'JPY',
          type: 'subscription',
          interval: 'month',
          active: true,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          name: '追加シナリオパック',
          description: 'シナリオ数を増やすための単発購入',
          price: 5000,
          currency: 'JPY',
          type: 'one_time',
          active: true,
          created_at: '2024-01-01T00:00:00Z'
        }
      ]
      setProducts(mockProducts)
    } catch (error) {
      console.error('Failed to load products:', error)
      toast.error('商品の読み込みに失敗しました')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || formData.price <= 0) {
      toast.error('商品名と価格は必須です')
      return
    }

    setLoading(true)
    try {
      // Here you would create/update the product in Stripe and your database
      if (editingProduct) {
        // Update existing product
        toast.success('商品を更新しました')
      } else {
        // Create new product
        toast.success('商品を作成しました')
      }
      
      setIsDialogOpen(false)
      resetForm()
      loadProducts()
    } catch (error) {
      console.error('Failed to save product:', error)
      toast.error('商品の保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      currency: 'JPY',
      type: 'one_time',
      interval: 'month'
    })
    setEditingProduct(null)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      type: product.type,
      interval: product.interval || 'month'
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('この商品を削除してもよろしいですか？')) return

    try {
      // Delete product from Stripe and database
      toast.success('商品を削除しました')
      loadProducts()
    } catch (error) {
      console.error('Failed to delete product:', error)
      toast.error('商品の削除に失敗しました')
    }
  }

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency
    }).format(price)
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6" />
            <h1 className="text-2xl font-bold">商品管理</h1>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                新規商品作成
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? '商品編集' : '新規商品作成'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">商品名</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="商品名を入力"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="type">商品タイプ</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        type: value as 'one_time' | 'subscription' 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">単発購入</SelectItem>
                        <SelectItem value="subscription">サブスクリプション</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">商品説明</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="商品の説明を入力"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">価格</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                      placeholder="0"
                      min="1"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="currency">通貨</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.type === 'subscription' && (
                    <div className="space-y-2">
                      <Label htmlFor="interval">請求間隔</Label>
                      <Select
                        value={formData.interval}
                        onValueChange={(value) => setFormData(prev => ({ 
                          ...prev, 
                          interval: value as 'month' | 'year' 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="month">月次</SelectItem>
                          <SelectItem value="year">年次</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    キャンセル
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? '保存中...' : editingProduct ? '更新' : '作成'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>商品一覧</CardTitle>
            <CardDescription>
              Stripeで管理されている商品の一覧です
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品名</TableHead>
                  <TableHead>タイプ</TableHead>
                  <TableHead>価格</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>作成日</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.type === 'subscription' ? 'default' : 'secondary'}>
                        {product.type === 'subscription' ? 'サブスク' : '単発'}
                        {product.type === 'subscription' && product.interval && (
                          <span className="ml-1">
                            ({product.interval === 'month' ? '月次' : '年次'})
                          </span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatPrice(product.price, product.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.active ? 'default' : 'secondary'}>
                        {product.active ? '有効' : '無効'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(product.created_at).toLocaleDateString('ja-JP')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}