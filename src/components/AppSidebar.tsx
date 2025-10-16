import { Home, MessageSquare, Settings, FileImage, Webhook, User, Bot, Users, MessageCircle, ArrowRight, LogIn, ChevronDown, FileText, BarChart3, CreditCard, Shield, DollarSign, Settings2, Menu, Globe, Crown } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User as SupabaseUser } from "@supabase/supabase-js"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const mainNavItems = {
  dashboard: { title: "ダッシュボード", url: "/", icon: Home },
  greeting: { title: "あいさつメッセージ一覧", url: "/greeting-message", icon: MessageCircle },
  richMenu: { title: "リッチメニュー", url: "/rich-menu", icon: Menu },
  chatInbox: { title: "チャット受信箱", url: "/chat-inbox", icon: MessageCircle },
  stepDelivery: { title: "ステップ配信", url: "/step-delivery", icon: ArrowRight },
  flexDesigner: { title: "フレックスメッセージ作成", url: "/flex-message-designer", icon: MessageSquare },
  mediaLibrary: { title: "ファイルライブラリ", url: "/media-library", icon: FileImage },
}

const settingsItems = [
  { title: "LINE API設定", url: "/line-api-settings", icon: Bot },
  { title: "LINEログイン設定", url: "/line-login-settings", icon: LogIn },
  { title: "Webhook設定", url: "/webhook-settings", icon: Webhook },
  { title: "プロファイル管理", url: "/profile-management", icon: User },
]

interface Friend {
  id: string
  line_user_id: string
  display_name: string | null
  picture_url: string | null
}

