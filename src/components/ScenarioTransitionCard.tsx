import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/integrations/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ArrowRight, Plus, X, TestTube } from "lucide-react"
import { StepScenario, ScenarioTransition } from "@/hooks/useStepScenarios"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

interface ScenarioTransitionCardProps {
  currentScenario: StepScenario
  availableScenarios: StepScenario[]
  transitions: ScenarioTransition[]
  onAddTransition: (toScenarioId: string) => void
  onRemoveTransition: (transitionId: string) => void
}

export function ScenarioTransitionCard({
  currentScenario,
  availableScenarios,
  transitions,
  onAddTransition,
  onRemoveTransition
}: ScenarioTransitionCardProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>("")
  
  const [accumCount, setAccumCount] = useState<number | null>(null)
  const [accumOpen, setAccumOpen] = useState(false)
  const [accumPage, setAccumPage] = useState(1)
  const [accumFriendIds, setAccumFriendIds] = useState<string[]>([])
  const [accumUsers, setAccumUsers] = useState<Array<{ id: string; display_name: string | null; picture_url: string | null; line_user_id: string; added_at?: string }>>([])
  const pageSize = 30

  // Popup filters & selection
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "name_asc">("date_desc")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const { toast } = useToast()
  
  const currentTransitions = transitions.filter(t => t.from_scenario_id === currentScenario.id)
  const hasMultipleTransitions = currentTransitions.length >= 2
  const availableOptions = availableScenarios.filter(s => 
    s.id !== currentScenario.id && 
    !currentTransitions.some(t => t.to_scenario_id === s.id)
  )

  const computeAccumulated = async () => {
    try {
      const { data: stepRows, error: stepErr } = await supabase
        .from('steps')
        .select('id')
        .eq('scenario_id', currentScenario.id)
      if (stepErr) throw stepErr
      const stepIds = (stepRows || []).map((r: any) => r.id)
      if (stepIds.length === 0) { setAccumCount(0); setAccumFriendIds([]); return }
      const { data: trackRows, error: tErr } = await supabase
        .from('step_delivery_tracking')
        .select('friend_id, step_id, status')
        .in('step_id', stepIds)
      if (tErr) throw tErr
      const totalSteps = stepIds.length
      const map = new Map<string, { delivered: number; total: number; hasNonDelivered: boolean }>()
      for (const r of trackRows || []) {
        const fid = (r as any).friend_id
        const status = (r as any).status
        const rec = map.get(fid) || { delivered: 0, total: 0, hasNonDelivered: false }
        rec.total += 1
        if (status === 'delivered') rec.delivered += 1
        else rec.hasNonDelivered = true
        map.set(fid, rec)
      }
      const completed: string[] = []
      for (const [fid, rec] of map) {
        if (rec.delivered === totalSteps && rec.total >= totalSteps) {
          completed.push(fid)
        }
      }
      setAccumFriendIds(completed)
      setAccumCount(completed.length)
    } catch (e) {
      console.error('滞留ユーザー数取得失敗:', e)
      setAccumCount(0)
      setAccumFriendIds([])
    }
  }

  const loadAccumPage = async (p: number) => {
    setAccumPage(p)
    const start = (p - 1) * pageSize
    const ids = accumFriendIds.slice(start, start + pageSize)
    if (ids.length === 0) { setAccumUsers([]); return }
    const { data: friends, error } = await supabase
      .from('line_friends')
      .select('id, display_name, picture_url, line_user_id, added_at')
      .in('id', ids)
    if (error) { setAccumUsers([]); return }
    let list = (friends || []) as any[]
    // sort
    list = list.sort((a,b) => {
      if (sort === 'date_desc') return new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
      if (sort === 'date_asc') return new Date(a.added_at).getTime() - new Date(b.added_at).getTime()
      return (a.display_name||'').localeCompare(b.display_name||'')
    })
    // filter by search
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(u => (u.display_name||'').toLowerCase().includes(q) || (u.line_user_id||'').toLowerCase().includes(q))
    }
    setAccumUsers(list as any)
    // selection state refresh
    setSelectAll(false)
    setSelectedIds(new Set())
  }

  useEffect(() => {
    if (currentTransitions.length === 0) {
      computeAccumulated()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScenario.id, currentTransitions.length])

  const handleAddTransition = () => {
    if (selectedScenario) {
      onAddTransition(selectedScenario)
      setSelectedScenario("")
    }
  }

  return (
    <Card className="mt-3">
      <CardHeader className="py-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          別シナリオへの移動
        </CardTitle>
        {currentTransitions.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            遷移シナリオを2個以上追加するとABテストが可能になります
          </p>
        )}
        {hasMultipleTransitions && (
          <p className="text-xs text-green-600 mt-1">
            <TestTube className="h-3 w-3 inline mr-1" />
            ABテスト有効：各シナリオに均等分配されます
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {currentTransitions.length === 0 && (
          <div className="p-3 rounded-md bg-muted/50 text-xs flex items-center justify-between">
            <div className="flex flex-col">
              <span>このシナリオに滞留中</span>
              <span className="text-muted-foreground mt-1">※全ステップ送信後に解除されていない人</span>
            </div>
            <Button
              variant="success"
              size="sm"
              onClick={async () => {
                await computeAccumulated()
                setAccumOpen(true)
                await loadAccumPage(1)
              }}
            >
              {(accumCount ?? 0)}人を表示
            </Button>
          </div>
        )}

        {/* 既存の移動設定 */}
        {currentTransitions.map((transition) => {
          const targetScenario = availableScenarios.find(s => s.id === transition.to_scenario_id)
          return (
            <div key={transition.id} className="flex items-center justify-between p-2 border rounded-lg">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{targetScenario?.name || '不明なシナリオ'}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveTransition(transition.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}


        {/* 新しい移動設定追加 */}
        {availableOptions.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="移動先シナリオを選択" />
                </SelectTrigger>
                <SelectContent>
                  {availableOptions.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAddTransition} 
                disabled={!selectedScenario}
                size="sm"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>

          </div>
        )}

        {availableOptions.length === 0 && currentTransitions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            移動可能なシナリオがありません
          </p>
        )}
      </CardContent>

      <Dialog open={accumOpen} onOpenChange={setAccumOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>滞留ユーザー一覧</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">合計 {(accumCount ?? 0)} 人</div>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {accumUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <img
                    src={u.picture_url ?? '/placeholder.svg'}
                    alt={`${u.display_name ?? '未設定'}のアイコン`}
                    className="h-8 w-8 rounded-full"
                  />
                  <div className="text-sm">{u.display_name ?? u.line_user_id}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadAccumPage(Math.max(1, accumPage - 1))}
                disabled={accumPage <= 1}
              >
                前へ
              </Button>
              <div className="text-xs text-muted-foreground">
                ページ {accumPage} / {Math.max(1, Math.ceil((accumCount ?? 0) / pageSize))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadAccumPage(accumPage + 1)}
                disabled={accumPage >= Math.max(1, Math.ceil((accumCount ?? 0) / pageSize))}
              >
                次へ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}