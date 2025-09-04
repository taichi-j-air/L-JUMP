import { LogOut, Plus, Users, Settings } from "lucide-react"
// Logo is now loaded from uploads
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
  line_bot_id?: string
  delivery_limit?: number
  delivery_count?: number
  monthly_message_limit?: number
  monthly_message_used?: number
  friends_count?: number
}

interface AppHeaderProps {
  user: User
}

export function AppHeader({ user }: AppHeaderProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeAccount, setActiveAccount] = useState<{ account_name: string; line_bot_id: string | null } | null>(null)
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
      // Parallel execution of profile and quota queries
      const [profileResult, quotaResult] = await Promise.all([
        // 1. Get profile with minimal columns
        supabase
          .from('profiles')
          .select('line_channel_id, line_bot_id, friends_count, monthly_message_limit, monthly_message_used')
          .eq('user_id', user.id)
          .single(),
        
        // 2. Get LINE quota information (will use channelId from first query)
        (async () => {
          try {
            // First get the channel ID
            const { data: tempProfile } = await supabase
              .from('profiles')
              .select('line_channel_id')
              .eq('user_id', user.id)
              .single()
            
            if (tempProfile?.line_channel_id) {
              return await supabase.functions.invoke('get-line-quota', {
                body: { channelId: tempProfile.line_channel_id }
              })
            }
            return { data: null, error: 'No channel ID' }
          } catch (error) {
            return { data: null, error: error.message }
          }
        })()
      ])

      if (profileResult.error) {
        console.error('Error loading profile:', profileResult.error)
      } else {
        setProfile(profileResult.data)

        // 現在のアクティブLINEアカウントを取得
        const { data: acc } = await supabase
          .from('line_accounts')
          .select('account_name, line_bot_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()
        setActiveAccount(acc ?? null)
      }

      // 友だち数（最新）をカウントして更新
      try {
        const { count: friendsCount } = await supabase
          .from('line_friends')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
        setProfile(prev => ({ ...(prev ?? {}), friends_count: friendsCount ?? (prev?.friends_count ?? 0) }))
      } catch (e) {
        console.warn('Failed to refresh friends count:', e)
      }

      // Update profile with quota data if successful
      if (!quotaResult.error && quotaResult.data && !quotaResult.data.error) {
        console.log('Received quota data:', quotaResult.data)
        setProfile(prev => ({
          ...(prev ?? {
            line_channel_id: undefined,
            delivery_limit: 1000,
            delivery_count: 0,
            friends_count: 0
          }),
          monthly_message_limit: quotaResult.data.limit,
          monthly_message_used: quotaResult.data.used
        }))
      } else if (quotaResult.error || quotaResult.data?.error) {
        console.log('Could not fetch LINE quota:', quotaResult.error || quotaResult.data?.error)
        // Don't overwrite existing data on error
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

  const currentLineId = activeAccount?.line_bot_id ?? profile?.line_bot_id ?? null;
  const lineIdLabel = currentLineId ? (currentLineId.startsWith('@') ? currentLineId : `@${currentLineId}`) : '未設定';
  const accountLabel = activeAccount?.account_name ?? lineIdLabel;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b h-14 flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <img 
          src="/lovable-uploads/ab6aefa7-fa54-4f4a-b5ef-03333852664c.png" 
          alt="L!JUMP" 
          className="h-8 w-auto"
          onError={(e) => {
            // Fallback to text if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            if (target.nextElementSibling) {
              target.nextElementSibling.classList.remove('hidden');
            }
          }}
        />
        <span className="text-xl font-semibold hidden">L!JUMP</span>
      </div>

      <div className="flex-1 flex items-center gap-4">
        {/* LINE公式アカウント切り替えタブ */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {accountLabel}
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
                  <span>LINE ID:</span>
                  <span className="font-mono">
                    {lineIdLabel}
                  </span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* 月間配信数 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">月間配信:</span>
          <Badge variant={
            profile && profile.monthly_message_limit ? 
              ((profile.monthly_message_limit - (profile.monthly_message_used || 0)) / profile.monthly_message_limit) <= 0.1 ? 
                "destructive" : "secondary"
              : "secondary"
          }>
            残り {((profile?.monthly_message_limit || 200) - (profile?.monthly_message_used || 0)).toLocaleString()} / {(profile?.monthly_message_limit || 200).toLocaleString()}
          </Badge>
        </div>

        {/* 友達数 */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline">
            {(profile?.friends_count ?? 0).toLocaleString()}/人
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