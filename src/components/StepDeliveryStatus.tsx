import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Users, UserX, CheckCircle, Ban } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Step } from "@/hooks/useStepScenarios"
import { format } from "date-fns"

interface StepDeliveryStatusProps {
  step: Step
}

interface DeliveryStats {
  waiting: number
  ready: number
  delivered: number
  exited: number
  blocked: number
}

export function StepDeliveryStatus({ step }: StepDeliveryStatusProps) {
  const [stats, setStats] = useState<DeliveryStats>({ waiting: 0, ready: 0, delivered: 0, exited: 0, blocked: 0 })
  const [showDetails, setShowDetails] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailUsers, setDetailUsers] = useState<Array<{ id: string; display_name: string | null; picture_url: string | null; line_user_id: string; ts: string | null }>>([])

  const loadStats = async () => {
    setLoading(true)
    try {
      // 配信統計（waiting/ready/exited は tracking、delivered はログで集計）
      const { data: trackingRows, error: trErr } = await supabase
        .from('step_delivery_tracking')
        .select('status')
        .eq('step_id', step.id)

      if (trErr) {
        console.error('配信統計取得失敗:', trErr)
        setStats({ waiting: 0, ready: 0, delivered: 0, exited: 0, blocked: 0 })
        return
      }

      let statsCount: DeliveryStats = { waiting: 0, ready: 0, delivered: 0, exited: 0, blocked: 0 }
      for (const item of trackingRows || []) {
        const s = (item as any).status
        if (s === 'ready') {
          statsCount.waiting += 1 // 準備中も「待機」に含める
          statsCount.ready += 1
        } else if (s === 'waiting' || s === 'exited') {
          ;(statsCount as any)[s] = ((statsCount as any)[s] || 0) + 1
        }
      }

      // 当該ステップでの配信完了人数（ログ基準、友だち重複排除）
      const { data: deliveredLogs, error: delErr } = await supabase
        .from('step_delivery_logs')
        .select('friend_id')
        .eq('step_id', step.id)
        .eq('delivery_status', 'delivered')
      if (!delErr) {
        const uniq = new Set<string>((deliveredLogs || []).map((r: any) => r.friend_id).filter(Boolean))
        statsCount.delivered = uniq.size
      }

      // 当該ステップでの配信失敗（ブロック等）数（ログ基準、重複排除）
      const { data: failedLogs, error: logErr } = await supabase
        .from('step_delivery_logs')
        .select('friend_id')
        .eq('step_id', step.id)
        .eq('delivery_status', 'failed')

      if (!logErr) {
        const uniq = new Set<string>((failedLogs || []).map((r: any) => r.friend_id).filter(Boolean))
        statsCount.blocked = uniq.size
      }

      setStats(statsCount)
    } catch (error) {
      console.error('配信統計取得失敗:', error)
      setStats({ waiting: 0, ready: 0, delivered: 0, exited: 0, blocked: 0 })
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

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`step-delivery-status-${step.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'step_delivery_tracking', filter: `step_id=eq.${step.id}` }, () => {
        loadStats()
        if (showDetails) {
          loadDetailsFor(showDetails)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'step_delivery_logs', filter: `step_id=eq.${step.id}` }, () => {
        loadStats()
        if (showDetails) {
          loadDetailsFor(showDetails)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [step.id])

  const loadDetailsFor = async (type: string) => {
    setLoading(true)
    try {
      if (type === 'blocked') {
        const { data: logs, error: lErr } = await supabase
          .from('step_delivery_logs')
          .select('friend_id')
          .eq('step_id', step.id)
          .eq('delivery_status', 'failed')
        if (lErr) throw lErr
        const friendIds = Array.from(new Set((logs || []).map((r: any) => r.friend_id).filter(Boolean)))
        if (friendIds.length > 0) {
          const { data: friends, error: fErr } = await supabase
            .from('line_friends')
            .select('id, display_name, picture_url, line_user_id')
            .in('id', friendIds)
          if (fErr) throw fErr
          setDetailUsers((friends || []).map((f: any) => ({ ...f, ts: null })))
        } else {
          setDetailUsers([])
        }
      } else if (type === 'delivered') {
        // 配信完了はログ基準で取得（離脱後も残る）
        const { data: logs, error: dErr } = await supabase
          .from('step_delivery_logs')
          .select('friend_id, delivered_at')
          .eq('step_id', step.id)
          .eq('delivery_status', 'delivered')
        if (dErr) throw dErr
        // 友だちごとに最新の delivered_at を採用
        const latestByFriend = new Map<string, string>()
        for (const r of logs || []) {
          const fid = (r as any).friend_id
          const ts = (r as any).delivered_at
          if (!fid || !ts) continue
          const current = latestByFriend.get(fid)
          if (!current || new Date(ts) > new Date(current)) latestByFriend.set(fid, ts)
        }
        const friendIds = Array.from(latestByFriend.keys())
        if (friendIds.length > 0) {
          const { data: friends, error: fErr } = await supabase
            .from('line_friends')
            .select('id, display_name, picture_url, line_user_id')
            .in('id', friendIds)
          if (fErr) throw fErr
          setDetailUsers((friends || []).map((f: any) => ({ ...f, ts: latestByFriend.get(f.id) || null })))
        } else {
          setDetailUsers([])
        }
      } else {
        // waiting / exited は tracking 基準
        let trackingQuery = supabase
          .from('step_delivery_tracking')
          .select('friend_id, scheduled_delivery_at, delivered_at, updated_at, status')
          .eq('step_id', step.id)
        if (type === 'waiting') {
          // 「待機」は準備中(ready)も含めて表示
          trackingQuery = (trackingQuery as any).in('status', ['waiting', 'ready'])
        } else {
          trackingQuery = (trackingQuery as any).eq('status', type)
        }
        const { data: trackingRows, error: tErr } = await trackingQuery
        if (tErr) throw tErr

        const friendIds = (trackingRows || []).map((r: any) => r.friend_id).filter(Boolean)
        if (friendIds.length > 0) {
          const { data: friends, error: fErr } = await supabase
            .from('line_friends')
            .select('id, display_name, picture_url, line_user_id')
            .in('id', friendIds)
          if (fErr) throw fErr

          const timeByFriend = new Map<string, string | null>()
          ;(trackingRows || []).forEach((r: any) => {
            let ts: string | null = null
            if (type === 'waiting') ts = r.scheduled_delivery_at
            else if (type === 'exited') ts = r.updated_at
            timeByFriend.set(r.friend_id, ts)
          })

          setDetailUsers((friends || []).map((f: any) => ({ ...f, ts: timeByFriend.get(f.id) || null })))
        } else {
          setDetailUsers([])
        }
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
      case 'delivered': return <CheckCircle className="h-3 w-3" />
      case 'exited': return <UserX className="h-3 w-3" />
      case 'blocked': return <Ban className="h-3 w-3" />
      default: return <Users className="h-3 w-3" />
    }
  }

  const getStatusLabel = (type: string) => {
    switch (type) {
      case 'waiting': return '配信待機'
      case 'delivered': return '配信完了'
      case 'exited': return 'シナリオ離脱'
      case 'blocked': return 'ブロック'
      default: return ''
    }
  }

  const getStatusValue = (type: string) => {
    switch (type) {
      case 'waiting': return stats.waiting
      case 'delivered': return stats.delivered
      case 'exited': return stats.exited
      case 'blocked': return stats.blocked
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
        <div className="grid grid-cols-4 gap-2">
          {['waiting', 'delivered', 'exited', 'blocked'].map((type) => (
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
                    <span className="text-xs">
                      {u.display_name || u.line_user_id}
                      {showDetails && u.ts ? (
                        <span className="ml-2 text-muted-foreground">{u.ts ? format(new Date(u.ts), 'yyyy/MM/dd HH:mm') : ''}</span>
                      ) : null}
                    </span>
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