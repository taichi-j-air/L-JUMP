import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, CreditCard, Calendar, Clock, AlertTriangle } from "lucide-react"
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
  landing_page_title?: string
  landing_page_content?: string
  landing_page_image_url?: string
  button_text: string
  button_color: string
  success_redirect_url?: string
  cancel_redirect_url?: string
}

export default function ProductLandingPage() {
  const { productId } = useParams<{ productId: string }>()
  const [searchParams] = useSearchParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [settings, setSettings] = useState<ProductSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)

  const uid = searchParams.get('uid')

  useEffect(() => {
    if (productId) {
      loadProduct()
    }
  }, [productId])

  const loadProduct = async () => {
    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('is_active', true)
        .single()

      if (productError) throw productError

      const { data: settingsData } = await supabase
        .from('product_settings')
        .select('*')
        .eq('product_id', productId)
        .single()

      setProduct(productData as Product)
      setSettings(settingsData as ProductSettings)
    } catch (error: any) {
      console.error('商品の読み込みに失敗:', error)
      toast.error('商品が見つかりません')
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async () => {
    if (!product || !product.stripe_price_id) {
      toast.error('商品の設定が完了していません')
      return
    }

    setPurchasing(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: product.stripe_price_id,
          successUrl: settings?.success_redirect_url || `${window.location.origin}/purchase-success`,
          cancelUrl: settings?.cancel_redirect_url || window.location.href,
          metadata: {
            product_id: product.id,
            user_uid: uid || 'guest'
          }
        }
      })

      if (error) throw error

      if (data?.url) {
        window.open(data.url, '_blank')
      } else {
        throw new Error('決済URLの取得に失敗しました')
      }
    } catch (error: any) {
      console.error('決済の開始に失敗:', error)
      toast.error('決済の開始に失敗しました')
    } finally {
      setPurchasing(false)
    }
  }

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(price)
  }

  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case 'one_time': return '単発決済'
      case 'subscription': return '継続課金'
      case 'subscription_with_trial': return 'トライアル付き継続課金'
      default: return type
    }
  }

  const getIntervalLabel = (interval?: string) => {
    switch (interval) {
      case 'month': return '月額'
      case 'year': return '年額'
      default: return ''
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
          <p>商品を読み込んでいます...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">商品が見つかりません</h1>
          <p className="text-muted-foreground">指定された商品は存在しないか、非公開に設定されています。</p>
        </div>
      </div>
    )
  }

  const isTestProduct = product.name.includes('テスト') || product.name.includes('test')

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Product Image */}
          {settings?.landing_page_image_url && (
            <div className="mb-8">
              <img
                src={settings.landing_page_image_url}
                alt={product.name}
                className="w-full h-64 object-cover rounded-lg shadow-lg"
              />
            </div>
          )}

          {/* Product Card */}
          <Card className={`shadow-lg ${isTestProduct ? 'border-orange-300 bg-orange-50/50' : ''}`}>
            <CardHeader className="text-center">
              {isTestProduct && (
                <Badge variant="secondary" className="w-fit mx-auto mb-4 bg-orange-100 text-orange-700">
                  テスト商品
                </Badge>
              )}
              
              <CardTitle className="text-3xl font-bold">
                {settings?.landing_page_title || product.name}
              </CardTitle>
              
              <div className="flex items-center justify-center gap-2 text-4xl font-bold text-primary mt-4">
                {formatPrice(product.price, product.currency)}
                <span className="text-sm text-muted-foreground">(税込)</span>
              </div>

              {product.product_type !== 'one_time' && (
                <div className="flex items-center justify-center gap-2 text-lg text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {getIntervalLabel(product.interval)}
                  {product.trial_period_days && (
                    <Badge variant="outline" className="ml-2">
                      {product.trial_period_days}日間無料トライアル
                    </Badge>
                  )}
                </div>
              )}

              <Badge variant="outline" className="w-fit mx-auto mt-2">
                <Package className="h-3 w-3 mr-1" />
                {getProductTypeLabel(product.product_type)}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Product Description */}
              {(settings?.landing_page_content || product.description) && (
                <div className="text-center">
                  <div 
                    className="prose prose-sm max-w-none text-muted-foreground"
                    dangerouslySetInnerHTML={{ 
                      __html: settings?.landing_page_content || product.description || '' 
                    }}
                  />
                </div>
              )}

              {/* Trial Information */}
              {product.trial_period_days && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-blue-900">無料トライアル</h3>
                      <p className="text-sm text-blue-700">
                        最初の{product.trial_period_days}日間は無料でお試しいただけます。
                        トライアル期間終了後、自動的に{getIntervalLabel(product.interval)}課金が開始されます。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Billing Information */}
              {product.product_type !== 'one_time' && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h3 className="font-semibold">課金について</h3>
                      <p className="text-sm text-muted-foreground">
                        {product.trial_period_days 
                          ? `${product.trial_period_days}日間の無料トライアル終了後から` 
                          : '今すぐ'}
                        {getIntervalLabel(product.interval)}で{formatPrice(product.price, product.currency)}(税込)が課金されます。
                        {product.interval === 'month' 
                          ? '毎月同じ日に自動更新されます。' 
                          : '毎年同じ日に自動更新されます。'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Purchase Button */}
              <Button
                onClick={handlePurchase}
                disabled={purchasing || !product.stripe_price_id}
                className="w-full text-lg py-6"
                style={{ 
                  backgroundColor: settings?.button_color || '#0cb386',
                  borderColor: settings?.button_color || '#0cb386'
                }}
              >
                {purchasing ? (
                  <>
                    <Package className="h-5 w-5 mr-2 animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    {settings?.button_text || '購入する'}
                  </>
                )}
              </Button>

              {!product.stripe_price_id && (
                <p className="text-sm text-muted-foreground text-center">
                  ※ この商品はまだ決済設定が完了していません
                </p>
              )}
            </CardContent>
          </Card>

          {/* User ID Info */}
          {uid && (
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                購入者ID: {uid}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}