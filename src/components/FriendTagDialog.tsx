import { useEffect, useMemo, useState } from "react"
import { User } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface FriendTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
  friend: { id: string; display_name: string | null }
}

interface TagRow {
  id: string
  name: string
}

export default function FriendTagDialog({ open, onOpenChange, user, friend }: FriendTagDialogProps) {
  const [tags, setTags] = useState<TagRow[]>([])
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    if (!open) return
    const load = async () => {
      try {
        const [{ data: tagRows, error: tagErr }, { data: ftRows, error: ftErr }] = await Promise.all([
          (supabase as any)
            .from("tags")
            .select("id, name")
            .eq("user_id", user.id)
            .order("name", { ascending: true }),
          (supabase as any)
            .from("friend_tags")
            .select("tag_id")
            .eq("user_id", user.id)
            .eq("friend_id", friend.id),
        ])
        if (tagErr) throw tagErr
        if (ftErr) throw ftErr
        setTags(tagRows || [])
        setAssigned(new Set((ftRows || []).map((r: any) => r.tag_id)))
      } catch (e) {
        console.error(e)
        toast.error("タグ情報の取得に失敗しました")
      }
    }
    load()
  }, [open, user.id, friend.id])

  const filteredTags = useMemo(() => {
    const q = filter.trim()
    if (!q) return tags
    return tags.filter((t) => t.name.includes(q))
  }, [tags, filter])

  const toggle = (tagId: string, checked: boolean) => {
    setAssigned((prev) => {
      const next = new Set(prev)
      if (checked) next.add(tagId)
      else next.delete(tagId)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const { data: currentRows, error: curErr } = await (supabase as any)
        .from("friend_tags")
        .select("tag_id")
        .eq("user_id", user.id)
        .eq("friend_id", friend.id)
      if (curErr) throw curErr
      const current = new Set<string>((currentRows || []).map((r: any) => String(r.tag_id)))

      const toAdd: string[] = Array.from(assigned).filter((id: string) => !current.has(id))
      const toRemove: string[] = Array.from(current).filter((id: string) => !assigned.has(id))

      if (toAdd.length) {
        const { error: addErr } = await (supabase as any)
          .from("friend_tags")
          .insert(toAdd.map((tag_id) => ({ user_id: user.id, friend_id: friend.id, tag_id })))
        if (addErr) throw addErr
      }
      if (toRemove.length) {
        const { error: delErr } = await (supabase as any)
          .from("friend_tags")
          .delete()
          .eq("user_id", user.id)
          .eq("friend_id", friend.id)
          .in("tag_id", toRemove)
        if (delErr) throw delErr
      }
      toast.success("タグを更新しました")
      onOpenChange(false)
      // 未読数などに影響しないが、必要ならイベント発火
      window.dispatchEvent(new Event("refreshFriendTags"))
    } catch (e) {
      console.error(e)
      toast.error("更新に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>タグ設定（{friend.display_name || "名前未設定"}）</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="タグ名で絞り込み" className="h-8" />
          <div className="max-h-64 overflow-auto rounded border p-2 space-y-2">
            {filteredTags.length === 0 ? (
              <div className="text-muted-foreground text-center py-6">タグがありません</div>
            ) : (
              filteredTags.map((t) => (
                <label key={t.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={assigned.has(t.id)}
                    onCheckedChange={(v) => toggle(t.id, Boolean(v))}
                    aria-label={`${t.name} を付与`}
                  />
                  <span className="truncate">{t.name}</span>
                </label>
              ))
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-8 px-3">
              キャンセル
            </Button>
            <Button onClick={save} disabled={saving} className="h-8 px-3">
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
