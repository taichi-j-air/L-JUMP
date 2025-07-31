import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Eye } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { StepScenario } from "@/hooks/useStepScenarios"

interface ScenarioAnalyticsProps {
  scenario: StepScenario
}

interface FriendLog {
  id: string
  invite_code: string
  added_at: string
  friend_id?: string
  line_user_id?: string
}

export function ScenarioAnalytics({ scenario }: ScenarioAnalyticsProps) {
  const [friendLogs, setFriendLogs] = useState<FriendLog[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('scenario_friend_logs')
        .select('*')
        .eq('scenario_id', scenario.id)
        .order('added_at', { ascending: false })

      if (error) {
        console.error('友達ログ取得エラー:', error)
      } else {
        setFriendLogs(data || [])
      }
    } catch (error) {
      console.error('分析データ取得失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [scenario.id])

  const handleToggleDetails = () => {
    setShowDetails(!showDetails)
    if (!showDetails) {
      loadAnalytics()
    }
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          流入分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">友達追加数</span>
          <Badge variant="secondary">{friendLogs.length}人</Badge>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleDetails}
          disabled={loading || friendLogs.length === 0}
          className="w-full h-7 text-xs gap-1"
        >
          <Eye className="h-3 w-3" />
          {showDetails ? '詳細を閉じる' : '詳細を表示'}
        </Button>

        {showDetails && (
          <div className="space-y-2">
            <div className="text-xs font-medium">追加履歴</div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {friendLogs.map((log) => (
                <div key={log.id} className="text-xs p-2 bg-muted rounded">
                  <div>コード: {log.invite_code}</div>
                  <div className="text-muted-foreground">
                    {new Date(log.added_at).toLocaleString('ja-JP')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}