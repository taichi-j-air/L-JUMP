import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Settings, Shield, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const ProfileManagement = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profile, setProfile] = useState({
    display_name: "",
    user_role: "user",
    line_api_status: "not_configured",
    webhook_url: "",
    line_channel_access_token: "",
    line_channel_secret: "",
  });
  const [userEmail, setUserEmail] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserEmail(user.email || "");

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        toast({
          title: "エラー",
          description: "プロファイル情報の読み込みに失敗しました",
          variant: "destructive",
        });
        return;
      }

      if (profileData) {
        setProfile({
          display_name: profileData.display_name || "",
          user_role: profileData.user_role || "user",
          line_api_status: profileData.line_api_status || "not_configured",
          webhook_url: profileData.webhook_url || "",
          line_channel_access_token: profileData.line_channel_access_token || "",
          line_channel_secret: profileData.line_channel_secret || "",
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "エラー",
        description: "プロファイルの読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profile.display_name,
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      toast({
        title: "成功",
        description: "プロファイル情報を更新しました",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "エラー",
        description: "プロファイル情報の更新に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getApiStatusBadge = () => {
    switch (profile.line_api_status) {
      case 'not_configured':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />未設定</Badge>;
      case 'configured':
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />設定済み</Badge>;
      case 'verified':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />検証済み</Badge>;
      default:
        return <Badge variant="destructive">不明</Badge>;
    }
  };

  const getWebhookStatusBadge = () => {
    if (!profile.webhook_url) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />未設定</Badge>;
    }
    return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />設定済み</Badge>;
  };

  const getRoleBadge = () => {
    switch (profile.user_role) {
      case 'admin':
        return <Badge variant="default"><Shield className="w-3 h-3 mr-1" />管理者</Badge>;
      case 'moderator':
        return <Badge variant="secondary"><Settings className="w-3 h-3 mr-1" />モデレーター</Badge>;
      default:
        return <Badge variant="outline"><User className="w-3 h-3 mr-1" />ユーザー</Badge>;
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              ダッシュボードに戻る
            </Button>
            <h1 className="text-2xl font-bold">プロファイル管理</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* 基本情報カード */}
          <Card>
            <CardHeader>
              <CardTitle>基本情報</CardTitle>
              <CardDescription>
                アカウントの基本情報を管理します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userEmail}
                    readOnly
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    メールアドレスは変更できません
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_name">表示名</Label>
                  <Input
                    id="display_name"
                    value={profile.display_name}
                    onChange={(e) => setProfile(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="表示名を入力してください"
                  />
                </div>

                <div className="space-y-2">
                  <Label>ユーザー権限</Label>
                  <div className="flex items-center gap-2">
                    {getRoleBadge()}
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "更新中..." : "基本情報を更新"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* システム設定状況カード */}
          <Card>
            <CardHeader>
              <CardTitle>システム設定状況</CardTitle>
              <CardDescription>
                各種設定の現在の状況を確認できます
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">LINE API設定</p>
                  <p className="text-sm text-muted-foreground">
                    Channel Access TokenとChannel Secretの設定状況
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getApiStatusBadge()}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/line-api-settings")}
                  >
                    設定
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Webhook設定</p>
                  <p className="text-sm text-muted-foreground">
                    LINE PlatformからのWebhook URLの設定状況
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getWebhookStatusBadge()}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/webhook-settings")}
                  >
                    設定
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API設定詳細カード */}
          <Card>
            <CardHeader>
              <CardTitle>API設定詳細</CardTitle>
              <CardDescription>
                現在設定されているAPI情報の詳細（セキュリティのため一部マスク表示）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Channel Access Token</Label>
                <Input
                  value={profile.line_channel_access_token ? 
                    profile.line_channel_access_token.substring(0, 10) + "..." : 
                    "未設定"
                  }
                  readOnly
                  className="bg-muted font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Channel Secret</Label>
                <Input
                  value={profile.line_channel_secret ? 
                    profile.line_channel_secret.substring(0, 10) + "..." : 
                    "未設定"
                  }
                  readOnly
                  className="bg-muted font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  value={profile.webhook_url || "未設定"}
                  readOnly
                  className="bg-muted font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* アカウント操作カード */}
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">危険な操作</CardTitle>
              <CardDescription>
                これらの操作は慎重に実行してください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                <p className="text-sm text-muted-foreground mb-2">
                  アカウントを削除すると、すべてのデータが永久に失われます。
                  この操作は取り消すことができません。
                </p>
                <Button variant="destructive" disabled>
                  アカウントを削除（未実装）
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ProfileManagement;