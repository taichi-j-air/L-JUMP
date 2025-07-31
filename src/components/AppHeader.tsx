import { LogOut, Plus, Users, Settings } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { supabase } from "@/integrations/supabase/client"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { User } from "@supabase/supabase-js"

interface Profile {
  line_channel_id?: string
  delivery_limit: number
  delivery_count: number
  monthly_message_limit: number
  monthly_message_used: number
  friends_count: number
}

interface AppHeaderProps {
  user: User
}

export function AppHeader({ user }: AppHeaderProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadProfile()
    
    // Periodic refresh every 30 seconds
    const interval = setInterval(loadProfile, 30000)
    return () => clearInterval(interval)
  }, [user.id])

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('line_channel_id, delivery_limit, delivery_count, monthly_message_limit, monthly_message_used, friends_count')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error loading profile:', error)
      } else {
        setProfile(data)
      }

      // Get actual LINE quota information
      try {
        const { data: quotaData, error: quotaError } = await supabase.functions.invoke('get-line-quota')
        
        if (!quotaError && quotaData) {
          console.log('Received quota data:', quotaData)
          // Update with actual quota data
          setProfile(prev => prev ? {
            ...prev,
            monthly_message_limit: quotaData.limit || prev.monthly_message_limit || 200,
            monthly_message_used: quotaData.used || prev.monthly_message_used || 0
          } : null)
        }
      } catch (quotaError) {
        console.log('Could not fetch LINE quota:', quotaError)
        // Fallback to profile data
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  if (loading) {
    return null
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b h-14 flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-primary">L!JUMP</h1>
      </div>

      <div className="flex-1 flex items-center gap-4">
        {/* LINE公式アカウント切り替えタブ */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              アカウント管理
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">LINE公式アカウント</h4>
                <Button size="sm" variant="outline" className="flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  追加
                </Button>
              </div>
              
              <Tabs defaultValue="current" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="current" className="flex-1">
                    現在のアカウント
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>アカウントID:</span>
                  <span className="font-mono">
                    {profile?.line_channel_id || '未設定'}
                  </span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* 月間配信数 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">月間配信:</span>
          <Badge variant="secondary">
            残り {((profile?.monthly_message_limit || 200) - (profile?.monthly_message_used || 0)).toLocaleString()} / {(profile?.monthly_message_limit || 200).toLocaleString()}
          </Badge>
        </div>

        {/* 友達数 */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline">
            {profile?.friends_count || 0} 友達
          </Badge>
        </div>
      </div>

      {/* ログアウトボタン */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleSignOut}
        className="flex items-center gap-2"
      >
        <LogOut className="h-4 w-4" />
        ログアウト
      </Button>
    </header>
  )
}