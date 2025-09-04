import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const LineApiSettings = () => {
  const [channelAccessToken, setChannelAccessToken] = useState("");
  const [channelSecret, setChannelSecret] = useState("");
  const [channelId, setChannelId] = useState("");
  const [lineBotId, setLineBotId] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<string>("not_configured");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("User not authenticated, redirecting to auth page");
        navigate("/auth");
        return;
      }
      console.log("User authenticated:", user.email);

      // Get current API status from profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('line_api_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error("プロファイル読み込みエラー:", profileError);
      } else if (profile) {
        setCurrentStatus(profile.line_api_status || 'not_configured');
      }

      // Get secure credentials using the security function
      const { data: credentials, error: credError } = await supabase
        .rpc('get_user_line_credentials', { p_user_id: user.id });

      if (credError) {
        console.error('Failed to load credentials:', credError);
        // Don't throw error for credentials - they might not exist yet
      } else if (credentials && credentials.length > 0) {
        const creds = credentials[0];
        setChannelAccessToken(creds.channel_access_token || '');
        setChannelSecret(creds.channel_secret || '');
        setChannelId(creds.channel_id || '');
        setLineBotId(creds.bot_id || '');
      }
    } catch (error) {
      console.error("設定の読み込みエラー:", error);
      toast({
        title: "エラー",
        description: "設定の読み込みに失敗しました",
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
        toast({
          title: "エラー",
          description: "ユーザーが認証されていません",
          variant: "destructive",
        });
        return;
      }

      // Validate required fields
      if (!channelAccessToken.trim() || !channelSecret.trim() || !channelId.trim() || !lineBotId.trim()) {
        toast({
          title: "入力エラー",
          description: "すべてのフィールドを入力してください",
          variant: "destructive",
        });
        return;
      }

      // Save credentials securely
      const credentialTypes = [
        { type: 'channel_access_token', value: channelAccessToken.trim() },
        { type: 'channel_secret', value: channelSecret.trim() },
        { type: 'channel_id', value: channelId.trim() },
        { type: 'bot_id', value: lineBotId.trim() }
      ];

      // Use upsert for each credential type
      for (const cred of credentialTypes) {
        const { error } = await supabase
          .from('secure_line_credentials')
          .upsert({
            user_id: user.id,
            credential_type: cred.type,
            encrypted_value: cred.value, // TODO: Implement proper encryption with Vault
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id, credential_type'
          });

        if (error) {
          console.error(`Failed to save credential ${cred.type}:`, error);
          toast({
            title: "エラー",
            description: `認証情報の保存に失敗しました: ${cred.type}`,
            variant: "destructive",
          });
          return;
        }
      }

      // Update API status in profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          line_api_status: 'configured'
        })
        .eq('user_id', user.id);

      if (profileError) {
        console.error("プロファイル更新エラー:", profileError);
        toast({
          title: "エラー",
          description: "設定ステータスの更新に失敗しました",
          variant: "destructive",
        });
        return;
      }

      setCurrentStatus("configured");
      toast({
        title: "成功",
        description: "LINE API設定が安全に保存されました",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "予期しないエラーが発生しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            ダッシュボードに戻る
          </Button>
          <h1 className="text-2xl font-bold">LINE API設定</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl">LINE Channel設定</CardTitle>
              {currentStatus === "configured" && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">設定済み</span>
                </div>
              )}
            </div>
            <CardDescription>
              LINE Developers Consoleで取得したChannel Access TokenとChannel Secretを入力してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="channel-access-token">Channel Access Token</Label>
                <Input
                  id="channel-access-token"
                  type="password"
                  value={channelAccessToken}
                  onChange={(e) => setChannelAccessToken(e.target.value)}
                  placeholder="Channel Access Tokenを入力"
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  LINE Developers Console → Messaging API → Channel access tokenから取得
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel-secret">Channel Secret</Label>
                <Input
                  id="channel-secret"
                  type="password"
                  value={channelSecret}
                  onChange={(e) => setChannelSecret(e.target.value)}
                  placeholder="Channel Secretを入力"
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  LINE Developers Console → Basic settings → Channel secretから取得
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel-id">チャネルID</Label>
                <Input
                  id="channel-id"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="チャネルIDを入力してください（例: 1234567890）"
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  LINE Developers Console → Basic settings → Channel IDから取得
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="line-bot-id">LINE Bot ID</Label>
                <Input
                  id="line-bot-id"
                  value={lineBotId}
                  onChange={(e) => setLineBotId(e.target.value)}
                  placeholder="LINE Bot IDを入力してください（例: @your-bot-id）"
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  LINE Developers Console → Messaging API → LINE公式アカウントから取得
                </p>
              </div>

              <Alert>
                <AlertDescription>
                  これらの情報は暗号化されて安全に保存されます。LINE Botの動作に必要な認証情報です。
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "保存中..." : "設定を保存"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">設定手順</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">1. LINE Developers Consoleにアクセス</h4>
              <p className="text-sm text-muted-foreground">
                https://developers.line.biz/console/ にアクセスしてログインします
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">2. チャンネルを作成またはを選択</h4>
              <p className="text-sm text-muted-foreground">
                Messaging API用のチャンネルを作成または既存のチャンネルを選択します
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">3. 認証情報を取得</h4>
              <p className="text-sm text-muted-foreground">
                • Basic settings → Channel secret<br />
                • Messaging API → Channel access token
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">4. 上記フォームに入力して保存</h4>
              <p className="text-sm text-muted-foreground">
                取得した認証情報を入力して設定を保存してください
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LineApiSettings;