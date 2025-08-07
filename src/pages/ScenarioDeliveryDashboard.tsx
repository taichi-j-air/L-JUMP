import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { ScenarioDeliveryManager } from "@/components/ScenarioDeliveryManager"
import { BarChart3, Users, Send, Calendar, Target, Zap, Play, Clock } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"
import { AppHeader } from "@/components/AppHeader"

interface DeliveryOverview {
  totalScenarios: number
  totalFriends: number
  readySteps: number
  deliveredToday: number
  pendingDeliveries: number
}

export default function ScenarioDeliveryDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<DeliveryOverview | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/auth'
        return
      }
      
      setUser(session.user)
      await loadOverview(session.user.id)
    } catch (error) {
      console.error('ユーザー確認エラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadOverview = async (userId: string) => {
    try {
      // シナリオ数
      const { count: scenarioCount } = await supabase
        .from('step_scenarios')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true)

      // 友だち数
      const { count: friendCount } = await supabase
        .from('line_friends')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      // 準備完了ステップ数
      const { count: readyStepsCount } = await supabase
        .from('step_delivery_tracking')
        .select(`
          *,
          step_scenarios!inner (user_id)
        `, { count: 'exact', head: true })
        .eq('status', 'ready')
        .eq('step_scenarios.user_id', userId)

      // 今日配信済み
      const today = new Date().toISOString().split('T')[0]
      const { count: deliveredTodayCount } = await supabase
        .from('step_delivery_tracking')
        .select(`
          *,
          step_scenarios!inner (user_id)
        `, { count: 'exact', head: true })
        .eq('status', 'delivered')
        .gte('delivered_at', `${today}T00:00:00.000Z`)
        .lte('delivered_at', `${today}T23:59:59.999Z`)
        .eq('step_scenarios.user_id', userId)

      // 保留中の配信
      const { count: pendingCount } = await supabase
        .from('step_delivery_tracking')
        .select(`
          *,
          step_scenarios!inner (user_id)
        `, { count: 'exact', head: true })
        .eq('status', 'waiting')
        .eq('step_scenarios.user_id', userId)

      setOverview({
        totalScenarios: scenarioCount || 0,
        totalFriends: friendCount || 0,
        readySteps: readyStepsCount || 0,
        deliveredToday: deliveredTodayCount || 0,
        pendingDeliveries: pendingCount || 0
      })

    } catch (error) {
      console.error('概要読み込みエラー:', error)
      toast({
        title: "エラー",
        description: "概要の読み込みに失敗しました",
        variant: "destructive"
      })
    }
  }

  const refreshOverview = () => {
    if (user) {
      loadOverview(user.id)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} />
      
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <Target className="h-6 w-6" />
          <h1 className="text-2xl font-bold">シナリオ配信ダッシュボード</h1>
        </div>

        {/* 概要カード */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardContent className="flex items-center p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-500/10 rounded-lg mr-4">
                    <BarChart3 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">アクティブシナリオ</p>
                    <p className="text-2xl font-bold">{overview.totalScenarios}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-500/10 rounded-lg mr-4">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">登録友だち</p>
                    <p className="text-2xl font-bold">{overview.totalFriends}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-500/10 rounded-lg mr-4">
                    <Play className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">配信準備完了</p>
                    <p className="text-2xl font-bold">{overview.readySteps}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-500/10 rounded-lg mr-4">
                    <Send className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">今日の配信</p>
                    <p className="text-2xl font-bold">{overview.deliveredToday}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-500/10 rounded-lg mr-4">
                    <Clock className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">待機中</p>
                    <p className="text-2xl font-bold">{overview.pendingDeliveries}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="delivery" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="delivery">配信管理</TabsTrigger>
            <TabsTrigger value="analytics">分析</TabsTrigger>
          </TabsList>

          <TabsContent value="delivery" className="space-y-4">
            <ScenarioDeliveryManager />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    配信状況
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {overview && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">配信完了率</span>
                          <span className="text-sm font-medium">
                            {overview.deliveredToday + overview.readySteps > 0
                              ? Math.round((overview.deliveredToday / (overview.deliveredToday + overview.readySteps)) * 100)
                              : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={overview.deliveredToday + overview.readySteps > 0
                            ? (overview.deliveredToday / (overview.deliveredToday + overview.readySteps)) * 100
                            : 0
                          } 
                          className="w-full"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{overview.deliveredToday}</div>
                          <div className="text-xs text-muted-foreground">配信済み</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-600">{overview.readySteps}</div>
                          <div className="text-xs text-muted-foreground">配信待ち</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    クイックアクション
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={refreshOverview}
                    variant="outline" 
                    className="w-full"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    データを更新
                  </Button>

                  {overview && overview.readySteps > 0 && (
                    <Alert>
                      <Play className="h-4 w-4" />
                      <AlertDescription>
                        {overview.readySteps}件のステップが配信準備完了です。
                        配信管理タブから実行できます。
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}