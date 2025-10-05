import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Plus, Save, Trash2, X } from "lucide-react"

interface TagRow {
  id: string
  name: string
  color: string | null
  description: string | null
  created_at: string
  updated_at: string
  user_id: string
}

interface MemberRow {
  id: string // friend_tags.id
  friend_id: string
  created_at: string // friend_tags.created_at (タグに入った日時)
  display_name: string | null
}

const useSEO = (title: string, description: string, canonical?: string) => {
  useEffect(() => {
    document.title = title
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement | null) ||
      document.createElement("meta")
    meta.setAttribute("name", "description")
    meta.setAttribute("content", description)
    if (!meta.parentNode) document.head.appendChild(meta)

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
      if (!link) {
        link = document.createElement("link")
        link.rel = "canonical"
        document.head.appendChild(link)
      }
      link.href = canonical
    }
  }, [title, description, canonical])
}

export default function TagsManager() {
  useSEO("タグ管理 | セグメント作成", "タグの作成・管理・メンバー確認", window.location.href)

  const [tags, setTags] = useState<TagRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const [newTagName, setNewTagName] = useState("")

  type SortKey = "count-desc" | "count-asc" | "name-asc" | "created-desc" | "created-asc"
  const [sortKey, setSortKey] = useState<SortKey>("created-desc")

  const [membersOpen, setMembersOpen] = useState(false)
  const [activeTag, setActiveTag] = useState<TagRow | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [removals, setRemovals] = useState<Set<string>>(new Set()) // friend_tags.id を保持
  const [savingRemovals, setSavingRemovals] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [totalMembers, setTotalMembers] = useState(0)

  const formatYYDDMMHHMM = (iso: string) => {
    const d = new Date(iso)
    const yy = String(d.getFullYear()).slice(-2)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const HH = String(d.getHours()).padStart(2, "0")
    const MM = String(d.getMinutes()).padStart(2, "0")
    return `${yy}${dd}${mm} ${HH}:${MM}`
  }

  const load = async () => {
    setLoading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        toast.error("ログインが必要です")
        setLoading(false)
        return
      }

      const [{ data: tagRowsData, error: tagErr }, { data: ftRows, error: ftErr }] = await Promise.all([
        (supabase as any).from("tags").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).from("friend_tags").select("tag_id").eq("user_id", user.id),
      ])

      if (tagErr) throw tagErr
      if (ftErr) throw ftErr

      const tagRows = tagRowsData || []

      // Check for "ブロック" tag and create if not exists
      const blockTagExists = (tagRows || []).some((tag) => tag.name === "ブロック")
      if (!blockTagExists) {
        const { data: newTag, error: insertError } = await supabase
          .from("tags")
          .insert({
            name: "ブロック",
            user_id: user.id,
            description: "LINE公式アカウントをブロックしたユーザーに自動で付与されるタグです。",
          })
          .select()
          .single()

        if (insertError) {
          console.error("Failed to create 'ブロック' tag:", insertError)
          // Continue without the block tag if creation fails
        } else if (newTag) {
          // Add the new tag to the list
          tagRows.unshift(newTag)
        }
      }

      const cnt: Record<string, number> = {}
      ;(ftRows || []).forEach((r: any) => {
        cnt[r.tag_id] = (cnt[r.tag_id] || 0) + 1
      })

      setTags(tagRows || [])
      setCounts(cnt)
    } catch (e) {
      console.error(e)
      toast.error("読み込みに失敗しました")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const handler = () => load()
    window.addEventListener("refreshFriendTags", handler as any)
    return () => window.removeEventListener("refreshFriendTags", handler as any)
  }, [])
  const sorted = useMemo(() => {
    const arr = [...tags]
    switch (sortKey) {
      case "count-desc":
        arr.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
        break
      case "count-asc":
        arr.sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0))
        break
      case "name-asc":
        arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"))
        break
      case "created-asc":
        arr.sort((a, b) => a.created_at.localeCompare(b.created_at))
        break
      case "created-desc":
      default:
        arr.sort((a, b) => b.created_at.localeCompare(a.created_at))
        break
    }
    return arr
  }, [tags, counts, sortKey])

  const handleCreate = async () => {
    if (!newTagName.trim()) {
      toast.error("タグ名を入力してください")
      return
    }
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) {
      toast.error("ログインが必要です")
      return
    }
    const { error } = await (supabase as any).from("tags").insert({ name: newTagName.trim(), user_id: user.id })
    if (error) {
      console.error(error)
      toast.error("作成に失敗しました")
      return
    }
    toast.success("タグを作成しました")
    setNewTagName("")
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("このタグを削除しますか？")) return
    const { error } = await (supabase as any).from("tags").delete().eq("id", id)
    if (error) {
      console.error(error)
      toast.error("削除に失敗しました")
      return
    }
    toast.success("削除しました")
    setTags((prev) => prev.filter((t) => t.id !== id))
    setCounts((prev) => {
      const cp = { ...prev }
      delete cp[id]
      return cp
    })
  }

  const openMembers = async (tag: TagRow) => {
    setActiveTag(tag)
    setMembers([])
    setRemovals(new Set())
    setMembersOpen(true)
    setPage(1)

    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) return

      const { count, error: cntErr } = await (supabase as any)
        .from("friend_tags")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("tag_id", tag.id)
      if (cntErr) throw cntErr
      setTotalMembers(count || 0)

      await fetchMembersPage(tag, 1, user.id)
    } catch (e) {
      console.error(e)
      toast.error("メンバー取得に失敗しました")
    }
  }

  const fetchMembersPage = async (tag: TagRow, p: number, userId?: string) => {
    try {
      let uid = userId
      if (!uid) {
        const { data: auth } = await supabase.auth.getUser()
        uid = auth.user?.id
        if (!uid) return
      }
      const from = (p - 1) * pageSize
      const to = from + pageSize - 1

      const { data: ftRows, error: ftErr } = await (supabase as any)
        .from("friend_tags")
        .select("id, friend_id, created_at")
        .eq("user_id", uid)
        .eq("tag_id", tag.id)
        .order("created_at", { ascending: false })
        .range(from, to)
      if (ftErr) throw ftErr

      const friendIds = (ftRows || []).map((r: any) => r.friend_id)
      let friendsMap: Record<string, { display_name: string | null }> = {}
      if (friendIds.length) {
        const { data: frows, error: ferr } = await (supabase as any)
          .from("line_friends")
          .select("id, display_name")
          .eq("user_id", uid)
          .in("id", friendIds)
        if (ferr) throw ferr
        friendsMap = Object.fromEntries((frows || []).map((f: any) => [f.id, { display_name: f.display_name }]))
      }

      const merged: MemberRow[] = (ftRows || []).map((r: any) => ({
        id: r.id,
        friend_id: r.friend_id,
        created_at: r.created_at,
        display_name: friendsMap[r.friend_id]?.display_name ?? null,
      }))
      setMembers(merged)
      setPage(p)
    } catch (e) {
      console.error(e)
      toast.error("メンバー取得に失敗しました")
    }
  }

  const toggleRemoval = (friendTagId: string, checked: boolean) => {
    setRemovals((prev) => {
      const next = new Set(prev)
      if (checked) next.add(friendTagId)
      else next.delete(friendTagId)
      return next
    })
  }

  const saveRemovals = async () => {
    if (!activeTag || removals.size === 0) {
      setMembersOpen(false)
      return
    }
    setSavingRemovals(true)
    try {
      const { error } = await (supabase as any).from("friend_tags").delete().in("id", Array.from(removals))
      if (error) throw error
      toast.success("タグから外しました")
      // UI更新
      setMembers((prev) => prev.filter((m) => !removals.has(m.id)))
      setCounts((prev) => ({ ...prev, [activeTag.id]: Math.max(0, (prev[activeTag.id] || 0) - removals.size) }))
      setRemovals(new Set())
      setMembersOpen(false)
    } catch (e) {
      console.error(e)
      toast.error("更新に失敗しました")
    } finally {
      setSavingRemovals(false)
    }
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">タグ管理</h1>
        <p className="text-muted-foreground">友だちをセグメントするためのタグを作成・管理できます。</p>
      </header>

      {/* 追加フォーム（名前のみ） */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>新規タグ</CardTitle>
          <CardDescription>名前だけで作成できます</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="例）VIP"
            className="sm:max-w-xs"
          />
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={!newTagName.trim()}>
              <Plus className="mr-2 h-4 w-4" /> 追加
            </Button>
            {newTagName && (
              <Button variant="outline" onClick={() => setNewTagName("")}>クリア</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 一覧（データテーブル） */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>タグ一覧</CardTitle>
            <CardDescription>人数・作成日時・削除を管理できます</CardDescription>
          </div>
          <div className="w-48">
            <Select value={sortKey} onValueChange={(v: SortKey) => setSortKey(v)}>
              <SelectTrigger>
                <SelectValue placeholder="並び替え" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count-desc">登録ユーザー数 多い順</SelectItem>
                <SelectItem value="count-asc">登録ユーザー数 少ない順</SelectItem>
                <SelectItem value="name-asc">あいうえお順</SelectItem>
                <SelectItem value="created-desc">作成順（新しい）</SelectItem>
                <SelectItem value="created-asc">作成順（古い）</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">読み込み中...</p>
          ) : (
            <div className="w-full overflow-x-auto text-sm">
              <Table>
                <TableHeader>
                  <TableRow className="h-9">
                    <TableHead className="w-[40%] py-2">タグ名</TableHead>
                    <TableHead className="w-[15%] text-right py-2">人数</TableHead>
                    <TableHead className="w-[25%] py-2">作成日時</TableHead>
                    <TableHead className="w-[20%] text-right py-2">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.length === 0 ? (
                    <TableRow className="h-9">
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-2">
                        まだタグがありません
                      </TableCell>
                    </TableRow>
                  ) : (
                    sorted.map((tag) => {
                      const c = counts[tag.id] || 0
                      return (
                        <TableRow key={tag.id} className="h-9">
                          <TableCell className="truncate py-2">{tag.name}</TableCell>
                          <TableCell className="text-right py-2">
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openMembers(tag)}>
                              {c.toLocaleString()} 名を見る
                            </Button>
                          </TableCell>
                          <TableCell className="py-2">{formatYYDDMMHHMM(tag.created_at)}</TableCell>
                          <TableCell className="text-right py-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => handleDelete(tag.id)}
                              disabled={tag.name === "ブロック"}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> 削除
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* メンバー表示モーダル */}
      <Dialog open={membersOpen} onOpenChange={(o) => (!o ? setMembersOpen(false) : null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {activeTag ? `「${activeTag.name}」のメンバー` : "メンバー"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="w-full overflow-x-auto text-sm">
              <Table>
                <TableHeader>
                  <TableRow className="h-9">
                    <TableHead className="py-2">ユーザー名</TableHead>
                    <TableHead className="py-2">追加日時</TableHead>
                    <TableHead className="text-right py-2">外す</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow className="h-9">
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-2">
                        メンバーがいません
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((m) => (
                      <TableRow key={m.id} className="h-9">
                        <TableCell className="truncate py-2">{m.display_name || "（名前未設定）"}</TableCell>
                        <TableCell className="py-2">{formatYYDDMMHHMM(m.created_at)}</TableCell>
                        <TableCell className="text-right py-2">
                          <Checkbox
                            checked={removals.has(m.id)}
                            onCheckedChange={(v) => toggleRemoval(m.id, Boolean(v))}
                            aria-label="タグから外す"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">
                表示 {Math.min((page - 1) * pageSize + 1, Math.max(totalMembers, 0))}
                -{Math.min(page * pageSize, totalMembers)} / {totalMembers}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => activeTag && page > 1 && fetchMembersPage(activeTag, page - 1)}
                  disabled={page <= 1}
                >
                  前へ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => activeTag && page * pageSize < totalMembers && fetchMembersPage(activeTag, page + 1)}
                  disabled={page * pageSize >= totalMembers}
                >
                  次へ
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setMembersOpen(false)} className="h-8 px-3">
                <X className="mr-2 h-4 w-4" /> キャンセル
              </Button>
              <Button onClick={saveRemovals} disabled={savingRemovals || removals.size === 0} className="h-8 px-3">
                <Save className="mr-2 h-4 w-4" /> 保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
