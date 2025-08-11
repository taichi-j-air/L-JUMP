import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Button } from "./ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { useToast } from "./ui/use-toast"

interface FriendLite {
  id: string
  line_user_id: string
  display_name: string | null
  picture_url: string | null
}

interface ScenarioItem {
  id: string
  name: string
}

interface FriendScenarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
  friend: FriendLite
}

export function FriendScenarioDialog({ open, onOpenChange, user, friend }: FriendScenarioDialogProps) {
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [assignedScenarios, setAssignedScenarios] = useState<ScenarioItem[]>([])
  const [unassignId, setUnassignId] = useState<string>("")
  const [scenarioSteps, setScenarioSteps] = useState<Array<{ id: string; name: string; step_order: number }>>([])
  const [startStepId, setStartStepId] = useState<string>("")
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    const load = async () => {
      const { data, error } = await supabase
        .from('step_scenarios')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name', { ascending: true })
      if (error) {
        toast({ title: 'シナリオ取得に失敗', description: error.message })
      } else {
        setScenarios(data || [])
      }

      // 現在この友だちに紐づくシナリオ一覧を取得（退出以外）
      const { data: tracking, error: tErr } = await supabase
        .from('step_delivery_tracking')
        .select('scenario_id')
        .eq('friend_id', friend.id)
        .neq('status', 'exited')
      if (!tErr) {
        const ids = Array.from(new Set((tracking || []).map((r: any) => r.scenario_id).filter(Boolean)))
        if (ids.length > 0) {
          const { data: assigned, error: aErr } = await supabase
            .from('step_scenarios')
            .select('id, name')
            .in('id', ids)
          if (!aErr) {
            setAssignedScenarios(assigned || [])
          }
        } else {
          setAssignedScenarios([])
        }
      }
    }
    load()
  }, [open, user.id, friend.id])

  // シナリオ選択時にそのシナリオのステップ一覧を取得
  useEffect(() => {
    if (!selectedId) {
      setScenarioSteps([])
      setStartStepId("")
      return
    }
    const fetchSteps = async () => {
      const { data, error } = await supabase
        .from('steps')
        .select('id, name, step_order')
        .eq('scenario_id', selectedId)
        .order('step_order', { ascending: true })
      if (!error) {
        setScenarioSteps(data || [])
        setStartStepId((data && data[0]?.id) || "")
      }
    }
    fetchSteps()
  }, [selectedId])

  const handleAssign = async () => {
    const scenario = scenarios.find(s => s.id === selectedId)
    if (!scenario) {
      toast({ title: 'シナリオ未選択', description: 'シナリオを選択してください。' })
      return
    }
    if (!startStepId) {
      toast({ title: '開始ステップ未選択', description: '開始ステップを選択してください。' })
      return
    }
    setLoading(true)
    try {
      // すべてのステップ取得（順序判定用）
      const { data: allSteps } = await supabase
        .from('steps')
        .select('id, step_order')
        .eq('scenario_id', scenario.id)
        .order('step_order', { ascending: true })

      const startOrder = (allSteps || []).find((s: any) => s.id === startStepId)?.step_order ?? 1

      // 開始ステップの配信設定と友だち登録日時を取得（初回スケジュール計算用）
      const [{ data: startStepDetail }, { data: friendRow }] = await Promise.all([
        supabase
          .from('steps')
          .select('id, delivery_type, delivery_seconds, delivery_minutes, delivery_hours, delivery_days, delivery_time_of_day, specific_time, delivery_relative_to_previous')
          .eq('id', startStepId)
          .maybeSingle(),
        supabase
          .from('line_friends')
          .select('added_at')
          .eq('id', friend.id)
          .maybeSingle(),
      ])

      const computeFirstScheduledAt = (): string => {
        const now = new Date()
        if (!startStepDetail) return now.toISOString()

        // delivery_typeの正規化（Edge関数に合わせる）
        let effectiveType = (startStepDetail as any).delivery_type as string
        if (effectiveType === 'immediate') effectiveType = 'immediately'
        if (effectiveType === 'specific') effectiveType = 'specific_time'
        if (effectiveType === 'time_of_day') effectiveType = 'relative_to_previous'
        if (effectiveType === 'relative' && (startStepDetail as any).delivery_relative_to_previous) effectiveType = 'relative_to_previous'

        const addOffset = (base: Date) => {
          const d = new Date(base)
          d.setSeconds(d.getSeconds() + ((startStepDetail as any).delivery_seconds || 0))
          d.setMinutes(d.getMinutes() + ((startStepDetail as any).delivery_minutes || 0))
          d.setHours(d.getHours() + ((startStepDetail as any).delivery_hours || 0))
          d.setDate(d.getDate() + ((startStepDetail as any).delivery_days || 0))
          return d
        }
        const parseTimeOfDay = (val?: string | null) => {
          if (!val) return null
          const [hh, mm = '0', ss = '0'] = val.split(':')
          return { h: Number(hh), m: Number(mm), s: Number(ss) }
        }

        // ベース時刻
        const friendAdded = friendRow?.added_at ? new Date(friendRow.added_at) : now

        if (effectiveType === 'specific_time' && (startStepDetail as any).specific_time) {
          // 特定日時
          return new Date((startStepDetail as any).specific_time).toISOString()
        }

        // relative / relative_to_previous の初回は friend.added_at を基準に
        let scheduled = addOffset(friendAdded)

        const tod = parseTimeOfDay((startStepDetail as any).delivery_time_of_day)
        if (tod) {
          const withTod = new Date(scheduled)
          withTod.setHours(tod.h, tod.m, tod.s, 0)
          // もしすでに過去なら翌日に
          if (withTod.getTime() <= scheduled.getTime()) {
            withTod.setDate(withTod.getDate() + 1)
          }
          scheduled = withTod
        }
        return scheduled.toISOString()
      }

      const firstScheduledAt = computeFirstScheduledAt()
      const firstNextCheck = new Date(new Date(firstScheduledAt).getTime() - 5000).toISOString()

      // 既存のトラッキング
      const { data: existing } = await supabase
        .from('step_delivery_tracking')
        .select('id, step_id')
        .eq('scenario_id', scenario.id)
        .eq('friend_id', friend.id)

      const existingMap = new Map<string, string>((existing || []).map((r: any) => [r.step_id, r.id]))

      // まず不足分を一括INSERT
      const missingRows = (allSteps || [])
        .filter((s: any) => !existingMap.has(s.id))
        .map((s: any) => ({
          scenario_id: scenario.id,
          step_id: s.id,
          friend_id: friend.id,
          status: s.step_order < startOrder ? 'delivered' : s.step_order === startOrder ? 'waiting' : 'waiting',
          delivered_at: s.step_order < startOrder ? new Date().toISOString() : null,
          scheduled_delivery_at: s.step_order === startOrder ? firstScheduledAt : null,
          next_check_at: s.step_order === startOrder ? firstNextCheck : null,
        }))
      if (missingRows.length > 0) {
        const { error: insErr } = await supabase.from('step_delivery_tracking').insert(missingRows)
        if (insErr) throw insErr
      }

      // 既存分を個別UPDATE（状態を正規化）
      for (const s of allSteps || []) {
        const id = existingMap.get(s.id)
        if (!id) continue
        const target = s.step_order < startOrder
          ? { status: 'delivered', delivered_at: new Date().toISOString(), scheduled_delivery_at: null, next_check_at: null }
          : s.step_order === startOrder
            ? { status: 'waiting', delivered_at: null, scheduled_delivery_at: firstScheduledAt, next_check_at: firstNextCheck }
            : { status: 'waiting', delivered_at: null, scheduled_delivery_at: null, next_check_at: null }
        const { error: updErr } = await supabase
          .from('step_delivery_tracking')
          .update({ ...target, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (updErr) throw updErr
      }

      // スケジューラ関数をキック（この友だちのみ）。未来時刻なら送られません。
      try {
        await supabase.functions.invoke('scheduled-step-delivery', {
          body: { line_user_id: friend.line_user_id, scenario_id: scenario.id }
        })
      } catch (e) {
        console.warn('scheduled-step-delivery invoke failed', e)
      }

      // 手動登録のログを追加（重複は許容）
      try {
        await supabase
          .from('scenario_friend_logs')
          .insert({
            scenario_id: scenario.id,
            friend_id: friend.id,
            line_user_id: friend.line_user_id,
            invite_code: 'manual'
          })
      } catch (logErr) {
        console.warn('scenario_friend_logs insert failed', logErr)
      }

      // 統計更新通知
      window.dispatchEvent(new CustomEvent('scenario-stats-updated'))

      toast({ title: '登録/更新完了', description: `${friend.display_name || 'ユーザー'} を「${scenario.name}」の${((((allSteps||[]).find((s:any)=>s.id===startStepId)?.step_order) ?? 0) + 1)}番目ステップから配信開始に設定しました。` })
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: '設定に失敗しました', description: e.message || '不明なエラー' })
    } finally {
      setLoading(false)
    }
  }

  const handleUnassign = async () => {
    if (!unassignId) {
      toast({ title: '解除対象未選択', description: '解除するシナリオを選択してください。' })
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase
        .from('step_delivery_tracking')
        .update({ status: 'exited', delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('friend_id', friend.id)
        .eq('scenario_id', unassignId)
      if (error) throw error
      toast({ title: '解除完了', description: 'シナリオを解除しました。' })
      setAssignedScenarios((prev) => prev.filter((s) => s.id !== unassignId))
      setUnassignId("")
      // 統計更新通知
      window.dispatchEvent(new CustomEvent('scenario-stats-updated'))
    } catch (e: any) {
      toast({ title: '解除に失敗しました', description: e.message || '不明なエラー' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>シナリオ選択/解除</DialogTitle>
          <DialogDescription>
            {friend.display_name || 'ユーザー'} に対して、シナリオの登録や解除、開始ステップの設定ができます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <h4 className="text-sm font-medium">現在登録されているシナリオ</h4>
            {assignedScenarios.length > 0 ? (
              <ul className="text-sm list-disc pl-5">
                {assignedScenarios.map(s => <li key={s.id}>{s.name}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">登録なし</p>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Select value={unassignId} onValueChange={setUnassignId}>
                <SelectTrigger>
                  <SelectValue placeholder="解除するシナリオを選択" />
                </SelectTrigger>
                <SelectContent>
                  {assignedScenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="destructive" onClick={handleUnassign} disabled={loading || !unassignId}>
                {loading ? '処理中...' : '選択したシナリオを解除'}
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-medium">シナリオ登録と開始ステップ</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="シナリオを選択" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={startStepId} onValueChange={setStartStepId} disabled={!scenarioSteps.length}>
                <SelectTrigger>
                  <SelectValue placeholder="開始ステップを選択" />
                </SelectTrigger>
                <SelectContent>
                  {scenarioSteps.map((st) => (
                    <SelectItem key={st.id} value={st.id}>{st.step_order + 1}. {st.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleAssign} disabled={loading || !selectedId || !startStepId}>
                {loading ? '登録中...' : '選択して登録/更新'}
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
