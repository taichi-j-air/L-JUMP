import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, CheckCircle, XCircle, RefreshCw } from "lucide-react";

const WebhookSettings = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<'not_configured' | 'configured' | 'verified'>('not_configured');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('webhook_url')
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

      if (profile?.webhook_url) {
        setWebhookUrl(profile.webhook_url);
        setWebhookStatus('configured');
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "エラー",
        description: "設定の読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const generateWebhookUrl = () => {
    const projectUrl = "https://rtjxurmuaawyzjcdkqxt.supabase.co";
    const functionName = "line-webhook";
    
    return `${projectUrl}/functions/v1/${functionName}`;
  };

  const handleGenerateWebhook = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const newWebhookUrl = generateWebhookUrl();

      const { error } = await supabase
        .from('profiles')
        .update({ 
          webhook_url: newWebhookUrl,
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setWebhookUrl(newWebhookUrl);
      setWebhookStatus('configured');

      toast({
        title: "成功",
        description: "Webhook URLが生成されました",
      });
    } catch (error) {
      console.error('Error generating webhook:', error);
      toast({
        title: "エラー",
        description: "Webhook URLの生成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "コピー完了",
        description: "Webhook URLをクリップボードにコピーしました",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "コピーに失敗しました",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = () => {
    switch (webhookStatus) {
      case 'not_configured':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />未設定</Badge>;
      case 'configured':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1" />設定済み</Badge>;
      case 'verified':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />検証済み</Badge>;
      default:
        return <Badge variant="destructive">不明</Badge>;
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
            <h1 className="text-2xl font-bold">Webhook設定</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Webhook URL設定カード */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Webhook URL</CardTitle>
                  <CardDescription>
                    LINE Platformに設定するWebhook URLです
                  </CardDescription>
                </div>
                {getStatusBadge()}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook-url"
                    value={webhookUrl}
                    readOnly
                    placeholder="Webhook URLを生成してください"
                    className="font-mono text-sm"
                  />
                  {webhookUrl && (
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(webhookUrl)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              {!webhookUrl ? (
                <Button 
                  onClick={handleGenerateWebhook}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "生成中..." : "Webhook URLを生成"}
                </Button>
              ) : (
                <Button 
                  onClick={handleGenerateWebhook}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                >
                  {loading ? "更新中..." : "URLを再生成"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 設定手順カード */}
          <Card>
            <CardHeader>
              <CardTitle>LINE Platform設定手順</CardTitle>
              <CardDescription>
                LINE Developers ConsoleでWebhook URLを設定する手順
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">LINE Developers Consoleにログイン</p>
                    <p className="text-sm text-muted-foreground">
                      https://developers.line.biz/ja/ にアクセスしてログインします
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Messaging API設定に移動</p>
                    <p className="text-sm text-muted-foreground">
                      プロバイダー → チャネル → Messaging API設定 タブを選択
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Webhook URLを設定</p>
                    <p className="text-sm text-muted-foreground">
                      上記で生成されたURLを「Webhook URL」欄にペーストして保存
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Webhookの利用を「オン」に設定</p>
                    <p className="text-sm text-muted-foreground">
                      「Webhookの利用」スイッチをオンにします
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                    5
                  </div>
                  <div>
                    <p className="font-medium">応答設定を調整</p>
                    <p className="text-sm text-muted-foreground">
                      応答メッセージ：オフ、Webhook：オン、挨拶メッセージ：オフ、チャット：オフ
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 注意事項カード */}
          <Card>
            <CardHeader>
              <CardTitle>重要な注意事項</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Webhook URLを変更した場合は、LINE Platform側でも更新してください</p>
              <p>• 初回設定後、メッセージの送受信テストを行って動作確認してください</p>
              <p>• LINE API設定が正しく行われていることを事前に確認してください</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default WebhookSettings;