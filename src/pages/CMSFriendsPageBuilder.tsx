import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Type helpers (loosened to avoid tight coupling with generated types)
interface CmsPageRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  share_code: string;
  visibility: "friends_only" | "public";
  internal_name?: string | null;
  tag_label?: string | null;
  content_blocks?: any[];
  allowed_tag_ids?: string[];
  blocked_tag_ids?: string[];
  require_passcode?: boolean;
  passcode?: string | null;
  timer_enabled?: boolean;
  timer_deadline?: string | null;
  timer_display_mode?: string;
  internal_timer?: boolean;
  timer_text?: string | null;
  expire_action?: string;
}

interface TagRow { id: string; name: string }

interface ContentBlock {
  id: string;
  title: string;
  body: string;
}

export default function CMSFriendsPageBuilder() {
  const [pages, setPages] = useState<CmsPageRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => pages.find(p => p.id === selectedId) || null, [pages, selectedId]);

  // Center editor states (bound to selected)
  const [internalName, setInternalName] = useState("");
  const [tagLabel, setTagLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);

  // Right settings
  const [tags, setTags] = useState<TagRow[]>([]);
  const [allowedTags, setAllowedTags] = useState<string[]>([]);
  const [blockedTags, setBlockedTags] = useState<string[]>([]);
  const [requirePass, setRequirePass] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDeadline, setTimerDeadline] = useState("");
  const [timerDisplay, setTimerDisplay] = useState<"dhms" | "hms" | "ms">("dhms");
  const [internalTimer, setInternalTimer] = useState(false);
  const [timerText, setTimerText] = useState("");
  const [expireAction, setExpireAction] = useState<"hide" | "keep_public">("keep_public");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "LINE友達ページ作成 | CMS";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'LINE友達限定ページを3カラム編集で作成・管理できます。');
  }, []);

  useEffect(() => {
    // Load pages and tags
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return toast.error("ログインが必要です");

      const { data: tagRows, error: tagErr } = await (supabase as any)
        .from('tags')
        .select('id,name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!tagErr) setTags(tagRows || []);

      const { data: pageRows, error } = await (supabase as any)
        .from('cms_pages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error(error);
        toast.error("ページの取得に失敗しました");
        return;
      }
      const arr: CmsPageRow[] = (pageRows || []).map((r: any) => ({
        ...r,
        content_blocks: Array.isArray(r.content_blocks) ? r.content_blocks : [],
        allowed_tag_ids: Array.isArray(r.allowed_tag_ids) ? r.allowed_tag_ids : [],
        blocked_tag_ids: Array.isArray(r.blocked_tag_ids) ? r.blocked_tag_ids : [],
      }));
      setPages(arr);
      if (arr.length > 0) setSelectedId(arr[0].id);
    };
    load();
  }, []);

  // When selected page changes, sync editor fields
  useEffect(() => {
    if (!selected) return;
    setInternalName(selected.internal_name || selected.title || "");
    setTagLabel(selected.tag_label || "");
    setSlug(selected.slug || "");
    setTitle(selected.title || "");
    const blocks = Array.isArray(selected.content_blocks) ? selected.content_blocks : [];
    setContentBlocks(blocks as ContentBlock[]);
    setAllowedTags(selected.allowed_tag_ids || []);
    setBlockedTags(selected.blocked_tag_ids || []);
    setRequirePass(!!selected.require_passcode);
    setPasscode(selected.passcode || "");
    setTimerEnabled(!!selected.timer_enabled);
    setTimerDeadline(selected.timer_deadline ? selected.timer_deadline.slice(0, 16) : ""); // yyyy-MM-ddTHH:mm
    setTimerDisplay(((selected.timer_display_mode as any) || "dhms") as any);
    setInternalTimer(!!selected.internal_timer);
    setTimerText(selected.timer_text || "");
    setExpireAction(((selected.expire_action as any) || "keep_public") as any);
  }, [selectedId]);

  const handleAddPage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return toast.error("ログインが必要です");
      const nowId = Date.now();
      const defaultTitle = "新規ページ";
      const defaultSlug = `page-${nowId}`;

      const { data, error } = await (supabase as any)
        .from('cms_pages')
        .insert({
          user_id: user.id,
          title: defaultTitle,
          internal_name: defaultTitle,
          slug: defaultSlug,
          visibility: 'friends_only',
          content_blocks: [],
          allowed_tag_ids: [],
          blocked_tag_ids: [],
          require_passcode: false,
          passcode: null,
          timer_enabled: false,
          timer_deadline: null,
          timer_display_mode: 'dhms',
          internal_timer: false,
          timer_text: null,
          expire_action: 'keep_public'
        })
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!data) return;
      setPages(prev => [data as CmsPageRow, ...prev]);
      setSelectedId(data.id);
      toast.success("ページを追加しました");
    } catch (e) {
      console.error(e);
      toast.error("ページの追加に失敗しました");
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!title || !slug) {
      toast.error("ページ名とスラッグは必須です");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        slug,
        internal_name: internalName,
        tag_label: tagLabel,
        content_blocks: contentBlocks,
        allowed_tag_ids: allowedTags,
        blocked_tag_ids: blockedTags,
        require_passcode: requirePass,
        passcode: requirePass ? (passcode || null) : null,
        timer_enabled: timerEnabled,
        timer_deadline: timerEnabled && timerDeadline ? new Date(timerDeadline).toISOString() : null,
        timer_display_mode: timerDisplay,
        internal_timer: internalTimer,
        timer_text: internalTimer ? (timerText || null) : (timerText || null),
        expire_action: expireAction,
      };

      const { data, error } = await (supabase as any)
        .from('cms_pages')
        .update(payload)
        .eq('id', selected.id)
        .select('*')
        .maybeSingle();
      if (error) throw error;

      setPages(prev => prev.map(p => (p.id === selected.id ? { ...(p as any), ...(data as any) } : p)) as any);
      toast.success("保存しました");
    } catch (e: any) {
      console.error(e);
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const shareUrl = selected ? `${window.location.origin}/cms/f/${selected.share_code}` : "";

  const toggleAllowed = (id: string) => {
    setAllowedTags(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // remove from blocked if added to allowed
      setBlockedTags(b => b.filter(x => x !== id));
      return next;
    });
  };
  const toggleBlocked = (id: string) => {
    setBlockedTags(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // remove from allowed if added to blocked
      setAllowedTags(a => a.filter(x => x !== id));
      return next;
    });
  };

  const addBlock = () => {
    const id = `blk-${Date.now()}`;
    setContentBlocks(prev => [...prev, { id, title: "新規ブロック", body: "" }]);
  };

  const updateBlock = (id: string, patch: Partial<ContentBlock>) => {
    setContentBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBlock = (id: string) => {
    setContentBlocks(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="container mx-auto max-w-[1200px] space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">LINE友達ページ作成</h1>
        <p className="text-muted-foreground">3カラムでページ追加・編集・公開設定ができます。</p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: list and add */}
        <div className="col-span-12 md:col-span-3 space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">ページ一覧</CardTitle>
              <Button size="sm" onClick={handleAddPage}>ページを追加</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {pages.length === 0 ? (
                <p className="text-sm text-muted-foreground">まだページがありません</p>
              ) : (
                <div className="space-y-1">
                  {pages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={`w-full text-left rounded-md px-3 py-2 transition-colors ${selectedId === p.id ? 'bg-muted' : 'hover:bg-muted/60'}`}
                    >
                      <div className="text-sm font-medium line-clamp-1">{p.internal_name || p.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">/{p.slug}</div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center: page info + builder */}
        <div className="col-span-12 md:col-span-6 space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">ページ情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">左からページを選択するか作成してください。</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ページ名（ツール内）</Label>
                      <Input value={internalName} onChange={(e) => setInternalName(e.target.value)} placeholder="例）会員限定ページA" />
                    </div>
                    <div className="space-y-2">
                      <Label>タグ名（ウェブサイト上）</Label>
                      <Input value={tagLabel} onChange={(e) => setTagLabel(e.target.value)} placeholder="例）特別公開" />
                    </div>
                    <div className="space-y-2">
                      <Label>ページタイトル</Label>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例）会員限定のお知らせ" />
                    </div>
                    <div className="space-y-2">
                      <Label>スラッグ（URLの一部）</Label>
                      <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="例）member-news" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>このページのURL</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={shareUrl} />
                      <Button type="button" onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast.success("URLをコピーしました"))}>コピー</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">ページ用コンテンツ作成ビルダー</CardTitle>
                <Button size="sm" variant="secondary" onClick={addBlock}>コンテンツを追加</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!selected ? (
                <p className="text-sm text-muted-foreground">ページを選択してください。</p>
              ) : contentBlocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">コンテンツがありません。「コンテンツを追加」を押してください。</p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {contentBlocks.map((blk) => (
                    <AccordionItem key={blk.id} value={blk.id}>
                      <AccordionTrigger className="px-3 py-2">{blk.title || '無題コンテンツ'}</AccordionTrigger>
                      <AccordionContent className="px-3 py-2 space-y-3">
                        <div className="space-y-2">
                          <Label>見出し</Label>
                          <Input value={blk.title} onChange={(e) => updateBlock(blk.id, { title: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>本文</Label>
                          <Textarea rows={5} value={blk.body} onChange={(e) => updateBlock(blk.id, { body: e.target.value })} placeholder="本文を入力" />
                        </div>
                        <div className="flex justify-end">
                          <Button variant="destructive" size="sm" onClick={() => removeBlock(blk.id)}>このコンテンツを削除</Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !selected}>{saving ? '保存中…' : '保存する'}</Button>
          </div>
        </div>

        {/* Right: publish & conditions */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">公開条件の設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">ページを選択してください。</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>閲覧を許可するタグ</Label>
                    <div className="space-y-1">
                      {tags.map(t => (
                        <label key={t.id} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={allowedTags.includes(t.id)} onCheckedChange={() => toggleAllowed(t.id)} />
                          <span>{t.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>閲覧を禁止するタグ</Label>
                    <div className="space-y-1">
                      {tags.map(t => (
                        <label key={t.id} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={blockedTags.includes(t.id)} onCheckedChange={() => toggleBlocked(t.id)} />
                          <span>{t.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">パスコード保護 <Switch checked={requirePass} onCheckedChange={(v) => setRequirePass(!!v)} /></Label>
                    {requirePass && (
                      <Input value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="例）1234" />
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">表示期限とタイマー</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">ページを選択してください。</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Label>カウントダウンタイマー</Label>
                    <Switch checked={timerEnabled} onCheckedChange={(v) => setTimerEnabled(!!v)} />
                  </div>
                  {timerEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label>表示期限（締切）</Label>
                        <Input type="datetime-local" value={timerDeadline} onChange={(e) => setTimerDeadline(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>タイマー表示方法</Label>
                        <Select value={timerDisplay} onValueChange={(v) => setTimerDisplay(v as any)}>
                          <SelectTrigger>
                            <SelectValue placeholder="表示方法" />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="dhms">残り（日・時・分・秒）</SelectItem>
                            <SelectItem value="hms">残り（時・分・秒）</SelectItem>
                            <SelectItem value="ms">残り（分・秒）</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between">
                    <Label>タイマーは表示せず内部タイマーにする</Label>
                    <Switch checked={internalTimer} onCheckedChange={(v) => setInternalTimer(!!v)} />
                  </div>
                  <div className="space-y-2">
                    <Label>内部タイマー時の表示テキスト（例：期間限定公開）</Label>
                    <Input value={timerText} onChange={(e) => setTimerText(e.target.value)} placeholder="例）期間限定公開" />
                  </div>

                  <div className="space-y-2">
                    <Label>タイマー切れ時の動作</Label>
                    <Select value={expireAction} onValueChange={(v) => setExpireAction(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="動作" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="hide">ページを非表示にする</SelectItem>
                        <SelectItem value="keep_public">公開した状態にする</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
