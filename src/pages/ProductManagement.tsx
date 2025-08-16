import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Plus, Package, Settings, Target, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface Product {
  id: string
  name: string
  description?: string
  price: number
  currency: string
  product_type: 'one_time' | 'subscription' | 'subscription_with_trial'
  trial_period_days?: number
  interval?: 'month' | 'year'
  is_active: boolean
  stripe_product_id?: string
  stripe_price_id?: string
}

interface ProductSettings {
  id?: string
  product_id: string
  landing_page_title?: string
  landing_page_content?: string
  landing_page_image_url?: string
  button_text: string
  button_color: string
  success_redirect_url?: string
  cancel_redirect_url?: string
  custom_parameters: Record<string, any>
}

interface ProductAction {
  id?: string
  product_id: string
  action_type: 'success' | 'failure'
  add_tag_ids?: string[]
  remove_tag_ids?: string[]
  scenario_action?: 'add_to_existing' | 'replace_all'
  target_scenario_id?: string
  failure_message?: string
  notify_user: boolean
  notification_method?: 'line' | 'system'
}

export default function ProductManagement() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  // Product form state
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    currency: 'jpy',
    product_type: 'one_time',
    trial_period_days: undefined,
    interval: 'month',
    is_active: true
  })

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<ProductSettings>({
    product_id: '',
    landing_page_title: '',
    landing_page_content: '',
    landing_page_image_url: '',
    button_text: '購入する',
    button_color: '#0cb386',
    success_redirect_url: '',
    cancel_redirect_url: '',
    custom_parameters: {}
  })

  // Actions form state
  const [successAction, setSuccessAction] = useState<ProductAction>({
    product_id: '',
    action_type: 'success',
    add_tag_ids: [],
    remove_tag_ids: [],
    scenario_action: 'add_to_existing',
    target_scenario_id: '',
    notify_user: false
  })

  const [failureAction, setFailureAction] = useState<ProductAction>({
    product_id: '',
    action_type: 'failure',
    failure_message: '',
    notify_user: true,
    notification_method: 'line'
  })

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
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts((data || []) as Product[])
    } catch (error: any) {
      console.error('商品の読み込みに失敗:', error)
      toast.error('商品の読み込みに失敗しました')
    }
  }

  const handleCreateProduct = () => {
    setIsCreating(true)
    setSelectedProduct(null)
    setProductForm({
      name: '',
      description: '',
      price: 0,
      currency: 'jpy',
      product_type: 'one_time',
      trial_period_days: undefined,
      interval: 'month',
      is_active: true
    })
    setSettingsForm({
      product_id: '',
      landing_page_title: '',
      landing_page_content: '',
      landing_page_image_url: '',
      button_text: '購入する',
      button_color: '#0cb386',
      success_redirect_url: '',
      cancel_redirect_url: '',
      custom_parameters: {}
    })
  }

  const handleSelectProduct = async (product: Product) => {
    setSelectedProduct(product)
    setIsCreating(false)
    setProductForm(product)

    // Load product settings and actions
    try {
      const [settingsRes, actionsRes] = await Promise.all([
        supabase.from('product_settings').select('*').eq('product_id', product.id).single(),
        supabase.from('product_actions').select('*').eq('product_id', product.id)
      ])

      if (settingsRes.data) {
        setSettingsForm({
          ...settingsRes.data,
          custom_parameters: settingsRes.data.custom_parameters as Record<string, any> || {}
        })
      }

      if (actionsRes.data) {
        const success = actionsRes.data.find(a => a.action_type === 'success') as ProductAction
        const failure = actionsRes.data.find(a => a.action_type === 'failure') as ProductAction
        
        if (success) setSuccessAction(success)
        if (failure) setFailureAction(failure)
      }
    } catch (error) {
      console.error('商品詳細の読み込みに失敗:', error)
    }
  }

  const handleSaveProduct = async () => {
    if (!user || !productForm.name) {
      toast.error('商品名は必須です')
      return
    }

    setSaving(true)
    try {
      let productId = selectedProduct?.id

      if (isCreating) {
        // Create new product
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert({
            name: productForm.name!,
            description: productForm.description,
            price: productForm.price || 0,
            currency: productForm.currency || 'jpy',
            product_type: productForm.product_type!,
            trial_period_days: productForm.trial_period_days,
            interval: productForm.interval,
            is_active: productForm.is_active ?? true,
            user_id: user.id
          })
          .select()
          .single()

        if (error) throw error
        productId = newProduct.id
        
        // Update products list
        setProducts(prev => [newProduct as Product, ...prev])
        setSelectedProduct(newProduct as Product)
        setIsCreating(false)
      } else {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productForm)
          .eq('id', productId)

        if (error) throw error
        
        // Update products list
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...productForm } : p))
      }

      // Save settings
      await supabase.from('product_settings').upsert({
        ...settingsForm,
        product_id: productId
      })

      // Save actions
      await Promise.all([
        supabase.from('product_actions').upsert({
          ...successAction,
          product_id: productId
        }),
        supabase.from('product_actions').upsert({
          ...failureAction,
          product_id: productId
        })
      ])

      toast.success('商品を保存しました')
    } catch (error: any) {
      console.error('商品の保存に失敗:', error)
      toast.error('商品の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case 'one_time': return '単発決済'
      case 'subscription': return '継続課金'
      case 'subscription_with_trial': return 'トライアル付き継続課金'
      default: return type
    }
  }

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency.toUpperCase()
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold">商品管理</h1>
          <p className="text-muted-foreground">Stripe決済商品の作成・管理を行います。</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左カラム: 商品リスト */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">商品一覧</h2>
              <Button onClick={handleCreateProduct} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                商品追加
              </Button>
            </div>

            <div className="space-y-2">
              {products.map((product) => (
                <Card 
                  key={product.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedProduct?.id === product.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handleSelectProduct(product)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{product.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {getProductTypeLabel(product.product_type)}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatPrice(product.price, product.currency)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {product.is_active ? (
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                        ) : (
                          <div className="w-2 h-2 bg-gray-400 rounded-full" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {products.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">商品がありません</p>
                    <p className="text-sm text-muted-foreground mt-1">右上の「商品追加」から作成してください</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* 右カラム: 商品設定 */}
          <div className="lg:col-span-2">
            {(selectedProduct || isCreating) ? (
              <div className="space-y-6">
                {/* 商品基本情報 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      商品基本設定
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="product-name">商品名 *</Label>
                        <Input
                          id="product-name"
                          value={productForm.name || ''}
                          onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="商品名を入力"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="product-type">決済タイプ</Label>
                        <Select
                          value={productForm.product_type}
                          onValueChange={(value) => setProductForm(prev => ({ ...prev, product_type: value as any }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="one_time">単発決済</SelectItem>
                            <SelectItem value="subscription">継続課金</SelectItem>
                            <SelectItem value="subscription_with_trial">トライアル付き継続課金</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="product-price">価格</Label>
                        <Input
                          id="product-price"
                          type="number"
                          value={productForm.price || 0}
                          onChange={(e) => setProductForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                        />
                      </div>

                      {productForm.product_type?.includes('subscription') && (
                        <div>
                          <Label htmlFor="product-interval">課金間隔</Label>
                          <Select
                            value={productForm.interval}
                            onValueChange={(value) => setProductForm(prev => ({ ...prev, interval: value as any }))}
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

                      {productForm.product_type === 'subscription_with_trial' && (
                        <div>
                          <Label htmlFor="trial-days">トライアル期間（日）</Label>
                          <Input
                            id="trial-days"
                            type="number"
                            value={productForm.trial_period_days || ''}
                            onChange={(e) => setProductForm(prev => ({ ...prev, trial_period_days: Number(e.target.value) }))}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="product-description">商品説明</Label>
                      <Textarea
                        id="product-description"
                        value={productForm.description || ''}
                        onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="商品の説明を入力"
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* ランディングページ設定 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      ランディングページ設定
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="landing-title">ページタイトル</Label>
                        <Input
                          id="landing-title"
                          value={settingsForm.landing_page_title || ''}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, landing_page_title: e.target.value }))}
                          placeholder="ランディングページのタイトル"
                        />
                      </div>

                      <div>
                        <Label htmlFor="button-text">ボタンテキスト</Label>
                        <Input
                          id="button-text"
                          value={settingsForm.button_text}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, button_text: e.target.value }))}
                        />
                      </div>

                      <div>
                        <Label htmlFor="button-color">ボタンカラー</Label>
                        <Input
                          id="button-color"
                          type="color"
                          value={settingsForm.button_color}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, button_color: e.target.value }))}
                        />
                      </div>

                      <div>
                        <Label htmlFor="landing-image">画像URL</Label>
                        <Input
                          id="landing-image"
                          value={settingsForm.landing_page_image_url || ''}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, landing_page_image_url: e.target.value }))}
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="landing-content">ページ内容</Label>
                      <Textarea
                        id="landing-content"
                        value={settingsForm.landing_page_content || ''}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, landing_page_content: e.target.value }))}
                        placeholder="ランディングページの内容を入力"
                        rows={4}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* アクション設定 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      決済後アクション設定
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-medium text-green-600 mb-3">決済成功時</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>シナリオアクション</Label>
                          <Select
                            value={successAction.scenario_action}
                            onValueChange={(value) => setSuccessAction(prev => ({ ...prev, scenario_action: value as any }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="add_to_existing">既存シナリオに追加</SelectItem>
                              <SelectItem value="replace_all">全シナリオを置換</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="target-scenario">対象シナリオID</Label>
                          <Input
                            id="target-scenario"
                            value={successAction.target_scenario_id || ''}
                            onChange={(e) => setSuccessAction(prev => ({ ...prev, target_scenario_id: e.target.value }))}
                            placeholder="シナリオIDを入力"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-medium text-red-600 mb-3">決済失敗時</h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="failure-message">失敗メッセージ</Label>
                          <Textarea
                            id="failure-message"
                            value={failureAction.failure_message || ''}
                            onChange={(e) => setFailureAction(prev => ({ ...prev, failure_message: e.target.value }))}
                            placeholder="決済失敗時に送信するメッセージ"
                            rows={2}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>通知方法</Label>
                            <Select
                              value={failureAction.notification_method}
                              onValueChange={(value) => setFailureAction(prev => ({ ...prev, notification_method: value as any }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="line">LINE通知</SelectItem>
                                <SelectItem value="system">システム通知</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 保存ボタン */}
                <div className="flex justify-end">
                  <Button onClick={handleSaveProduct} disabled={saving} size="lg">
                    {saving ? '保存中...' : (isCreating ? '商品を作成' : '変更を保存')}
                  </Button>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">商品を選択してください</h3>
                  <p className="text-muted-foreground">
                    左側の商品リストから編集したい商品を選択するか、<br />
                    「商品追加」ボタンから新しい商品を作成してください。
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}