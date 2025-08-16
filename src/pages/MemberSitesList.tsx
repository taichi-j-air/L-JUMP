import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MemberSitesList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState([]);

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    // TODO: Implement sites loading logic
    setSites([]);
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
            <Globe className="w-6 h-6" />
            <h1 className="text-2xl font-bold">会員サイト一覧</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">作成済みサイト</h2>
              <p className="text-muted-foreground">会員向けサイトを管理します</p>
            </div>
            <Button onClick={() => navigate("/member-sites/create")} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              新しいサイトを作成
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>会員サイト</CardTitle>
              <CardDescription>
                会員限定コンテンツサイトの作成・管理
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">会員サイト機能は開発中です</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default MemberSitesList;