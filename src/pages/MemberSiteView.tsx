import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

const MemberSiteView = () => {
  const { slug } = useParams();
  const [site, setSite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSite = async () => {
      if (!slug) return;
      
      try {
        const { data, error } = await supabase
          .from('member_sites')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (error) throw error;
        setSite(data);
      } catch (error) {
        console.error('Error loading site:', error);
        setError('サイトが見つかりません');
      } finally {
        setLoading(false);
      }
    };

    loadSite();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">404 - ページが見つかりません</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8">
            {!site?.is_published && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm font-medium">
                  🔍 プレビューモード - このサイトは非公開です
                </p>
              </div>
            )}
            <h1 className="text-3xl font-bold mb-4">{site?.name}</h1>
            <p className="text-muted-foreground mb-6">{site?.description}</p>
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">
                会員サイトのデザインは後日実装予定です
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                現在はプレースホルダー表示です
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MemberSiteView;