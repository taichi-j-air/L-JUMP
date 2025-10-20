import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { MessageCircle, Tag as TagIcon, ListChecks, Calendar as CalendarIcon, MenuSquare, Ban } from "lucide-react"
import { format, startOfDay, endOfDay } from "date-fns"
import { ChatWindow } from "./ChatWindow"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { useToast } from "@/hooks/use-toast"
import { FriendScenarioDialog } from "./FriendScenarioDialog"
import FriendTagDialog from "./FriendTagDialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Calendar } from "./ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"
import { SetUserRichMenuDialog } from "./SetUserRichMenuDialog"

interface Friend {
  id: string
  line_user_id: string
  display_name: string | null
  picture_url: string | null
  added_at: string
  updated_at: string
  is_blocked: boolean
  blocked_at?: string | null
  short_uid?: string | null
  total_payment_amount?: number | null
}

interface PaymentHistoryEntry {
  id: string
  created_at: string
  amount: number
  currency: string
  status: string
  productLabel: string
  livemode: boolean | null
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
  const [richMenuDialogFriend, setRichMenuDialogFriend] = useState<Friend | null>(null)
  const { toast } = useToast()

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [sort, setSort] = useState<'date_desc'|'date_asc'|'name_asc'>("date_desc")
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [tags, setTags] = useState<Array<{id:string; name:string}>>([])
  const [scenarios, setScenarios] = useState<Array<{id:string; name:string}>>([])
  const [selectedTag, setSelectedTag] = useState<string>("all")
  const [selectedScenario, setSelectedScenario] = useState<string>("all")
  const [friendTagMap, setFriendTagMap] = useState<Record<string, string[]>>({})
  const [friendScenarioMap, setFriendScenarioMap] = useState<Record<string, string[]>>({})
  const [blockTagId, setBlockTagId] = useState<string | null>(null)
  const [bulkScenarioId, setBulkScenarioId] = useState<string>("")
  const [bulkTagAddId, setBulkTagAddId] = useState<string>("")
  const [bulkTagRemoveId, setBulkTagRemoveId] = useState<string>("")
  const [confirmRegisterOpen, setConfirmRegisterOpen] = useState(false)
  const [confirmUnenrollOpen, setConfirmUnenrollOpen] = useState(false)
  const [confirmTagOpen, setConfirmTagOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailFriend, setDetailFriend] = useState<Friend | null>(null)
  const [detailForms, setDetailForms] = useState<any[]>([])
  const [detailLogs, setDetailLogs] = useState<any[]>([])
  const [detailPayments, setDetailPayments] = useState<PaymentHistoryEntry[]>([])
  const [detailPaymentTotals, setDetailPaymentTotals] = useState<Record<string, number>>({})
  const [detailRichMenuName, setDetailRichMenuName] = useState<string | null>(null)

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-"
    try {
      return format(new Date(value), "yyyy/MM/dd HH:mm")
    } catch {
      return value
    }
  }

  const addedAtText = detailFriend ? formatDateTime(detailFriend.added_at) : "-"
  const blockedStatusText = detailFriend
    ? detailFriend.is_blocked
      ? formatDateTime(detailFriend.updated_at)
      : "ブロックなし"
    : "-"

  const copyText = (value: string | null | undefined, label: string) => {
    if (!value) return
    navigator.clipboard.writeText(value)
    toast({ title: `${label} をコピーしました`, description: value })
  }

  const normalizeAmount = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return 0
    if (typeof value === "string") {
      const parsed = parseFloat(value)
      return Number.isNaN(parsed) ? 0 : parsed
    }
    return value
  }

  const formatCurrencyDisplay = (amount: number, currency?: string | null) => {
    const upperCurrency = (currency || "JPY").toUpperCase()
    if (upperCurrency === "JPY") {
      return `¥${amount.toLocaleString()}`
    }
    const normalized = amount / 100
    return `${upperCurrency} ${normalized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const detailTagNames = useMemo(() => {
    if (!detailFriend) return []
    const tagIds = friendTagMap[detailFriend.id] || []
    if (tagIds.length === 0) return []
    const tagLookup = new Map(tags.map((tag) => [tag.id, tag.name]))
    return tagIds.map((id) => tagLookup.get(id)).filter((name): name is string => Boolean(name))
  }, [detailFriend, friendTagMap, tags])
  const shortUidValue = detailFriend?.short_uid || ""
  const hasShortUid = Boolean(shortUidValue)
  const displayNameValue = (detailFriend?.display_name || "").trim()
  const hasDisplayName = displayNameValue.length > 0

  useEffect(() => {
    loadFriends()
    loadAux()
  }, [user.id])

  const loadFriends = async () => {
    try {
      const { data: dbData, error: dbError } = await supabase
        .from("line_friends")
        .select("*")
        .eq("user_id", user.id)
        .order("added_at", { ascending: false });

      if (dbError) {
        console.error("Error loading friends from DB:", dbError);
        return;
      }

      const friendRows = dbData || [];
      setFriends(friendRows);

      const friendIds = friendRows.map((f: any) => f.id);

      if (friendIds.length > 0) {
        const [
          { data: trackingRows, error: trackingError },
          { data: scenarioLogRows, error: scenarioLogError },
          { data: tagRows, error: tagError },
        ] = await Promise.all([
          supabase
            .from("step_delivery_tracking")
            .select(`
              friend_id,
              scenario_id,
              status,
              step_scenarios!step_delivery_tracking_scenario_id_fkey(prevent_auto_exit)
            `)
            .in("friend_id", friendIds)
            .neq("status", "exited"),
          supabase
            .from("scenario_friend_logs")
            .select("friend_id, scenario_id, exited_at")
            .in("friend_id", friendIds)
            .is("exited_at", null),
          supabase
            .from("friend_tags")
            .select("friend_id, tag_id")
            .in("friend_id", friendIds),
        ]);

        if (trackingError) {
          console.error("Error loading step tracking:", trackingError);
        }
        if (scenarioLogError) {
          console.error("Error loading scenario logs:", scenarioLogError);
        }
        if (tagError) {
          console.error("Error loading friend tags:", tagError);
        }

        const scenarioSetMap = new Map<string, Set<string>>();

        const addScenario = (friendId?: string | null, scenarioId?: string | null) => {
          if (!friendId || !scenarioId) return;
          const set = scenarioSetMap.get(friendId) ?? new Set<string>();
          set.add(scenarioId);
          scenarioSetMap.set(friendId, set);
        };

        for (const track of (trackingRows || []) as any[]) {
          addScenario(track.friend_id as string | null, track.scenario_id as string | null);

        }

        for (const log of (scenarioLogRows || []) as any[]) {
          addScenario(log.friend_id as string | null, log.scenario_id as string | null);
        }

        const scenarioMap: Record<string, string[]> = {};
        scenarioSetMap.forEach((value, key) => {
          scenarioMap[key] = Array.from(value);
        });
        setFriendScenarioMap(scenarioMap);

        const tagMap: Record<string, string[]> = {};
        for (const row of (tagRows || []) as any[]) {
          const friendId = row.friend_id as string | null;
          const tagId = row.tag_id as string | null;
          if (!friendId || !tagId) continue;
          if (!tagMap[friendId]) {
            tagMap[friendId] = [];
          }
          tagMap[friendId].push(tagId);
        }
        setFriendTagMap(tagMap);
      } else {
        setFriendScenarioMap({});
        setFriendTagMap({});
      }

      
    } catch (error) {
      console.error("Error loading friends:", error);
    } finally {
      setLoading(false);
    }
  };
  const loadAux = async () => { const [{ data: tagRows }, { data: scenarioRows }] = await Promise.all([ supabase.from('tags').select('id, name').eq('user_id', user.id).order('name', { ascending: true }), supabase.from('step_scenarios').select('id, name').eq('user_id', user.id).order('name', { ascending: true }), ]); setTags((tagRows||[]) as any); setScenarios((scenarioRows||[]) as any); const blockTag = (tagRows || []).find((t) => t.name === "ブロック"); if (blockTag) { setBlockTagId(blockTag.id); } };
  const toggleBlockTag = async (friend: Friend) => { if (!blockTagId) { toast({ title: "エラー", description: "「ブロック」タグが見つかりません。", variant: "destructive" }); return; } const isBlocked = (friendTagMap[friend.id] || []).includes(blockTagId); try { if (isBlocked) { const { error } = await supabase.from("friend_tags").delete().eq("friend_id", friend.id).eq("tag_id", blockTagId); if (error) throw error; setFriendTagMap((prev) => { const newMap = { ...prev }; newMap[friend.id] = (newMap[friend.id] || []).filter((tId) => tId !== blockTagId); return newMap; }); toast({ title: "ブロック解除しました" }); } else { const { error } = await supabase.from("friend_tags").insert({ user_id: user.id, friend_id: friend.id, tag_id: blockTagId, }); if (error) throw error; setFriendTagMap((prev) => { const newMap = { ...prev }; if (!newMap[friend.id]) { newMap[friend.id] = []; } newMap[friend.id].push(blockTagId); return newMap; }); toast({ title: "ブロックしました" }); } window.dispatchEvent(new CustomEvent("refreshFriendTags")); } catch (error: any) { console.error("Error toggling block tag:", error); toast({ title: "操作に失敗しました", description: error.message, variant: "destructive" }); } };

  if (loading) return <div className="p-4">読み込み中...</div>;
  if (friends.length === 0) return <div className="p-4 text-center text-muted-foreground">まだ友達が追加されていません</div>;
  if (selectedFriend) return <ChatWindow user={user} friend={selectedFriend} onClose={() => setSelectedFriend(null)} />;

  const filteredFriends = friends
    .filter((friend) => {
      const query = searchTerm.trim().toLowerCase();
      const searchTargets = [
        (friend.display_name || "").toLowerCase(),
        friend.line_user_id.toLowerCase(),
        (friend.short_uid || "").toLowerCase(),
        friend.id.toLowerCase(),
      ];
      const matchesSearch = !query || searchTargets.some((value) => value.includes(query));

      const addedAt = new Date(friend.added_at);
      const isAfterFrom = !dateRange?.from || addedAt >= startOfDay(dateRange.from);
      const isBeforeTo = !dateRange?.to || addedAt <= endOfDay(dateRange.to);

      const tagMatches = selectedTag === "all" || (friendTagMap[friend.id] || []).includes(selectedTag);

      const activeScenarios = friendScenarioMap[friend.id] || [];
      const scenarioMatches = selectedScenario === "all" || activeScenarios.includes(selectedScenario);

      return matchesSearch && isAfterFrom && isBeforeTo && tagMatches && scenarioMatches;
    })
    .sort((a, b) => {
      if (sort === "date_desc") return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
      if (sort === "date_asc") return new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
      return (a.display_name || "").localeCompare(b.display_name || "");
    });
  const totalPages = Math.max(1, Math.ceil(filteredFriends.length / pageSize));
  const pagedFriends = filteredFriends.slice((page-1)*pageSize, page*pageSize);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-3">
        <aside className="col-span-12 md:col-span-3 space-y-2">
          <Accordion type="multiple" className="space-y-2">
            <AccordionItem value="filters"><AccordionTrigger>絞り込み</AccordionTrigger><AccordionContent><div className="p-3 border rounded-md space-y-3"><div className="space-y-2"><Label>キーワード</Label><Input value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }} placeholder="ユーザー名やIDで検索" className="h-9" aria-label="友だち検索" /></div><div className="space-y-1"><Label>友だち追加期間</Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal", !dateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? (`${format(dateRange.from, 'yyyy/MM/dd')} - ${format(dateRange.to, 'yyyy/MM/dd')}`) : (`${format(dateRange.from, 'yyyy/MM/dd')} - `)) : (<span>期間を選択</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={dateRange} onSelect={(range)=>{ setDateRange(range); setPage(1) }} numberOfMonths={2} initialFocus className={cn("p-3 pointer-events-auto")} formatters={{ formatCaption: (date) => `${date.getFullYear()}年${date.getMonth() + 1}月` }} /></PopoverContent></Popover></div><div className="space-y-1"><Label>タグで絞り込み</Label><Select value={selectedTag} onValueChange={(v)=>{setSelectedTag(v); setPage(1)}}><SelectTrigger className="h-9"><SelectValue placeholder="すべて" /></SelectTrigger><SelectContent><SelectItem value="all">すべて</SelectItem>{tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>シナリオで絞り込み</Label><Select value={selectedScenario} onValueChange={(v)=>{setSelectedScenario(v); setPage(1)}}><SelectTrigger className="h-9"><SelectValue placeholder="すべて" /></SelectTrigger><SelectContent><SelectItem value="all">すべて</SelectItem>{scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>並び順</Label><Select value={sort} onValueChange={(v:any)=>{setSort(v); setPage(1)}}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date_desc">友だち追加の新しい順</SelectItem><SelectItem value="date_asc">友だち追加の古い順</SelectItem><SelectItem value="name_asc">名前順</SelectItem></SelectContent></Select></div><div className="flex items-end"><Button variant="secondary" className="w-full h-9" onClick={()=>{ setSearchTerm(''); setDateRange(undefined); setSelectedTag('all'); setSelectedScenario('all'); setSort('date_desc'); setPage(1) }}>クリア</Button></div></div></div></AccordionContent></AccordionItem>
            <AccordionItem value="bulk-scenario"><AccordionTrigger><div className="text-sm">一括シナリオ操作<span className="block text-xs text-muted-foreground">（表示中のユーザーに適用）</span></div></AccordionTrigger><AccordionContent><div className="p-3 border rounded-md space-y-2"><div className="grid grid-cols-1 gap-2"><Select value={bulkScenarioId} onValueChange={setBulkScenarioId}><SelectTrigger className="h-9"><SelectValue placeholder="登録/解除するシナリオを選択" /></SelectTrigger><SelectContent>{scenarios.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><Button className="w-full h-9" onClick={async ()=>{
                   if (!bulkScenarioId) { toast({ title:'シナリオ未選択', description:'登録するシナリオを選択してください' }); return }
                   setConfirmRegisterOpen(true)
                 }}>一斉登録</Button><Button variant="destructive" className="w-full h-9" onClick={async ()=>{
                      if (!bulkScenarioId) { toast({ title:'解除対象未選択', description:'解除するシナリオを選択してください' }); return }
                      setConfirmUnenrollOpen(true)
                    }}>一斉解除</Button></div></div></AccordionContent></AccordionItem>
            <AccordionItem value="bulk-tag"><AccordionTrigger><div className="text-sm">一括タグ操作<span className="block text-xs text-muted-foreground">（表示中のユーザーに適用）</span></div></AccordionTrigger><AccordionContent><div className="p-3 border rounded-md space-y-4"><div className="space-y-1"><Label>付与するタグ</Label><Select value={bulkTagAddId} onValueChange={setBulkTagAddId}><SelectTrigger className="h-9"><SelectValue placeholder="付与するタグ" /></SelectTrigger><SelectContent>{tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>解除するタグ</Label><Select value={bulkTagRemoveId} onValueChange={setBulkTagRemoveId}><SelectTrigger className="h-9"><SelectValue placeholder="解除するタグ" /></SelectTrigger><SelectContent>{tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div><Button className="w-full h-9" onClick={async ()=>{
                    setConfirmTagOpen(true)
                  }}>保存</Button></div></AccordionContent></AccordionItem>
          </Accordion>
        </aside>

        <section className="col-span-12 md:col-span-9 space-y-2">
          <div className="space-y-0 divide-y rounded-md border">
            {pagedFriends.map((friend) => (
              <div key={friend.line_user_id} className="hover:bg-muted/50 transition-colors">
                <div 
                  className="p-1 cursor-pointer"
                  onClick={async ()=>{
                    setDetailFriend(friend)
                    setDetailOpen(true)
                    setDetailForms([])
                    setDetailLogs([])
                    setDetailPayments([])
                    setDetailPaymentTotals({})
                    setDetailRichMenuName(null)
                    try {
                      const friendUidVariants = Array.from(
                        new Set(
                          [friend.short_uid, friend.short_uid?.toUpperCase(), friend.short_uid?.toLowerCase()].filter(
                            (value): value is string => Boolean(value)
                          )
                        )
                      )

                      const paymentsPromise = friendUidVariants.length > 0
                        ? (() => {
                            let query = supabase
                              .from('orders')
                              .select('id, amount, currency, status, created_at, product_id, metadata, livemode, friend_uid')
                              .eq('user_id', user.id)
                              .order('created_at', { ascending: false })
                              .limit(50)
                            if (friendUidVariants.length === 1) {
                              query = query.eq('friend_uid', friendUidVariants[0])
                            } else {
                              query = query.or(friendUidVariants.map((uid) => `friend_uid.eq.${uid}`).join(','))
                            }
                            return query
                          })()
                        : Promise.resolve({ data: [], error: null } as { data: any[]; error: any })

                      const [
                        formsResult,
                        logsResult,
                        exitLogsResult,
                        paymentsResult
                      ] = await Promise.all([
                        supabase
                          .from('form_submissions')
                          .select(`
                            id, submitted_at, data, form_id,
                            forms(name, fields)
                          `)
                          .eq('user_id', user.id)
                          .eq('friend_id', friend.id)
                          .order('submitted_at', { ascending: false })
                          .limit(50),
                        supabase
                          .from('scenario_friend_logs')
                          .select('added_at, scenario_id')
                          .eq('line_user_id', friend.line_user_id)
                          .order('added_at', { ascending: false })
                          .limit(100),
                        supabase
                          .from('step_delivery_tracking')
                          .select('updated_at, scenario_id, status')
                          .eq('friend_id', friend.id)
                          .eq('status', 'exited')
                          .order('updated_at', { ascending: false })
                          .limit(100),
                        paymentsPromise
                      ])

                      if (formsResult.error) {
                        console.error('Error loading form submissions:', formsResult.error)
                        setDetailForms([])
                      } else {
                        setDetailForms(formsResult.data || [])
                      }

                      if (logsResult.error) {
                        console.error('Error loading scenario logs:', logsResult.error)
                      }
                      if (exitLogsResult.error) {
                        console.error('Error loading exit logs:', exitLogsResult.error)
                      }

                      const registeredEntries = (logsResult.data || [])
                        .map((l: any) => ({
                          type: 'registered' as const,
                          date: l.added_at,
                          scenario_id: l.scenario_id
                        }))
                        .filter((entry) => Boolean(entry.date) && Boolean(entry.scenario_id))

                      const exitEntriesMap = new Map<string, { type: 'exited'; date: string; scenario_id: string }>()
                      for (const log of exitLogsResult.data || []) {
                        if (!log?.scenario_id || !log?.updated_at) continue
                        const existing = exitEntriesMap.get(log.scenario_id)
                        if (!existing || new Date(log.updated_at).getTime() > new Date(existing.date).getTime()) {
                          exitEntriesMap.set(log.scenario_id, {
                            type: 'exited',
                            date: log.updated_at,
                            scenario_id: log.scenario_id
                          })
                        }
                      }
                      const exitEntries = Array.from(exitEntriesMap.values())

                      const combinedLogs = [...registeredEntries, ...exitEntries].sort(
                        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                      )
                      setDetailLogs(combinedLogs)

                      if (paymentsResult.error) {
                        console.error('Error loading payment history:', paymentsResult.error)
                        setDetailPayments([])
                        setDetailPaymentTotals({})
                      } else {
                        const rawPayments = (paymentsResult.data || []) as any[]
                        if (rawPayments.length > 0) {
                          const productIds = Array.from(
                            new Set(
                              rawPayments
                                .map((payment) => payment.product_id)
                                .filter((id: string | null | undefined): id is string => Boolean(id))
                            )
                          )
                          let productNameMap: Record<string, string> = {}
                          if (productIds.length > 0) {
                            const { data: productRows, error: productError } = await supabase
                              .from('products')
                              .select('id, name')
                              .in('id', productIds)
                              .eq('user_id', user.id)
                            if (productError) {
                              console.error('Error loading product names for payments:', productError)
                            } else if (productRows) {
                              productNameMap = productRows.reduce((acc: Record<string, string>, product: any) => {
                                acc[product.id] = product.name
                                return acc
                              }, {})
                            }
                          }

                          const payments: PaymentHistoryEntry[] = rawPayments.map((payment) => {
                            const amountNumber = normalizeAmount(payment.amount)
                            const currency = (payment.currency || 'JPY').toString().toUpperCase()
                            const metadataProductName = typeof payment.metadata === 'object' && payment.metadata
                              ? (payment.metadata as any).product_name
                              : undefined
                            const productLabel =
                              productNameMap[payment.product_id ?? ''] ||
                              metadataProductName ||
                              '不明な商品'
                            return {
                              id: payment.id,
                              created_at: payment.created_at,
                              amount: amountNumber,
                              currency,
                              status: payment.status || '',
                              productLabel,
                              livemode: payment.livemode ?? null
                            }
                          })

                          setDetailPayments(payments)

                          const totals = payments
                            .filter((entry) => entry.status === 'paid')
                            .reduce((acc: Record<string, number>, entry) => {
                              acc[entry.currency] = (acc[entry.currency] ?? 0) + entry.amount
                              return acc
                            }, {})

                          if (Object.keys(totals).length === 0) {
                            const fallbackTotal = normalizeAmount(friend.total_payment_amount)
                            if (fallbackTotal > 0) {
                              totals['JPY'] = fallbackTotal
                            }
                          }

                          setDetailPaymentTotals(totals)
                        } else {
                          setDetailPayments([])
                          const fallbackTotal = normalizeAmount(friend.total_payment_amount)
                          setDetailPaymentTotals(fallbackTotal > 0 ? { JPY: fallbackTotal } : {})
                        }
                      }

                      if (friend.line_user_id) {
                        try {
                          const { data: currentMenuData, error: currentMenuError } = await supabase.functions.invoke('get-user-rich-menu', {
                            body: { userId: friend.line_user_id }
                          })
                          if (currentMenuError) {
                            const status = currentMenuError?.context?.status ?? currentMenuError?.status
                            if (status && Number(status) === 404) {
                              setDetailRichMenuName(null)
                            } else {
                              console.error('Error fetching current rich menu:', currentMenuError)
                            }
                          } else if (currentMenuData) {
                            const menuId = currentMenuData.richMenuId || currentMenuData.menuId || null
                            if (menuId) {
                              const { data: menuRecord, error: menuError } = await supabase
                                .from('rich_menus')
                                .select('name')
                                .eq('id', menuId)
                                .eq('user_id', user.id)
                                .maybeSingle()
                              if (menuError) {
                                console.error('Error loading rich menu name:', menuError)
                                setDetailRichMenuName(menuId)
                              } else {
                                setDetailRichMenuName(menuRecord?.name || menuId)
                              }
                            } else {
                              setDetailRichMenuName(null)
                            }
                          }
                        } catch (richMenuError) {
                          console.error('Unexpected error loading rich menu:', richMenuError)
                        }
                      }
                    } catch(e) {
                      console.error('Error loading friend detail:', e)
                      setDetailForms([])
                      setDetailLogs([])
                      setDetailPayments([])
                      setDetailPaymentTotals({})
                      setDetailRichMenuName(null)
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={friend.picture_url || ""} alt={friend.display_name || ""} />
                        <AvatarFallback>
                          {friend.display_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      {friend.is_blocked && (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                <Ban className="h-5 w-5 text-red-500" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs text-muted-foreground">このユーザーはあなたをブロックしています</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          className="font-medium truncate mr-2 hover:bg-primary/20 rounded"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(friend.display_name || '')
                            toast({ title: `名前 ${friend.display_name || ''} をコピーしました` })
                          }}
                        >
                          {friend.display_name || "名前未設定"}
                        </button>
                        <span className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-xs text-gray-500">友達追加日時：</span>
                          <Badge variant="secondary" className="text-xs">
                            {format(new Date(friend.added_at), "yyyy/MM/dd HH:mm")}
                          </Badge>
                          {friend.is_blocked && (
                            <>
                              <span className="text-xs text-gray-500">ブロック日時：</span>
                              <Badge variant="destructive" className="text-xs">
                                {format(new Date(friend.updated_at), "yyyy/MM/dd HH:mm")}
                              </Badge>
                            </>
                          )}
                        </span>
                        
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p className="font-mono font-bold">
                          <span className="text-gray-500">UID: </span>
                          <button 
                            className="ml-1 px-1 hover:bg-primary/20 rounded text-primary"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(friend.short_uid || '')
                              toast({ title: `UID ${friend.short_uid} をコピーしました` })
                            }}
                          >
                            {friend.short_uid || '生成中...'}
                          </button>
                        </p>
                      </div>
                    </div>

                    <TooltipProvider delayDuration={0}>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              aria-label="リッチメニュー"
                              onClick={() => setRichMenuDialogFriend(friend)}
                            >
                              <MenuSquare className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>メニュー</TooltipContent>
                        </Tooltip>
                        {blockTagId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={cn(
                                  "h-8 w-8 p-0",
                                  (friendTagMap[friend.id] || []).includes(blockTagId) ? "text-destructive" : ""
                                )}
                                aria-label={(friendTagMap[friend.id] || []).includes(blockTagId) ? "ブロック解除" : "ブロック"}
                                onClick={() => toggleBlockTag(friend)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {(friendTagMap[friend.id] || []).includes(blockTagId) ? "ブロック解除" : "ブロック"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              aria-label="タグ"
                              onClick={() => setTagDialogFriend(friend)}
                            >
                              <TagIcon className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>タグ</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              aria-label="シナリオ"
                              onClick={() => setScenarioDialogFriend(friend)}
                            >
                              <ListChecks className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>シナリオ</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              aria-label="チャット"
                              onClick={() => setSelectedFriend(friend)}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>チャット</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
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

      {richMenuDialogFriend && (
        <SetUserRichMenuDialog
          user={user}
          friend={richMenuDialogFriend}
          open={!!richMenuDialogFriend}
          onOpenChange={(open) => { if (!open) setRichMenuDialogFriend(null) }}
        />
      )}

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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>
              プロフィール情報
            </DialogTitle>
            <DialogDescription>プロフィール情報と関連履歴を確認できます。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <div className="flex flex-col items-center gap-2 md:col-span-1">
                <Avatar className="h-28 w-28 border shadow-sm">
                  <AvatarImage src={detailFriend?.picture_url || ""} alt={detailFriend?.display_name || ""} />
                  <AvatarFallback className="text-2xl">
                    {detailFriend?.display_name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="grid gap-3 text-sm md:col-span-2 lg:col-span-3">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">UID</div>
                    {hasShortUid ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-base font-semibold text-primary transition-colors hover:text-primary/80 focus:outline-none"
                        onClick={() => copyText(shortUidValue, "UID")}
                      >
                        {shortUidValue}
                      </button>
                    ) : (
                      <div className="text-sm text-muted-foreground">未設定</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">名前</div>
                    {hasDisplayName ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 font-semibold text-primary transition-colors hover:text-primary/80 focus:outline-none"
                        onClick={() => copyText(displayNameValue, "名前")}
                      >
                        {displayNameValue}
                      </button>
                    ) : (
                      <div className="text-sm text-muted-foreground">未設定</div>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">友だち追加日時</div>
                    <div>{addedAtText}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">ブロック日時</div>
                    <div>{detailFriend?.is_blocked ? blockedStatusText : "ブロックなし"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="border rounded-md p-3 space-y-2">
                <div className="text-sm font-medium">累計決済金額</div>
                <div className="space-y-1.5 text-sm">
                  {Object.entries(detailPaymentTotals).length > 0 ? (
                    Object.entries(detailPaymentTotals).map(([currency, total]) => (
                      <div key={currency} className="flex items-center justify-between rounded bg-muted px-2 py-1">
                        <span className="text-xs text-muted-foreground">{currency.toUpperCase()}</span>
                        <span className="font-semibold">{formatCurrencyDisplay(total, currency)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground">決済データなし</div>
                  )}
                </div>
              </div>
              <div className="border rounded-md p-3 space-y-2">
                <div className="text-sm font-medium">現在のリッチメニュー</div>
                <div className="text-sm">
                  {detailRichMenuName ? (
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => copyText(detailRichMenuName, "リッチメニュー")}
                    >
                      {detailRichMenuName}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">連携なし</span>
                  )}
                </div>
              </div>
              <div className="border rounded-md p-3 space-y-2 sm:col-span-2 lg:col-span-1">
                <div className="text-sm font-medium">設定中のタグ</div>
                {detailTagNames.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {detailTagNames.map((name) => (
                      <Badge key={name} variant="secondary" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">タグなし</div>
                )}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">決済履歴</h4>
                  <span className="text-[11px] text-muted-foreground">最新50件</span>
                </div>
                {detailPayments.length === 0 && (
                  <div className="text-xs text-muted-foreground">決済履歴なし</div>
                )}
                {detailPayments.length > 0 && (
                  <div className="space-y-1.5">
                    {detailPayments.map((payment) => (
                      <div key={payment.id} className="border rounded-md p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(payment.created_at)}
                          </span>
                          <span className="font-semibold">
                            {formatCurrencyDisplay(payment.amount, payment.currency)}
                          </span>
                        </div>
                        <div className="text-sm font-medium break-all">{payment.productLabel}</div>
                        <div className="flex items-center justify-between text-xs">
                          <Badge
                            variant={
                              payment.status === "paid"
                                ? "default"
                                : payment.status === "refunded"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {payment.status || "status不明"}
                          </Badge>
                          <span className="text-muted-foreground">
                            {payment.livemode ? "本番" : "テスト"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
                <h4 className="text-sm font-medium">フォーム回答</h4>
                <div className="space-y-1.5 text-xs">
                  {detailForms.length === 0 && <div className="text-muted-foreground">履歴なし</div>}
                  {detailForms.length > 0 && (
                    <Accordion type="single" collapsible className="w-full">
                      {detailForms.map((f: any) => {
                        const formFields = f.forms?.fields || []
                        return (
                          <AccordionItem key={f.id} value={f.id}>
                            <AccordionTrigger className="text-xs">
                              {f.forms?.name || "フォーム"} - {format(new Date(f.submitted_at), "yyyy/MM/dd HH:mm")}
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2">
                                {Object.entries(f.data).map(([key, value]) => {
                                  const field = formFields.find(
                                    (field: any) => field.name === key || field.id === key
                                  )
                                  const label = field?.label || key
                                  return (
                                    <div key={key}>
                                      <div className="font-medium text-xs">{label}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {Array.isArray(value) ? value.join(", ") : String(value)}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                <h4 className="text-sm font-medium">シナリオ遷移ログ</h4>
                <div className="space-y-1.5 text-xs">
                  {detailLogs.length === 0 && <div className="text-muted-foreground">履歴なし</div>}
                  {detailLogs.length > 0 && (
                    <div className="space-y-1.5">
                      {detailLogs.map((log: any, idx: number) => {
                        const scenarioName = scenarios.find((s) => s.id === log.scenario_id)?.name || "Unknown"
                        return (
                          <div key={idx} className="border rounded-md p-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Badge
                                className={cn(
                                  "text-xs rounded px-2 py-0.5",
                                  log.type === "registered" ? "bg-[rgb(12,179,134)]" : "bg-red-500"
                                )}
                              >
                                {log.type === "registered" ? "登録" : "解除"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(log.date), "yyyy/MM/dd HH:mm")}
                              </span>
                            </div>
                            <div className="text-sm font-medium">{scenarioName}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                
                for (const friend of filteredFriends) {
                  try {
                    console.log('Registering friend:', friend.line_user_id, 'to scenario:', target.name)
                    
                    const { data: allSteps } = await supabase
                      .from('steps')
                      .select('id, step_order, delivery_type, delivery_seconds, delivery_minutes, delivery_hours, delivery_days, delivery_time_of_day, specific_time, delivery_relative_to_previous')
                      .eq('scenario_id', target.id)
                      .order('step_order', { ascending: true })

                    if (!allSteps || allSteps.length === 0) {
                      console.error('No steps found for scenario:', target.id)
                      errorCount++
                      continue
                    }

                    const startOrder = 0
                    const startStepId = allSteps[0]?.id

                    const startStepDetail = allSteps[0]
                    
                    const computeFirstScheduledAt = (): string => {
                      const now = new Date()
                      if (!startStepDetail) return now.toISOString()

                      let effectiveType = startStepDetail.delivery_type as string
                      if (effectiveType === 'immediate') effectiveType = 'immediately'
                      if (effectiveType === 'specific') effectiveType = 'specific_time'
                      if (effectiveType === 'time_of_day') effectiveType = 'relative_to_previous'
                      if (effectiveType === 'relative' && startStepDetail.delivery_relative_to_previous) effectiveType = 'relative_to_previous'

                      const addOffset = (base: Date) => {
                        const d = new Date(base)
                        d.setSeconds(d.getSeconds() + (startStepDetail.delivery_seconds || 0))
                        d.setMinutes(d.getMinutes() + (startStepDetail.delivery_minutes || 0))
                        d.setHours(d.getHours() + (startStepDetail.delivery_hours || 0))
                        d.setDate(d.getDate() + (startStepDetail.delivery_days || 0))
                        return d
                      }
                      
                      const parseTimeOfDay = (val?: string | null) => {
                        if (!val) return null
                        const [hh, mm = '0', ss = '0'] = val.split(':')
                        return { h: Number(hh), m: Number(mm), s: Number(ss) }
                      }

                      const registrationAt = now

                      if (effectiveType === 'specific_time' && startStepDetail.specific_time) {
                        return new Date(startStepDetail.specific_time).toISOString()
                      }

                      let scheduled = addOffset(registrationAt)

                      const tod = parseTimeOfDay(startStepDetail.delivery_time_of_day)
                      if (tod) {
                        const withTod = new Date(scheduled)
                        withTod.setHours(tod.h, tod.m, tod.s, 0)
                        if (withTod.getTime() <= scheduled.getTime()) {
                          withTod.setDate(withTod.getDate() + 1)
                        }
                        scheduled = withTod
                      }
                      return scheduled.toISOString()
                    }

                    const firstScheduledAt = computeFirstScheduledAt()
                    const firstNextCheck = new Date(new Date(firstScheduledAt).getTime() - 5000).toISOString()

                    const { data: existing } = await supabase
                      .from('step_delivery_tracking')
                      .select('id, step_id')
                      .eq('scenario_id', target.id)
                      .eq('friend_id', friend.id)

                    const existingMap = new Map<string, string>((existing || []).map((r: any) => [r.step_id, r.id]))

                    const missingRows = allSteps
                      .filter((s: any) => !existingMap.has(s.id))
                      .map((s: any) => ({
                        scenario_id: target.id,
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

                    for (const s of allSteps) {
                      const id = existingMap.get(s.id)
                      if (!id) continue
                      const target_update = s.step_order < startOrder
                        ? { status: 'delivered', delivered_at: new Date().toISOString(), scheduled_delivery_at: null, next_check_at: null }
                        : s.step_order === startOrder
                        ? { status: 'waiting', delivered_at: null, scheduled_delivery_at: firstScheduledAt, next_check_at: firstNextCheck }
                        : { status: 'waiting', delivered_at: null, scheduled_delivery_at: null, next_check_at: null }
                      const { error: updErr } = await supabase
                        .from('step_delivery_tracking')
                        .update({ ...target_update, updated_at: new Date().toISOString() })
                        .eq('id', id)
                      if (updErr) throw updErr
                    }

                    try {
                      await supabase.functions.invoke('scheduled-step-delivery', {
                        body: { line_user_id: friend.line_user_id, scenario_id: target.id }
                      })
                    } catch (e) {
                      console.warn('scheduled-step-delivery invoke failed', e)
                    }

                    try {
                      await supabase
                        .from('scenario_friend_logs')
                        .insert({
                          scenario_id: target.id,
                          friend_id: friend.id,
                          line_user_id: friend.line_user_id,
                          invite_code: 'bulk_manual'
                        })
                    } catch (logErr) {
                      console.warn('scenario_friend_logs insert failed', logErr)
                    }

                    successCount++
                    console.log('Successfully registered friend:', friend.line_user_id)
                    
                  } catch (e: any) {
                    console.error('Registration error for friend:', friend.line_user_id, e)
                    errorCount++
                  }
                }
                
                if (successCount > 0) {
                  toast({ title:'登録完了', description:`${successCount}名を登録しました${errorCount > 0 ? ` (${errorCount}名でエラー)` : ''}` })
                  window.dispatchEvent(new CustomEvent('scenario-stats-updated'))
                  loadFriends()
                } else {
                  toast({ title:'登録失敗', description:'登録できませんでした', variant:'destructive' })
                }
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
