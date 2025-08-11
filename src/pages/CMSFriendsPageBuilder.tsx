import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function CMSFriendsPageBuilder() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    document.title = "LINE友達ページ作成 | CMS";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'LINE友達限定ページを作成して専用URLを発行します。');
  }, []);

  const handleSave = async () => {
    if (!title || !slug) {
      toast.error("タイトルとスラッグを入力してください");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("ログインが必要です");
        return;
      }
      const { data, error } = await (supabase as any)
        .from('cms_pages')
        .insert({
          user_id: user.id,
          title,
          slug,
          content,
          visibility: 'friends_only',
        })
        .select('share_code')
        .maybeSingle();

      if (error) throw error;

      const code = data?.share_code;
      if (code) {
        const url = `${window.location.origin}/cms/f/${code}`;
        setShareUrl(url);
        toast.success("ページを作成しました。共有URLを発行しました。");
      } else {
        toast.success("ページを作成しました");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">LINE友達ページ作成</h1>
        <p className="text-muted-foreground">公式LINEの友達のみ閲覧できる専用ページを作成します。</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">タイトル</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例）会員限定のお知らせ" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">スラッグ（URLの一部）</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="例）member-news" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">内容</Label>
            <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder="ページの本文を入力してください" />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '作成中…' : 'ページを作成'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {shareUrl && (
        <Card>
          <CardHeader>
            <CardTitle>専用URL</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-2">このURLは公式LINEの友達のみ閲覧可能になります。</p>
            <a href={shareUrl} className="text-primary underline break-all" target="_blank" rel="noopener noreferrer">{shareUrl}</a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
