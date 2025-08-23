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
import { 
  Trash2, 
  FormInput, 
  FileText, 
  GripVertical, 
  Plus, 
  ChevronDown, 
  ChevronUp,
  Edit3
} from "lucide-react";

// 【統合】全コンテンツブロックの型定義
interface ContentBlock {
  id: string;
  type: 'richtext' | 'form';
  title: string;
  order: number;
  data: any;
}

// 【統合】リッチテキストブロック
interface RichTextBlock extends ContentBlock {
  type: 'richtext';
  data: {
    html: string;
  };
}

// 【統合】フォームブロック
interface FormBlock extends ContentBlock {
  type: 'form';
  data: {
    formId: string;
    formName: string;
  };
}

// CMSページの型定義（フォーム専用カラムを削除し、統合コンテンツブロックに変更）
interface CmsPageRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  share_code: string;
  visibility: "friends_only" | "public" | "private";
  internal_name?: string | null;
  tag_label?: string | null;
  content_blocks?: ContentBlock[]; // 【変更】統合型に変更
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

export default function CMSFriendsPageBuilder() {
  // 【基本状態管理】ページとコンテンツの状態
  const [pages, setPages] = useState<CmsPageRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => pages.find(p => p.id === selectedId) || null, [pages, selectedId]);
  const { hasLiffConfig } = useLiffValidation();

  // 【ページ情報の状態】タイトル、スラッグなどの基本情報
  const [internalName, setInternalName] = useState("");
  const [tagLabel, setTagLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  
  // 【統合コンテンツブロックの状態】リッチテキストとフォームを統合管理
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  
  // 【開閉状態の管理】各ブロックの編集画面の開閉状態
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  // 【右カラムの設定項目】タグ・パスコード・タイマー等の設定
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
  
  // 【タイマー設定（アクセス後カウント用）】日・時・分・秒の入力値
  const [durDays, setDurDays] = useState<number>(0);
  const [durHours, setDurHours] = useState<number>(0);
  const [durMinutes, setDurMinutes] = useState<number>(0);
  const [durSecs, setDurSecs] = useState<number>(0);

  // 【その他の状態】保存中フラグ、公開設定、フォーム一覧
  const [saving, setSaving] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [forms, setForms] = useState<Array<{id: string; name: string}>>([]);

  // 【ユーティリティ関数】日・時・分・秒を合計秒数に変換
  const toSeconds = (d: number, h: number, m: number, s: number) => d * 86400 + h * 3600 + m * 60 + s;

  // 【コンテンツブロック操作】新しいリッチテキストブロックを追加
  const addRichTextBlock = () => {
    const newBlock: RichTextBlock = {
      id: `richtext_${Date.now()}`,
      type: 'richtext',
      title: 'テキストコンテンツ',
      order: contentBlocks.length,
      data: { html: '' }
    };
    setContentBlocks(prev => [...prev, newBlock]);
    // 新しく追加したブロックを展開状態にする
    setExpandedBlocks(prev => new Set([...prev, newBlock.id]));
  };

  // 【コンテンツブロック操作】新しいフォームブロックを追加
  const addFormBlock = () => {
    const newBlock: FormBlock = {
      id: `form_${Date.now()}`,
      type: 'form',
      title: 'フォーム埋め込み',
      order: contentBlocks.length,
      data: { formId: '', formName: '' }
    };
    setContentBlocks(prev => [...prev, newBlock]);
    // 新しく追加したフォームブロックを展開状態にする
    setExpandedBlocks(prev => new Set([...prev, newBlock.id]));
  };

  // 【コンテンツブロック操作】ブロックの更新（タイトルや内容の変更）
  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    setContentBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
  };

  // 【コンテンツブロック操作】ブロックの削除
  const deleteBlock = (blockId: string) => {
    setContentBlocks(prev => prev.filter(block => block.id !== blockId));
    // 削除したブロックの展開状態も削除
    setExpandedBlocks(prev => {
      const newSet = new Set(prev);
      newSet.delete(blockId);
      return newSet;
    });
  };

  // 【コンテンツブロック操作】ブロックの展開/折りたたみ切り替え
  const toggleBlockExpansion = (blockId: string) => {
    setExpandedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blockId)) {
        newSet.delete(blockId);
      } else {
        newSet.add(blockId);
      }
      return newSet;
    });
  };

  // 【ドラッグ&ドロップ】ブロックの順序変更（簡易版）
  const moveBlock = (fromIndex: number, toIndex: number) => {
    setContentBlocks(prev => {
      const newBlocks = [...prev];
      const [movedBlock] = newBlocks.splice(fromIndex, 1);
      newBlocks.splice(toIndex, 0, movedBlock);
      // order値を再計算
      return newBlocks.map((block, index) => ({ ...block, order: index }));
    });
  };

  // 【初期化処理】タイマーの秒数計算
  useEffect(() => {
    setDurationSeconds(toSeconds(durDays, durHours, durMinutes, durSecs));
  }, [durDays, durHours, durMinutes, durSecs]);

  // 【初期化処理】ページタイトルとメタデータの設定
  useEffect(() => {
    document.title = "LINE友達ページ作成 | CMS";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'LINE友達限定ページを3カラム編集で作成・管理できます。');
  }, []);

  // 【データ取得】ページ・タグ・フォーム一覧をSupabaseから取得
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return toast.error("ログインが必要です");

      // タグ一覧を取得
      const { data: tagRows, error: tagErr } = await (supabase as any)
        .from('tags')
        .select('id,name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!tagErr) setTags(tagRows || []);

      // フォーム一覧を取得
      const { data: formRows } = await (supabase as any)
        .from('forms')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setForms(formRows || []);

      // ページ一覧を取得
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
      
      // 取得したデータを整形（配列の安全性チェック）
      const arr: CmsPageRow[] = (pageRows || []).map((r: any) => ({
        ...r,
        content_blocks: Array.isArray(r.content_blocks) ? r.content_blocks : [],
        allowed_tag_ids: Array.isArray(r.allowed_tag_ids) ? r.allowed_tag_ids : [],
        blocked_tag_ids: Array.isArray(r.blocked_tag_ids) ? r.blocked_tag_ids : [],
      }));
      
      setPages(arr);
      // 最初のページを選択状態にする
      if (arr.length > 0) setSelectedId(arr[0].id);
    };
    load();
  }, []);

  // 【ページ選択時の処理】選択されたページの情報をフォームに読み込み
  useEffect(() => {
    if (!selected) return;
    
    // 基本情報の読み込み
    setInternalName(selected.internal_name || selected.title || "");
    setTagLabel(selected.tag_label || "");
    setSlug(selected.slug || "");
    setTitle(selected.title || "");
    
    // コンテンツブロックの読み込み（統合型）
    setContentBlocks(Array.isArray(selected.content_blocks) ? selected.content_blocks : []);
    
    // 公開設定・権限設定の読み込み
    setAllowedTags(selected.allowed_tag_ids || []);
    setBlockedTags(selected.blocked_tag_ids || []);
    setRequirePass(!!selected.require_passcode);
    setPasscode(selected.passcode || "");
    
    // タイマー設定の読み込み
    setTimerEnabled(!!selected.timer_enabled);
    setTimerMode(((selected as any).timer_mode as any) || "absolute");
    setTimerDeadline(selected.timer_deadline ? selected.timer_deadline.slice(0, 16) : "");
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
    
    // タイマー時間の逆算（秒数から日・時・分・秒に変換）
    const secsInit = Number((selected as any).timer_duration_seconds || 0);
    const d = Math.floor(secsInit / 86400);
    const h = Math.floor((secsInit % 86400) / 3600);
    const m = Math.floor((secsInit % 3600) / 60);
    const s = secsInit % 60;
    setDurDays(d);
    setDurHours(h);
    setDurMinutes(m);
    setDurSecs(s);
    
    // 公開状態の読み込み（friends_onlyを公開として扱う）
    setIsPublic(selected.visibility === 'friends_only');
  }, [selectedId]);

  // 【ページ操作】新しいページを追加
  const handleAddPage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return toast.error("ログインが必要です");
      
      // デフォルト値の設定
      const nowId = Date.now();
      const defaultTitle = "新規ページ";
      const defaultSlug = `page-${nowId}`;

      // Supabaseにページを挿入
      const { data, error } = await (supabase as any)
        .from('cms_pages')
        .insert({
          user_id: user.id,
          title: defaultTitle,
          internal_name: defaultTitle,
          slug: defaultSlug,
          visibility: 'private', // 初期値は非公開
          content: "",
          content_blocks: [], // 空の統合ブロック配列
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
      
      // ページ一覧に追加し、新しいページを選択状態にする
      setPages(prev => [data as CmsPageRow, ...prev]);
      setSelectedId(data.id);
      toast.success("ページを追加しました");
    } catch (e) {
      console.error(e);
      toast.error("ページの追加に失敗しました");
    }
  };

  // 【ページ操作】ページを削除
  const handleDelete = async (pageId: string) => {
    if (!confirm("このページを削除しますか？この操作は取り消せません。")) return;
    
    try {
      // Supabaseからページを削除
      const { error } = await (supabase as any)
        .from('cms_pages')
        .delete()
        .eq('id', pageId);
      
      if (error) throw error;
      
      // ローカル状態からページを削除
      setPages(prev => prev.filter(p => p.id !== pageId));
      
      // 削除したページが選択中だった場合、別のページを選択
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

  // 【保存処理】ページの内容をSupabaseに保存
  const handleSave = async () => {
    if (!selected) return;
    if (!title || !slug) {
      toast.error("ページ名とスラッグは必須です");
      return;
    }
    
    setSaving(true);
    try {
      // 保存用のペイロード作成
      const payload = {
        title,
        slug,
        internal_name: internalName,
        tag_label: tagLabel,
        visibility: isPublic ? 'friends_only' : 'private', // 公開=friends_only, 非公開=private
        content_blocks: contentBlocks, // 統合型コンテンツブロック
        allowed_tag_ids: allowedTags,
        blocked_tag_ids: blockedTags,
        require_passcode: requirePass,
        passcode: requirePass ? (passcode || null) : null,
        timer_enabled: timerEnabled,
        timer_deadline: timerEnabled && timerMode === 'absolute' && timerDeadline 
          ? new Date(timerDeadline).toISOString() : null,
        timer_mode: timerMode,
        timer_duration_seconds: timerEnabled && timerMode === 'per_access' 
          ? toSeconds(durDays, durHours, durMinutes, durSecs) : null,
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

      // Supabaseにデータを更新
      const { data, error } = await (supabase as any)
        .from('cms_pages')
        .update(payload)
        .eq('id', selected.id)
        .select('*')
        .maybeSingle();
        
      if (error) throw error;

      // ローカル状態を更新
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

  // 【URL生成】共有用URLの生成
  const shareUrl = useMemo(() => {
    if (!selected) return "";
    const baseUrl = `${window.location.origin}/cms/f/${selected.share_code}`;
    if (hasLiffConfig) {
      return `${baseUrl}?uid=[UID]`;
    }
    return baseUrl;
  }, [selected, hasLiffConfig]);

  // 【タグ操作】許可タグの切り替え
  const toggleAllowed = (id: string) => {
    setAllowedTags(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setBlockedTags(b => b.filter(x => x !== id)); // 許可に追加されたら禁止から削除
      return next;
    });
  };

  // 【タグ操作】禁止タグの切り替え
  const toggleBlocked = (id: string) => {
    setBlockedTags(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setAllowedTags(a => a.filter(x => x !== id)); // 禁止に追加されたら許可から削除
      return next;
    });
  };

  // 【プレビュー】プレビュー画面を開く（保存してから実行）
  const openPreview = () => {
    if (!selected) return;
    handleSave().then(() => {
      window.open(`/cms/preview/${selected.id}`, '_blank');
    });
  };

  return (
    <div className="container mx-auto max-w-[1200px] space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">LINE友達ページ作成</h1>
        <p className="text-muted-foreground">統合型コンテンツビルダーでページを作成・編集・公開設定ができます。</p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* 【左カラム】ページ一覧とページ追加ボタン */}
        <div className="col-span-12 md:col-span-3 space-y-3">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">ページ一覧</CardTitle>
              <Button size="sm" onClick={handleAddPage} className="h-8">
                <Plus className="h-3 w-3 mr-1" />
                追加
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {pages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  まだページがありません
                </p>
              ) : (
                <div className="space-y-2">
                  {pages.map((p) => (
                    <div
                      key={p.id}
                      className={`
                        flex items-center justify-between rounded-lg px-3 py-2 
                        border transition-all duration-200 cursor-pointer
                        ${selectedId === p.id 
                          ? 'bg-primary/10 border-primary/30 shadow-sm' 
                          : 'border-border hover:border-primary/20 hover:bg-muted/50'
                        }
                      `}
                    >
                      <button
                        onClick={() => setSelectedId(p.id)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-medium line-clamp-1 mb-1">
                          {p.internal_name || p.title}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          /{p.slug}
                        </div>
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(p.id);
                        }}
                        className="ml-2 h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 【中央カラム】ページ情報とコンテンツビルダー */}
        <div className="col-span-12 md:col-span-6 space-y-4">
          {/* ページ基本情報 */}
          <Card className="shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base">ページ情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  左からページを選択するか新規作成してください
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">ページ名（ツール内）</Label>
                      <Input 
                        value={internalName} 
                        onChange={(e) => setInternalName(e.target.value)} 
                        placeholder="例）会員限定ページA"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">ページタブ名</Label>
                      <Input 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)} 
                        placeholder="例）会員限定のお知らせ"
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      このページのURL {hasLiffConfig && "(LIFF認証対応)"}
                    </Label>
                    <div className="flex gap-2">
                      <Input readOnly value={shareUrl} className="h-9 bg-muted/50" />
                      <Button 
                        type="button" 
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast.success("URLをコピーしました"))}
                        className="h-9"
                      >
                        コピー
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <Label className="text-sm font-medium">
                      ページを{isPublic ? "公開中" : "非公開"}
                    </Label>
                    <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 統合コンテンツビルダー */}
          <Card className="shadow-sm">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">コンテンツビルダー</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={openPreview} 
                    disabled={!selected}
                    className="h-8"
                  >
                    プレビュー
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  ページを選択してください
                </p>
              ) : (
                <>
                  {/* タイマープレビュー（タイマーが有効な場合のみ表示） */}
                  {timerEnabled && (
                    <div className="p-3 border rounded-lg bg-muted/30">
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
                    </div>
                  )}

                  {/* コンテンツ追加ボタン */}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={addRichTextBlock}
                      className="h-8 flex items-center gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      テキスト追加
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={addFormBlock}
                      className="h-8 flex items-center gap-1"
                    >
                      <FormInput className="h-3 w-3" />
                      フォーム追加
                    </Button>
                  </div>

                  {/* コンテンツブロック一覧 */}
                  {contentBlocks.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        コンテンツがありません
                      </p>
                      <p className="text-xs text-muted-foreground">
                        上のボタンからテキストやフォームを追加してください
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contentBlocks
                        .sort((a, b) => a.order - b.order)
                        .map((block, index) => (
                        <div
                          key={block.id}
                          className={`
                            border rounded-lg transition-all duration-200
                            ${block.type === 'form' 
                              ? 'border-l-4 border-l-emerald-500 bg-emerald-50/50' 
                              : 'border-l-4 border-l-blue-500 bg-blue-50/50'
                            }
                          `}
                        >
                          {/* ブロックヘッダー */}
                          <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="cursor-move p-1 rounded hover:bg-muted/50">
                                <GripVertical className="h-3 w-3 text-muted-foreground" />
                              </div>
                              
                              {block.type === 'richtext' ? (
                                <FileText className="h-4 w-4 text-blue-600" />
                              ) : (
                                <FormInput className="h-4 w-4 text-emerald-600" />
                              )}
                              
                              <div className="flex-1">
                                <Input
                                  value={block.title}
                                  onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                                  className="h-7 text-sm font-medium border-0 bg-transparent p-0 focus-visible:ring-0"
                                  placeholder="ブロックタイトル"
                                />
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleBlockExpansion(block.id)}
                                className="h-7 w-7 p-0"
                              >
                                {expandedBlocks.has(block.id) ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteBlock(block.id)}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* ブロック編集エリア（展開時のみ表示） */}
                          {expandedBlocks.has(block.id) && (
                            <div className="border-t bg-background/50 p-3">
                              {block.type === 'richtext' ? (
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">リッチテキスト内容</Label>
                                  <div className="border rounded-md">
                                    <RichTextEditor
                                      value={block.data.html}
                                      onChange={(html) => updateBlock(block.id, { 
                                        data: { ...block.data, html } 
                                      })}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">埋め込むフォーム</Label>
                                    <Select 
                                      value={block.data.formId} 
                                      onValueChange={(formId) => {
                                        const selectedForm = forms.find(f => f.id === formId);
                                        updateBlock(block.id, { 
                                          data: { 
                                            formId, 
                                            formName: selectedForm?.name || '' 
                                          } 
                                        });
                                      }}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="フォームを選択してください" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {forms.map(form => (
                                          <SelectItem key={form.id} value={form.id}>
                                            {form.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {block.data.formId && (
                                    <div className="p-3 bg-muted/30 rounded-lg text-sm">
                                      <div className="flex items-center gap-2">
                                        <FormInput className="h-4 w-4 text-emerald-600" />
                                        <span className="font-medium">選択中:</span>
                                        <span>{block.data.formName}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* 保存ボタン */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={saving || !selected}
              className="h-9"
            >
              {saving ? '保存中…' : '保存する'}
            </Button>
          </div>
        </div>

        {/* 【右カラム】公開条件とタイマー設定 */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          {/* 公開条件の設定 */}
          <Card className="shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base">公開条件の設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  ページを選択してください
                </p>
              ) : (
                <>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="tag-settings">
                      <AccordionTrigger className="text-sm py-2">タグ設定</AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">閲覧を許可するタグ</Label>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {tags.map(t => (
                              <label key={t.id} className="flex items-center gap-2 text-sm">
                                <Checkbox 
                                  checked={allowedTags.includes(t.id)} 
                                  onCheckedChange={() => toggleAllowed(t.id)} 
                                />
                                <span>{t.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">閲覧を禁止するタグ</Label>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {tags.map(t => (
                              <label key={t.id} className="flex items-center gap-2 text-sm">
                                <Checkbox 
                                  checked={blockedTags.includes(t.id)} 
                                  onCheckedChange={() => toggleBlocked(t.id)} 
                                />
                                <span>{t.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">パスコード保護</Label>
                      <Switch checked={requirePass} onCheckedChange={setRequirePass} />
                    </div>
                    {requirePass && (
                      <Input 
                        value={passcode} 
                        onChange={(e) => setPasscode(e.target.value)} 
                        placeholder="例）1234"
                        className="h-9"
                      />
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* タイマー設定 */}
          <Card className="shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base">表示期限とタイマー</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  ページを選択してください
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">カウントダウンタイマー</Label>
                    <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
                  </div>
                  
                  {timerEnabled && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">表示期限タイプ</Label>
                        <Select value={timerMode} onValueChange={(v) => setTimerMode(v as any)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="タイプ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="absolute">日時時間指定</SelectItem>
                            <SelectItem value="per_access">アクセス後カウント</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {timerMode === 'absolute' ? (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">表示期限（締切）</Label>
                          <Input 
                            type="datetime-local" 
                            value={timerDeadline} 
                            onChange={(e) => setTimerDeadline(e.target.value)}
                            className="h-9"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">カウント時間</Label>
                          <div className="grid grid-cols-4 gap-1">
                            {[
                              { label: '日', value: durDays, setter: setDurDays },
                              { label: '時', value: durHours, setter: setDurHours },
                              { label: '分', value: durMinutes, setter: setDurMinutes },
                              { label: '秒', value: durSecs, setter: setDurSecs },
                            ].map(({ label, value, setter }, idx) => (
                              <div key={idx} className="space-y-1">
                                <Label className="text-xs font-medium">{label}</Label>
                                <Input 
                                  type="number" 
                                  min={0} 
                                  value={value} 
                                  onChange={(e) => setter(Math.max(0, Number(e.target.value || 0)))}
                                  className="h-8 text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">ミリ秒を表示</Label>
                        <Switch checked={showMilliseconds} onCheckedChange={setShowMilliseconds} />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">タイマーデザイン</Label>
                        <Select value={timerStyle} onValueChange={(v) => setTimerStyle(v as any)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="デザイン" />
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
                          <Label className="text-sm font-medium">背景色</Label>
                          <ColorPicker color={timerBgColor} onChange={setTimerBgColor} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">文字色</Label>
                          <ColorPicker color={timerTextColor} onChange={setTimerTextColor} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">内部タイマーにする</Label>
                        <Switch checked={internalTimer} onCheckedChange={setInternalTimer} />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">内部タイマー時の表示テキスト</Label>
                        <Input 
                          value={timerText} 
                          onChange={(e) => setTimerText(e.target.value)} 
                          placeholder="例）期間限定公開"
                          className="h-9"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">タイマー切れ時の動作</Label>
                        <Select value={expireAction} onValueChange={(v) => setExpireAction(v as any)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="動作" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hide">ページを非表示にする</SelectItem>
                            <SelectItem value="keep_public">公開した状態にする</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
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
