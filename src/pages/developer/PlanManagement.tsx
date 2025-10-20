import { useState, useEffect, ChangeEvent } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Edit, Plus, Trash2, Save } from "lucide-react"
import { toast } from "sonner"
import {
  PlanFeatureConfig,
  PlanLimits,
  PlanStripeSettings,
  PlanType,
  PLAN_TYPE_LABELS,
  sanitizeLimitsForPlanType,
  createDefaultPlanFeatures,
  normalizePlanType,
  parsePlanFeatureConfig,
  buildPlanFeaturesPayload,
} from "@/types/plans"

interface PlanConfig {
  id: string
  plan_type: PlanType
  name: string
  monthly_price: number
  yearly_price: number
  message_limit: number
  featureConfig: PlanFeatureConfig
  is_active: boolean
}

interface PlatformStripeCredentialsForm {
  id: string
  test_publishable_key: string
  test_secret_key: string
  live_publishable_key: string
  live_secret_key: string
}

const PLATFORM_CREDENTIAL_ID = "00000000-0000-0000-0000-000000000001"

const PLAN_TYPE_OPTIONS: { value: PlanType; label: string }[] = [
  { value: "free", label: PLAN_TYPE_LABELS.free },
  { value: "basic", label: PLAN_TYPE_LABELS.basic },
  { value: "premium", label: PLAN_TYPE_LABELS.premium },
  { value: "developer", label: PLAN_TYPE_LABELS.developer },
]

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(price || 0)

const formatLimitValue = (value: number | null, suffix?: string) => {
  if (value === null) return "無制限"
  const label = value.toLocaleString()
  return suffix ? `${label}${suffix}` : label
}

