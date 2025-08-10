import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Users, UserX, CheckCircle, Eye } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Step } from "@/hooks/useStepScenarios"

interface StepDeliveryStatusProps {
  step: Step
}

interface DeliveryStats {
  waiting: number
  ready: number
  delivered: number
  exited: number
}

export function StepDeliveryStatus({ step }: StepDeliveryStatusProps) {
  const [stats, setStats] = useState<DeliveryStats>({ waiting: 0, ready: 0, delivered: 0, exited: 0 })
  const [showDetails, setShowDetails] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailUsers, setDetailUsers] = useState<Array<{ id: string; display_name: string | null; picture_url: string | null; line_user_id: string }>>([])

  const loadStats = async () => {
    setLoading(true)
    try {
      // 実際の配信統計を取得
      const { data: deliveryData, error } = await supabase
        .from('step_delivery_tracking')
        .select('status')
        .eq('step_id', step.id)

      if (error) {
        console.error('配信統計取得失敗:', error)
        setStats({ waiting: 0, ready: 0, delivered: 0, exited: 0 })
        return
      }

      const statsCount = deliveryData?.reduce((acc, item) => {
        acc[item.status as keyof DeliveryStats] = (acc[item.status as keyof DeliveryStats] || 0) + 1
        return acc
      }, { waiting: 0, ready: 0, delivered: 0, exited: 0 } as DeliveryStats) || { waiting: 0, ready: 0, delivered: 0, exited: 0 }

      setStats(statsCount)
    } catch (error) {
      console.error('配信統計取得失敗:', error)
      setStats({ waiting: 0, ready: 0, delivered: 0, exited: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
    if (showDetails) {
      loadDetailsFor(showDetails)
    }
  }, [step.id])

  const loadDetailsFor = async (type: string) => {
    setLoading(true)
    try {
      const { data: trackingRows, error: tErr } = await supabase
        .from('step_delivery_tracking')
        .select('friend_id')
        .eq('step_id', step.id)
        .eq('status', type)
      if (tErr) throw tErr

      const friendIds = (trackingRows || []).map((r: any) => r.friend_id).filter(Boolean)
      if (friendIds.length > 0) {
        const { data: friends, error: fErr } = await supabase
          .from('line_friends')
          .select('id, display_name, picture_url, line_user_id')
          .in('id', friendIds)
        if (fErr) throw fErr
        setDetailUsers(friends || [])
      } else {
        setDetailUsers([])
      }
    } catch (e) {
      console.error('詳細取得失敗:', e)
      setDetailUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleShowDetails = async (type: string) => {
    const next = showDetails === type ? null : type
    setShowDetails(next)
    setDetailUsers([])
    if (!next) return
    await loadDetailsFor(next)
  }

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'waiting': return <Clock className="h-3 w-3" />
      case 'ready': return <Eye className="h-3 w-3" />
      case 'delivered': return <CheckCircle className="h-3 w-3" />
      case 'exited': return <UserX className="h-3 w-3" />
      default: return <Users className="h-3 w-3" />
    }
  }

  const getStatusLabel = (type: string) => {
    switch (type) {
      case 'waiting': return '配信待機'
      case 'ready': return '配信準備中'
      case 'delivered': return '配信完了'
      case 'exited': return 'シナリオ離脱'
      default: return ''
    }
  }

  const getStatusValue = (type: string) => {
    switch (type) {
      case 'waiting': return stats.waiting
      case 'ready': return stats.ready
      case 'delivered': return stats.delivered
      case 'exited': return stats.exited
      default: return 0
    }
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          配信状況
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        <div className="grid grid-cols-3 gap-2">
          {['waiting', 'delivered', 'exited'].map((type) => (
            <div key={type} className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleShowDetails(type)}
                className="w-full p-2 h-auto flex flex-col gap-1"
                disabled={getStatusValue(type) === 0}
              >
                <div className="flex items-center gap-1">
                  {getStatusIcon(type)}
                  <span className="text-xs">{getStatusLabel(type)}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {getStatusValue(type)}人
                </Badge>
              </Button>
            </div>
          ))}
        </div>

        {showDetails && (
          <div className="space-y-2 border-t pt-2">
            <div className="text-xs font-medium flex items-center gap-1">
              {getStatusIcon(showDetails)}
              {getStatusLabel(showDetails)}ユーザー
            </div>
            {loading ? (
              <div className="text-xs text-muted-foreground">読み込み中...</div>
            ) : detailUsers.length > 0 ? (
              <ul className="space-y-1">
                {detailUsers.map((u) => (
                  <li key={u.id} className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-muted overflow-hidden">
                      {u.picture_url ? (
                        <img src={u.picture_url} alt={u.display_name ?? u.line_user_id} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <span className="text-xs">{u.display_name || u.line_user_id}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted-foreground">ユーザーはいません</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}