import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Eye, Edit, Trash2, Search, Crown, X } from "lucide-react"
import { toast } from "sonner"

interface UserData {
  user_id: string
  display_name: string
  user_role: string
  line_api_status: string
  line_bot_id: string | null
  email: string
  created_at: string
  plan_type?: string
  total_revenue: number
  user_suspended?: boolean
}

export default function UserManagement() {
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [isMasterMode, setIsMasterMode] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string>("")

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadCurrentUserRole(session.user.id)
      }
      setLoading(false)
    })
  }, [])

  const loadCurrentUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('user_id', userId)
        .single()
      
      if (!error && data) {
        setCurrentUserRole(data.user_role)
      }
    } catch (error) {
      console.error('Error loading current user role:', error)
    }
  }

  useEffect(() => {
    if (user) {
      loadUsers()
    }
  }, [user])

  const loadUsers = async () => {
    try {
      // 開発者・管理者権限でのみ実行可能なユーザー一覧取得用のEdge Functionを呼び出し
      const { data: usersData, error: usersError } = await supabase.functions.invoke('get-all-users', {
        body: { requestType: 'getUsersList' }
      })

      if (usersError) {
        console.error('Error fetching users:', usersError)
        toast.error('ユーザー情報の取得に失敗しました')
        return
      }

      if (!usersData?.profiles) {
        console.error('No profiles data received')
        return
      }

      const profiles = usersData.profiles
      const authUsers = usersData.authUsers || []

      const emailMap = new Map<string, string>()
      authUsers.forEach((authUser: any) => {
        emailMap.set(authUser.id, authUser.email || '未設定')
      })

      // ユーザープラン情報も取得
      const userIds = profiles?.map(p => p.user_id) || []
      const { data: plans } = await supabase
        .from('user_plans')
        .select('user_id, plan_type, monthly_revenue, is_active')
        .in('user_id', userIds)

      // 累計課金額計算のためのマップ
      const totalRevenueMap = new Map()
      const activePlanMap = new Map()
      
      plans?.forEach(plan => {
        if (plan.is_active) {
          activePlanMap.set(plan.user_id, plan.plan_type)
        }
        
        const currentTotal = totalRevenueMap.get(plan.user_id) || 0
        totalRevenueMap.set(plan.user_id, currentTotal + (plan.monthly_revenue || 0))
      })

      const usersWithData = profiles?.map(profile => ({
        ...profile,
        email: emailMap.get(profile.user_id) || '未設定',
        plan_type: activePlanMap.get(profile.user_id) || 'free',
        total_revenue: totalRevenueMap.get(profile.user_id) || 0
      })) || []

      setUsers(usersWithData)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('ユーザー情報の取得に失敗しました')
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ user_role: newRole })
        .eq('user_id', userId)

      if (error) throw error

      toast.success('ユーザーロールを更新しました')
      loadUsers()
    } catch (error) {
      console.error('Error updating user role:', error)
      toast.error('ユーザーロールの更新に失敗しました')
    }
  }

  const handlePremiumToggle = async (userId: string, makePremium: boolean) => {
    try {
      // 現在のプランを無効化
      await supabase
        .from('user_plans')
        .update({ is_active: false })
        .eq('user_id', userId)

      // 新しいプランを作成
      const { error } = await supabase
        .from('user_plans')
        .insert({
          user_id: userId,
          plan_type: makePremium ? 'premium' : 'free',
          is_active: true,
          monthly_revenue: makePremium ? 9800 : 0
        })

      if (error) throw error

      toast.success(makePremium ? 'プレミアムアカウントに設定しました' : 'フリーアカウントに設定しました')
      loadUsers()
    } catch (error) {
      console.error('Error updating premium status:', error)
      toast.error('プレミアム設定の更新に失敗しました')
    }
  }

  const handleUserSuspension = async (userId: string, suspend: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ user_suspended: suspend })
        .eq('user_id', userId)

      if (error) throw error

      toast.success(suspend ? 'ユーザーを利用停止にしました' : 'ユーザーの利用を再開しました')
      loadUsers()
    } catch (error) {
      console.error('Error updating user suspension:', error)
      toast.error('ユーザー状態の更新に失敗しました')
    }
  }

  const updateLineName = async (userId: string) => {
    try {
      toast.info('公式LINE名を取得中...')
      
      const { data, error } = await supabase.functions.invoke('get-line-bot-info', {
        body: { userId }
      })

      if (error) {
        console.error('Error fetching LINE bot info:', error)
        toast.error('公式LINE名の取得に失敗しました')
        return
      }

      if (data?.success) {
        toast.success(`公式LINE名を更新しました: ${data.officialLineName}`)
        loadUsers()
      } else {
        toast.error('公式LINE名の取得に失敗しました')
      }
    } catch (error) {
      console.error('Error updating LINE name:', error)
      toast.error('公式LINE名の更新に失敗しました')
    }
  }

  const filteredUsers = users.filter(userData => {
    const matchesSearch = !searchTerm || 
      userData.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userData.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userData.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userData.line_bot_id?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === "all" || userData.user_role === roleFilter
    
    return matchesSearch && matchesRole
  })

  const toggleMasterMode = () => {
    setIsMasterMode(!isMasterMode)
    if (!isMasterMode) {
      toast.success('MASTERモードを有効にしました', {
        description: '全システム権限で操作できます'
      })
    } else {
      toast.info('MASTERモードを終了しました', {
        description: '通常の開発者権限に戻りました'
      })
    }
  }

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (!user) {
    return <div className="p-4">ログインが必要です</div>
  }

  return (
    <div className="space-y-6">
      <AppHeader user={user} />
      
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              ユーザー管理
              {isMasterMode && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  MASTER
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">システムの全ユーザーを管理できます。</p>
          </div>
          {(currentUserRole === 'admin' || currentUserRole === 'developer') && (
            <Button 
              onClick={toggleMasterMode} 
              variant={isMasterMode ? "destructive" : "default"}
              className="flex items-center gap-2"
            >
              <Crown className="h-4 w-4" />
              {isMasterMode ? 'MASTERモード終了' : 'MASTERモード開始'}
            </Button>
          )}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>フィルター</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ユーザー名またはIDで検索"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="ロールで絞り込み" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="user">一般ユーザー</SelectItem>
                  <SelectItem value="developer">開発者</SelectItem>
                  <SelectItem value="admin">管理者</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ユーザー一覧 ({filteredUsers.length}件)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ユーザー名</TableHead>
                    <TableHead>LINE ID</TableHead>
                    <TableHead>公式LINE名</TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>プラン内容</TableHead>
                    <TableHead>累計課金金額</TableHead>
                    <TableHead>ロール</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((userData) => (
                    <TableRow key={userData.user_id}>
                      <TableCell className="font-medium">
                        {userData.display_name || '未設定'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {userData.line_bot_id || '未設定'}
                      </TableCell>
                      <TableCell>
                        {userData.line_bot_id ? `${userData.display_name}の公式LINE` : '未設定'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {userData.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={userData.plan_type === 'free' ? 'secondary' : 'default'}>
                          {userData.plan_type === 'free' ? 'フリー' : userData.plan_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ¥{userData.total_revenue.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={userData.user_role || 'user'} 
                          onValueChange={(value) => handleRoleChange(userData.user_id, value)}
                          disabled={!isMasterMode && currentUserRole !== 'admin' && currentUserRole !== 'developer'}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">ユーザー</SelectItem>
                            <SelectItem value="developer">開発者</SelectItem>
                            <SelectItem value="admin">管理者</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                         <div className="flex gap-2">
                           <Dialog>
                             <DialogTrigger asChild>
                               <Button size="sm" variant="outline">
                                 <Eye className="h-4 w-4" />
                               </Button>
                             </DialogTrigger>
                             <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                               <DialogHeader>
                                 <div className="flex items-center justify-between">
                                   <DialogTitle>ユーザー詳細: {userData.display_name}</DialogTitle>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => {
                                        const closeBtn = document.querySelector('[data-dialog-close]') as HTMLButtonElement;
                                        closeBtn?.click();
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                 </div>
                               </DialogHeader>
                               <div className="space-y-4">
                                 <div className="grid grid-cols-2 gap-4">
                                   <div>
                                     <label className="text-sm font-medium">ユーザーID</label>
                                     <p className="text-sm font-mono bg-muted p-2 rounded">{userData.user_id}</p>
                                   </div>
                                   <div>
                                     <label className="text-sm font-medium">メールアドレス</label>
                                     <p className="text-sm bg-muted p-2 rounded">{userData.email}</p>
                                   </div>
                                   <div>
                                     <label className="text-sm font-medium">LINE ID</label>
                                     <p className="text-sm bg-muted p-2 rounded">{userData.line_bot_id || '未設定'}</p>
                                   </div>
                                   <div>
                                     <label className="text-sm font-medium">LINE API状態</label>
                                     <p className="text-sm bg-muted p-2 rounded">
                                       {userData.line_api_status === 'configured' ? '設定済み' : '未設定'}
                                     </p>
                                   </div>
                                   <div>
                                     <label className="text-sm font-medium">プラン</label>
                                     <p className="text-sm bg-muted p-2 rounded">{userData.plan_type}</p>
                                   </div>
                                   <div>
                                     <label className="text-sm font-medium">累計課金金額</label>
                                     <p className="text-sm bg-muted p-2 rounded">¥{userData.total_revenue.toLocaleString()}</p>
                                   </div>
                                   <div>
                                     <label className="text-sm font-medium">登録日</label>
                                     <p className="text-sm bg-muted p-2 rounded">
                                       {new Date(userData.created_at).toLocaleDateString('ja-JP')}
                                     </p>
                                   </div>
                                   <div>
                                     <label className="text-sm font-medium">ロール</label>
                                     <p className="text-sm bg-muted p-2 rounded">{userData.user_role}</p>
                                   </div>
                                 </div>
                               </div>
                             </DialogContent>
                           </Dialog>
                           
                           {(isMasterMode || currentUserRole === 'admin' || currentUserRole === 'developer') && (
                             <>
                               <Button size="sm" variant="outline">
                                 <Edit className="h-4 w-4" />
                               </Button>
                               <Button
                                 size="sm"
                                 variant="secondary"
                                 onClick={() => updateLineName(userData.user_id)}
                               >
                                 LINE名更新
                               </Button>
                               <Button
                                 size="sm"
                                 variant={userData.user_suspended ? "default" : "destructive"}
                                 onClick={() => handleUserSuspension(userData.user_id, !userData.user_suspended)}
                               >
                                 {userData.user_suspended ? "利用再開" : "利用停止"}
                               </Button>
                               {userData.user_role !== 'developer' && userData.user_role !== 'admin' && (
                                 <Button size="sm" variant="outline" className="text-destructive">
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               )}
                               <Button
                                 size="sm"
                                 variant={userData.plan_type === 'premium' ? 'secondary' : 'default'}
                                 onClick={() => handlePremiumToggle(userData.user_id, userData.plan_type !== 'premium')}
                               >
                                 {userData.plan_type === 'premium' ? 'プレミアム解除' : 'プレミアム付与'}
                               </Button>
                             </>
                           )}
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}