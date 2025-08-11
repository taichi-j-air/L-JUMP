import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CMSPublicPageBuilder() {
  useEffect(() => {
    document.title = "外部WEBページ作成 | CMS";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', '誰でも見れるLPのような公開ページを作成します。');
  }, []);

  return (
    <div className="container mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">外部WEBページ作成</h1>
        <p className="text-muted-foreground">LPのような公開ページを作成します。（準備中）</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>準備中</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">まずはLINE友達ページ用CMSの実装を進めています。こちらも順次対応します。</p>
        </CardContent>
      </Card>
    </div>
  );
}
