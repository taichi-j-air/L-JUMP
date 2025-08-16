import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"

interface FieldInsertionDialogProps {
  trigger: React.ReactNode
  productName?: string
  productPrice?: number
  currency?: string
  productUrl?: string
}

const fieldOptions = [
  { label: "商品名", value: "{product_name}", description: "商品の名前が挿入されます" },
  { label: "価格", value: "{product_price}", description: "商品の価格が挿入されます" },
  { label: "商品名＋価格", value: "{product_name_price}", description: "商品名と価格が組み合わせて挿入されます" },
  { label: "URL", value: "{product_url}", description: "商品の購入URLが挿入されます" },
  { label: "税込み価格", value: "{product_price_tax}", description: "税込み価格が挿入されます" },
  { label: "通貨", value: "{product_currency}", description: "通貨記号が挿入されます" }
]

export function FieldInsertionDialog({ trigger, productName, productPrice, currency = 'JPY', productUrl }: FieldInsertionDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(value)
      toast.success('フィールドをコピーしました')
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast.error('コピーに失敗しました')
    }
  }

  const getPreviewValue = (field: string) => {
    switch (field) {
      case "{product_name}":
        return productName || "サンプル商品"
      case "{product_price}":
        return productPrice ? `${productPrice}` : "1000"
      case "{product_name_price}":
        return `${productName || "サンプル商品"} - ${productPrice || 1000}円`
      case "{product_url}":
        return productUrl || "https://example.com/product/123"
      case "{product_price_tax}":
        return productPrice ? `${Math.floor(productPrice * 1.1)}円（税込）` : "1100円（税込）"
      case "{product_currency}":
        return currency === 'JPY' ? '円' : currency
      default:
        return "プレビュー"
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>フィールド挿入</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            以下のフィールドをコピーして、テキスト内に貼り付けてください。実際の商品情報に自動で置き換わります。
          </p>

          <div className="grid gap-3">
            {fieldOptions.map((field) => (
              <Card key={field.value} className="transition-colors hover:bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <h4 className="font-medium">{field.label}</h4>
                          <p className="text-sm text-muted-foreground">{field.description}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          value={field.value}
                          readOnly
                          className="font-mono text-xs h-8"
                        />
                        <div className="text-xs text-muted-foreground border-l pl-2">
                          プレビュー: {getPreviewValue(field.value)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(field.value)}
                      className="ml-4"
                    >
                      {copiedField === field.value ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
            <p className="font-medium mb-1">使用例:</p>
            <p>「{getPreviewValue("{product_name}")}をご購入いただき、ありがとうございます。価格は{getPreviewValue("{product_price_tax}")}です。」</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}