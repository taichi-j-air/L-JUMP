import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProductType = "one_time" | "subscription" | "subscription_with_trial";

interface ProductData {
  id: string;
  name: string;
  description?: string;
  stripe_price_id: string;
  product_type: ProductType;
  price: number;
  currency: string;
  trial_period_days?: number;
  is_active: boolean;
  user_id: string;
  // settings
  landing_page_title?: string;
  landing_page_content?: string;
  landing_page_image_url?: string;
  button_text?: string;
  button_color?: string;
  success_redirect_url?: string;
  cancel_redirect_url?: string;
}

export default function ProductLandingPage() {
  const { productId } = useParams<{ productId: string }>();
  const location = useLocation();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [uid, setUid] = useState<string | undefined>();

  useEffect(() => {
    const rawUid = new URLSearchParams(location.search).get("uid");
    const validUid = rawUid && rawUid !== "[UID]" ? rawUid : undefined;
    setUid(validUid);

    console.log("[LP] productId, uid", productId, validUid);

    if (productId) fetchProduct(productId);
  }, [productId, location.search]);

  const fetchProduct = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("public-get-product", {
        body: { product_id: id },
      });

      if (error) throw error;

      if (data?.product) {
        setProduct(data.product as ProductData);
      } else {
        toast.error("商品が見つかりません");
      }
    } catch (e) {
      console.error("Product fetch error:", e);
      toast.error("商品情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!product || !productId) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          product_id: productId,
          uid: uid,
          utm_source: new URLSearchParams(location.search).get("utm_source"),
          utm_medium: new URLSearchParams(location.search).get("utm_medium"),
          utm_campaign: new URLSearchParams(location.search).get("utm_campaign"),
        },
      });

      if (error) throw error;

      if (data?.url) {
        console.log("[LP] Opening checkout URL:", data.url);
        window.open(data.url, '_blank');
      } else {
        throw new Error("決済URLの取得に失敗しました");
      }
    } catch (e) {
      console.error("Checkout error:", e);
      toast.error("決済の開始に失敗しました");
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    if (currency?.toLowerCase() === "jpy") {
      return `¥${(price ?? 0).toLocaleString()}`;
    }
    // 他通貨はpriceが最小単位の想定なら100で割る
    return `${currency?.toUpperCase() || "USD"} ${(price ?? 0) / 100}`;
  };

  const getProductTypeLabel = (type: ProductType) => {
    switch (type) {
      case "one_time":
        return "単発商品";
      case "subscription":
        return "サブスクリプション";
      case "subscription_with_trial":
        return "トライアル付きサブスク";
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
            <p className="text-center text-muted-foreground">商品が見つかりません</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const buttonStyle = product.button_color
    ? ({ backgroundColor: product.button_color, color: "#fff" } as React.CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        <Card className="border-2 border-muted overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-b from-background to-muted/20 p-6 flex flex-col min-h-[600px]">
              {/* Header */}
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold mb-2">
                  {product.landing_page_title || product.name}
                </h1>
                <div className="w-8 h-1 bg-primary mx-auto rounded-full" />
                <Badge variant="outline" className="mt-3 text-xs">
                  {getProductTypeLabel(product.product_type)}
                </Badge>
              </div>

              {/* Product Image */}
              <div className="flex-1 flex items-center justify-center mb-6">
                {product.landing_page_image_url ? (
                  <img 
                    src={product.landing_page_image_url}
                    alt={product.name}
                    className="max-w-full max-h-40 object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="text-center mb-6">
                <div className="text-2xl font-bold text-primary mb-3">
                  {formatPrice(product.price, product.currency)}
                </div>
                
                {(product.product_type === "subscription" || product.product_type === "subscription_with_trial") && (
                  <p className="text-sm text-muted-foreground mb-2">毎月課金</p>
                )}

                {(product.landing_page_content || product.description) && (
                  <p className="text-sm text-muted-foreground leading-relaxed px-2">
                    {product.landing_page_content || product.description}
                  </p>
                )}
              </div>

              {/* Purchase Button */}
              <div className="mt-auto space-y-3">
                <Button
                  onClick={handlePayment}
                  disabled={processing}
                  className="w-full h-12 text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
                  style={buttonStyle}
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      処理中...
                    </>
                  ) : (
                    product.button_text || "今すぐ始める"
                  )}
                </Button>

                {/* Security Badge */}
                <div className="text-center">
                  <Badge variant="outline" className="text-xs">
                    🔒 安全な決済（Stripe）
                  </Badge>
                </div>

                {uid && (
                  <p className="text-xs text-muted-foreground text-center opacity-50">
                    ID: {uid}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




