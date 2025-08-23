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
import { ColorPicker } from "@/components/ui/color-picker";
import RichTextEditor from "@/components/RichTextEditor";
import RichTextBlocksEditor from "@/components/RichTextBlocksEditor";
import { TimerPreview } from "@/components/TimerPreview";
import { useLiffValidation } from "@/hooks/useLiffValidation";
import { Trash2 } from "lucide-react";

// 【修正1】型定義にprivateを追加
interface CmsPageRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  share_code: string;
  visibility: "friends_only" | "public" | "private";  // ← private追加
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
  const { hasLiffConfig } = useLiffValidation();

  // Center editor states (bound to selected)
  const [internalName, setInternalName] = useState("");
  const [tagLabel, setTagLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState<string>("");
  const [contentBlocks, setContentBlocks] = useState<string[]>([]);

  // Right settings
  const [tags, setTags] = useState<TagRow[]>([]);
  const [allowedTags, setAllowedTags] = useState<string[]>([]);
  const [blockedTags, setBlockedTags] = useState<string[]>([]);
  const [requirePass, setRequirePass] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMode, setTimerMode] = useState<"absolute" | "per_access">("absolute");
  const [timerDeadline, setTimerDeadline] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [showMilliseconds, setShowMilliseconds] = useState<boolean>(false);
  const [timerStyle, setTimerStyle] = useState<"solid" | "glass" | "outline">("solid");
  const [timerBgColor, setTimerBgColor] = useState<string>("#0cb386");
  const [timerTextColor, setTimerTextColor] = useState<string>("#ffffff");
  const [internalTimer, setInternalTimer] = useState(false);
  const [timerText, setTimerText] = useState("");
  const [expireAction, setExpireAction] = useState<"hide" | "keep_public">("keep_public");
  const [dayLabel, setDayLabel] = useState<string>("日");
  const [hourLabel, setHourLabel] = useState<string>("時間");
  const [minuteLabel, setMinuteLabel] = useState<string>("分");
  const [secondLabel, setSecondLabel] = useState<string>("秒");
  // Per-access duration inputs (D/H/M/S)
  const [durDays, setDurDays] = useState<number>(0);
  const [durHours, setDurHours] = useState<number>(0);
  const [durMinutes, setDurMinutes] = useState<number>(0);
  const [durSecs, setDurSecs] = useState<number>(0);

  // ✅ 正しい秒換算
  const toSeconds = (d: number, h: number, m: number, s: number) => d * 86400 + h * 3600 + m * 60 + s;

  const [saving, setSaving] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [forms, setForms] = useState<Array<{id: string; name: string}>>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");

  // 修正: durationSecondsをdurDays/durHours/durMinutes/durSecsの変更時にuseEffectで更新
  useEffect(() => {
    setDurationSeconds(toSeconds(durDays, durHours, durMinutes, durSecs));
  }, [durDays, durHours, durMinutes, durSecs]);

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

      // Load forms
      const { data: formRows } = await (supabase as any)
        .from('forms')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setForms(formRows || []);

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
    setContentHtml((selected as any).content || "");
    setContentBlocks(Array.isArray((selected as any).content_blocks) ? (selected as any).content_blocks : []);
    setAllowedTags(selected.allowed_tag_ids || []);
    setBlockedTags(selected.blocked_tag_ids || []);
    setRequirePass(!!selected.require_passcode);
    setPasscode(selected.passcode || "");
    setTimerEnabled(!!selected.timer_enabled);
    setTimerMode(((selected as any).timer_mode as any) || "absolute");
    setTimerDeadline(selected.timer_deadline ? selected.timer_deadline.slice(0, 16) : ""); // yyyy-MM-ddTHH:mm
    setDurationSeconds((selected as any).timer_duration_seconds || 0);
    setShowMilliseconds(!!(selected as any).show_milliseconds);
    setTimerStyle(((selected as any).timer_style as any) || "solid");
    setTimerBgColor(((selected as any).timer_bg_color as any) || "#0cb386");
    setTimerTextColor(((selected as any).timer_text_color as any) || "#ffffff");
    setInternalTimer(!!selected.internal_timer);
    setTimerText(selected.timer_text || "");
    setExpireAction(((selected.expire_action as any) || "keep_public") as any);
    setDayLabel(((selected as any).timer_day_label as any) || "日");
    setHourLabel(((selected as any).timer_hour_label as any) || "時間");
    setMinuteLabel(((selected as any).timer_minute_label as any) || "分");
    setSecondLabel(((selected as any).timer_second_label as any) || "秒");
    const secsInit = Number((selected as any).timer_duration_seconds || 0);
    const d = Math.floor(secsInit / 86400);
    const h = Math.floor((secsInit % 86400) / 3600);
    const m = Math.floor((secsInit % 3600) / 60);
    const s = secsInit % 60;
    setDurDays(d);
    setDurHours(h);
    setDurMinutes(m);
    setDurSecs(s);
    
    // 【修正2】状態読み込みの論理を修正
    setIsPublic(selected.visibility === 'friends_only'); // friends_onlyを公開として扱う
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
          visibility: 'private', // 【修正3】初期値をprivate（非公開）に変更
          content: "",
          allowed_tag_ids: [],
          blocked_tag_ids: [],
          require_passcode: false,
          passcode: null,
          timer_enabled: false,
          timer_deadline: null,
          timer_mode: 'absolute',
          timer_duration_seconds: null,
          show_milliseconds: false,
          timer_style: 'solid',
          timer_bg_color: '#0cb386',
          timer_text_color: '#ffffff',
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

  const handleDelete = async (pageId: string) => {
    if (!confirm("このページを削除しますか？この操作は取り消せません。")) return;
    
    try {
      const { error } = await (supabase as any)
        .from('cms_pages')
        .delete()
        .eq('id', pageId);
      
      if (error) throw error;
      
      setPages(prev => prev.filter(p => p.id !== pageId));
      if (selectedId === pageId) {
        const remaining = pages.filter(p => p.id !== pageId);
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast.success("ページを削除しました");
    } catch (e) {
      console.error(e);
      toast.error("ページの削除に失敗しました");
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
        
        // 【修正4】保存ロジックを修正（論理反転）
        visibility: isPublic ? 'friends_only' : 'private', // 公開=friends_only, 非公開=private
        
        content: contentHtml,
        content_blocks: contentBlocks,
        allowed_tag_ids: allowedTags,
        blocked_tag_ids: blockedTags,
        require_passcode: requirePass,
        passcode: requirePass ? (passcode || null) : null,
        timer_enabled: timerEnabled,
        timer_deadline:
          timerEnabled && timerMode === 'absolute' && timerDeadline
            ? new Date(timerDeadline).toISOString()
            : null,
        timer_mode: timerMode,
        timer_duration_seconds:
          timerEnabled && timerMode === 'per_access' ? toSeconds(durDays, durHours, durMinutes, durSecs) : null,
        show_milliseconds: showMilliseconds,
        timer_style: timerStyle,
        timer_bg_color: timerBgColor,
        timer_text_color: timerTextColor,
        internal_timer: internalTimer,
        timer_text: timerText || null,
        expire_action: expireAction,
        timer_day_label: dayLabel,
        timer_hour_label: hourLabel,
        timer_minute_label: minuteLabel,
        timer_second_label: secondLabel,
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
      return Promise.resolve();
    } catch (e: any) {
      console.error(e);
      toast.error("保存に失敗しました");
      return Promise.reject(e);
    } finally {
      setSaving(false);
    }
  };

  const shareUrl = useMemo(() => {
    if (!selected) return "";
    const baseUrl = `${window.location.origin}/cms/f/${selected.share_code}`;
    if (hasLiffConfig) {
      // LIFF認証対応のパラメーター付きURL（UIDパラメーター）
      return `${baseUrl}?uid=[UID]`;
    }
    return baseUrl;
  }, [selected, hasLiffConfig]);

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

  // Preview open
  const openPreview = () => {
    if (!selected) return;
    // まず保存してからプレビューを開く
    handleSave().then(() => {
      window.open(`/cms/preview/${selected.id}`, '_blank');
    });
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
                    <div
                      key={p.id}
                      className={`flex items-center justify-between rounded-md px-3 py-2 transition-colors ${selectedId === p.id ? 'bg-muted' : 'hover:bg-muted/60'}`}
                    >
                      <button
                        onClick={() => setSelectedId(p.id)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-medium line-clamp-1">{p.internal_name || p.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">/{p.slug}</div>
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(p.id);
                        }}
                        className="ml-2 h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>ページ名（ツール内）</Label>
                      <Input value={internalName} onChange={(e) => setInternalName(e.target.value)} placeholder="例）会員限定ページA" />
                    </div>
                    <div className="space-y-2">
                      <Label>ページタブ名</Label>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例）会員限定のお知らせ" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>このページのURL {hasLiffConfig && "(LIFF認証対応)"}</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={shareUrl} />
                      <Button type="button" onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast.success("URLをコピーしました"))}>コピー</Button>
                    </div>
                  </div>

                  {/* 【修正5】UIラベルをプロフェッショナルに変更 */}
                  <div className="flex items-center justify-between">
                    <Label>このページを{isPublic ? "公開" : "非公開"}</Label>
                    <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">ページ用コンテンツ作成ビルダー</CardTitle>
                <Button size="sm" variant="secondary" onClick={openPreview} disabled={!selected}>プレビュー</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">ページを選択してください。</p>
              ) : (
                <>
                  {timerEnabled && (
                    <TimerPreview
                      mode={timerMode}
                      deadline={timerMode === 'absolute' ? timerDeadline || undefined : undefined}
                      durationSeconds={timerMode === 'per_access' ? durationSeconds : undefined}
                      showMilliseconds={showMilliseconds}
                      styleVariant={timerStyle}
                      bgColor={timerBgColor}
                      textColor={timerTextColor}
                      shareCode={selected.share_code}
                      dayLabel={dayLabel}
                      hourLabel={hourLabel}
                      minuteLabel={minuteLabel}
                      secondLabel={secondLabel}
                      preview={true}
                      internalTimer={internalTimer}
                      timerText={timerText}
                      showEndDate={timerMode === 'per_access'}
                    />
                  )}
                  <div className="space-y-2">
                    <Label>本文（リッチテキスト・複数可）</Label>
                    <RichTextBlocksEditor value={contentBlocks} onChange={setContentBlocks} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>フォーム埋め込み</Label>
                    <div className="flex gap-2">
                      <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="フォームを選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {forms.map(form => (
                            <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={() => {
                          if (!selectedFormId) return;
                          const selectedForm = forms.find(f => f.id === selectedFormId);
                          const formEmbed = `<div class="form-embed" data-form-id="${selectedFormId}" style="padding: 20px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
                            <h3>📝 ${selectedForm?.name || 'フォーム'}</h3>
                            <p>フォームが埋め込まれます</p>
                          </div>`;
                          setContentBlocks(prev => [...prev, formEmbed]);
                          setSelectedFormId("");
                        }}
                        disabled={!selectedFormId}
                      >
                        追加
                      </Button>
                    </div>
                  </div>
                </>
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
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="tag-settings">
                      <AccordionTrigger className="text-sm">タグ設定</AccordionTrigger>
                      <AccordionContent className="space-y-4">
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
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

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
                        <Label>表示期限タイプ</Label>
                        <Select value={timerMode} onValueChange={(v) => setTimerMode(v as any)}>
                          <SelectTrigger>
                            <SelectValue placeholder="タイプ" />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="absolute">日時時間指定</SelectItem>
                            <SelectItem value="per_access">アクセス後カウント</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {timerMode === 'absolute' ? (
                        <div className="space-y-2">
                          <Label>表示期限（締切）</Label>
                          <Input type="datetime-local" value={timerDeadline} onChange={(e) => setTimerDeadline(e.target.value)} />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>カウント時間</Label>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">日</Label>
                              <Input 
                                type="number" 
                                min={0} 
                                value={durDays} 
                                onChange={(e) => {
                                  const v = Math.max(0, Number(e.target.value || 0));
                                  setDurDays(v);
                                  const newSeconds = toSeconds(v, durHours, durMinutes, durSecs);
                                  setDurationSeconds(newSeconds);
                                  console.log('Updated duration (days):', { days: v, hours: durHours, minutes: durMinutes, seconds: durSecs, total: newSeconds });
                                }}
                                className="h-8 w-full text-sm"
                                inputMode="numeric"
                                pattern="[0-9]*"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">時</Label>
                              <Input 
                                type="number" 
                                min={0} 
                                value={durHours} 
                                onChange={(e) => {
                                  const v = Math.max(0, Number(e.target.value || 0));
                                  setDurHours(v);
                                  const newSeconds = toSeconds(durDays, v, durMinutes, durSecs);
                                  setDurationSeconds(newSeconds);
                                  console.log('Updated duration (hours):', { days: durDays, hours: v, minutes: durMinutes, seconds: durSecs, total: newSeconds });
                                }}
                                className="h-8 w-full text-sm"
                                inputMode="numeric"
                                pattern="[0-9]*"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">分</Label>
                              <Input 
                                type="number" 
                                min={0} 
                                value={durMinutes} 
                                onChange={(e) => {
                                  const v = Math.max(0, Number(e.target.value || 0));
                                  setDurMinutes(v);
                                  const newSeconds = toSeconds(durDays, durHours, v, durSecs);
                                  setDurationSeconds(newSeconds);
                                  console.log('Updated duration (minutes):', { days: durDays, hours: durHours, minutes: v, seconds: durSecs, total: newSeconds });
                                }}
                                className="h-8 w-full text-sm"
                                inputMode="numeric"
                                pattern="[0-9]*"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">秒</Label>
                              <Input 
                                type="number" 
                                min={0} 
                                value={durSecs} 
                                onChange={(e) => {
                                  const v = Math.max(0, Number(e.target.value || 0));
                                  setDurSecs(v);
                                  const newSeconds = toSeconds(durDays, durHours, durMinutes, v);
                                  setDurationSeconds(newSeconds);
                                  console.log('Updated duration (seconds):', { days: durDays, hours: durHours, minutes: durMinutes, seconds: v, total: newSeconds });
                                }}
                                className="h-8 w-full text-sm"
                                inputMode="numeric"
                                pattern="[0-9]*"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <Label>ミリ秒を表示</Label>
                        <Switch checked={showMilliseconds} onCheckedChange={(v) => setShowMilliseconds(!!v)} />
                      </div>

                      <div className="space-y-2">
                        <Label>タイマーデザイン</Label>
                        <Select value={timerStyle} onValueChange={(v) => setTimerStyle(v as any)}>
                          <SelectTrigger>
                            <SelectValue placeholder="デザイン" />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="solid">ソリッド</SelectItem>
                            <SelectItem value="glass">グラス</SelectItem>
                            <SelectItem value="outline">アウトライン</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>背景色</Label>
                          <ColorPicker color={timerBgColor} onChange={setTimerBgColor} />
                        </div>
                        <div className="space-y-2">
                          <Label>文字色</Label>
                          <ColorPicker color={timerTextColor} onChange={setTimerTextColor} />
                        </div>
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
