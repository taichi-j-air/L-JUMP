import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MemberSiteManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/member-sites")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              サイト一覧に戻る
            </Button>
            <Settings2 className="w-6 h-6" />
            <h1 className="text-2xl font-bold">サイト別管理</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>サイト別管理</CardTitle>
              <CardDescription>
                各会員サイトの個別設定・管理
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">サイト別管理機能は開発中です</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default MemberSiteManagement;