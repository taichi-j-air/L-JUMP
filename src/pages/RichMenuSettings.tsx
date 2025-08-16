import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Menu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RichMenuSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [richMenus, setRichMenus] = useState([]);

  useEffect(() => {
    loadRichMenus();
  }, []);

  const loadRichMenus = async () => {
    // TODO: Implement rich menu loading logic
    setRichMenus([]);
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
            <Menu className="w-6 h-6" />
            <h1 className="text-2xl font-bold">リッチメニュー設定</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>リッチメニュー管理</CardTitle>
              <CardDescription>
                LINE公式アカウントのリッチメニューを作成・管理します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">リッチメニュー機能は開発中です</p>
                <Button variant="outline" className="mt-4" disabled>
                  新しいリッチメニューを作成
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default RichMenuSettings;