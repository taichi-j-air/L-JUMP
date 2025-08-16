import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Smartphone } from "lucide-react"

interface ProductPreviewProps {
  productName: string
  price: number
  currency: string
  imageUrl?: string
  buttonText: string
  buttonColor: string
  title?: string
  content?: string
}

export function ProductPreview({
  productName,
  price,
  currency,
  imageUrl,
  buttonText,
  buttonColor,
  title,
  content
}: ProductPreviewProps) {
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(price) + '（税込）'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Smartphone className="h-4 w-4" />
        <span>モバイルプレビュー</span>
      </div>
      
      <div className="mx-auto max-w-sm">
        <Card className="border-2 border-muted">
          <CardContent className="p-0">
            <div className="aspect-[9/16] bg-gradient-to-b from-background to-muted/20 p-6 flex flex-col">
              {/* Header */}
              <div className="text-center mb-6">
                {title && (
                  <h1 className="text-lg font-bold mb-2">{title}</h1>
                )}
                <div className="w-8 h-1 bg-primary mx-auto rounded-full" />
              </div>

              {/* Product Image */}
              <div className="flex-1 flex items-center justify-center mb-6">
                {imageUrl ? (
                  <img 
                    src={imageUrl} 
                    alt={productName}
                    className="max-w-full max-h-32 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">画像なし</span>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="text-center mb-6">
                <h2 className="text-base font-semibold mb-2">{productName}</h2>
                <div className="text-lg font-bold text-primary mb-2">
                  {formatPrice(price, currency)}
                </div>
                {content && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {content}
                  </p>
                )}
              </div>

              {/* Purchase Button */}
              <div className="mt-auto">
                <Button 
                  className="w-full"
                  style={{ 
                    backgroundColor: buttonColor,
                    borderColor: buttonColor
                  }}
                >
                  {buttonText}
                </Button>
              </div>

              {/* Footer */}
              <div className="text-center mt-4">
                <Badge variant="outline" className="text-xs">
                  安全な決済
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}