import { Home, MessageSquare, Settings, FileImage, Webhook, User, Bot, Users, MessageCircle, ArrowRight } from "lucide-react"
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const menuItems = [
  { title: "ダッシュボード", url: "/", icon: Home },
  { title: "友達一覧", url: "/friends-list", icon: Users },
  { title: "チャット受信箱", url: "/chat-inbox", icon: MessageCircle },
  { title: "ステップ配信", url: "/step-delivery", icon: ArrowRight },
  { title: "Flex メッセージデザイナー", url: "/flex-message-designer", icon: MessageSquare },
  { title: "メディアライブラリ", url: "/media-library", icon: FileImage },
]

const settingsItems = [
  { title: "LINE API設定", url: "/line-api-settings", icon: Bot },
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
  
  const collapsed = state === "collapsed"

  useEffect(() => {
    loadFriends()
    loadUnreadCount()
    
    // リアルタイムでメッセージの変更を監視
    const messageSubscription = supabase
      .channel('chat_messages_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'chat_messages' }, 
        () => {
          loadUnreadCount()
        }
      )
      .subscribe()

    // カスタムイベントで未読数更新を監視
    const handleRefreshUnread = () => {
      loadUnreadCount()
    }
    
    window.addEventListener('refreshUnreadCount', handleRefreshUnread)

    return () => {
      supabase.removeChannel(messageSubscription)
      window.removeEventListener('refreshUnreadCount', handleRefreshUnread)
    }
  }, [user.id])

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


  const isActive = (path: string) => currentPath === path
  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarTrigger className="m-2 self-end" />
      
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold">メインメニュー</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClass}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                      {item.title === "チャット受信箱" && unreadCount > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="ml-auto h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white rounded-full"
                        >
                          {unreadCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}