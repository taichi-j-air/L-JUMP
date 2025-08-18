import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductData {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  stripe_price_id: string;
  product_type: string;
  amount: number;
  currency: string;
  is_active: boolean;
  submit_button_text?: string;
  submit_button_variant?: string;
  submit_button_bg_color?: string;
  submit_button_text_color?: string;
  accent_color?: string;
}

export default function ProductLandingPage() {
  const { productId } = useParams<{ productId: string }>();
  const location = useLocation();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [uid, setUid] = useState<string | undefined>();

  useEffect(() => {
    const rawUid = new URLSearchParams(location.search).get('uid');
    const validUid = rawUid && rawUid !== '[UID]' ? rawUid : undefined;
    setUid(validUid);
    
    console.log('[LP] productId, uid', productId, validUid);
    
    if (productId) {
      fetchProduct(productId);
    }
  }, [productId, location.search]);

  const fetchProduct = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('public-get-product', {
        body: { product_id: id }
      });

      if (error) throw error;
      
      if (data?.product) {
        setProduct(data.product);
      } else {
        toast.error('商品が見つかりません');
      }
    } catch (error) {
      console.error('Product fetch error:', error);
      toast.error('商品情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!product || !productId) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          product_id: productId,
          uid: uid,
          utm_source: new URLSearchParams(location.search).get('utm_source'),
          utm_medium: new URLSearchParams(location.search).get('utm_medium'),
          utm_campaign: new URLSearchParams(location.search).get('utm_campaign'),
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('決済URLの取得に失敗しました');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('決済の開始に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    if (currency.toLowerCase() === 'jpy') {
      return `¥${amount.toLocaleString()}`;
    }
    return `$${(amount / 100).toFixed(2)}`;
  };

  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case 'one_time':
        return '単発商品';
      case 'subscription':
        return 'サブスクリプション';
      case 'subscription_with_trial':
        return 'トライアル付きサブスク';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              商品が見つかりません
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const buttonStyle = product.submit_button_bg_color && product.submit_button_text_color ? {
    backgroundColor: product.submit_button_bg_color,
    color: product.submit_button_text_color,
  } : undefined;

  const accentStyle = product.accent_color ? {
    borderColor: product.accent_color,
  } : undefined;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="w-full" style={accentStyle}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold">{product.name}</CardTitle>
                {product.description && (
                  <p className="text-muted-foreground mt-2">{product.description}</p>
                )}
              </div>
              <Badge variant="secondary" className="ml-4">
                {getProductTypeLabel(product.product_type)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {product.image_url && (
              <div className="w-full h-64 rounded-lg overflow-hidden">
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="text-center py-6">
              <div className="text-4xl font-bold text-primary mb-2">
                {formatPrice(product.amount, product.currency)}
              </div>
              {product.product_type === 'subscription' && (
                <p className="text-sm text-muted-foreground">毎月課金</p>
              )}
              {product.product_type === 'subscription_with_trial' && (
                <p className="text-sm text-muted-foreground">トライアル期間あり</p>
              )}
            </div>

            <Button
              onClick={handlePayment}
              disabled={processing}
              className="w-full h-12 text-lg font-semibold"
              style={buttonStyle}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  処理中...
                </>
              ) : (
                product.submit_button_text || '支払いへ進む'
              )}
            </Button>

            {uid && (
              <p className="text-xs text-muted-foreground text-center">
                UID: {uid}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}