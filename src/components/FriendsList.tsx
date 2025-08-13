import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { MessageCircle, Tag as TagIcon, ListChecks, Calendar as CalendarIcon } from "lucide-react"
import { format, startOfDay, endOfDay } from "date-fns"
import { ChatWindow } from "./ChatWindow"
import { Input } from "./ui/input"
import { useToast } from "@/hooks/use-toast"
import { FriendScenarioDialog } from "./FriendScenarioDialog"
import FriendTagDialog from "./FriendTagDialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Calendar } from "./ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"
interface Friend {
  id: string
  line_user_id: string
  display_name: string | null
  picture_url: string | null
  added_at: string
  short_uid?: string | null
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
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [sort, setSort] = useState<'date_desc'|'date_asc'|'name_asc'>("date_desc")
  const [page, setPage] = useState(1)
  const pageSize = 50

  // Tags & scenarios
  const [tags, setTags] = useState<Array<{id:string; name:string}>>([])
  const [scenarios, setScenarios] = useState<Array<{id:string; name:string}>>([])
  const [selectedTag, setSelectedTag] = useState<string>("all")
  const [selectedScenario, setSelectedScenario] = useState<string>("all")
  const [friendTagMap, setFriendTagMap] = useState<Record<string, string[]>>({})
  const [friendScenarioMap, setFriendScenarioMap] = useState<Record<string, string[]>>({})

