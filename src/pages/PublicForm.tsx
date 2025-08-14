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
import { Loader2 } from "lucide-react";

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
  fields: Array<{ 
    id: string; 
    label: string; 
    name: string; 
    type: string; 
    required?: boolean; 
    options?: string[]; 
    placeholder?: string; 
    rows?: number;
    validation?: {
      min_length?: number;
      max_length?: number;
      pattern?: string;
      error_message?: string;
    };
  }>;
}

interface LineFriend {
  id: string;
  line_user_id: string;
  short_uid: string | null;
  display_name: string | null;
  user_id: string;
}

interface FormSubmissionData {
  form_id: string;
  data: Record<string, any>;
  friend_id: string | null;
  line_user_id: string | null;
  submitted_at?: string;
}

const useSEO = (title: string, description: string, canonical?: string) => {
  useEffect(() => {
    document.title = title;
    
    // メタディスクリプションの設定
    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // Canonical URLの設定
    if (canonical) {
      let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.rel = 'canonical';
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = canonical;
    }

    // OGタグの設定
    const setOGTag = (property: string, content: string) => {
      let ogTag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!ogTag) {
        ogTag = document.createElement('meta');
        ogTag.setAttribute('property', property);
        document.head.appendChild(ogTag);
      }
      ogTag.setAttribute('content', content);
    };

    setOGTag('og:title', title);
    setOGTag('og:description', description);
    if (canonical) setOGTag('og:url', canonical);
    setOGTag('og:type', 'website');
  }, [title, description, canonical]);
};

// バリデーション関数
const validateField = (field: PublicFormRow['fields'][0], value: any): string | null => {
  if (field.required) {
    if (field.type === 'checkbox') {
      if (!Array.isArray(value) || value.length === 0) {
        return `${field.label}は必須です`;
      }
    } else if (!value || (typeof value === 'string' && value.trim() === '')) {
      return `${field.label}は必須です`;
    }
  }

  if (value && field.validation) {
    const val = typeof value === 'string' ? value : String(value);
    
    if (field.validation.min_length && val.length < field.validation.min_length) {
      return field.validation.error_message || `${field.label}は${field.validation.min_length}文字以上入力してください`;
    }
    
    if (field.validation.max_length && val.length > field.validation.max_length) {
      return field.validation.error_message || `${field.label}は${field.validation.max_length}文字以内で入力してください`;
    }
    
    if (field.validation.pattern) {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(val)) {
        return field.validation.error_message || `${field.label}の形式が正しくありません`;
      }
    }
  }

  return null;
};

