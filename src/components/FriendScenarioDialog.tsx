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
    }
    load()
  }, [open, user.id])

  const handleAssign = async () => {
    const scenario = scenarios.find(s => s.id === selectedId)
    if (!scenario) {
      toast({ title: 'シナリオ未選択', description: 'シナリオを選択してください。' })
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc('register_friend_with_scenario', {
      p_line_user_id: friend.line_user_id,
      p_display_name: friend.display_name,
      p_picture_url: friend.picture_url,
      p_scenario_name: scenario.name,
      p_campaign_id: null,
      p_registration_source: 'manual'
    })
    setLoading(false)
    if (error) {
      toast({ title: '登録に失敗しました', description: error.message })
      return
    }
    toast({ title: '登録完了', description: `${friend.display_name || 'ユーザー'} を「${scenario.name}」に登録しました。` })
    onOpenChange(false)
  }

  const handleManage = () => {
    // 管理ダッシュボードへ遷移（友だちIDをクエリに付与）
    window.location.href = `/delivery-dashboard?friend=${friend.id}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>シナリオ選択/解除</DialogTitle>
          <DialogDescription>
            {friend.display_name || 'ユーザー'} に適用するシナリオを選択してください。解除や詳細管理はダッシュボードで行えます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleManage}>管理ページを開く</Button>
          <Button onClick={handleAssign} disabled={loading}>{loading ? '登録中...' : '選択して登録'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
