import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleGoToAuth = () => {
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">FlexMaster</CardTitle>
            <CardDescription className="text-lg">
              LINE APIを活用したフレキシブルなチャットボット管理システム
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              LINE Bot APIの設定・管理から、チャットボットの動作制御まで、
              すべてを一箇所で管理できる統合プラットフォームです。
            </p>
            <Button onClick={handleGoToAuth} className="w-full" size="lg">
              ログイン / サインアップ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">FlexMaster</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              ようこそ、{user.email}
            </span>
            <Button variant="outline" onClick={handleSignOut}>
              ログアウト
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">ダッシュボード</h2>
          <p className="text-xl text-muted-foreground">
            LINE Botの設定と管理をここから始めましょう
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>LINE API設定</CardTitle>
              <CardDescription>
                Channel Access TokenとChannel Secretの設定
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">設定開始</Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Webhook設定</CardTitle>
              <CardDescription>
                LINE PlatformからのWebhook URLの設定
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">設定確認</Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>プロファイル管理</CardTitle>
              <CardDescription>
                ユーザー情報とAPI設定の管理
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">管理画面</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;