export default function PlanManagement() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<PlanConfig[]>([])
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [platformCredentials, setPlatformCredentials] = useState<PlatformStripeCredentialsForm>({
    id: PLATFORM_CREDENTIAL_ID,
    test_publishable_key: "",
    test_secret_key: "",
    live_publishable_key: "",
    live_secret_key: "",
  })
  const [credentialsLoading, setCredentialsLoading] = useState(true)
  const [savingCredentials, setSavingCredentials] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (user) {
      loadPlans()
      loadPlatformCredentials()
    }
  }, [user])

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plan_configs")
        .select("*")
        .order("monthly_price", { ascending: true })

      if (error) throw error

      const formattedPlans: PlanConfig[] =
        data?.map((plan: any) => {
          const planType = normalizePlanType(plan.plan_type)
          const featureConfig = parsePlanFeatureConfig(plan.features, planType)

          return {
            id: plan.id,
            plan_type: planType,
            name: plan.name ?? "",
            monthly_price: Number(plan.monthly_price ?? 0),
            yearly_price: Number(plan.yearly_price ?? 0),
            message_limit: Number(plan.message_limit ?? 0),
            featureConfig,
            is_active: Boolean(plan.is_active),
          }
        }) || []

      setPlans(formattedPlans)
    } catch (error) {
      console.error("Error loading plans:", error)
      toast.error("プラン情報の取得に失敗しました")
    }
  }

  const loadPlatformCredentials = async () => {
    setCredentialsLoading(true)
    try {
      const { data, error } = await supabase
        .from("platform_stripe_credentials")
        .select("*")
        .maybeSingle()

      if (error && error.code !== "PGRST116") {
        throw error
      }

      setPlatformCredentials({
        id: data?.id ?? PLATFORM_CREDENTIAL_ID,
        test_publishable_key: data?.test_publishable_key ?? "",
        test_secret_key: data?.test_secret_key ?? "",
        live_publishable_key: data?.live_publishable_key ?? "",
        live_secret_key: data?.live_secret_key ?? "",
      })
    } catch (error) {
      console.error("Error loading Stripe credentials:", error)
      toast.error("Stripeキーの取得に失敗しました")
    } finally {
      setCredentialsLoading(false)
    }
  }

  const handleSavePlan = async () => {
    if (!editingPlan) return

    const payloadFeatures = buildPlanFeaturesPayload(editingPlan.plan_type, editingPlan.featureConfig)

    try {
      const planData = {
        plan_type: editingPlan.plan_type,
        name: editingPlan.name,
        monthly_price: editingPlan.monthly_price,
        yearly_price: editingPlan.yearly_price,
        message_limit: editingPlan.message_limit,
        features: payloadFeatures,
        is_active: editingPlan.is_active,
      }

      if (editingPlan.id === "new") {
        const { error } = await supabase.from("plan_configs").insert(planData)

        if (error) throw error
        toast.success("プランを作成しました")
      } else {
        const { error } = await supabase
          .from("plan_configs")
          .update(planData)
          .eq("id", editingPlan.id)

        if (error) throw error
        toast.success("プランを更新しました")
      }

      setIsDialogOpen(false)
      setEditingPlan(null)
      loadPlans()
    } catch (error) {
      console.error("Error saving plan:", error)
      toast.error("プランの保存に失敗しました")
    }
  }

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("このプランを削除しますか？")) return

    try {
      const { error } = await supabase.from("plan_configs").delete().eq("id", planId)

      if (error) throw error
      toast.success("プランを削除しました")
      loadPlans()
    } catch (error) {
      console.error("Error deleting plan:", error)
      toast.error("プランの削除に失敗しました")
    }
  }

  const openEditDialog = (plan?: PlanConfig) => {
    if (plan) {
      setEditingPlan({
        ...plan,
        featureConfig: {
          marketingHighlights: plan.featureConfig.marketingHighlights?.slice() ?? [],
          limits: { ...plan.featureConfig.limits },
          stripe: { ...(plan.featureConfig.stripe ?? {}) },
        },
      })
    } else {
      setEditingPlan({
        id: "new",
        plan_type: "basic",
        name: "",
        monthly_price: 0,
        yearly_price: 0,
        message_limit: 0,
        featureConfig: createDefaultPlanFeatures("basic"),
        is_active: true,
      })
    }
    setIsDialogOpen(true)
  }

  const updateEditingPlan = (updates: Partial<PlanConfig>) => {
    setEditingPlan((prev) => (prev ? { ...prev, ...updates } : prev))
  }

  const updateFeatureConfig = (updates: Partial<PlanFeatureConfig>) => {
    setEditingPlan((prev) =>
      prev
        ? {
            ...prev,
            featureConfig: {
              ...prev.featureConfig,
              ...updates,
            },
          }
        : prev
    )
  }

  const updatePlanLimits = (updates: Partial<PlanLimits>) => {
    setEditingPlan((prev) =>
      prev
        ? {
            ...prev,
            featureConfig: {
              ...prev.featureConfig,
              limits: {
                ...prev.featureConfig.limits,
                ...updates,
              },
            },
          }
        : prev
    )
  }

  const updateStripeSettings = (updates: Partial<PlanStripeSettings>) => {
    setEditingPlan((prev) =>
      prev
        ? {
            ...prev,
            featureConfig: {
              ...prev.featureConfig,
              stripe: {
                ...prev.featureConfig.stripe,
                ...updates,
              },
            },
          }
        : prev
    )
  }

  const updatePlatformCredentialField = (field: keyof PlatformStripeCredentialsForm, value: string) => {
    setPlatformCredentials((prev) => ({ ...prev, [field]: value }))
  }

  const handleSavePlatformCredentials = async () => {
    setSavingCredentials(true)
    try {
      const payload = {
        id: PLATFORM_CREDENTIAL_ID,
        test_publishable_key: platformCredentials.test_publishable_key || null,
        test_secret_key: platformCredentials.test_secret_key || null,
        live_publishable_key: platformCredentials.live_publishable_key || null,
        live_secret_key: platformCredentials.live_secret_key || null,
      }

      const { error } = await supabase
        .from("platform_stripe_credentials")
        .upsert(payload, { onConflict: "id" })

      if (error) throw error

      toast.success("Stripeキーを保存しました")
      loadPlatformCredentials()
    } catch (error) {
      console.error("Error saving Stripe credentials:", error)
      toast.error("Stripeキーの保存に失敗しました")
    } finally {
      setSavingCredentials(false)
    }
  }

  const handlePlanTypeChange = (value: PlanType) => {
    setEditingPlan((prev) =>
      prev
        ? {
            ...prev,
            plan_type: value,
            featureConfig: {
              ...prev.featureConfig,
              limits: sanitizeLimitsForPlanType(value, prev.featureConfig.limits),
            },
          }
        : prev
    )
  }

  const handleLimitInputChange =
    (field: keyof PlanLimits) => (event: ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value
      if (rawValue.trim() === "") {
        updatePlanLimits({ [field]: null })
        return
      }

      const parsed = Number(rawValue)
      if (Number.isNaN(parsed) || parsed < 0) {
        return
      }

      updatePlanLimits({ [field]: parsed })
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
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">プラン管理</h1>
            <p className="text-muted-foreground">
              L-JUMP 全体の料金プラン・利用制限・Stripe連携情報を管理します。
            </p>
          </div>
          <Button onClick={() => openEditDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            新規プラン作成
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Stripeキー設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              プラン決済で共通利用する Stripe の API キーを登録します。テスト・本番両方のキーを入力し、保存してください。
            </p>
            {credentialsLoading ? (
              <div className="text-sm text-muted-foreground">読み込み中...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test_publishable_key">テスト公開鍵 (pk_test_...)</Label>
                  <Input
                    id="test_publishable_key"
                    value={platformCredentials.test_publishable_key}
                    onChange={(e) => updatePlatformCredentialField("test_publishable_key", e.target.value)}
                    placeholder="pk_test_..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test_secret_key">テストシークレットキー (sk_test_...)</Label>
                  <Input
                    id="test_secret_key"
                    type="password"
                    value={platformCredentials.test_secret_key}
                    onChange={(e) => updatePlatformCredentialField("test_secret_key", e.target.value)}
                    placeholder="sk_test_..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="live_publishable_key">本番公開鍵 (pk_live_...)</Label>
                  <Input
                    id="live_publishable_key"
                    value={platformCredentials.live_publishable_key}
                    onChange={(e) => updatePlatformCredentialField("live_publishable_key", e.target.value)}
                    placeholder="pk_live_..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="live_secret_key">本番シークレットキー (sk_live_...)</Label>
                  <Input
                    id="live_secret_key"
                    type="password"
                    value={platformCredentials.live_secret_key}
                    onChange={(e) => updatePlatformCredentialField("live_secret_key", e.target.value)}
                    placeholder="sk_live_..."
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={handleSavePlatformCredentials} disabled={savingCredentials}>
                {savingCredentials ? "保存中..." : "Stripeキーを保存"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>プラン一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-2 text-lg font-semibold text-blue-800">Stripe設定の流れ</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-blue-700">
                <li>管理者アカウントでStripeダッシュボードに価格（Price）を作成します。</li>
                <li>各価格ID（月額 / 年額）と商品IDを取得し、以下のフォームに保存します。</li>
                <li>Supabase Functions の `create-checkout` 等で価格IDを参照し、決済フローを開始します。</li>
                <li>Webhook (`stripe-webhook`) 側でサブスクリプションイベントを受け取り、プランを更新します。</li>
              </ol>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>プラン名</TableHead>
                    <TableHead>タイプ</TableHead>
                    <TableHead>料金</TableHead>
                    <TableHead>利用制限</TableHead>
                    <TableHead>Stripe連携</TableHead>
                    <TableHead>特徴</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => {
                    const { limits, stripe, marketingHighlights } = plan.featureConfig
                    return (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{PLAN_TYPE_LABELS[plan.plan_type]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>月額: {formatPrice(plan.monthly_price)}</div>
                          <div>年額: {formatPrice(plan.yearly_price)}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>シナリオ: {formatLimitValue(limits.scenarioStepLimit, "ステップ")}</div>
                          <div>Flex保存: {formatLimitValue(limits.flexMessageTemplateLimit, "通")}</div>
                          <div>会員サイト: {formatLimitValue(limits.memberSiteLimit, "件")}</div>
                          <div>
                            コンテンツブロック合計:{" "}
                            {formatLimitValue(limits.totalContentBlockLimit, "個")}
                          </div>
                          <div>
                            サイト毎ブロック:{" "}
                            {formatLimitValue(limits.contentBlockPerSiteLimit, "個")}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>Product: {stripe?.productId || "未設定"}</div>
                          <div>月額Price: {stripe?.monthlyPriceId || "未設定"}</div>
                          <div>年額Price: {stripe?.yearlyPriceId || "未設定"}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {marketingHighlights?.length ? (
                            <ul className="space-y-1">
                              {marketingHighlights.slice(0, 3).map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                              {marketingHighlights.length > 3 && <li>…</li>}
                            </ul>
                          ) : (
                            <span>未設定</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={plan.is_active ? "default" : "secondary"}>
                            {plan.is_active ? "アクティブ" : "無効"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(plan)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeletePlan(plan.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan?.id === "new" ? "プラン作成" : "プラン編集"}</DialogTitle>
            </DialogHeader>
            {editingPlan && (
              <div className="space-y-4 pb-2">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">プラン名</Label>
                    <Input
                      id="name"
                      value={editingPlan.name}
                      onChange={(e) => updateEditingPlan({ name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan_type">プランタイプ</Label>
                    <select
                      id="plan_type"
                      className="w-full rounded-md border px-3 py-2"
                      value={editingPlan.plan_type}
                      onChange={(e) => handlePlanTypeChange(e.target.value as PlanType)}
                    >
                      {PLAN_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="monthly_price">月額料金 (円)</Label>
                    <Input
                      id="monthly_price"
                      type="number"
                      value={editingPlan.monthly_price}
                      onChange={(e) =>
                        updateEditingPlan({ monthly_price: Number(e.target.value || 0) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearly_price">年額料金 (円)</Label>
                    <Input
                      id="yearly_price"
                      type="number"
                      value={editingPlan.yearly_price}
                      onChange={(e) =>
                        updateEditingPlan({ yearly_price: Number(e.target.value || 0) })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="message_limit">月間メッセージ制限</Label>
                    <Input
                      id="message_limit"
                      type="number"
                      value={editingPlan.message_limit}
                      onChange={(e) =>
                        updateEditingPlan({ message_limit: Number(e.target.value || 0) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ステータス</Label>
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <input
                        id="is_active"
                        type="checkbox"
                        checked={editingPlan.is_active}
                        onChange={(e) => updateEditingPlan({ is_active: e.target.checked })}
                      />
                      <Label htmlFor="is_active" className="cursor-pointer">
                        アクティブ
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="marketing">マーケティング向け特徴（1行につき1項目）</Label>
                    <Textarea
                      id="marketing"
                      className="min-h-[120px]"
                      value={editingPlan.featureConfig.marketingHighlights.join("\n")}
                      onChange={(e) =>
                        updateFeatureConfig({
                          marketingHighlights: e.target.value
                            .split("\n")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="例）Flexメッセージテンプレート2件まで保存&#10;例）シナリオ配信20ステップまで"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="stripe_product">Stripe Product ID</Label>
                      <Input
                        id="stripe_product"
                        value={editingPlan.featureConfig.stripe?.productId || ""}
                        onChange={(e) =>
                          updateStripeSettings({ productId: e.target.value.trim() || undefined })
                        }
                        placeholder="prod_xxxxx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stripe_price_monthly">Stripe Price ID（毎月）</Label>
                      <Input
                        id="stripe_price_monthly"
                        value={editingPlan.featureConfig.stripe?.monthlyPriceId || ""}
                        onChange={(e) =>
                          updateStripeSettings({
                            monthlyPriceId: e.target.value.trim() || undefined,
                          })
                        }
                        placeholder="price_xxxxx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stripe_price_yearly">Stripe Price ID（毎年）</Label>
                      <Input
                        id="stripe_price_yearly"
                        value={editingPlan.featureConfig.stripe?.yearlyPriceId || ""}
                        onChange={(e) =>
                          updateStripeSettings({
                            yearlyPriceId: e.target.value.trim() || undefined,
                          })
                        }
                        placeholder="price_xxxxx"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>利用制限（空欄は無制限）</Label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="limit_scenario">シナリオ総ステップ数</Label>
                      <Input
                        id="limit_scenario"
                        type="number"
                        value={editingPlan.featureConfig.limits.scenarioStepLimit ?? ""}
                        onChange={handleLimitInputChange("scenarioStepLimit")}
                        placeholder="例）20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="limit_flex">Flexメッセージ保存数</Label>
                      <Input
                        id="limit_flex"
                        type="number"
                        value={editingPlan.featureConfig.limits.flexMessageTemplateLimit ?? ""}
                        onChange={handleLimitInputChange("flexMessageTemplateLimit")}
                        placeholder="例）2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="limit_site">会員サイト作成数</Label>
                      <Input
                        id="limit_site"
                        type="number"
                        value={editingPlan.featureConfig.limits.memberSiteLimit ?? ""}
                        onChange={handleLimitInputChange("memberSiteLimit")}
                        placeholder="例）1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="limit_block_total">コンテンツブロック（合計）</Label>
                      <Input
                        id="limit_block_total"
                        type="number"
                        value={editingPlan.featureConfig.limits.totalContentBlockLimit ?? ""}
                        onChange={handleLimitInputChange("totalContentBlockLimit")}
                        placeholder="例）5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="limit_block_site">サイト毎コンテンツブロック数</Label>
                      <Input
                        id="limit_block_site"
                        type="number"
                        value={editingPlan.featureConfig.limits.contentBlockPerSiteLimit ?? ""}
                        onChange={handleLimitInputChange("contentBlockPerSiteLimit")}
                        placeholder="例）15"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={handleSavePlan}>
                    <Save className="mr-2 h-4 w-4" />
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
