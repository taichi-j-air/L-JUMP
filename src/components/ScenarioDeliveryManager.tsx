import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Play, Users, Send, BarChart3, Settings, Zap, Target } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

interface ScenarioStats {
  total: number
  byStatus: Record<string, number>
  byCampaign: Record<string, number>
  bySource: Record<string, number>
}

interface Scenario {
  id: string
  name: string
  description: string
  is_active: boolean
}

export function ScenarioDeliveryManager() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedScenario, setSelectedScenario] = useState<string>("")
  const [stats, setStats] = useState<ScenarioStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)

  // シナリオ URL 生成用
  const [campaignId, setCampaignId] = useState("")
  const [registrationSource, setRegistrationSource] = useState("manual")
  const [generatedUrl, setGeneratedUrl] = useState("")

  useEffect(() => {
    loadScenarios()
  }, [])

  useEffect(() => {
    if (selectedScenario) {
      loadStats()
    }
  }, [selectedScenario])

  const loadScenarios = async () => {
    try {
      const { data, error } = await supabase
        .from('step_scenarios')
        .select('id, name, description, is_active')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setScenarios(data || [])
    } catch (error) {
      console.error('シナリオ読み込みエラー:', error)
      toast({
        title: "エラー",
        description: "シナリオの読み込みに失敗しました",
        variant: "destructive"
      })
    }
  }

  const loadStats = async () => {
    if (!selectedScenario) return

    setLoading(true)
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('認証が必要です')

      const response = await supabase.functions.invoke('enhanced-step-delivery', {
        body: {
          action: 'get_delivery_stats',
          data: {
            userId: user.user.id,
            scenarioId: selectedScenario
          }
        }
      })

      if (response.error) throw response.error
      setStats(response.data.stats)
    } catch (error) {
      console.error('統計読み込みエラー:', error)
      toast({
        title: "エラー",
        description: "統計の読み込みに失敗しました",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const processReadySteps = async () => {
    setProcessing(true)
    try {
      const response = await supabase.functions.invoke('enhanced-step-delivery', {
        body: {
          action: 'process_ready_steps',
          data: {}
        }
      })

      if (response.error) throw response.error

      toast({
        title: "配信完了",
        description: response.data.message,
      })

      // 統計を再読み込み
      await loadStats()
    } catch (error) {
      console.error('ステップ処理エラー:', error)
      toast({
        title: "配信エラー",
        description: "ステップ配信に失敗しました",
        variant: "destructive"
      })
    } finally {
      setProcessing(false)
    }
  }

  const generateScenarioUrl = () => {
    if (!selectedScenario) return

    const scenario = scenarios.find(s => s.id === selectedScenario)
    if (!scenario) return

    const baseUrl = window.location.origin
    const params = new URLSearchParams({
      scenario: scenario.name,
      ...(campaignId && { campaign: campaignId }),
      ...(registrationSource && { source: registrationSource })
    })

    const url = `${baseUrl}/invite?${params.toString()}`
    setGeneratedUrl(url)
  }

  const copyUrl = async () => {
    if (!generatedUrl) return

    try {
      await navigator.clipboard.writeText(generatedUrl)
      toast({
        title: "コピー完了",
        description: "URLをクリップボードにコピーしました",
      })
    } catch (error) {
      toast({
        title: "コピー失敗",
        description: "URLのコピーに失敗しました",
        variant: "destructive"
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'default'
      case 'ready': return 'secondary'
      case 'waiting': return 'outline'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6" />
        <h2 className="text-2xl font-bold">シナリオ配信管理</h2>
      </div>

      <Tabs defaultValue="delivery" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="delivery">配信管理</TabsTrigger>
          <TabsTrigger value="urls">URL生成</TabsTrigger>
          <TabsTrigger value="stats">統計情報</TabsTrigger>
        </TabsList>

        {/* 配信管理タブ */}
        <TabsContent value="delivery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                ステップ配信実行
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  準備完了(ready)状態のステップを一括配信します。定期実行やスケジュール配信も可能です。
                </AlertDescription>
              </Alert>

              <div className="flex gap-4">
                <Button 
                  onClick={processReadySteps}
                  disabled={processing}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {processing ? "配信中..." : "準備完了ステップを配信"}
                </Button>

                <Button variant="outline" onClick={loadStats}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  統計更新
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* URL生成タブ */}
        <TabsContent value="urls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                シナリオURL生成
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scenario-select">シナリオ選択</Label>
                <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                  <SelectTrigger>
                    <SelectValue placeholder="シナリオを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios.map((scenario) => (
                      <SelectItem key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-id">キャンペーンID（任意）</Label>
                  <Input
                    id="campaign-id"
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    placeholder="例: summer2024"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source">登録元</Label>
                  <Select value={registrationSource} onValueChange={setRegistrationSource}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">手動登録</SelectItem>
                      <SelectItem value="website">Webサイト</SelectItem>
                      <SelectItem value="social">SNS</SelectItem>
                      <SelectItem value="email">メール</SelectItem>
                      <SelectItem value="qr">QRコード</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={generateScenarioUrl} disabled={!selectedScenario}>
                  URL生成
                </Button>
              </div>

              {generatedUrl && (
                <div className="space-y-2">
                  <Label>生成されたURL</Label>
                  <div className="flex items-center gap-2">
                    <Input value={generatedUrl} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="sm" onClick={copyUrl}>
                      コピー
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 統計情報タブ */}
        <TabsContent value="stats" className="space-y-4">
          {selectedScenario && stats && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    配信統計
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{stats.total}</div>
                      <div className="text-sm text-muted-foreground">総配信数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {stats.byStatus.delivered || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">配信完了</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {stats.byStatus.ready || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">配信準備中</div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-2">ステータス別内訳</h4>
                    <div className="space-y-2">
                      {Object.entries(stats.byStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusColor(status)}>{status}</Badge>
                          </div>
                          <span className="font-mono">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {Object.keys(stats.byCampaign).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">キャンペーン別</h4>
                        <div className="space-y-2">
                          {Object.entries(stats.byCampaign).map(([campaign, count]) => (
                            <div key={campaign} className="flex items-center justify-between">
                              <span className="text-sm">{campaign}</span>
                              <span className="font-mono">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {Object.keys(stats.bySource).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">登録元別</h4>
                        <div className="space-y-2">
                          {Object.entries(stats.bySource).map(([source, count]) => (
                            <div key={source} className="flex items-center justify-between">
                              <span className="text-sm">{source}</span>
                              <span className="font-mono">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!selectedScenario && (
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                統計を表示するには、まずシナリオを選択してください。
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}