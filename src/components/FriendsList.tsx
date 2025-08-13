import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { MessageCircle, Tag as TagIcon, ListChecks } from "lucide-react"
import { format } from "date-fns"
import { ChatWindow } from "./ChatWindow"
import { Input } from "./ui/input"
import { useToast } from "@/hooks/use-toast"
import { FriendScenarioDialog } from "./FriendScenarioDialog"
import FriendTagDialog from "./FriendTagDialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
interface Friend {
  id: string
  line_user_id: string
  display_name: string | null
  picture_url: string | null
  added_at: string
}

interface FriendsListProps {
  user: User
}

export function FriendsList({ user }: FriendsListProps) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [scenarioDialogFriend, setScenarioDialogFriend] = useState<Friend | null>(null)
  const [tagDialogFriend, setTagDialogFriend] = useState<Friend | null>(null)
  const { toast } = useToast() // moved to hooks per shadcn update

  // Filters & pagination
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [sort, setSort] = useState<'date_desc'|'date_asc'|'name_asc'>("date_desc")
  const [page, setPage] = useState(1)
  const pageSize = 50

  // Tags & scenarios
  const [tags, setTags] = useState<Array<{id:string; name:string}>>([])
  const [scenarios, setScenarios] = useState<Array<{id:string; name:string}>>([])
  const [selectedTag, setSelectedTag] = useState<string>("")
  const [selectedScenario, setSelectedScenario] = useState<string>("")
  const [friendTagMap, setFriendTagMap] = useState<Record<string, string[]>>({})
  const [friendScenarioMap, setFriendScenarioMap] = useState<Record<string, string[]>>({})

  // Bulk actions
  const [bulkScenarioId, setBulkScenarioId] = useState<string>("")
  const [bulkTagAddId, setBulkTagAddId] = useState<string>("")
  const [bulkTagRemoveId, setBulkTagRemoveId] = useState<string>("")

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailForms, setDetailForms] = useState<any[]>([])
  const [detailLogs, setDetailLogs] = useState<any[]>([])

  useEffect(() => {
    loadFriends()
    loadAux()
  }, [user.id])

  const loadFriends = async () => {
    try {
      const { data: dbData, error: dbError } = await supabase
        .from('line_friends')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });

      if (dbError) {
        console.error('Error loading friends from DB:', dbError);
      } else {
        setFriends(dbData || []);
        // build scenario map
        const ids = (dbData || []).map((f:any)=>f.id)
        if (ids.length) {
          const { data: tracks } = await supabase
            .from('step_delivery_tracking')
            .select('friend_id, scenario_id, status')
            .in('friend_id', ids)
            .neq('status','exited')
          const map: Record<string,string[]> = {}
          for (const t of (tracks||[]) as any[]) {
            const arr = map[t.friend_id] || []
            if (!arr.includes(t.scenario_id)) arr.push(t.scenario_id)
            map[t.friend_id] = arr
          }
          setFriendScenarioMap(map)
        }
        // build tag map
        if (ids.length) {
          const { data: fts } = await supabase
            .from('friend_tags')
            .select('friend_id, tag_id')
            .in('friend_id', ids)
          const tmap: Record<string,string[]> = {}
          for (const r of (fts||[]) as any[]) {
            const arr = tmap[r.friend_id] || []
            arr.push(r.tag_id)
            tmap[r.friend_id] = arr
          }
          setFriendTagMap(tmap)
        }
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  }

  const loadAux = async () => {
    const [{ data: tagRows }, { data: scenarioRows }] = await Promise.all([
      supabase.from('tags').select('id, name').eq('user_id', user.id).order('name', { ascending: true }),
      supabase.from('step_scenarios').select('id, name').eq('user_id', user.id).order('name', { ascending: true }),
    ])
    setTags((tagRows||[]) as any)
    setScenarios((scenarioRows||[]) as any)
  }

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (friends.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        まだ友達が追加されていません
      </div>
    )
  }

  if (selectedFriend) {
    return (
      <ChatWindow 
        user={user} 
        friend={selectedFriend} 
        onClose={() => setSelectedFriend(null)} 
      />
    )
  }

  const filteredFriends = friends.filter((f) => {
    const q = searchTerm.trim().toLowerCase()
    const withinSearch = !q || (f.display_name || '').toLowerCase().includes(q) || f.line_user_id.toLowerCase().includes(q)
    const withinFrom = !dateFrom || new Date(f.added_at) >= new Date(dateFrom)
    const withinTo = !dateTo || new Date(f.added_at) <= new Date(dateTo + 'T23:59:59')
    const tagOk = !selectedTag || (friendTagMap[f.id] || []).includes(selectedTag)
    const scenarioOk = !selectedScenario || (friendScenarioMap[f.id] || []).includes(selectedScenario)
    return withinSearch && withinFrom && withinTo && tagOk && scenarioOk
  }).sort((a,b) => {
    if (sort === 'date_desc') return new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
    if (sort === 'date_asc') return new Date(a.added_at).getTime() - new Date(b.added_at).getTime()
    return (a.display_name||'').localeCompare(b.display_name||'')
  })

  const totalPages = Math.max(1, Math.ceil(filteredFriends.length / pageSize))
  const pagedFriends = filteredFriends.slice((page-1)*pageSize, page*pageSize)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-3">
        {/* Left: controls (3/12) */}
        <aside className="col-span-12 md:col-span-3 space-y-3">
          <div className="p-3 border rounded-md space-y-3">
            <div className="space-y-2">
              <Label>キーワード</Label>
              <Input
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                placeholder="ユーザー名やIDで検索"
                className="h-9"
                aria-label="友だち検索"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>開始日</Label>
                <Input type="date" value={dateFrom} onChange={(e)=>{setDateFrom(e.target.value); setPage(1)}} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label>終了日</Label>
                <Input type="date" value={dateTo} onChange={(e)=>{setDateTo(e.target.value); setPage(1)}} className="h-9" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>タグで絞り込み</Label>
              <Select value={selectedTag} onValueChange={(v)=>{setSelectedTag(v); setPage(1)}}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="すべて" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">すべて</SelectItem>
                  {tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>シナリオで絞り込み</Label>
              <Select value={selectedScenario} onValueChange={(v)=>{setSelectedScenario(v); setPage(1)}}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="すべて" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">すべて</SelectItem>
                  {scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>並び順</Label>
                <Select value={sort} onValueChange={(v:any)=>{setSort(v); setPage(1)}}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">新しい順</SelectItem>
                    <SelectItem value="date_asc">古い順</SelectItem>
                    <SelectItem value="name_asc">名前順</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="secondary" className="w-full h-9" onClick={()=>{ setSearchTerm(''); setDateFrom(''); setDateTo(''); setSelectedTag(''); setSelectedScenario(''); setSort('date_desc'); setPage(1) }}>クリア</Button>
              </div>
            </div>
          </div>

          <div className="p-3 border rounded-md space-y-2">
            <Label>一括シナリオ操作（表示中のユーザーに適用）</Label>
            <div className="grid grid-cols-1 gap-2">
              <Select value={bulkScenarioId} onValueChange={setBulkScenarioId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="移動先シナリオを選択" /></SelectTrigger>
                <SelectContent>
                  {scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button className="w-full h-9" onClick={async ()=>{
                if (!bulkScenarioId) { toast({ title:'シナリオ未選択', description:'移動先シナリオを選択してください' }); return }
                if (!confirm(`現在の表示ユーザー ${filteredFriends.length} 名を選択シナリオに移動しますか？`)) return
                try {
                  const target = scenarios.find(s=>s.id===bulkScenarioId)
                  if (!target) return
                  for (const f of filteredFriends) {
                    await supabase.rpc('register_friend_with_scenario', { p_line_user_id: f.line_user_id, p_display_name: f.display_name, p_picture_url: f.picture_url, p_scenario_name: target.name })
                  }
                  toast({ title:'移動完了', description:`${filteredFriends.length}名を移動しました` })
                } catch (e:any) {
                  toast({ title:'移動失敗', description:e.message||'不明なエラー', variant:'destructive' })
                }
              }}>一斉移動</Button>
              <Button variant="destructive" className="w-full h-9" onClick={async ()=>{
                if (!bulkScenarioId) { toast({ title:'解除対象未選択', description:'解除するシナリオを選択してください' }); return }
                if (!confirm(`現在の表示ユーザー ${filteredFriends.length} 名をシナリオ解除しますか？`)) return
                try {
                  const ids = filteredFriends.map(f=>f.id)
                  await supabase
                    .from('step_delivery_tracking')
                    .update({ status:'exited', delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                    .eq('scenario_id', bulkScenarioId)
                    .in('friend_id', ids)
                  toast({ title:'解除完了', description:`${filteredFriends.length}名を解除しました` })
                } catch (e:any) {
                  toast({ title:'解除失敗', description:e.message||'不明なエラー', variant:'destructive' })
                }
              }}>一斉解除</Button>
            </div>
          </div>

          <div className="p-3 border rounded-md space-y-2">
            <Label>一括タグ操作（表示中のユーザーに適用）</Label>
            <Select value={bulkTagAddId} onValueChange={setBulkTagAddId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="付与するタグ" /></SelectTrigger>
              <SelectContent>
                {tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={bulkTagRemoveId} onValueChange={setBulkTagRemoveId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="解除するタグ" /></SelectTrigger>
              <SelectContent>
                {tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="w-full h-9" onClick={async ()=>{
              if (!confirm(`現在の表示ユーザー ${filteredFriends.length} 名にタグ操作を保存しますか？`)) return
              try {
                const ids = filteredFriends.map(f=>f.id)
                if (bulkTagAddId) {
                  // 既存を確認してから不足分のみ追加
                  const { data: existing } = await supabase
                    .from('friend_tags')
                    .select('friend_id')
                    .eq('user_id', user.id)
                    .eq('tag_id', bulkTagAddId)
                    .in('friend_id', ids)
                  const existingSet = new Set((existing||[]).map((r:any)=>r.friend_id))
                  const rowsToInsert = ids
                    .filter(fid => !existingSet.has(fid))
                    .map(fid => ({ user_id: user.id, friend_id: fid, tag_id: bulkTagAddId }))
                  if (rowsToInsert.length) {
                    await supabase.from('friend_tags').insert(rowsToInsert)
                  }
                }
                if (bulkTagRemoveId) {
                  await supabase.from('friend_tags').delete().in('friend_id', ids).eq('tag_id', bulkTagRemoveId)
                }
                toast({ title:'保存完了', description:'タグ操作を反映しました' })
                loadFriends()
              } catch (e:any) {
                toast({ title:'保存失敗', description:e.message||'不明なエラー', variant:'destructive' })
              }
            }}>保存</Button>
          </div>
        </aside>

        {/* Right: list (9/12) */}
        <section className="col-span-12 md:col-span-9 space-y-2">
          <div className="space-y-0 divide-y rounded-md border">
            {pagedFriends.map((friend) => (
              <div key={friend.line_user_id} className="hover:bg-muted/50 transition-colors">
                <div className="p-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={friend.picture_url || ""} alt={friend.display_name || ""} />
                      <AvatarFallback>
                        {friend.display_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button className="font-medium truncate text-left" onClick={async ()=>{
                          setSelectedFriend(friend)
                          setDetailOpen(true)
                          try {
                            const [{ data: forms }, { data: logs }] = await Promise.all([
                              supabase.from('form_submissions').select('id, submitted_at, data').eq('user_id', user.id).eq('friend_id', friend.id).order('submitted_at',{ascending:false}).limit(50),
                              supabase.from('scenario_friend_logs').select('added_at, scenario_id').eq('line_user_id', friend.line_user_id).order('added_at',{ascending:false}).limit(100)
                            ])
                            setDetailForms(forms||[])
                            setDetailLogs(logs||[])
                          } catch(e) { setDetailForms([]); setDetailLogs([]) }
                        }}>
                          {friend.display_name || "名前未設定"}
                        </button>
                        <Badge variant="secondary" className="text-xs">
                          {format(new Date(friend.added_at), "yyyy/MM/dd HH:mm")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        ID: {friend.line_user_id}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setTagDialogFriend(friend)} className="gap-1 h-8 px-2">
                        <TagIcon className="h-4 w-4" />
                        タグ
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setScenarioDialogFriend(friend)} className="gap-1 h-8 px-2">
                        <ListChecks className="h-4 w-4" />
                        シナリオ
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedFriend(friend)} className="gap-1 h-8 px-2">
                        <MessageCircle className="h-4 w-4" />
                        チャット
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between py-2">
            <div className="text-xs text-muted-foreground">{filteredFriends.length}件中 {(page-1)*pageSize+1} - {Math.min(page*pageSize, filteredFriends.length)} 件</div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={()=>setPage(Math.max(1,page-1))} disabled={page<=1}>前へ</Button>
              <div className="text-xs">{page} / {totalPages}</div>
              <Button variant="secondary" size="sm" onClick={()=>setPage(Math.min(totalPages,page+1))} disabled={page>=totalPages}>次へ</Button>
            </div>
          </div>
        </section>
      </div>

      {/* Existing dialogs */}
      {scenarioDialogFriend && (
        <FriendScenarioDialog
          open={!!scenarioDialogFriend}
          onOpenChange={(open) => { if (!open) setScenarioDialogFriend(null) }}
          user={user}
          friend={scenarioDialogFriend}
        />
      )}

      {tagDialogFriend && (
        <FriendTagDialog
          open={!!tagDialogFriend}
          onOpenChange={(open) => { if (!open) setTagDialogFriend(null) }}
          user={user}
          friend={{ id: tagDialogFriend.id, display_name: tagDialogFriend.display_name }}
        />
      )}

      {/* Friend details dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedFriend?.display_name || selectedFriend?.line_user_id}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
            <div>
              <h4 className="text-sm font-medium mb-2">フォーム回答</h4>
              <div className="space-y-2 text-xs">
                {detailForms.length === 0 && <div className="text-muted-foreground">履歴なし</div>}
                {detailForms.map((f:any)=> (
                  <div key={f.id} className="p-2 border rounded">
                    <div className="text-muted-foreground mb-1">{format(new Date(f.submitted_at), "yyyy/MM/dd HH:mm")}</div>
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(f.data, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">シナリオ遷移ログ</h4>
              <div className="space-y-2 text-xs">
                {detailLogs.length === 0 && <div className="text-muted-foreground">履歴なし</div>}
                {detailLogs.map((l:any, idx:number)=> (
                  <div key={idx} className="p-2 border rounded">
                    <div className="text-muted-foreground">{format(new Date(l.added_at), "yyyy/MM/dd HH:mm")}</div>
                    <div className="mt-1">scenario_id: {l.scenario_id}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}