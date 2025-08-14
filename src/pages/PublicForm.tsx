import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface PublicFormRow {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  success_message: string | null;
  user_id?: string;
  require_line_friend?: boolean;
  prevent_duplicate_per_friend?: boolean;
  post_submit_scenario_id?: string | null;
  submit_button_text?: string | null;
  submit_button_variant?: string | null;
  submit_button_bg_color?: string | null;
  submit_button_text_color?: string | null;
  accent_color?: string | null;
  fields: Array<{ id: string; label: string; name: string; type: string; required?: boolean; options?: string[]; placeholder?: string; rows?: number }>;
}

const useSEO = (title: string, description: string, canonical?: string) => {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.setAttribute('name', 'description');
    meta.setAttribute('content', description);
    document.head.appendChild(meta);

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
    }
  }, [title, description, canonical]);
};

export default function PublicForm() {
  const params = useParams();
  const formId = params.id as string;
  const [form, setForm] = useState<PublicFormRow | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useSEO(
    form ? `${form.name} | フォーム` : 'フォーム',
    form?.description || '埋め込みフォーム',
    window.location.href
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        console.log(`=== フォーム読み込み開始 formId: ${formId} ===`);
        
        const { data, error } = await (supabase as any)
          .from('forms')
          .select('id,name,description,fields,success_message,is_public,user_id,require_line_friend,prevent_duplicate_per_friend,post_submit_scenario_id,submit_button_text,submit_button_variant,submit_button_bg_color,submit_button_text_color,accent_color')
          .eq('id', formId)
          .maybeSingle();
          
        if (error) {
          console.error('フォーム取得エラー:', error);
          toast.error('フォームの取得に失敗しました');
          return;
        }
        
        if (!data) {
          console.log('フォームが見つかりません');
          return;
        }
        
        console.log('フォーム取得成功:', {
          id: data.id,
          name: data.name,
          user_id: data.user_id,
          require_line_friend: data.require_line_friend,
          prevent_duplicate_per_friend: data.prevent_duplicate_per_friend
        });
        
        setForm({ ...data, fields: Array.isArray(data.fields) ? data.fields : [] });
        
      } catch (err) {
        console.error('フォーム読み込み中の予期しないエラー:', err);
        toast.error('フォームの読み込み中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };
    
    if (formId) {
      load();
    }
  }, [formId]);

  const handleChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('=== フォーム送信開始 ===');
    e.preventDefault();
    
    if (!form) {
      console.log('エラー: フォームが存在しません');
      toast.error('フォームデータが見つかりません');
      return;
    }

    // バリデーション
    console.log('=== 必須項目チェック開始 ===');
    for (const f of form.fields) {
      const val = values[f.name];
      console.log(`フィールドチェック - ${f.name}: ${JSON.stringify(val)} (必須: ${f.required})`);
      
      if (f.required) {
        if (f.type === 'checkbox') {
          if (!Array.isArray(val) || val.length === 0) {
            console.log(`バリデーションエラー: 必須チェックボックスが未入力 - ${f.label}`);
            toast.error(`${f.label} は必須です`);
            return;
          }
        } else if (!val || (typeof val === 'string' && val.trim() === '')) {
          console.log(`バリデーションエラー: 必須項目が未入力 - ${f.label}`);
          toast.error(`${f.label} は必須です`);
          return;
        }
      }
    }
    console.log('=== 必須項目チェック完了 ===');

    // URLパラメータの取得と詳細ログ
    const url = new URL(window.location.href);
    const allParams = Object.fromEntries(url.searchParams.entries());
    console.log('=== URLパラメータ解析 ===');
    console.log('現在のURL:', window.location.href);
    console.log('全てのパラメータ:', allParams);

    // 各種パラメータを取得
    const lineUserId = url.searchParams.get('line_user_id') || 
                       url.searchParams.get('lu') || 
                       url.searchParams.get('user_id');
    const shortUid = url.searchParams.get('uid') || 
                     url.searchParams.get('suid') || 
                     url.searchParams.get('s');

    console.log('取得したパラメータ:', {
      lineUserId,
      shortUid,
      'url.searchParams.get("uid")': url.searchParams.get('uid'),
      'url.searchParams.get("suid")': url.searchParams.get('suid'),
      'url.searchParams.get("s")': url.searchParams.get('s'),
      'url.searchParams.get("line_user_id")': url.searchParams.get('line_user_id'),
      'url.searchParams.get("lu")': url.searchParams.get('lu'),
      'url.searchParams.get("user_id")': url.searchParams.get('user_id')
    });

    let friendId: string | null = null;
    let actualLineUserId: string | null = lineUserId;
    let friendDisplayName: string | null = null;

    // 友だち情報の検索（UIDまたはLINE User IDが提供されている場合）
    if (shortUid || lineUserId) {
      console.log('=== 友だち情報検索開始 ===');
      console.log('検索条件:', {
        form_user_id: form.user_id,
        shortUid,
        lineUserId
      });

      try {
        let friendQuery = (supabase as any)
          .from('line_friends')
          .select('id, line_user_id, short_uid, display_name, user_id')
          .eq('user_id', form.user_id);

        if (shortUid) {
          console.log(`短縮UIDで検索: ${shortUid}`);
          friendQuery = friendQuery.eq('short_uid', shortUid);
        } else if (lineUserId) {
          console.log(`LINE User IDで検索: ${lineUserId}`);
          friendQuery = friendQuery.eq('line_user_id', lineUserId);
        }

        const { data: friend, error: friendError } = await friendQuery.maybeSingle();
        
        if (friendError) {
          console.error('友だち検索エラー:', friendError);
          console.log('エラー詳細:', {
            code: friendError.code,
            message: friendError.message,
            details: friendError.details,
            hint: friendError.hint
          });
        }

        if (friend) {
          friendId = friend.id;
          actualLineUserId = friend.line_user_id;
          friendDisplayName = friend.display_name;
          console.log('✅ 友だちを特定成功:', {
            id: friend.id,
            display_name: friend.display_name,
            short_uid: friend.short_uid,
            line_user_id: friend.line_user_id,
            user_id: friend.user_id
          });
        } else {
          console.log('❌ 友だちが見つかりませんでした');
          
          // デバッグ用：該当するuser_idの全友だちを確認
          console.log('=== デバッグ: 該当user_idの全友だちを確認 ===');
          const { data: allFriends, error: allFriendsError } = await (supabase as any)
            .from('line_friends')
            .select('id, line_user_id, short_uid, display_name, user_id')
            .eq('user_id', form.user_id)
            .limit(10);
            
          if (allFriendsError) {
            console.error('全友だち取得エラー:', allFriendsError);
          } else {
            console.log(`user_id ${form.user_id} の友だち一覧 (最大10件):`, allFriends);
            
            if (allFriends && allFriends.length > 0) {
              console.log('比較用データ:');
              allFriends.forEach((f: any, i: number) => {
                console.log(`友だち${i + 1}:`, {
                  short_uid: f.short_uid,
                  '検索対象shortUid': shortUid,
                  'short_uid一致': f.short_uid === shortUid,
                  line_user_id: f.line_user_id,
                  '検索対象lineUserId': lineUserId,
                  'line_user_id一致': f.line_user_id === lineUserId
                });
              });
            } else {
              console.log('該当するuser_idの友だちが1件も見つかりません');
            }
          }
        }
      } catch (err) {
        console.error('友だち検索中の予期しないエラー:', err);
      }
      
      console.log('=== 友だち情報検索終了 ===');
    } else {
      console.log('UIDもLINE User IDも提供されていません（匿名送信）');
    }

    // LINE友だち限定チェック
    if (form.require_line_friend) {
      console.log('=== LINE友だち限定チェック ===');
      if (!friendId) {
        console.log('エラー: LINE友だち限定フォームですが友だちが特定できませんでした');
        toast.error('このフォームはLINE友だち限定です。先に友だち追加してください。');
        return;
      }

      // 重複送信チェック
      if (form.prevent_duplicate_per_friend) {
        console.log('=== 重複送信チェック ===');
        try {
          const { data: duplicate, error: dupError } = await (supabase as any)
            .from('form_submissions')
            .select('id')
            .eq('form_id', form.id)
            .eq('friend_id', friendId)
            .maybeSingle();

          if (dupError) {
            console.error('重複チェックエラー:', dupError);
          }

          if (duplicate) {
            console.log('エラー: 重複送信が検出されました');
            toast.error('このフォームはお一人様1回までです。');
            return;
          }
          console.log('重複送信チェック完了: 問題なし');
        } catch (err) {
          console.error('重複チェック中の予期しないエラー:', err);
        }
      }
    }

    // フォーム送信
    console.log('=== フォーム送信実行 ===');
    const submissionData = {
      form_id: form.id,
      data: values,
      friend_id: friendId,
      line_user_id: actualLineUserId,
    };
    
    console.log('送信データ:', submissionData);
    
    try {
      const { data: submission, error: submitError } = await (supabase as any)
        .from('form_submissions')
        .insert(submissionData)
        .select()
        .single();

      if (submitError) {
        console.error('フォーム送信エラー:', submitError);
        console.log('エラー詳細:', {
          code: submitError.code,
          message: submitError.message,
          details: submitError.details,
          hint: submitError.hint
        });
        toast.error('送信に失敗しました');
        return;
      }

      console.log('✅ フォーム送信成功:', {
        submission_id: submission?.id,
        friend_id: friendId,
        friend_display_name: friendDisplayName,
        line_user_id: actualLineUserId,
        form_id: form.id
      });

      setSubmitted(true);
      toast.success('送信しました');
      
      // TODO: 回答後シナリオ遷移の実行
      if (form.post_submit_scenario_id) {
        console.log(`TODO: 回答後シナリオ実行 - scenario_id: ${form.post_submit_scenario_id}`);
      }
      
    } catch (err) {
      console.error('フォーム送信中の予期しないエラー:', err);
      toast.error('送信処理中にエラーが発生しました');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl p-4">
        <div className="text-center">読み込み中...</div>
      </div>
    );
  }
  
  if (!form) {
    return (
      <div className="container mx-auto max-w-3xl p-4">
        <div className="text-center text-red-600">フォームが見つかりません</div>
      </div>
    );
  }
  
  if (!form.is_public) {
    return (
      <div className="container mx-auto max-w-3xl p-4">
        <div className="text-center text-yellow-600">このフォームは非公開です</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>{form.name}</CardTitle>
          {form.description && <CardDescription>{form.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="py-8">
              <p className="text-center text-muted-foreground">
                {form.success_message || '送信ありがとうございました。'}
              </p>
            </div>
          ) : (
            <form 
              className="space-y-4" 
              onSubmit={handleSubmit} 
              style={{ ['--form-accent' as any]: form.accent_color || '#0cb386' }}
            >
              {form.require_line_friend && (
                <p className="text-xs text-muted-foreground">
                  このフォームはLINE友だち限定です。LINEから開くと自動で認証されます。
                </p>
              )}
              
              {form.fields.map((f) => (
                <div key={f.id} className="space-y-2">
                  <label className="text-sm font-medium" htmlFor={f.name}>
                    {f.label}
                    {f.required && (
                      <span className="ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-destructive text-destructive-foreground">
                        必須
                      </span>
                    )}
                  </label>
                  
                  {f.type === 'textarea' && (
                    <Textarea 
                      id={f.name} 
                      name={f.name} 
                      placeholder={f.placeholder}
                      rows={f.rows || 3}
                      required={!!f.required} 
                      value={values[f.name] || ''}
                      onChange={(e) => handleChange(f.name, e.target.value)} 
                    />
                  )}
                  
                  {(f.type === 'text' || f.type === 'email') && (
                    <Input 
                      id={f.name} 
                      name={f.name} 
                      type={f.type || 'text'} 
                      placeholder={f.placeholder}
                      required={!!f.required} 
                      value={values[f.name] || ''}
                      onChange={(e) => handleChange(f.name, e.target.value)} 
                    />
                  )}
                  
                  {f.type === 'select' && Array.isArray(f.options) && (
                    <Select value={values[f.name] || ''} onValueChange={(v) => handleChange(f.name, v)}>
                      <SelectTrigger className="px-3">
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-[60]">
                        {(f.options || [])
                          .map((opt) => (opt ?? "").trim())
                          .filter(Boolean)
                          .map((opt, i) => (
                            <SelectItem key={`${opt}-${i}`} value={opt}>
                              {opt}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  )}
                  
                  {f.type === 'radio' && Array.isArray(f.options) && (
                    <RadioGroup 
                      value={values[f.name] || ""} 
                      onValueChange={(v) => handleChange(f.name, v)}
                    >
                      <div className="flex flex-col gap-2">
                        {f.options
                          .filter(opt => opt && opt.trim())
                          .map((opt) => (
                            <label key={opt} className="inline-flex items-center gap-2">
                              <RadioGroupItem 
                                value={opt} 
                                className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white" 
                              />
                              <span>{opt}</span>
                            </label>
                          ))
                        }
                      </div>
                    </RadioGroup>
                  )}
                  
                  {f.type === 'checkbox' && Array.isArray(f.options) && (
                    <div className="flex flex-col gap-2">
                      {f.options
                        .filter(opt => opt && opt.trim())
                        .map((opt) => {
                          const currentValues = Array.isArray(values[f.name]) ? values[f.name] : [];
                          const checked = currentValues.includes(opt);
                          
                          return (
                            <label key={opt} className="inline-flex items-center gap-2">
                              <Checkbox
                                className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white"
                                checked={checked}
                                onCheckedChange={(checked) => {
                                  const prev: string[] = Array.isArray(values[f.name]) ? values[f.name] : [];
                                  if (checked === true) {
                                    handleChange(f.name, Array.from(new Set([...prev, opt])));
                                  } else {
                                    handleChange(f.name, prev.filter((x) => x !== opt));
                                  }
                                }}
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              ))}
              
              <Button 
                type="submit" 
                className="w-full" 
                variant="default" 
                style={{ 
                  backgroundColor: form.submit_button_bg_color || '#0cb386', 
                  color: form.submit_button_text_color || '#ffffff' 
                }}
              >
                {form.submit_button_text || '送信'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}