import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, MessageCircle, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeCanvas } from 'qrcode.react';

interface Scenario {
  id: string;
  name: string;
}

const GreetingMessageSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [greetingMessage, setGreetingMessage] = useState("");
  const [friendUrl, setFriendUrl] = useState("");
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadGreetingMessage();
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('line_bot_id')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setProfile(data);
        if (data.line_bot_id) {
          const botId = data.line_bot_id.startsWith('@') ? data.line_bot_id.substring(1) : data.line_bot_id;
          setFriendUrl(`https://line.me/R/ti/p/%40${botId}`);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleDownloadPNG = () => {
    const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = "line-add-friend-qr.png";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const loadGreetingMessage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('line_greeting_settings')
        .select('greeting_message')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setGreetingMessage(data.greeting_message || '');
      }
    } catch (error) {
      console.error('Error loading greeting message:', error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!greetingMessage.trim()) {
        toast({
          title: "エラー",
          description: "あいさつメッセージを入力してください",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "エラー",
          description: "ログインが必要です",
          variant: "destructive",
        });
        return;
      }

      const payload = {
        user_id: user.id,
        greeting_type: 'message',
        greeting_message: greetingMessage,
        scenario_id: null,
      };

      const { error } = await supabase
        .from('line_greeting_settings')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        throw error;
      }

      toast({
        title: "成功",
        description: "あいさつメッセージ設定を保存しました",
      });
    } catch (error) {
      console.error('Error saving greeting message:', error);
      toast({
        title: "エラー",
        description: "あいさつメッセージの保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
              戻る
            </Button>
            <MessageCircle className="w-6 h-6" />
            <h1 className="text-2xl font-bold">あいさつメッセージ設定</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>あいさつメッセージ</CardTitle>
              <CardDescription>
                友だち追加時に送信されるメッセージを設定します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="greeting">あいさつメッセージ</Label>
                    <Textarea
                      id="greeting"
                      value={greetingMessage}
                      onChange={(e) => setGreetingMessage(e.target.value)}
                      placeholder="友だち追加ありがとうございます！"
                      rows={6}
                    />
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        最大500文字まで入力できます
                      </p>
                      <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                        <p className="font-medium mb-1">使用可能なトークン：</p>
                        <ul className="space-y-0.5 ml-4">
                          <li><code className="bg-background px-1 py-0.5 rounded">[UID]</code> - 友だちの固有ID</li>
                          <li><code className="bg-background px-1 py-0.5 rounded">[LINE_NAME]</code> - 友だちの表示名</li>
                          <li><code className="bg-background px-1 py-0.5 rounded">[LINE_NAME_SAN]</code> - 友だちの表示名 + さん</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "保存中..." : "設定を保存"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 友だち追加URL & QR */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="w-5 h-5" />
                友だち追加URL & QR
              </CardTitle>
              <CardDescription>
                通常の友だち追加用のURLとQRコードです（LINEログイン無し）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {friendUrl ? (
                <>
                  <div className="space-y-2">
                    <Label>友だち追加URL</Label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={friendUrl} 
                        readOnly
                        className="flex-1 px-3 py-2 border rounded-md bg-muted font-mono text-sm"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => navigator.clipboard.writeText(friendUrl)}
                      >
                        コピー
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4 text-center">
                    <div className="flex items-center justify-center p-4 border rounded-lg bg-white w-40 mx-auto">
                        <QRCodeCanvas id="qr-code-canvas" value={friendUrl} size={128} />
                    </div>
                    <Button variant="outline" onClick={handleDownloadPNG}>
                        PNGとして保存
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>LINE Bot IDが設定されていません</p>
                  <p className="text-sm">LINE API設定で先にBOT IDを設定してください</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default GreetingMessageSettings;