interface AppSidebarProps {
  user: SupabaseUser
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { state } = useSidebar()
  const location = useLocation()
  const currentPath = location.pathname
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [friendsOpen, setFriendsOpen] = useState(false)
  const [formsOpen, setFormsOpen] = useState(false)
  const [responsesHasNew, setResponsesHasNew] = useState(false)
  const [cmsOpen, setCmsOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [developerOpen, setDeveloperOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const collapsed = state === "collapsed"
  const { dashboard, greeting, richMenu, chatInbox, stepDelivery, flexDesigner, mediaLibrary } = mainNavItems
  const groupActiveFriends = currentPath.startsWith('/friends-list') || currentPath.startsWith('/tags')
  const groupActiveForms = currentPath.startsWith('/forms')
  const groupActiveCMS = currentPath.startsWith('/cms')
  const groupActivePayment = currentPath.startsWith('/payment')
  const groupActiveSettings = currentPath.startsWith('/settings')
  const groupActiveDeveloper = currentPath.startsWith('/developer')
  const isDeveloper = profile?.user_role === 'developer'
  const isAdmin = profile?.user_role === 'admin'

  useEffect(() => {
    setFriendsOpen(groupActiveFriends)
    setFormsOpen(groupActiveForms)
    setCmsOpen(groupActiveCMS)
    setPaymentOpen(groupActivePayment)
    setSettingsOpen(groupActiveSettings)
    setDeveloperOpen(groupActiveDeveloper)
    setAdminOpen(currentPath.startsWith('/admin'))
  }, [groupActiveFriends, groupActiveForms, groupActiveCMS, groupActivePayment, groupActiveSettings, groupActiveDeveloper])

  useEffect(() => {
    loadFriends()
    loadUnreadCount()
    loadProfile()

    // Chat messages realtime subscription
    const messageSubscription = supabase
      .channel('chat_messages_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'chat_messages' }, 
        () => {
          loadUnreadCount()
        }
      )
      .subscribe()

    // Form submissions realtime subscription for notifications
    const formSubSubscription = supabase
      .channel('form_submissions_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'form_submissions' }, (payload: any) => {
        try {
          const formId = payload?.new?.form_id
          if (!formId) return
          const raw = localStorage.getItem('unreadResponses')
          const map: Record<string, number> = raw ? JSON.parse(raw) : {}
          map[formId] = (map[formId] || 0) + 1
          localStorage.setItem('unreadResponses', JSON.stringify(map))

          const enabledRaw = localStorage.getItem('formBadgeEnabled')
          const enabledMap: Record<string, boolean> = enabledRaw ? JSON.parse(enabledRaw) : {}
          const enabled = enabledMap[formId] !== false

          if (enabled) {
            localStorage.setItem('unreadResponsesGlobal', 'true')
            setResponsesHasNew(true)
          }
          window.dispatchEvent(new Event('unread-responses-updated'))
        } catch (e) {
          console.error('Failed to update unread responses', e)
        }
      })
      .subscribe()

    // Listen to storage updates from other parts of the app
    const handleUnreadUpdate = () => {
      try {
        const raw = localStorage.getItem('unreadResponses')
        const enabledRaw = localStorage.getItem('formBadgeEnabled')
        const global = localStorage.getItem('unreadResponsesGlobal') === 'true'
        const counts: Record<string, number> = raw ? JSON.parse(raw) : {}
        const enabledMap: Record<string, boolean> = enabledRaw ? JSON.parse(enabledRaw) : {}
        const anyEnabledUnread = Object.entries(counts).some(([id, cnt]) => (enabledMap[id] !== false) && ((cnt || 0) > 0))
        setResponsesHasNew(global || anyEnabledUnread)
      } catch {
        setResponsesHasNew(false)
      }
    }
    window.addEventListener('unread-responses-updated', handleUnreadUpdate)
    handleUnreadUpdate()
  }, [user.id])

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('user_id', user.id)
        .single()
      
      if (!error && data) {
        setProfile(data)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }

  const loadFriends = async () => {
    try {
      const { data, error } = await supabase
        .from('line_friends')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error loading friends:', error)
      } else {
        setFriends(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    try {
      // 未読メッセージ（read_at が null の受信メッセージ）の数をカウント
      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('message_type', 'incoming')
        .is('read_at', null)

      if (!error && count !== null) {
        setUnreadCount(count)
      }
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }
  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium focus-visible:outline-none focus-visible:ring-0"
      : "hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-0"

  // Clear global and per-form unread when opening responses page
  useEffect(() => {
    if (currentPath.startsWith('/forms/responses')) {
      try {
        const raw = localStorage.getItem('unreadResponses')
        const map: Record<string, number> = raw ? JSON.parse(raw) : {}
        const cleared = Object.fromEntries(Object.keys(map).map((k) => [k, 0]))
        localStorage.setItem('unreadResponses', JSON.stringify(cleared))
        localStorage.setItem('unreadResponsesGlobal', 'false')
        // Also clear unread submission ids to avoid lingering dots
        localStorage.setItem('unreadSubmissionIds', JSON.stringify({}))
      } catch {}
      setResponsesHasNew(false)
      window.dispatchEvent(new Event('unread-responses-updated'))
    }
  }, [currentPath])
  return (
    <Sidebar className={(collapsed ? "w-14" : "w-64") + " border-r border-sidebar-border bg-sidebar text-sidebar-foreground"} collapsible="icon">
      <SidebarTrigger className="m-2 self-end" />
      
      <SidebarContent className="px-2 pt-4 md:pt-6">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold">メインメニュー</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={dashboard.url} end className={getNavClass}>
                    <dashboard.icon className="h-4 w-4" />
                    {!collapsed && <span>{dashboard.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={greeting.url} end className={getNavClass}>
                    <greeting.icon className="h-4 w-4" />
                    {!collapsed && <span>{greeting.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={richMenu.url} end className={getNavClass}>
                    <richMenu.icon className="h-4 w-4" />
                    {!collapsed && <span>{richMenu.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setFriendsOpen((v) => !v)} isActive={groupActiveFriends}>
                  <Users className="h-4 w-4" />
                  {!collapsed && (
                    <span className="flex items-center gap-1">
                      友達メニュー
                      <ChevronDown className="h-3 w-3" />
                    </span>
                  )}
                </SidebarMenuButton>
                {friendsOpen && (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <NavLink to="/friends-list" end className={({ isActive }) => getNavClass({ isActive })}>
                          <span>友だち一覧</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <NavLink to="/tags" end className={({ isActive }) => getNavClass({ isActive })}>
                          <span>タグ一覧/設定</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={chatInbox.url} end className={getNavClass}>
                    <chatInbox.icon className="h-4 w-4" />
                    {!collapsed && <span>{chatInbox.title}</span>}
                    {unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full"
                      >
                        {unreadCount}
                      </Badge>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <SidebarSeparator className="my-2" />

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={stepDelivery.url} end className={getNavClass}>
                    <stepDelivery.icon className="h-4 w-4" />
                    {!collapsed && <span>{stepDelivery.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={flexDesigner.url} end className={getNavClass}>
                    <flexDesigner.icon className="h-4 w-4" />
                    {!collapsed && <span>{flexDesigner.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setFormsOpen((v) => !v)} isActive={groupActiveForms}>
                  <FileText className="h-4 w-4" />
                  {!collapsed && (
                    <span className="flex items-center gap-1">
                      フォーム管理
                      <ChevronDown className="h-3 w-3" />
                    </span>
                  )}
                </SidebarMenuButton>
                {formsOpen && (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <NavLink to="/forms" end className={({ isActive }) => getNavClass({ isActive })}>
                          <span>フォーム作成/一覧</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <NavLink to="/forms/responses" end className={({ isActive }) => getNavClass({ isActive })}>
                          <span className="flex items-center gap-2">
                            回答結果
                            {responsesHasNew && (
                              <span className="inline-block h-2 w-2 rounded-full bg-destructive" aria-label="新着" />
                            )}
                          </span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setCmsOpen((v) => !v)} isActive={groupActiveCMS}>
                  <BarChart3 className="h-4 w-4" />
                  {!collapsed && (
                    <span className="flex items-center gap-1">
                      ブラウザ一覧
                      <ChevronDown className="h-3 w-3" />
                    </span>
                  )}
                </SidebarMenuButton>
                {cmsOpen && (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <NavLink to="/cms/friends-page" end className={({ isActive }) => getNavClass({ isActive })}>
                          <span>LINE友達ページ作成</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <NavLink to="/external-web-page" end className={({ isActive }) => getNavClass({ isActive })}>
                          <span>外部WEBページ作成</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <Globe className="h-4 w-4" />
                      {!collapsed && (
                        <span className="flex items-center gap-1">
                          会員サイト
                          <ChevronDown className="h-3 w-3" />
                        </span>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <NavLink to="/member-sites" end className={({ isActive }) => getNavClass({ isActive })}>
                            <span>会員サイト一覧/作成</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <NavLink
                            to="/member-sites/management"
                            end
                            className={({ isActive }) => getNavClass({ isActive })}
                          >
                            <span>サイト別/管理</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setPaymentOpen((v) => !v)} isActive={groupActivePayment}>
                  <CreditCard className="h-4 w-4" />
                  {!collapsed && (
                    <span className="flex items-center gap-1">
                      決済/商品管理
                      <ChevronDown className="h-3 w-3" />
                    </span>
                  )}
                </SidebarMenuButton>
                {paymentOpen && (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <NavLink to="/payment/stripe-settings" end className={({ isActive }) => getNavClass({ isActive })}>
                          <span>決済連携設定</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <NavLink to="/payment/products" end className={({ isActive }) => getNavClass({ isActive })}>
                          <span>商品管理</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <NavLink to="/payment/orders" end className={({ isActive }) => getNavClass({ isActive })}>
                          <span>決済管理</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            </SidebarMenu>

            <SidebarSeparator className="my-2" />

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={mediaLibrary.url} end className={getNavClass}>
                    <mediaLibrary.icon className="h-4 w-4" />
                    {!collapsed && <span>{mediaLibrary.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold">設定</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClass}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* ツール利用設定 */}
              <SidebarMenuItem>
                <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <Settings className="h-4 w-4" />
                      {!collapsed && (
                        <span className="flex items-center gap-1">
                          ツール利用設定
                          <ChevronDown className="h-3 w-3" />
                        </span>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <NavLink to="/settings/plan" end className={getNavClass}>
                            <Shield className="h-4 w-4" />
                            {!collapsed && <span>プラン設定</span>}
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/affiliate" end className={getNavClass}>
                    <DollarSign className="h-4 w-4" />
                    {!collapsed && <span>アフィリエイト</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Developer menu */}
        {(isDeveloper || isAdmin) && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="text-sm font-semibold text-muted-foreground">開発者メニュー</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/developer/master-mode" end className={getNavClass}>
                        <Crown className="h-4 w-4" />
                        {!collapsed && <span>MASTERモード</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/developer/user-management" end className={getNavClass}>
                        <Users className="h-4 w-4" />
                        {!collapsed && <span>ユーザー管理</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/developer/plan-management" end className={getNavClass}>
                        <DollarSign className="h-4 w-4" />
                        {!collapsed && <span>プラン管理</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/developer/maintenance" end className={getNavClass}>
                        <Settings2 className="h-4 w-4" />
                        {!collapsed && <span>メンテナンス設定</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Affiliate Management dropdown */}
                  <SidebarMenuItem>
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton>
                          <Users className="h-4 w-4" />
                          {!collapsed && (
                            <span className="flex items-center gap-1">
                              アフィリエイト管理
                              <ChevronDown className="h-3 w-3" />
                            </span>
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <NavLink to="/developer/affiliate/management" end className={({ isActive }) => getNavClass({ isActive })}>
                                <span>アフィリエイト一覧</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <NavLink to="/developer/affiliate/settings" end className={({ isActive }) => getNavClass({ isActive })}>
                                <span>プログラム設定</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </Collapsible>
                  </SidebarMenuItem>
                 </SidebarMenu>
               </SidebarGroupContent>
             </SidebarGroup>
             <div className="h-6" />
           </>
         )}
      </SidebarContent>
    </Sidebar>
  )
}
