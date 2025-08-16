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
import { Eye, Search, Crown, X, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

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

const USERS_PER_PAGE = 20

export default function MasterMode() {
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [currentUserRole, setCurrentUserRole] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const navigate = useNavigate()

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
        if (data.user_role !== 'admin' && data.user_role !== 'developer') {
          toast.error('MASTERモードにアクセスする権限がありません')
          navigate('/')
          return
        }
      }
    } catch (error) {
      console.error('Error loading current user role:', error)
    }
  }

  useEffect(() => {
    if (user && (currentUserRole === 'admin' || currentUserRole === 'developer')) {
      loadUsers()
    }
  }, [user, currentUserRole])

  const loadUsers = async () => {
    try {
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

      const userIds = profiles?.map(p => p.user_id) || []
      const { data: plans } = await supabase
        .from('user_plans')
        .select('user_id, plan_type, monthly_revenue, is_active')
        .in('user_id', userIds)

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

  const handleUserAccess = (userId: string, displayName: string) => {
    // MASTERモードでユーザーのツールにアクセス
    sessionStorage.setItem('masterMode', 'true')
    sessionStorage.setItem('masterModeUserId', userId)
    sessionStorage.setItem('masterModeUserName', displayName || 'ユーザー')
    
    toast.success(`${displayName || 'ユーザー'}のツールページにアクセスします`, {
      description: 'MASTERモードが有効になりました'
    })
    
    // ユーザーのダッシュボードにリダイレクト
    navigate('/')
  }

  const exitMasterMode = () => {
    sessionStorage.removeItem('masterMode')
    sessionStorage.removeItem('masterModeUserId')
    sessionStorage.removeItem('masterModeUserName')
    toast.info('MASTERモードを終了しました')
    navigate('/')
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

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE)
  const startIndex = (currentPage - 1) * USERS_PER_PAGE
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE)

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (!user) {
    return <div className="p-4">ログインが必要です</div>
  }

  if (currentUserRole !== 'admin' && currentUserRole !== 'developer') {
    return <div className="p-4">アクセス権限がありません</div>
  }

  const isMasterModeActive = sessionStorage.getItem('masterMode') === 'true'

  return (
    <div className="space-y-6">
      <AppHeader user={user} />
      
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Crown className="h-6 w-6 text-yellow-500" />
              MASTERモード
              <Badge variant="destructive" className="flex items-center gap-1">
                <Crown className="h-3 w-3" />
                MASTER
              </Badge>
            </h1>
            <p className="text-muted-foreground">
              他のユーザーのツール管理画面にアクセスして編集できます。
            </p>
            {isMasterModeActive && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    現在「{sessionStorage.getItem('masterModeUserName')}」のツールを管理中
                  </span>
                </div>
                <Button 
                  onClick={exitMasterMode} 
                  variant="outline" 
                  size="sm"
                  className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
                >
                  <X className="h-4 w-4 mr-1" />
                  MASTERモード終了
                </Button>
              </div>
            )}
          </div>
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
            <CardTitle>ユーザー一覧 ({filteredUsers.length}件中 {Math.min(startIndex + 1, filteredUsers.length)}-{Math.min(startIndex + USERS_PER_PAGE, filteredUsers.length)}件表示)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ユーザー名</TableHead>
                    <TableHead>LINE名</TableHead>
                    <TableHead>メール</TableHead>
                    <TableHead>プラン</TableHead>
                    <TableHead>ロール</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((userData) => (
                    <TableRow key={userData.user_id}>
                      <TableCell className="font-medium">
                        {userData.display_name || '未設定'}
                      </TableCell>
                       <TableCell>
                         {userData.line_bot_id || '未設定'}
                       </TableCell>
                      <TableCell className="text-sm">
                        {userData.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={userData.plan_type === 'free' ? 'secondary' : 'default'}>
                          {userData.plan_type === 'free' ? 'フリー' : userData.plan_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {userData.user_role === 'user' ? 'ユーザー' : 
                           userData.user_role === 'developer' ? '開発者' : '管理者'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleUserAccess(userData.user_id, userData.display_name)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          ツールにアクセス
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  ページ {currentPage} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    前へ
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    次へ
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}