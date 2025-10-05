export type FieldToken = `{${string}}`

export interface FieldPreviewContext {
  productName?: string
  productPrice?: number
  productUrl?: string
  currency?: string
  taxRate?: number
  [key: string]: unknown
}

export interface FieldDefinition {
  id: string
  token: FieldToken
  label: string
  description: string
  sample: string
  tags?: string[]
  resolvePreview?: (context: FieldPreviewContext) => string
}

export interface FieldCategory {
  id: string
  label: string
  description?: string
  fields: FieldDefinition[]
}

const DEFAULT_PREVIEW_CONTEXT: Required<Pick<FieldPreviewContext, "productName" | "productPrice" | "productUrl" | "currency" | "taxRate">> = {
  productName: "サンプル商品",
  productPrice: 1000,
  productUrl: "https://example.com/product/123",
  currency: "JPY",
  taxRate: 0.1
}

const formatCurrency = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency
    }).format(value)
  } catch (error) {
    return `${value.toLocaleString("ja-JP")} ${currency}`.trim()
  }
}

const getContext = (context: FieldPreviewContext) => ({
  ...DEFAULT_PREVIEW_CONTEXT,
  ...context
})

const productFields: FieldDefinition[] = [
  {
    id: "product_name",
    token: "{product_name}",
    label: "商品名",
    description: "商品詳細ページに登録されている名称を挿入します。",
    sample: DEFAULT_PREVIEW_CONTEXT.productName,
    resolvePreview: (context) => getContext(context).productName
  },
  {
    id: "product_price",
    token: "{product_price}",
    label: "価格 (税抜)",
    description: "商品に設定された税抜価格を挿入します。",
    sample: DEFAULT_PREVIEW_CONTEXT.productPrice.toLocaleString("ja-JP"),
    resolvePreview: (context) => getContext(context).productPrice.toLocaleString("ja-JP")
  },
  {
    id: "product_name_price",
    token: "{product_name_price}",
    label: "商品名＋価格",
    description: "商品名と税抜価格を組み合わせて挿入します。(例: サンプル商品 - 1,000円)",
    sample: `${DEFAULT_PREVIEW_CONTEXT.productName} - ${DEFAULT_PREVIEW_CONTEXT.productPrice.toLocaleString("ja-JP")}円`,
    resolvePreview: (context) => {
      const ctx = getContext(context)
      return `${ctx.productName} - ${ctx.productPrice.toLocaleString("ja-JP")}円`
    }
  },
  {
    id: "product_url",
    token: "{product_url}",
    label: "商品URL",
    description: "購入ページのURLを挿入します。",
    sample: DEFAULT_PREVIEW_CONTEXT.productUrl,
    resolvePreview: (context) => getContext(context).productUrl
  },
  {
    id: "product_price_tax",
    token: "{product_price_tax}",
    label: "価格 (税込)",
    description: "税率を考慮した税込価格を挿入します。",
    sample: formatCurrency(DEFAULT_PREVIEW_CONTEXT.productPrice * (1 + DEFAULT_PREVIEW_CONTEXT.taxRate), DEFAULT_PREVIEW_CONTEXT.currency),
    resolvePreview: (context) => {
      const ctx = getContext(context)
      const taxIncluded = Math.floor(ctx.productPrice * (1 + ctx.taxRate))
      return formatCurrency(taxIncluded, ctx.currency)
    }
  },
  {
    id: "product_currency",
    token: "{product_currency}",
    label: "通貨",
    description: "表示に使用される通貨記号を挿入します。",
    sample: DEFAULT_PREVIEW_CONTEXT.currency === "JPY" ? "円" : DEFAULT_PREVIEW_CONTEXT.currency,
    resolvePreview: (context) => {
      const { currency } = getContext(context)
      return currency === "JPY" ? "円" : currency
    }
  }
]

export const FIELD_CATEGORIES: FieldCategory[] = [
  {
    id: "product",
    label: "商品情報",
    description: "決済商品に紐づくフィールドです。",
    fields: productFields
  }
]

export const FIELD_DEFINITION_BY_TOKEN: Record<FieldToken, FieldDefinition> = FIELD_CATEGORIES.flatMap((category) => category.fields)
  .reduce((acc, field) => {
    acc[field.token] = field
    return acc
  }, {} as Record<FieldToken, FieldDefinition>)

export const getFieldDefinition = (token: FieldToken) => FIELD_DEFINITION_BY_TOKEN[token]

export const getFieldPreview = (token: FieldToken, context: FieldPreviewContext = {}) => {
  const definition = getFieldDefinition(token)

  if (!definition) {
    return ""
  }

  if (definition.resolvePreview) {
    return definition.resolvePreview(context)
  }

  return definition.sample
}

export const listAllFieldTokens = () => FIELD_CATEGORIES.flatMap((category) => category.fields.map((field) => field.token))