  // Bulk actions
  const [bulkScenarioId, setBulkScenarioId] = useState<string>("")
  const [bulkTagAddId, setBulkTagAddId] = useState<string>("")
  const [bulkTagRemoveId, setBulkTagRemoveId] = useState<string>("")
  const [confirmMoveOpen, setConfirmMoveOpen] = useState(false)
  const [confirmRegisterOpen, setConfirmRegisterOpen] = useState(false)
  const [confirmUnenrollOpen, setConfirmUnenrollOpen] = useState(false)
  const [confirmTagOpen, setConfirmTagOpen] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailFriend, setDetailFriend] = useState<Friend | null>(null)
  const [detailForms, setDetailForms] = useState<any[]>([])
  const [detailLogs, setDetailLogs] = useState<any[]>([])

  // Followers/blocked
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set())

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
        // fetch current LINE followers to detect blocked/unfollowed
        try {
          const { data: followersData, error: followersError } = await supabase.functions.invoke('get-line-friends', { body: {} })
          if (!followersError && followersData?.friends) {
            const currentIds = new Set((followersData.friends as any[]).map((x:any)=>x.line_user_id))
            const dbLineIds = (dbData || []).map((f:any)=>f.line_user_id)
            const blocked = dbLineIds.filter((id:string)=>!currentIds.has(id))
            setBlockedSet(new Set(blocked))
          }
        } catch (e) {
          console.error('Error fetching LINE followers:', e)
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
    const d = new Date(f.added_at)
    const fromOk = !dateRange?.from || d >= startOfDay(dateRange.from)
    const toOk = !dateRange?.to || d <= endOfDay(dateRange.to)
    const tagOk = selectedTag === 'all' || (friendTagMap[f.id] || []).includes(selectedTag)
    const scenarioOk = selectedScenario === 'all' || (friendScenarioMap[f.id] || []).includes(selectedScenario)
    return withinSearch && fromOk && toOk && tagOk && scenarioOk
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
        <aside className="col-span-12 md:col-span-3 space-y-2">
          <Accordion type="multiple" className="space-y-2">
            <AccordionItem value="filters">
              <AccordionTrigger>絞り込み</AccordionTrigger>
              <AccordionContent>
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
                  <div className="space-y-1">
                    <Label>友だち追加期間</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full h-9 justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              `${format(dateRange.from, 'yyyy/MM/dd')} - ${format(dateRange.to, 'yyyy/MM/dd')}`
                            ) : (
                              `${format(dateRange.from, 'yyyy/MM/dd')} - `
                            )
                          ) : (
                            <span>期間を選択</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={(range)=>{ setDateRange(range); setPage(1) }}
                          numberOfMonths={2}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                          formatters={{
                            formatCaption: (date) => `${date.getFullYear()}年${date.getMonth() + 1}月`
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label>タグで絞り込み</Label>
                    <Select value={selectedTag} onValueChange={(v)=>{setSelectedTag(v); setPage(1)}}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="すべて" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
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
                        <SelectItem value="all">すべて</SelectItem>
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
                          <SelectItem value="date_desc">友だち追加の新しい順</SelectItem>
                          <SelectItem value="date_asc">友だち追加の古い順</SelectItem>
                          <SelectItem value="name_asc">名前順</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button variant="secondary" className="w-full h-9" onClick={()=>{ setSearchTerm(''); setDateRange(undefined); setSelectedTag('all'); setSelectedScenario('all'); setSort('date_desc'); setPage(1) }}>クリア</Button>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bulk-scenario">
              <AccordionTrigger>
                <div className="text-sm">
                  一括シナリオ操作
                  <span className="block text-xs text-muted-foreground">（表示中のユーザーに適用）</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-3 border rounded-md space-y-2">
              <div className="grid grid-cols-1 gap-2">
                <Select value={bulkScenarioId} onValueChange={setBulkScenarioId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="登録するシナリオを選択" /></SelectTrigger>
                  <SelectContent>
                    {scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                 <Button className="w-full h-9" onClick={async ()=>{
                   if (!bulkScenarioId) { toast({ title:'シナリオ未選択', description:'登録するシナリオを選択してください' }); return }
                   setConfirmRegisterOpen(true)
                 }}>一斉登録</Button>
                    <Button variant="destructive" className="w-full h-9" onClick={async ()=>{
                      if (!bulkScenarioId) { toast({ title:'解除対象未選択', description:'解除するシナリオを選択してください' }); return }
                      setConfirmUnenrollOpen(true)
                    }}>一斉解除</Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bulk-tag">
              <AccordionTrigger>
                <div className="text-sm">
                  一括タグ操作
                  <span className="block text-xs text-muted-foreground">（表示中のユーザーに適用）</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-3 border rounded-md space-y-2">
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
                    setConfirmTagOpen(true)
                  }}>保存</Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>

        {/* Right: list (9/12) */}
        <section className="col-span-12 md:col-span-9 space-y-2">
          <div className="space-y-0 divide-y rounded-md border">
            {pagedFriends.map((friend) => (
              <div key={friend.line_user_id} className="hover:bg-muted/50 transition-colors">
                <div 
                  className="p-1 cursor-pointer"
                  onClick={async ()=>{
                    setDetailFriend(friend)
                    setDetailOpen(true)
                    try {
                      const [{ data: forms }, { data: logs }, { data: exitLogs }] = await Promise.all([
                        supabase.from('form_submissions').select('id, submitted_at, data').eq('user_id', user.id).eq('friend_id', friend.id).order('submitted_at',{ascending:false}).limit(50),
                        supabase.from('scenario_friend_logs').select('added_at, scenario_id').eq('line_user_id', friend.line_user_id).order('added_at',{ascending:false}).limit(100),
                        supabase.from('step_delivery_tracking').select('updated_at, scenario_id, status').eq('friend_id', friend.id).eq('status','exited').order('updated_at',{ascending:false}).limit(100)
                      ])
                      setDetailForms(forms||[])
                      const combined = [
                        ...((logs||[]).map((l:any)=>({ type:'registered', date:l.added_at, scenario_id:l.scenario_id }))),
                        ...((exitLogs||[]).map((l:any)=>({ type:'exited', date:l.updated_at, scenario_id:l.scenario_id }))),
                      ].sort((a:any,b:any)=> new Date(b.date).getTime() - new Date(a.date).getTime())
                      setDetailLogs(combined)
                    } catch(e) { setDetailForms([]); setDetailLogs([]) }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={friend.picture_url || ""} alt={friend.display_name || ""} />
                      <AvatarFallback>
                        {friend.display_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {friend.display_name || "名前未設定"}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {format(new Date(friend.added_at), "yyyy/MM/dd HH:mm")}
                        </Badge>
                        {blockedSet.has(friend.line_user_id) && (
                          <Badge variant="destructive" className="text-xs">ブロック中</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p className="font-mono font-bold text-primary">
                          User ID: {friend.short_uid || '生成中...'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
            <DialogTitle>{detailFriend?.display_name || detailFriend?.line_user_id}</DialogTitle>
            <DialogDescription>フォーム回答やシナリオ履歴を確認できます。</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
            <div>
              <h4 className="text-sm font-medium mb-2">フォーム回答</h4>
              <div className="space-y-2 text-xs">
                {detailForms.length === 0 && <div className="text-muted-foreground">履歴なし</div>}
                {detailForms.length > 0 && (
                  <Accordion type="single" collapsible className="w-full">
                    {detailForms.map((f:any)=> (
                      <AccordionItem key={f.id} value={f.id}>
                        <AccordionTrigger className="text-xs">
                          {format(new Date(f.submitted_at), "yyyy/MM/dd HH:mm")}
                        </AccordionTrigger>
                        <AccordionContent>
                          <pre className="whitespace-pre-wrap break-words">{JSON.stringify(f.data, null, 2)}</pre>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">シナリオ遷移ログ</h4>
              <div className="space-y-2 text-xs">
                {detailLogs.length === 0 && <div className="text-muted-foreground">履歴なし</div>}
                {detailLogs.map((l:any, idx:number)=> {
                  const scenarioName = scenarios.find(s => s.id === l.scenario_id)?.name || 'Unknown'
                  return (
                    <div key={idx} className="p-2 border rounded">
                      <div className="text-muted-foreground">{format(new Date(l.date), "yyyy/MM/dd HH:mm")}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge 
                          className={cn(
                            "text-white text-xs rounded",
                            l.type === 'registered' 
                              ? "bg-[rgb(12,179,134)]" 
                              : "bg-red-500"
                          )}
                        >
                          {l.type === 'registered' ? '登録' : '解除'}
                        </Badge>
                        <span>{scenarioName}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm dialogs */}
      <AlertDialog open={confirmRegisterOpen} onOpenChange={setConfirmRegisterOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>一斉登録の確認</AlertDialogTitle>
            <AlertDialogDescription>
              現在の表示ユーザー {filteredFriends.length} 名を選択シナリオに登録しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={async ()=>{
              try {
                const target = scenarios.find(s=>s.id===bulkScenarioId)
                if (!target) {
                  toast({ title:'エラー', description:'シナリオが見つかりません', variant:'destructive' })
                  return
                }
                
                let successCount = 0;
                let errorCount = 0;
                
                // Register each friend to the scenario using RPC function
                for (const f of filteredFriends) {
                  try {
                    console.log('Registering friend:', f.line_user_id, 'to scenario:', target.name)
                    
                    const result = await supabase.rpc('register_friend_with_scenario', { 
                      p_line_user_id: f.line_user_id, 
                      p_display_name: f.display_name, 
                      p_picture_url: f.picture_url, 
                      p_scenario_name: target.name 
                    })
                    
                    console.log('Registration result:', result)
                    
                    if (result.error) {
                      console.error('Registration failed for friend:', f.line_user_id, result.error)
                      errorCount++;
                    } else {
                      successCount++;
                    }
                  } catch (e: any) {
                    console.error('Registration error for friend:', f.line_user_id, e)
                    errorCount++;
                  }
                }
                
                if (successCount > 0) {
                  toast({ title:'登録完了', description:`${successCount}名を登録しました${errorCount > 0 ? ` (${errorCount}名でエラー)` : ''}` })
                } else {
                  toast({ title:'登録失敗', description:'登録できませんでした', variant:'destructive' })
                }
                
                loadFriends() // Reload to update scenario mappings
              } catch (e:any) {
                console.error('Bulk registration error:', e)
                toast({ title:'登録失敗', description:e.message||'不明なエラー', variant:'destructive' })
              } finally { 
                setConfirmRegisterOpen(false) 
              }
            }}>実行</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmUnenrollOpen} onOpenChange={setConfirmUnenrollOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>一斉解除の確認</AlertDialogTitle>
            <AlertDialogDescription>
              現在の表示ユーザー {filteredFriends.length} 名をシナリオ解除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={async ()=>{
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
              } finally { setConfirmUnenrollOpen(false) }
            }}>実行</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmTagOpen} onOpenChange={setConfirmTagOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>タグ操作の確認</AlertDialogTitle>
            <AlertDialogDescription>
              現在の表示ユーザー {filteredFriends.length} 名にタグ操作を保存しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={async ()=>{
              try {
                const ids = filteredFriends.map(f=>f.id)
                if (bulkTagAddId) {
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
              } finally { setConfirmTagOpen(false) }
            }}>実行</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}