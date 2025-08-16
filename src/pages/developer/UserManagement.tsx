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
import { Eye, Edit, Trash2, Search } from "lucide-react"
import { toast } from "sonner"

interface UserData {
  user_id: string
  display_name: string
  user_role: string
  line_api_status: string
  created_at: string
  monthly_message_used: number
  monthly_message_limit: number
  plan_type?: string
}

export default function UserManagement() {
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (user) {
      loadUsers()
    }
  }, [user])

  const loadUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          display_name,
          user_role,
          line_api_status,
          created_at,
          monthly_message_used,
          monthly_message_limit
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // ユーザープラン情報も取得
      const userIds = profiles?.map(p => p.user_id) || []
      const { data: plans } = await supabase
        .from('user_plans')
        .select('user_id, plan_type')
        .in('user_id', userIds)
        .eq('is_active', true)

      const planMap = new Map(plans?.map(p => [p.user_id, p.plan_type]) || [])

      const usersWithPlans = profiles?.map(profile => ({
        ...profile,
        plan_type: planMap.get(profile.user_id) || 'free'
      })) || []

      setUsers(usersWithPlans)
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

  const filteredUsers = users.filter(userData => {
    const matchesSearch = !searchTerm || 
      userData.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userData.user_id.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === "all" || userData.user_role === roleFilter
    
    return matchesSearch && matchesRole
  })

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold">ユーザー管理</h1>
          <p className="text-muted-foreground">システムの全ユーザーを管理できます。</p>
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
                    <TableHead>ユーザーID</TableHead>
                    <TableHead>ロール</TableHead>
                    <TableHead>プラン</TableHead>
                    <TableHead>LINE API</TableHead>
                    <TableHead>メッセージ使用量</TableHead>
                    <TableHead>登録日</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((userData) => (
                    <TableRow key={userData.user_id}>
                      <TableCell className="font-medium">
                        {userData.display_name || '未設定'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {userData.user_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={userData.user_role || 'user'} 
                          onValueChange={(value) => handleRoleChange(userData.user_id, value)}
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
                        <Badge variant={userData.plan_type === 'free' ? 'secondary' : 'default'}>
                          {userData.plan_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          userData.line_api_status === 'configured' ? 'default' : 'secondary'
                        }>
                          {userData.line_api_status === 'configured' ? '設定済み' : '未設定'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {userData.monthly_message_used} / {userData.monthly_message_limit}
                          <div className="w-full bg-secondary rounded-full h-2 mt-1">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ 
                                width: `${Math.min(100, (userData.monthly_message_used / userData.monthly_message_limit) * 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(userData.created_at).toLocaleDateString('ja-JP')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                          {userData.user_role !== 'developer' && (
                            <Button size="sm" variant="outline" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
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