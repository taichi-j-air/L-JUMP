import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GreetingMessageSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [greetingMessage, setGreetingMessage] = useState("");

  useEffect(() => {
    loadGreetingMessage();
  }, []);

  const loadGreetingMessage = async () => {
    // TODO: Implement greeting message loading logic
    setGreetingMessage("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Implement save logic
      toast({
        title: "成功",
        description: "あいさつメッセージを保存しました",
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
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="greeting">あいさつメッセージ</Label>
                  <Textarea
                    id="greeting"
                    value={greetingMessage}
                    onChange={(e) => setGreetingMessage(e.target.value)}
                    placeholder="友だち追加ありがとうございます！"
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    最大500文字まで入力できます
                  </p>
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "保存中..." : "メッセージを保存"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default GreetingMessageSettings;