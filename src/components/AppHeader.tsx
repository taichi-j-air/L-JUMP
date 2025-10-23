import { LogOut, Plus, Settings } from "lucide-react"
import { Button } from "./ui/button"
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

interface PlanStats {
  plan_name: string;
  current_steps: number;
  max_steps: number;
}

interface MemberSiteStats {
  current_sites: number;
  max_sites: number;
  current_total_content: number;
  max_total_content: number;
}

interface AppHeaderProps {
  user: User
}

export function AppHeader({ user }: AppHeaderProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [planStats, setPlanStats] = useState<PlanStats | null>(null);
  const [memberSiteStats, setMemberSiteStats] = useState<MemberSiteStats | null>(null);
  const [flexMessageCount, setFlexMessageCount] = useState<number | null>(null);
  const [activeAccount, setActiveAccount] = useState<{ account_name: string; line_bot_id: string | null } | null>(null)
  const navigate = useNavigate()

  const planNameRaw = planStats?.plan_name ?? "";
  const planNameLower = planNameRaw.toLowerCase();
  const planContentLimit = (() => {
    if (!planNameRaw) return null;
    if (planNameLower.includes("free") || planNameRaw.includes("フリー")) return 5;
    if (planNameLower.includes("silver") || planNameRaw.includes("シルバー")) return 15;
    if (planNameLower.includes("gold") || planNameRaw.includes("ゴールド")) return -1;
    return null;
  })();

  const hasPlanPerSiteLimit = typeof planContentLimit === "number" && planContentLimit !== -1;
  const fallbackContentLimit = memberSiteStats?.max_total_content ?? -1;
  const effectiveContentLimit = hasPlanPerSiteLimit
    ? (planContentLimit as number)
    : fallbackContentLimit;
  const perSiteLimitLabel = hasPlanPerSiteLimit
    ? `${effectiveContentLimit.toLocaleString()}件/サイト`
    : effectiveContentLimit === -1
      ? "無制限"
      : `${effectiveContentLimit.toLocaleString()}件`;
  const planFlexLimit = (() => {
    if (!planNameRaw) return null;
    if (planNameLower.includes("free") || planNameRaw.includes("フリー")) return 2;
    if (planNameLower.includes("silver") || planNameRaw.includes("シルバー")) return 10;
    if (planNameLower.includes("gold") || planNameRaw.includes("ゴールド")) return -1;
    return null;
  })();
  const flexLimitLabel = typeof planFlexLimit === "number"
    ? planFlexLimit === -1
      ? "無制限"
      : `${planFlexLimit.toLocaleString()}件`
    : "取得中";

  useEffect(() => {
    loadProfile()
    
    const interval = setInterval(loadProfile, 30000)
    return () => clearInterval(interval)
  }, [user.id])

  const loadProfile = async () => {
    try {
      const [profileResult, quotaResult, planStatsResult, memberSiteStatsResult, flexMessageCountResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('line_channel_id, line_bot_id, friends_count, monthly_message_limit, monthly_message_used')
          .eq('user_id', user.id)
          .single(),
        (async () => {
          try {
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
        })(),
        supabase.rpc('get_user_plan_and_step_stats', { p_user_id: user.id }),
        supabase.rpc('get_user_member_site_stats', { p_user_id: user.id }),
        supabase
          .from('flex_messages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
      ])

      if (profileResult.error) {
        console.error('Error loading profile:', profileResult.error)
      } else {
        setProfile(profileResult.data)

        const { data: acc } = await supabase
          .from('line_accounts')
          .select('account_name, line_bot_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()
        setActiveAccount(acc ?? null)
      }

      try {
        const { count: friendsCount } = await supabase
          .from('line_friends')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
        setProfile(prev => ({ ...(prev ?? {}), friends_count: friendsCount ?? (prev?.friends_count ?? 0) }))
      } catch (e) {
        console.warn('Failed to refresh friends count:', e)
      }

      if (!quotaResult.error && quotaResult.data && !quotaResult.data.error) {
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
      }

      if (planStatsResult.error) {
        console.error('Error loading plan stats:', planStatsResult.error);
      } else if (planStatsResult.data) {
        setPlanStats(planStatsResult.data[0] || null);
      }

      if (memberSiteStatsResult.error) {
        console.error('Error loading member site stats:', memberSiteStatsResult.error);
      } else if (memberSiteStatsResult.data) {
        setMemberSiteStats(memberSiteStatsResult.data[0] || null);
      }

      if (flexMessageCountResult.error) {
        console.error('Error counting flex messages:', flexMessageCountResult.error);
      } else {
        setFlexMessageCount(flexMessageCountResult.count ?? null);
      }

    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  const currentLineId = activeAccount?.line_bot_id ?? profile?.line_bot_id ?? null;
  const lineIdLabel = currentLineId ? (currentLineId.startsWith('@') ? currentLineId : `@${currentLineId}`) : '未設定';
  const accountLabel = activeAccount ? activeAccount.account_name : '読み込み中...';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b h-14 flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <img 
          src="/lovable-uploads/ab6aefa7-fa54-4f4a-b5ef-03333852664c.png" 
          alt="L!JUMP" 
          className="h-8 w-auto"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            if (target.nextElementSibling) {
              target.nextElementSibling.classList.remove('hidden');
            }
          }}
        />
        <span className="text-xl font-semibold hidden">L!JUMP</span>
      </div>

      <div className="flex-1 flex items-center gap-6">
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

        {/* 現在のプラン */}
        <div className="flex flex-col items-center justify-center leading-tight flex-shrink-0">
          {planStats ? (
            <div className="font-bold text-sm py-0.5 px-2 text-slate-700">
              {planStats.plan_name}
            </div>
          ) : (
            <div className="font-bold text-sm py-0.5 px-2">...</div>
          )}
          <div className="text-muted-foreground mt-0.5 text-[10px]">現在のプラン</div>
        </div>

        {/* 友達数 */}
        <div className="flex flex-col items-center justify-center leading-tight flex-shrink-0">
          {profile ? (
            <div className="font-bold text-sm py-0.5 px-2 text-slate-700">
              {(profile?.friends_count ?? 0).toLocaleString()}<span className="text-xs ml-0.5">人</span>
            </div>
          ) : (
            <div className="font-bold text-sm py-0.5 px-2">...</div>
          )}
          <div className="text-muted-foreground mt-0.5 text-[10px]">友達数</div>
        </div>

        {/* 月間配信数 */}
        <div className="flex flex-col items-center justify-center leading-tight flex-shrink-0">
          {profile ? (
            <div className={`font-bold text-sm py-0.5 px-2 ${
              profile.monthly_message_limit && ((profile.monthly_message_limit - (profile.monthly_message_used || 0)) / profile.monthly_message_limit) <= 0.1
              ? 'text-destructive'
              : 'text-slate-700'
            }`}>
              残り {((profile?.monthly_message_limit || 200) - (profile?.monthly_message_used || 0)).toLocaleString()} / {(profile?.monthly_message_limit || 200).toLocaleString()}
            </div>
          ) : (
            <div className="font-bold text-sm py-0.5 px-2">...</div>
          )}
          <div className="text-muted-foreground mt-0.5 text-[10px]">月間配信</div>
        </div>

        {/* ステップ数 */}
        <div className="flex flex-col items-center justify-center leading-tight flex-shrink-0">
          {planStats ? (
            <div className="font-bold text-sm py-0.5 px-2 text-slate-700">
              {planStats.current_steps.toLocaleString()}
              <span className="text-xs"> / {planStats.max_steps === -1 ? '無制限' : planStats.max_steps.toLocaleString()}</span>
            </div>
          ) : (
            <div className="font-bold text-sm py-0.5 px-2">...</div>
          )}
          <div className="text-muted-foreground mt-0.5 text-[10px]">ステップ数</div>
        </div>

        {/* 会員サイト数 */}
        <div className="flex flex-col items-center justify-center leading-tight flex-shrink-0">
          {memberSiteStats ? (
            <div className="font-bold text-sm py-0.5 px-2 text-slate-700">
              {memberSiteStats.current_sites.toLocaleString()}<span className="text-xs"> / {memberSiteStats.max_sites === -1 ? '無制限' : memberSiteStats.max_sites.toLocaleString()}</span>
            </div>
          ) : (
            <div className="font-bold text-sm py-0.5 px-2">...</div>
          )}
          <div className="text-muted-foreground mt-0.5 text-[10px]">会員サイト数</div>
        </div>

        {/* Flexメッセージ */}
        <div className="flex flex-col items-center justify-center leading-tight flex-shrink-0">
          {typeof flexMessageCount === "number" ? (
            <div className="font-bold text-sm py-0.5 px-2 text-slate-700">
              {flexMessageCount.toLocaleString()}
              {typeof planFlexLimit === "number" && planFlexLimit !== -1 && (
                <span className="text-xs"> / {planFlexLimit.toLocaleString()}</span>
              )}
            </div>
          ) : (
            <div className="font-bold text-sm py-0.5 px-2">...</div>
          )}
          <div className="text-muted-foreground mt-0.5 text-[10px]">
            Flex保存（上限 {flexLimitLabel}）
          </div>
        </div>

        {/* コンテンツ数 */}
        <div className="flex flex-col items-center justify-center leading-tight flex-shrink-0">
          {memberSiteStats ? (
            <>
              {hasPlanPerSiteLimit ? (
                <div className="flex items-baseline gap-1 py-0.5 px-2 leading-tight">
                  <span className="text-[10px] text-muted-foreground">各サイト</span>
                  <span className="text-sm font-bold text-slate-700">{effectiveContentLimit.toLocaleString()}件</span>
                  <span className="text-[10px] text-muted-foreground">/サイト（合計</span>
                  <span className="text-sm font-bold text-slate-700">{memberSiteStats.current_total_content.toLocaleString()}件</span>
                  <span className="text-[10px] text-muted-foreground">）</span>
                </div>
              ) : (
                <div className="font-bold text-sm py-0.5 px-2 text-slate-700">
                  {memberSiteStats.current_total_content.toLocaleString()}
                  <span className="text-xs"> / {perSiteLimitLabel}</span>
                </div>
              )}
            </>
          ) : (
            <div className="font-bold text-sm py-0.5 px-2">...</div>
          )}
          <div className="text-muted-foreground mt-0.5 text-[10px]">コンテンツ数</div>
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
