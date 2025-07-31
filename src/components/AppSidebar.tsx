import { Home, MessageSquare, Settings, FileImage, Webhook, User, Bot, Users, MessageCircle, Plus } from "lucide-react"
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
  { title: "友達一覧", url: "/friends-list", icon: Users },
  { title: "ダッシュボード", url: "/", icon: Home },
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
  
  const collapsed = state === "collapsed"

  useEffect(() => {
    loadFriends()
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

  const addTestFriend = async () => {
    try {
      const { error } = await supabase
        .from('line_friends')
        .insert({
          user_id: user.id,
          line_user_id: 'test_user_' + Date.now(),
          display_name: 'テストユーザー' + Date.now(),
          picture_url: null,
          added_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error adding test friend:', error)
      } else {
        loadFriends()
      }
    } catch (error) {
      console.error('Error:', error)
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
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 友達リストと個別チャット */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold flex items-center justify-between">
            {!collapsed && "友達とチャット"}
            {!collapsed && (
              <Button
                size="sm"
                variant="ghost"
                onClick={addTestFriend}
                className="h-5 w-5 p-0"
                title="テスト友達を追加"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                <SidebarMenuItem>
                  {!collapsed && <div className="text-xs text-muted-foreground p-2">読み込み中...</div>}
                </SidebarMenuItem>
              ) : friends.length === 0 ? (
                <SidebarMenuItem>
                  {!collapsed && (
                    <div className="text-xs text-muted-foreground p-2 space-y-2">
                      <div>友達がいません</div>
                      <div className="text-xs">
                        LINEから友達追加するか：
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addTestFriend}
                        className="text-xs h-6 w-full"
                      >
                        テスト友達を追加
                      </Button>
                    </div>
                  )}
                </SidebarMenuItem>
              ) : (
                friends.map((friend) => (
                  <SidebarMenuItem key={friend.id}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={`/chat/${friend.id}`} 
                        className={({ isActive }: { isActive: boolean }) =>
                          isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                        }
                      >
                        <div className="flex items-center gap-2 w-full min-w-0">
                          <Avatar className="h-5 w-5 flex-shrink-0">
                            <AvatarImage src={friend.picture_url || ""} />
                            <AvatarFallback className="text-xs">
                              {friend.display_name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          {!collapsed && (
                            <span className="text-sm truncate">
                              {friend.display_name || "名前未設定"}
                            </span>
                          )}
                        </div>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
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