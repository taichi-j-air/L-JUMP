import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { X, Eye, Link, Copy, Trash2 } from "lucide-react";
import { TimerPreview } from "@/components/TimerPreview";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EnhancedBlockEditor, Block } from "@/components/EnhancedBlockEditor";

export default function CMSFriendsPageBuilder() {
  const navigate = useNavigate();
  
  // States
  const [selectedId, setSelectedId] = useState<string>("");
  const [pages, setPages] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [scenarioSteps, setScenarioSteps] = useState<any[]>([]);
  
  // Form states
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [contentBlocks, setContentBlocks] = useState<Block[]>([]);
  const [allowedTags, setAllowedTags] = useState<string[]>([]);
  const [blockedTags, setBlockedTags] = useState<string[]>([]);
  const [requirePass, setRequirePass] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMode, setTimerMode] = useState<"absolute" | "per_access" | "step_delivery">("absolute");
  const [timerDeadline, setTimerDeadline] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [showMilliseconds, setShowMilliseconds] = useState<boolean>(false);

  // ▼ 画像③(minimal) を追加
  const [timerStyle, setTimerStyle] = useState<"solid" | "glass" | "outline" | "minimal">("solid");

  const [timerBgColor, setTimerBgColor] = useState<string>("#0cb386");
  const [timerTextColor, setTimerTextColor] = useState<string>("#ffffff");
  const [internalTimer, setInternalTimer] = useState(false);
  const [timerText, setTimerText] = useState("");
  const [expireAction, setExpireAction] = useState<"hide_page" | "keep_public">("keep_public");
  const [dayLabel, setDayLabel] = useState<string>("日");
  const [hourLabel, setHourLabel] = useState<string>("時間");
  const [minuteLabel, setMinuteLabel] = useState<string>("分");
  const [secondLabel, setSecondLabel] = useState<string>("秒");
  const [selectedScenario, setSelectedScenario] = useState("");
  const [selectedStep, setSelectedStep] = useState("");
  
  // Per-access duration inputs (D/H/M/S)
  const [durDays, setDurDays] = useState<number>(0);
  const [durHours, setDurHours] = useState<number>(0);
  const [durMinutes, setDurMinutes] = useState<number>(0);
  const [durSecs, setDurSecs] = useState<number>(0);
  
  // Toggle controls for timer display
  const [showRemainingText, setShowRemainingText] = useState<boolean>(true);
  const [showEndDate, setShowEndDate] = useState<boolean>(true);
  
  // External browser control
  const [forceExternalBrowser, setForceExternalBrowser] = useState<boolean>(false);

  const normalizeExpireAction = (value?: string | null): "hide_page" | "keep_public" => {
    if (value === "hide" || value === "hide_page") return "hide_page";
    return "keep_public";
  };

  // ✅ 正しい秒換算
  const toSeconds = (d: number, h: number, m: number, s: number) => d * 86400 + h * 3600 + m * 60 + s;

  const [saving, setSaving] = useState(false);

  const selected = pages.find(p => p.id === selectedId) || null;
  const hasLiffConfig = true; // Assume LIFF is configured

  const shareUrlRef = useRef<HTMLDivElement>(null);
  const [isShareUrlOverflowing, setIsShareUrlOverflowing] = useState(false);

  useEffect(() => {
    fetchPages();
    fetchTags();
    fetchScenarios();
  }, []);

  const fetchPages = async () => {
    try {
      const { data } = await supabase.from('cms_pages').select('*').order('created_at', { ascending: false });
      setPages(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTags = async () => {
    try {
      const { data } = await supabase.from('tags').select('*').order('name');
      setTags(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchScenarios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.from('step_scenarios').select('*').eq('user_id', user.id).order('name');
      setScenarios(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchScenarioSteps = async (scenarioId: string) => {
    try {
      const { data } = await supabase.from('steps').select('*').eq('scenario_id', scenarioId).order('step_order');
      setScenarioSteps(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedScenario) {
      fetchScenarioSteps(selectedScenario);
      setSelectedStep("");
    }
  }, [selectedScenario]);

  const resetForm = () => {
    setSlug("");
    setTitle("");
    setContentBlocks([]);
    setAllowedTags([]);
    setBlockedTags([]);
    setRequirePass(false);
    setPasscode("");
    setTimerEnabled(false);
    setTimerMode("absolute");
    setTimerDeadline("");
    setDurationSeconds(0);
    setShowMilliseconds(false);
    setTimerStyle("solid");
    setTimerBgColor("#0cb386");
    setTimerTextColor("#ffffff");
    setInternalTimer(false);
    setTimerText("");
    setExpireAction("keep_public");
    setDayLabel("日");
    setHourLabel("時間");
    setMinuteLabel("分");
    setSecondLabel("秒");
    setSelectedScenario("");
    setSelectedStep("");
    setDurDays(0);
    setDurHours(0);
    setDurMinutes(0);
    setDurSecs(0);
    setShowRemainingText(true);
    setShowEndDate(true);
  };

  // Load selected page data
  useEffect(() => {
    if (!selected) return;
    setSlug(selected.slug || "");
    setTitle(selected.title || "");
    
    if (Array.isArray(selected.content_blocks)) {
      setContentBlocks(selected.content_blocks);
    } else if (typeof selected.content_blocks === 'string') {
      try {
        setContentBlocks(JSON.parse(selected.content_blocks));
      } catch (e) {
        setContentBlocks([]);
      }
    } else {
      setContentBlocks([]);
    }

    setAllowedTags(selected.allowed_tag_ids || []);
    setBlockedTags(selected.blocked_tag_ids || []);
    setRequirePass(!!selected.require_passcode);
    setPasscode(selected.passcode || "");
    setTimerEnabled(!!selected.timer_enabled);
    setTimerMode((selected as any).timer_mode || "absolute");
    setTimerDeadline((selected as any).timer_deadline || "");
    setDurationSeconds((selected as any).timer_duration_seconds || 0);
    setShowMilliseconds(!!(selected as any).show_milliseconds);

    setTimerStyle(((selected as any).timer_style as "solid" | "glass" | "outline" | "minimal") || "solid");

    setTimerBgColor((selected as any).timer_bg_color || "#0cb386");
    setTimerTextColor((selected as any).timer_text_color || "#ffffff");
    setInternalTimer(!!(selected as any).internal_timer);
    setTimerText((selected as any).timer_text || "");
    setExpireAction(normalizeExpireAction((selected as any).expire_action));
    setDayLabel((selected as any).timer_day_label || "日");
    setHourLabel((selected as any).timer_hour_label || "時間");
    setMinuteLabel((selected as any).timer_minute_label || "分");
    setSecondLabel((selected as any).timer_second_label || "秒");
    setSelectedScenario((selected as any).timer_scenario_id || "");
    setSelectedStep((selected as any).timer_step_id || "");
    
    const dur = (selected as any).timer_duration_seconds || 0;
    const days = Math.floor(dur / 86400);
    const hours = Math.floor((dur % 86400) / 3600);
    const minutes = Math.floor((dur % 3600) / 60);
    const seconds = dur % 60;
    setDurDays(days);
    setDurHours(hours);
    setDurMinutes(minutes);
    setDurSecs(seconds);
    
    setShowRemainingText((selected as any).show_remaining_text ?? true);
    setShowEndDate((selected as any).show_end_date ?? true);
    setForceExternalBrowser((selected as any).force_external_browser ?? false);
  }, [selected]);

  const handleAddPage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("認証が必要です");
        return;
      }

      const payload = {
        user_id: user.id,
        title: "新しいページ",
        slug: `page-${Date.now()}`,
        content_blocks: [],
        visibility: "friends_only" as const,
        allowed_tag_ids: [],
        blocked_tag_ids: [],
        require_passcode: false,
        timer_enabled: false,
        timer_mode: "absolute",
        expire_action: "keep_public",
      };
      const { data, error } = await (supabase as any).from('cms_pages').insert(payload).select('*').maybeSingle();
      if (error) throw error;
      setPages(prev => [data, ...prev]);
      setSelectedId(data.id);
      toast.success("ページを追加しました");
    } catch (e: any) {
      console.error(e);
      toast.error("ページの追加に失敗しました");
    }
  };

  const handleDeletePage = async (pageId: string) => {
    try {
      const { error } = await supabase.from('cms_pages').delete().eq('id', pageId);
      if (error) throw error;
      
      setPages(prev => prev.filter(p => p.id !== pageId));
      if (selectedId === pageId) {
        setSelectedId("");
        resetForm();
      }
      toast.success("ページを削除しました");
    } catch (e: any) {
      console.error(e);
      toast.error("ページの削除に失敗しました");
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!selected) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("認証が必要です");
        return;
      }

      const currentDurationSeconds = toSeconds(durDays, durHours, durMinutes, durSecs);

      let validatedTimerDeadline = null;
      if (timerMode === "absolute" && timerDeadline) {
        const deadlineDate = new Date(timerDeadline);
        if (isNaN(deadlineDate.getTime())) {
          toast.error("期限日時が正しくありません");
          return;
        }
        validatedTimerDeadline = deadlineDate.toISOString();
      }

      const payload = {
        title,
        slug,
        content_blocks: contentBlocks,
        allowed_tag_ids: allowedTags,
        blocked_tag_ids: blockedTags,
        require_passcode: requirePass,
        passcode: requirePass ? passcode : null,
        timer_enabled: timerEnabled,
        timer_mode: timerMode,
        timer_deadline: validatedTimerDeadline,
        timer_duration_seconds: (timerMode === "per_access" || timerMode === "step_delivery") ? currentDurationSeconds : null,
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
        timer_scenario_id: timerMode === "step_delivery" ? selectedScenario || null : null,
        timer_step_id: timerMode === "step_delivery" ? selectedStep || null : null,
        show_remaining_text: showRemainingText,
        show_end_date: showEndDate,
        force_external_browser: forceExternalBrowser,
      };

      const { data, error } = await supabase
        .from('cms_pages')
        .update({
          ...payload,
          content_blocks: JSON.stringify(payload.content_blocks)
        })
        .eq('id', selected.id)
        .select('*')
        .maybeSingle();
      
      if (error) {
        console.error("Save error:", error);
        throw error;
      }

      setPages(prev => prev.map(p => (p.id === selected.id ? { ...(p as any), ...(data as any) } : p)) as any);
      toast.success("保存しました");
      return Promise.resolve();
    } catch (e: any) {
      console.error("Save failed:", e);
      toast.error(`保存に失敗しました: ${e.message}`);
      return Promise.reject(e);
    } finally {
      setSaving(false);
    }
  };

  const shareUrl = useMemo(() => {
    if (!selected) return "";
    const queryParams = [];
    if (hasLiffConfig) {
      queryParams.push('uid=[UID]');
    }
    if (forceExternalBrowser) {
      queryParams.push('openExternalBrowser=1');
    }
    const baseUrl = `${window.location.origin}/cms/f/${selected.share_code}`;
    if (queryParams.length > 0) {
      return `${baseUrl}?${queryParams.join('&')}`;
    }
    return baseUrl;
  }, [selected, hasLiffConfig, forceExternalBrowser]);

  useEffect(() => {
    const checkOverflow = () => {
      if (shareUrlRef.current) {
        const el = shareUrlRef.current;
        const isOverflowing = el.scrollWidth > el.clientWidth;
        if (isOverflowing !== isShareUrlOverflowing) {
          setIsShareUrlOverflowing(isOverflowing);
        }
      }
    };

    const timer = setTimeout(checkOverflow, 50);
    window.addEventListener('resize', checkOverflow);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [shareUrl, selected, isShareUrlOverflowing]);

  const toggleAllowed = (id: string) => {
    setAllowedTags(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setBlockedTags(b => b.filter(x => x !== id));
      return next;
    });
  };
  const toggleBlocked = (id: string) => {
    setBlockedTags(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setAllowedTags(a => a.filter(x => x !== id));
      return next;
    });
  };

  const openPreview = () => {
    if (!selected) return;
    handleSave().then(() => {
      const url = requirePass 
        ? `/cms/preview/${selected.id}?passcode=${passcode}`
        : `/cms/preview/${selected.id}`;
      window.open(url, '_blank');
    }).catch(() => {
      const url = requirePass 
        ? `/cms/preview/${selected.id}?passcode=${passcode}`
        : `/cms/preview/${selected.id}`;
      window.open(url, '_blank');
    });
  };
  return (
    <div className="max-w-[1200px] w-full space-y-4 px-4 ml-0 mr-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">LINE友達ページ作成</h1>
        <p className="text-muted-foreground">3カラムでページ追加・編集・公開設定ができます。</p>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-3 space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">ページ一覧</CardTitle>
              <Button size="sm" onClick={handleAddPage}>ページを追加</Button>
            </CardHeader>
            <CardContent className="p-2">
              {pages.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">まだページがありません</p>
              ) : (
                <div className="space-y-1">
                  {pages.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between border rounded-md px-2 py-1.5 transition-all ${
                        selectedId === p.id 
                          ? 'bg-primary/10 border-primary shadow-sm' 
                          : 'border-border hover:border-primary/50 hover:bg-muted/60'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedId(p.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="text-sm font-medium line-clamp-1">{p.title}</div>
                      </button>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(p.id);
                            openPreview();
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('このページを削除しますか？')) {
                              handleDeletePage(p.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-6 space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">ページ編集</CardTitle>
              {selected && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={openPreview}>
                    <Eye className="h-3 w-3 mr-1" />
                    プレビュー
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "保存中..." : "保存"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">左側のリストからページを選択してください。</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>タイトル</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ページタイトル" />
                  </div>

                  {timerEnabled && (
                    <div className="space-y-2">
                      <Label>タイマープレビュー</Label>
                      <TimerPreview
                        mode={timerMode}
                        deadline={timerMode === "absolute" && timerDeadline ? new Date(timerDeadline).toISOString() : undefined}
                        durationSeconds={(timerMode === "per_access" || timerMode === "step_delivery") ? durationSeconds : undefined}
                        showMilliseconds={showMilliseconds}
                        styleVariant={timerStyle}
                        bgColor={timerBgColor}
                        textColor={timerTextColor}
                        dayLabel={dayLabel}
                        hourLabel={hourLabel}
                        minuteLabel={minuteLabel}
                        secondLabel={secondLabel}
                         preview={true}
                         internalTimer={internalTimer}
                         timerText={timerText}
                         showEndDate={showEndDate}
                         showRemainingText={showRemainingText}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>コンテンツ</Label>
                    <EnhancedBlockEditor
                      key={selected?.id || 'no-selection'}
                      blocks={contentBlocks}
                      onChange={setContentBlocks}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-3 space-y-3">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">公開設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">ページを選択してください。</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      共有URL
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(shareUrl);
                          toast.success("URLをコピーしました");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </Label>
                    <div 
                      className="bg-muted rounded-md border px-3 py-1 text-xs text-muted-foreground overflow-hidden whitespace-nowrap cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        toast.success("URLをコピーしました");
                      }}
                      title="クリックしてURLをコピー"
                    >
                      {isShareUrlOverflowing ? (
                        <div className="inline-block hover:animate-scroll-left">
                          <span className="pr-16">{shareUrl}</span>
                          <span>{shareUrl}</span>
                        </div>
                      ) : (
                        <div ref={shareUrlRef}>{shareUrl}</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      ページ表示
                      <Switch 
                        checked={selected?.is_published ?? true} 
                        onCheckedChange={async (checked) => {
                          if (!selected) return;
                          try {
                            const { data, error } = await supabase
                              .from('cms_pages')
                              .update({ is_published: checked })
                              .eq('id', selected.id)
                              .select('*')
                              .maybeSingle();
                            if (error) throw error;
                            setPages(prev => prev.map(p => p.id === selected.id ? data : p));
                            toast.success(checked ? "ページを表示しました" : "ページを非表示にしました");
                          } catch (e: any) {
                            console.error(e);
                            toast.error("更新に失敗しました");
                          }
                        }}
                      />
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {selected?.is_published ? "このページはLINE友達に表示されています" : "このページは非表示です（誰もアクセス不可）"}
                    </p>
                  </div>

                  <Accordion type="multiple" className="w-full">
                    <AccordionItem value="url-settings">
                      <AccordionTrigger className="text-sm">URL設定</AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="force-external">外部ブラウザで強制表示</Label>
                          <Switch 
                            id="force-external"
                            checked={forceExternalBrowser} 
                            onCheckedChange={setForceExternalBrowser} 
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          オンにするとLINE内ブラウザでは開かれず、safariなどの外部ブラウザで表示されます。
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="tag-access">
                      <AccordionTrigger className="text-sm">タグアクセス制御</AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <div className="space-y-2">
                          <Label>閲覧を許可するタグ</Label>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
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
                          <div className="space-y-1 max-h-32 overflow-y-auto">
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
                            <SelectItem value="step_delivery">ステップ配信時からカウント</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {timerMode === 'absolute' ? (
                        <div className="space-y-2">
                          <Label>表示期限（締切）</Label>
                          <Input type="datetime-local" value={timerDeadline} onChange={(e) => setTimerDeadline(e.target.value)} />
                        </div>
                      ) : (timerMode === 'per_access' || timerMode === 'step_delivery') ? (
                        <div className="space-y-4">
                          {timerMode === 'step_delivery' && (
                            <>
                              <div className="space-y-2">
                                <Label>対象シナリオ</Label>
                                <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="シナリオを選択" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {scenarios.map((scenario) => (
                                      <SelectItem key={scenario.id} value={scenario.id}>
                                        {scenario.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {selectedScenario && (
                                <div className="space-y-2">
                                  <Label>対象ステップ</Label>
                                  <Select value={selectedStep} onValueChange={setSelectedStep}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="ステップを選択" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {scenarioSteps.map((step) => (
                                        <SelectItem key={step.id} value={step.id}>
                                          {step.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </>
                          )}
                          
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
                                    
                                  }}
                                  className="h-8 w-full text-sm"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <Accordion type="multiple" className="w-full">
                        <AccordionItem value="timer-settings">
                          <AccordionTrigger className="text-sm">タイマー詳細設定</AccordionTrigger>
                          <AccordionContent className="space-y-3">
                            <div className="space-y-2">
                              <Label>期限切れ後の動作</Label>
                              <Select value={expireAction} onValueChange={(v) => setExpireAction(normalizeExpireAction(v))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="keep_public">そのまま表示</SelectItem>
                                  <SelectItem value="hide_page">ページを非表示</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>スタイル</Label>
                              <Select value={timerStyle} onValueChange={(v) => setTimerStyle(v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-background">
                                  <SelectItem value="solid">ソリッド</SelectItem>
                                  <SelectItem value="glass">画像①（横ラベル）</SelectItem>
                                  <SelectItem value="outline">画像②（円リング）</SelectItem>
                                  <SelectItem value="minimal">画像③（ミニマル）</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-2">
                                <Label>背景色</Label>
                                <Input type="color" value={timerBgColor} onChange={(e) => setTimerBgColor(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label>文字色</Label>
                                <Input type="color" value={timerTextColor} onChange={(e) => setTimerTextColor(e.target.value)} />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-2">
                                <Label>日ラベル</Label>
                                <Input value={dayLabel} onChange={(e) => setDayLabel(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label>時間ラベル</Label>
                                <Input value={hourLabel} onChange={(e) => setHourLabel(e.target.value)} />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-2">
                                <Label>分ラベル</Label>
                                <Input value={minuteLabel} onChange={(e) => setMinuteLabel(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label>秒ラベル</Label>
                                <Input value={secondLabel} onChange={(e) => setSecondLabel(e.target.value)} />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="flex items-center justify-between">
                                内部タイマー
                                <Switch checked={internalTimer} onCheckedChange={(v) => setInternalTimer(!!v)} />
                              </Label>
                              {internalTimer && (
                                <Input value={timerText} onChange={(e) => setTimerText(e.target.value)} placeholder="期間限定公開" />
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label className="flex items-center justify-between">
                                ミリ秒表示
                                <Switch checked={showMilliseconds} onCheckedChange={(v) => setShowMilliseconds(!!v)} />
                              </Label>
                            </div>

                            {(timerStyle === 'outline' || timerStyle === 'minimal') && (
                              <div className="space-y-2">
                                <Label className="flex items-center justify-between">
                                  「終了まで残り」テキスト表示
                                  <Switch checked={showRemainingText} onCheckedChange={setShowRemainingText} />
                                </Label>
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label className="flex items-center justify-between">
                                終了日時表示
                                <Switch checked={showEndDate} onCheckedChange={setShowEndDate} />
                              </Label>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>

                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