// LINEへの通知処理
const notifyLineBot = async (
  formId: string,
  lineUserId: string | null,
  friendId: string | null,
  submissionData: Record<string, any>,
  postSubmitScenarioId?: string | null
) => {
  if (!lineUserId) {
    console.log('LINE User IDがないため通知をスキップ');
    return false;
  }

  try {
    // Webhookエンドポイントまたはサーバーレス関数を呼び出し
    const response = await fetch('/api/form-submission-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        form_id: formId,
        line_user_id: lineUserId,
        friend_id: friendId,
        submission_data: submissionData,
        post_submit_scenario_id: postSubmitScenarioId,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`通知API呼び出し失敗: ${response.status}`);
    }

    const result = await response.json();
    console.log('LINE通知成功:', result);
    return true;
  } catch (error) {
    console.error('LINE通知エラー:', error);
    
    // フォールバック: Supabase Edge Functions または Realtime を使用
    try {
      const { error: notifyError } = await supabase
        .from('line_notifications')
        .insert({
          type: 'form_submission',
          line_user_id: lineUserId,
          friend_id: friendId,
          data: {
            form_id: formId,
            submission_data: submissionData,
            post_submit_scenario_id: postSubmitScenarioId,
          },
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (notifyError) {
        console.error('フォールバック通知も失敗:', notifyError);
        return false;
      }

      console.log('フォールバック通知成功');
      return true;
    } catch (fallbackError) {
      console.error('フォールバック通知エラー:', fallbackError);
      return false;
    }
  }
};

export default function PublicForm() {
  const params = useParams();
  const formId = params.id as string;
  const [form, setForm] = useState<PublicFormRow | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // URL パラメータの解析
  const urlParams = useMemo(() => {
    const url = new URL(window.location.href);
    const lineUserId = url.searchParams.get('line_user_id') || 
                       url.searchParams.get('lu') || 
                       url.searchParams.get('user_id');
    const shortUid = url.searchParams.get('uid') || 
                     url.searchParams.get('suid') || 
                     url.searchParams.get('s');
    
    return {
      lineUserId,
      shortUid,
      allParams: Object.fromEntries(url.searchParams.entries()),
    };
  }, []);

  useSEO(
    form ? `${form.name} | フォーム` : 'フォーム',
    form?.description || 'オンラインフォーム',
    window.location.href
  );

  // フォームデータの取得
  useEffect(() => {
    const loadForm = async () => {
      if (!formId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('forms')
          .select(`
            id, name, description, fields, success_message, is_public, user_id,
            require_line_friend, prevent_duplicate_per_friend, post_submit_scenario_id,
            submit_button_text, submit_button_variant, submit_button_bg_color,
            submit_button_text_color, accent_color
          `)
          .eq('id', formId)
          .maybeSingle();

        if (error) {
          console.error('フォーム取得エラー:', error);
          toast.error('フォームの取得に失敗しました');
          return;
        }

        if (data) {
          setForm({
            ...data,
            fields: Array.isArray(data.fields) ? data.fields : []
          });
          
          // デフォルト値の設定
          const defaultValues: Record<string, any> = {};
          data.fields?.forEach((field: any) => {
            if (field.type === 'checkbox') {
              defaultValues[field.name] = [];
            }
          });
          setValues(defaultValues);
        }
      } catch (error) {
        console.error('フォーム読み込みエラー:', error);
        toast.error('フォームの読み込み中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, [formId]);

  // 入力値の変更処理
  const handleChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // エラーをクリア
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // フォーム送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form || submitting) return;

    console.log('=== フォーム送信開始 ===');
    console.log('URLパラメータ:', urlParams);
    console.log('送信データ:', values);

    setSubmitting(true);
    setErrors({});

    try {
      // バリデーション
      const validationErrors: Record<string, string> = {};
      for (const field of form.fields) {
        const error = validateField(field, values[field.name]);
        if (error) {
          validationErrors[field.name] = error;
        }
      }

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        toast.error('入力内容を確認してください');
        return;
      }

      // 友だち情報の特定
      let friendId: string | null = null;
      let actualLineUserId: string | null = urlParams.lineUserId;
      let friend: LineFriend | null = null;

      if (urlParams.shortUid || urlParams.lineUserId) {
        let friendQuery = supabase
          .from('line_friends')
          .select('id, line_user_id, short_uid, display_name, user_id')
          .eq('user_id', form.user_id);
        
        if (urlParams.shortUid) {
          friendQuery = friendQuery.eq('short_uid', urlParams.shortUid);
          console.log(`短縮UIDで友だち検索: ${urlParams.shortUid}`);
        } else if (urlParams.lineUserId) {
          friendQuery = friendQuery.eq('line_user_id', urlParams.lineUserId);
          console.log(`LINE User IDで友だち検索: ${urlParams.lineUserId}`);
        }
        
        const { data: friendData, error: friendError } = await friendQuery.maybeSingle();
        
        if (friendData) {
          friend = friendData as LineFriend;
          friendId = friend.id;
          actualLineUserId = friend.line_user_id;
          console.log(`友だちを特定: ${friend.display_name} (ID: ${friendId})`);
        } else {
          console.log('友だちが見つかりませんでした:', friendError);
          console.log(`検索クエリ: user_id=${form.user_id}, ${urlParams.shortUid ? `short_uid=${urlParams.shortUid}` : `line_user_id=${urlParams.lineUserId}`}`);
        }
      }

      // LINE友だち限定チェック
      if (form.require_line_friend && !friendId) {
        toast.error('このフォームはLINE友だち限定です。LINEから正しいリンクでアクセスしてください。');
        return;
      }

      // 重複送信チェック
      if (form.prevent_duplicate_per_friend && friendId) {
        const { data: existingSubmission } = await supabase
          .from('form_submissions')
          .select('id')
          .eq('form_id', form.id)
          .eq('friend_id', friendId)
          .maybeSingle();
        
        if (existingSubmission) {
          toast.error('このフォームは既に回答済みです。お一人様1回までとなっております。');
          return;
        }
      }

      // フォーム送信
      const submissionData: FormSubmissionData = {
        form_id: form.id,
        data: values,
        friend_id: friendId,
        line_user_id: actualLineUserId,
        submitted_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('form_submissions')
        .insert(submissionData);
      
      if (insertError) {
        console.error('フォーム送信エラー:', insertError);
        toast.error('送信に失敗しました。再度お試しください。');
        return;
      }
      
      console.log(`フォーム送信成功: friend_id=${friendId}, line_user_id=${actualLineUserId}`);
      
      // LINEへの通知
      if (actualLineUserId) {
        const notifySuccess = await notifyLineBot(
          form.id,
          actualLineUserId,
          friendId,
          values,
          form.post_submit_scenario_id
        );
        
        if (notifySuccess) {
          console.log('LINE通知成功');
        } else {
          console.log('LINE通知失敗 - フォーム送信は完了');
        }
      }

      setSubmitted(true);
      toast.success('送信が完了しました');
      
      // スクロールを上部に移動
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } catch (error) {
      console.error('フォーム送信処理エラー:', error);
      toast.error('送信中にエラーが発生しました。再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  // ローディング状態
  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl p-4">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>フォームを読み込み中...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // フォームが見つからない場合
  if (!form) {
    return (
      <div className="container mx-auto max-w-3xl p-4">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              指定されたフォームが見つかりません。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 非公開フォームの場合
  if (!form.is_public) {
    return (
      <div className="container mx-auto max-w-3xl p-4">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              このフォームは現在非公開に設定されています。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">
            {form.name}
          </CardTitle>
          {form.description && (
            <CardDescription className="text-sm md:text-base">
              {form.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="text-green-600 text-lg font-medium">
                ✓ 送信完了
              </div>
              <p className="text-muted-foreground">
                {form.success_message || '送信ありがとうございました。'}
              </p>
            </div>
          ) : (
            <form 
              className="space-y-6" 
              onSubmit={handleSubmit}
              style={{ ['--form-accent' as any]: form.accent_color || '#0cb386' }}
            >
              {form.require_line_friend && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    このフォームはLINE友だち限定です。LINEから正しいリンクでアクセスしてください。
                  </p>
                </div>
              )}
              
              {form.fields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <label className="text-sm font-medium block" htmlFor={field.name}>
                    {field.label}
                    {field.required && (
                      <span className="ml-2 inline-flex items-center rounded px-2 py-0.5 text-xs bg-red-100 text-red-800">
                        必須
                      </span>
                    )}
                  </label>
                  
                  {/* テキストエリア */}
                  {field.type === 'textarea' && (
                    <Textarea 
                      id={field.name}
                      name={field.name}
                      placeholder={field.placeholder}
                      rows={field.rows || 3}
                      value={values[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      className={errors[field.name] ? 'border-red-500' : ''}
                    />
                  )}
                  
                  {/* テキスト・メール入力 */}
                  {(field.type === 'text' || field.type === 'email') && (
                    <Input 
                      id={field.name}
                      name={field.name}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={values[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      className={errors[field.name] ? 'border-red-500' : ''}
                    />
                  )}
                  
                  {/* セレクトボックス */}
                  {field.type === 'select' && Array.isArray(field.options) && (
                    <Select 
                      value={values[field.name] || ''} 
                      onValueChange={(v) => handleChange(field.name, v)}
                    >
                      <SelectTrigger className={`px-3 ${errors[field.name] ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-[60]">
                        {field.options
                          .map((opt) => (opt ?? "").trim())
                          .filter(Boolean)
                          .map((opt, i) => (
                            <SelectItem key={`${opt}-${i}`} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {/* ラジオボタン */}
                  {field.type === 'radio' && Array.isArray(field.options) && (
                    <RadioGroup 
                      value={values[field.name] || ""} 
                      onValueChange={(v) => handleChange(field.name, v)}
                      className={errors[field.name] ? 'border border-red-500 rounded p-2' : ''}
                    >
                      <div className="flex flex-col gap-3">
                        {field.options.map((opt) => (
                          <label key={opt} className="inline-flex items-center gap-3 cursor-pointer">
                            <RadioGroupItem 
                              value={opt} 
                              className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white" 
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
                  
                  {/* チェックボックス */}
                  {field.type === 'checkbox' && Array.isArray(field.options) && (
                    <div className={`flex flex-col gap-3 ${errors[field.name] ? 'border border-red-500 rounded p-2' : ''}`}>
                      {field.options.map((opt) => {
                        const checked = Array.isArray(values[field.name]) && values[field.name].includes(opt);
                        return (
                          <label key={opt} className="inline-flex items-center gap-3 cursor-pointer">
                            <Checkbox
                              className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white"
                              checked={checked}
                              onCheckedChange={(isChecked) => {
                                const prev: string[] = Array.isArray(values[field.name]) ? values[field.name] : [];
                                if (isChecked === true) {
                                  handleChange(field.name, [...new Set([...prev, opt])]);
                                } else {
                                  handleChange(field.name, prev.filter((x) => x !== opt));
                                }
                              }}
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* エラーメッセージ */}
                  {errors[field.name] && (
                    <p className="text-red-600 text-xs mt-1">
                      {errors[field.name]}
                    </p>
                  )}
                </div>
              ))}
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={submitting}
                style={{ 
                  backgroundColor: form.submit_button_bg_color || '#0cb386', 
                  color: form.submit_button_text_color || '#ffffff' 
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    送信中...
                  </>
                ) : (
                  form.submit_button_text || '送信'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}