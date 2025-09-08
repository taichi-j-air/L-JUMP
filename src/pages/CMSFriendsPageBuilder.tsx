import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { X, Eye, Link, Copy, ExternalLink } from "lucide-react";
import { TimerPreview } from "@/components/TimerPreview";
import FormAccessSelector from "@/components/FormAccessSelector";
import { FormEmbedSelector } from "@/components/FormEmbedSelector";
import { supabase } from "@/integrations/supabase/client";
import RichTextBlocksEditor from "@/components/RichTextBlocksEditor";
import { toast } from "sonner";

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
  const [contentHtml, setContentHtml] = useState("");
  const [contentBlocks, setContentBlocks] = useState<string[]>([]);
  const [allowedTags, setAllowedTags] = useState<string[]>([]);
  const [blockedTags, setBlockedTags] = useState<string[]>([]);
  const [requirePass, setRequirePass] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMode, setTimerMode] = useState<"absolute" | "per_access" | "step_delivery">("absolute");
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
  const [selectedScenario, setSelectedScenario] = useState("");
  const [selectedStep, setSelectedStep] = useState("");
  
  // Per-access duration inputs (D/H/M/S)
  const [durDays, setDurDays] = useState<number>(0);
  const [durHours, setDurHours] = useState<number>(0);
  const [durMinutes, setDurMinutes] = useState<number>(0);
  const [durSecs, setDurSecs] = useState<number>(0);

  // ✅ 正しい秒換算
  const toSeconds = (d: number, h: number, m: number, s: number) => d * 86400 + h * 3600 + m * 60 + s;

  const [saving, setSaving] = useState(false);
  const [showFormInsert, setShowFormInsert] = useState(false);
  const [showFormEmbed, setShowFormEmbed] = useState(false);

  const selected = pages.find(p => p.id === selectedId) || null;
  const hasLiffConfig = true; // Assume LIFF is configured

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
    setContentHtml("");
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
  };

  // Load selected page data
  useEffect(() => {
    if (!selected) return;
    setSlug(selected.slug || "");
    setTitle(selected.title || "");
    setContentHtml((selected as any).content || "");
    setContentBlocks(Array.isArray((selected as any).content_blocks) ? 
      (selected as any).content_blocks.filter((block: any) => typeof block === 'string') : []);
    setAllowedTags(selected.allowed_tag_ids || []);
    setBlockedTags(selected.blocked_tag_ids || []);
    setRequirePass(!!selected.require_passcode);
    setPasscode(selected.passcode || "");
    setTimerEnabled(!!selected.timer_enabled);
    setTimerMode((selected as any).timer_mode || "absolute");
    setTimerDeadline((selected as any).timer_deadline || "");
    setDurationSeconds((selected as any).timer_duration_seconds || 0);
    setShowMilliseconds(!!(selected as any).show_milliseconds);
    setTimerStyle((selected as any).timer_style || "solid");
    setTimerBgColor((selected as any).timer_bg_color || "#0cb386");
    setTimerTextColor((selected as any).timer_text_color || "#ffffff");
    setInternalTimer(!!(selected as any).internal_timer);
    setTimerText((selected as any).timer_text || "");
    setExpireAction((selected as any).expire_action || "keep_public");
    setDayLabel((selected as any).timer_day_label || "日");
    setHourLabel((selected as any).timer_hour_label || "時間");
    setMinuteLabel((selected as any).timer_minute_label || "分");
    setSecondLabel((selected as any).timer_second_label || "秒");
    setSelectedScenario((selected as any).timer_scenario_id || "");
    setSelectedStep((selected as any).timer_step_id || "");
    
    // Convert duration back to D/H/M/S
    const dur = (selected as any).timer_duration_seconds || 0;
    const days = Math.floor(dur / 86400);
    const hours = Math.floor((dur % 86400) / 3600);
    const minutes = Math.floor((dur % 3600) / 60);
    const seconds = dur % 60;
    setDurDays(days);
    setDurHours(hours);
    setDurMinutes(minutes);
    setDurSecs(seconds);
  }, [selected]);

  const handleAddPage = async () => {
    try {
      console.log("🔄 Adding new page...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("認証が必要です");
        return;
      }

      const payload = {
        title: "新しいページ",
        slug: `page-${Date.now()}`,
        content: "",
        content_blocks: [],
        visibility: "friends_only" as const,
        allowed_tag_ids: [],
        blocked_tag_ids: [],
        require_passcode: false,
        timer_enabled: false,
        timer_mode: "absolute",
        expire_action: "keep_public",
        user_id: user.id,  // 明示的にuser_idを設定
        is_published: true
      };
      
      console.log("📤 Inserting page with payload:", payload);
      const { data, error } = await supabase.from('cms_pages').insert(payload).select('*').single();
      
      if (error) {
        console.error("❌ Insert error:", error);
        throw error;
      }
      
      console.log("✅ Page created successfully:", data);
      setPages(prev => [data, ...prev]);
      setSelectedId(data.id);
      toast.success("ページを追加しました");
    } catch (e: any) {
      console.error("❌ Failed to add page:", e);
      toast.error(`ページの追加に失敗しました: ${e.message}`);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!selected) return;
    setSaving(true);
    try {
      const payload = {
        title,
        slug,
        content: contentHtml,
        content_blocks: contentBlocks,
        allowed_tag_ids: allowedTags,
        blocked_tag_ids: blockedTags,
        require_passcode: requirePass,
        passcode: requirePass ? passcode : null,
        timer_enabled: timerEnabled,
        timer_mode: timerMode,
        timer_deadline: timerMode === "absolute" ? new Date(timerDeadline).toISOString() : null,
        timer_duration_seconds: (timerMode === "per_access" || timerMode === "step_delivery") ? durationSeconds : null,
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
      // Check if passcode is required
      const url = requirePass 
        ? `/cms/preview/${selected.id}?passcode=${passcode}`
        : `/cms/preview/${selected.id}`;
      window.open(url, '_blank');
    }).catch(() => {
      // If save fails, still open preview with current data
      const url = requirePass 
        ? `/cms/preview/${selected.id}?passcode=${passcode}`
        : `/cms/preview/${selected.id}`;
      window.open(url, '_blank');
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
                          setSelectedId(p.id);
                          openPreview();
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center: edit panel */}
        <div className="col-span-12 md:col-span-5 space-y-3">
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

                  {/* Timer Preview in center column */}
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
                        showEndDate={timerMode === 'per_access' || timerMode === 'step_delivery'}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>コンテンツ</Label>
                    <RichTextBlocksEditor
                      value={contentBlocks}
                      onChange={setContentBlocks}
                    />
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => setShowFormEmbed(true)}>
                        フォーム埋め込み
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>従来HTMLコンテンツ</Label>
                    <Textarea 
                      value={contentHtml} 
                      onChange={(e) => setContentHtml(e.target.value)} 
                      placeholder="HTMLコンテンツ（廃止予定）"
                      rows={4}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: settings */}
        <div className="col-span-12 md:col-span-4 space-y-3">
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
                    <div className="text-xs text-muted-foreground break-all p-2 bg-muted rounded">{shareUrl}</div>
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
                        </div>
                      ) : null}

                      {/* Timer Customization */}
                      <Accordion type="multiple" className="w-full">
                        <AccordionItem value="timer-settings">
                          <AccordionTrigger className="text-sm">タイマー詳細設定</AccordionTrigger>
                          <AccordionContent className="space-y-3">
                            <div className="space-y-2">
                              <Label>期限切れ後の動作</Label>
                              <Select value={expireAction} onValueChange={(v) => setExpireAction(v as any)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="keep_public">そのまま表示</SelectItem>
                                  <SelectItem value="hide">ページを非表示</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>スタイル</Label>
                              <Select value={timerStyle} onValueChange={(v) => setTimerStyle(v as any)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="solid">ソリッド</SelectItem>
                                  <SelectItem value="glass">グラス</SelectItem>
                                  <SelectItem value="outline">アウトライン</SelectItem>
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

      {/* Modals */}
      {showFormEmbed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <FormEmbedSelector
            onInsert={(formHtml) => {
              setContentBlocks(prev => [...prev, formHtml]);
              setShowFormEmbed(false);
            }}
            onClose={() => setShowFormEmbed(false)}
          />
        </div>
      )}
    </div>
  );
}