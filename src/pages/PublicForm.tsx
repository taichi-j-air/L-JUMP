// PublicForm.tsx（完全版）
// 変更点サマリ：
// - INSERT ペイロードから source_uid を完全に削除（generated column のため）
// - meta.source_uid にのみ格納し、DB 側の generated 列に任せる
// - 既存回答チェックは URL(uid) / LINE userId の OR で実施
// - duplicate_policy=block のときは既存回答を表示して送信不可
// - PostgREST のエラーコード（23505/unique, 42501/RLS 等）を日本語で丁寧に出す
// - LIFF が使えない/CSP ブロックでも require_line_friend=false なら送信できる動線のまま

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLiff } from "@/hooks/useLiff";

interface PublicFormRow {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  success_message: string | null;
  user_id?: string;
  require_line_friend?: boolean;
  prevent_duplicate_per_friend?: boolean;
  duplicate_policy?: "allow" | "block" | "overwrite";
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
  }>;
}

const useSEO = (title: string, description: string, canonical?: string) => {
  useEffect(() => {
    document.title = title;
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", description);
    if (!meta.parentNode) document.head.appendChild(meta);

    if (canonical) {
      let link = document.querySelector(
        'link[rel="canonical"]'
      ) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
    }
  }, [title, description, canonical]);
};

// UID の正規化（空やダミー値は null）
const normalizeUid = (raw: string | null) => {
  const v = (raw || "").trim();
  if (!v) return null;
  const up = v.toUpperCase();
  if (["[UID]", "UID", "NULL"].includes(up)) return null;
  return up;
};

export default function PublicForm() {
  const params = useParams();
  const formId = params.id as string;

  const [form, setForm] = useState<PublicFormRow | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [isFirstSubmission, setIsFirstSubmission] = useState(true);
  const [liffId, setLiffId] = useState<string | null>(null);

  const isMobile = useIsMobile();
  const {
    isLiffReady,
    isLoggedIn,
    profile,
    error: liffError,
  } = useLiff(liffId || undefined);

  useEffect(() => {
    console.log("[LIFF DEBUG] State changed:", {
      liffId,
      isLiffReady,
      isLoggedIn,
      profile,
      liffError,
    });
  }, [liffId, isLiffReady, isLoggedIn, profile, liffError]);

  useSEO(
    form ? `${form.name} | フォーム` : "フォーム",
    form?.description || "埋め込みフォーム",
    typeof window !== "undefined" ? window.location.href : undefined
  );

  // フォームメタ取得（RPC → Fallback）
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: formData, error: formError } = await supabase
          .rpc("get_public_form_meta", { p_form_id: formId })
          .maybeSingle();

        if (formError) {
          console.error("[forms.load] RPC error:", formError);

          const { data: fallbackData, error: fallbackError } = await supabase
            .from("forms")
            .select(
              `
              id, name, description, fields, success_message, is_public, user_id,
              require_line_friend, prevent_duplicate_per_friend, duplicate_policy, post_submit_scenario_id,
              submit_button_text, submit_button_variant, submit_button_bg_color,
              submit_button_text_color, accent_color
            `
            )
            .eq("id", formId)
            .eq("is_public", true)
            .maybeSingle();

          if (fallbackError) {
            console.error("[forms.load] Fallback error:", fallbackError);
            toast.error("フォームの取得に失敗しました");
            return;
          }

          if (fallbackData) {
            const formFields = Array.isArray(fallbackData.fields)
              ? fallbackData.fields
              : [];
            setForm({
              ...fallbackData,
              fields: formFields as any,
              duplicate_policy:
                (fallbackData.duplicate_policy as any) || "allow",
            });

            // LIFF IDの取得（ユーザープロファイルに格納されている前提）
            try {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("liff_id")
                .eq("user_id", fallbackData.user_id)
                .maybeSingle();
              if (profileData?.liff_id) setLiffId(profileData.liff_id);
            } catch (e) {
              console.warn("[liff] Failed to get LIFF ID from profile:", e);
            }
          }
        } else if (formData) {
          const formFields = Array.isArray(formData.fields)
            ? formData.fields
            : [];
          setForm({ ...formData, fields: formFields as any });
          if ((formData as any).liff_id) setLiffId((formData as any).liff_id);
        }
      } catch (error) {
        console.error("[forms.load] unexpected error:", error);
        toast.error("フォームの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    if (formId) load();
  }, [formId]);

  // 既存回答チェック（UID/LINE を OR）
  useEffect(() => {
    const checkExistingSubmission = async () => {
      if (!form || form.duplicate_policy === "allow") return;

      const url = new URL(window.location.href);
      const sourceUid = normalizeUid(
        url.searchParams.get("uid") ||
          url.searchParams.get("suid") ||
          url.searchParams.get("s")
      );

      let lineUserId: string | null = null;
      if (isLiffReady && isLoggedIn && profile?.userId) {
        lineUserId = profile.userId;
      }

      if (!sourceUid && !lineUserId) return;

      try {
        let query = supabase
          .from("form_submissions")
          .select("id, data, submitted_at, meta, source_uid, line_user_id")
          .eq("form_id", form.id)
          .order("submitted_at", { ascending: false })
          .limit(1);

        if (sourceUid && lineUserId) {
          query = query.or(
            `source_uid.eq.${sourceUid},line_user_id.eq.${lineUserId}`
          );
        } else if (sourceUid) {
          query = query.eq("source_uid", sourceUid);
        } else if (lineUserId) {
          query = query.eq("line_user_id", lineUserId);
        }

        const { data: existingData, error } = await query.maybeSingle();

        if (error) {
          // maybeSingle が複数ヒットで落ちた場合のフォールバック
          // @ts-ignore
          const { data: rows } = await query;
          const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
          if (first) {
            setExistingSubmission(first);
            setIsFirstSubmission(false);
          }
          return;
        }

        if (existingData) {
          setExistingSubmission(existingData);
          setIsFirstSubmission(false);

          if (
            form.duplicate_policy === "overwrite" &&
            existingData.data &&
            typeof existingData.data === "object"
          ) {
            setValues(existingData.data as Record<string, any>);
          }
        }
      } catch (error) {
        console.error("Error checking existing submission:", error);
      }
    };

    checkExistingSubmission();
  }, [form, isLiffReady, isLoggedIn, profile]);

  // ブラウザ翻訳の検出（念のため）
  useEffect(() => {
    const checkTranslation = () => {
      const isTranslated =
        document.documentElement.classList.contains("translated-ltr") ||
        document.documentElement.classList.contains("translated-rtl") ||
        document.querySelector('[class*="translate"]') ||
        document.querySelector("font[face]") ||
        document.body.style.top === "-30000px";
      if (isTranslated) {
        console.warn("[Browser Translation] Detected");
        toast.error(
          "ブラウザの翻訳機能が検出されました。正常に動作しない場合は翻訳をオフにしてください。",
          { duration: 8000 }
        );
      }
    };
    const timer = setTimeout(checkTranslation, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // 必須チェック
    for (const f of form.fields) {
      const val = values[f.name];
      if (f.required) {
        if (f.type === "checkbox") {
          if (!Array.isArray(val) || val.length === 0) {
            toast.error(`${f.label} は必須です`);
            return;
          }
        } else if (val === undefined || val === null || val === "") {
          toast.error(`${f.label} は必須です`);
          return;
        }
      }
    }

    // URL/LIFF から ID 抽出（UID優先）
    const url = new URL(window.location.href);
    let lineUserIdParam =
      url.searchParams.get("line_user_id") ||
      url.searchParams.get("lu") ||
      url.searchParams.get("user_id");

    if (isLiffReady && isLoggedIn && profile?.userId) {
      lineUserIdParam = profile.userId;
    }

    const shortUid = normalizeUid(
      url.searchParams.get("uid") ||
        url.searchParams.get("suid") ||
        url.searchParams.get("s")
    );

    // 友だち限定のチェック
    if (form.require_line_friend) {
      if (!profile?.userId && !lineUserIdParam && !shortUid) {
        toast.error(
          "このフォームはLINE友だち限定です。LINEアプリから開いてください。"
        );
        return;
      }
    }

    // INSERT ペイロード（※ source_uid は入れない！）
    const payload: any = {
      form_id: form.id,
      data: values,
      user_id: form.user_id,
      line_user_id: lineUserIdParam || null,
      meta: {
        // ここに入れておけば DB 側の generated 列が拾う想定
        source_uid: shortUid || null,
        full_url: window.location.href,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        liff_info: liffId
          ? {
              liff_id: liffId,
              is_logged_in: isLoggedIn,
              has_profile: !!profile,
            }
          : null,
      },
    };

    console.log("[insert.payload]", payload);

    // 重複制御は DB 側（generated column / トリガ / unique 制約）に委任
    const { error } = await supabase
      .from("form_submissions")
      .insert(payload)
      // .select().single() // 必要なら挿入行を取得
      ;

    if (error) {
      console.error("[insert.error]", error, payload);

      // よくあるエラーのユーザー向け説明
      const msg =
        error.message || (error as any)?.hint || "エラーが発生しました";

      if (
        form.require_line_friend &&
        (error.code === "42501" ||
          error.code === "PGRST301" ||
          (error as any).status === 401)
      ) {
        toast.error(
          "このフォームはLINE友だち限定です。LINEでログインしてから送信してください。"
        );
        return;
      }

      // 重複（unique violation / トリガでの例外）
      if (
        error.code === "23505" || // unique_violation
        /既に回答済み|duplicate|conflict|unique/i.test(msg)
      ) {
        if (form.duplicate_policy === "block") {
          toast.error("このフォームには既に回答済みです。");
        } else {
          toast.error("既に回答済みのようです。");
        }
        return;
      }

      // generated column を手で入れてしまったときのエラー保険
      if (
        error.code === "428C9" ||
        /generated column|cannot insert a non-DEFAULT value/i.test(msg)
      ) {
        toast.error(
          "内部列の扱いに問題があります。ページを再読込してもう一度お試しください。"
        );
        return;
      }

      toast.error(`送信に失敗しました: ${msg}`);
      return;
    }

    setSubmitted(true);

    // 初回のみシナリオ発火（必要ならここで実装）
    const shouldTriggerScenario =
      isFirstSubmission && form.post_submit_scenario_id;
    console.log("Scenario trigger decision:", {
      isFirstSubmission,
      hasScenario: !!form.post_submit_scenario_id,
      shouldTriggerScenario,
    });

    if (form.duplicate_policy === "overwrite" && !isFirstSubmission) {
      toast.success("回答を更新しました");
    } else {
      toast.success("送信しました");
    }
  };

  if (loading)
    return (
      <div className={isMobile ? "p-4" : "container mx-auto max-w-3xl p-4"}>
        読み込み中...
      </div>
    );
  if (!form)
    return (
      <div className={isMobile ? "p-4" : "container mx-auto max-w-3xl p-4"}>
        フォームが見つかりません
      </div>
    );
  if (!form.is_public)
    return (
      <div className={isMobile ? "p-4" : "container mx-auto max-w-3xl p-4"}>
        このフォームは非公開です
      </div>
    );

  const containerClass = isMobile
    ? "min-h-screen px-2 pt-1"
    : "container mx-auto max-w-3xl p-4";

  return (
    <div className={containerClass}>
      <Card className={isMobile ? "border-0 rounded-none min-h-screen shadow-none" : ""}>
        <CardHeader className={isMobile ? "px-1 pt-2 pb-2" : ""}>
          <CardTitle>{form.name}</CardTitle>
          {form.description && (
            <CardDescription>{form.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className={isMobile ? "space-y-4 px-1" : "space-y-4"}>
          {submitted ? (
            <div className="py-8">
              <div
                className="text-center text-muted-foreground prose prose-sm mx-auto"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    form.success_message && form.success_message.trim()
                      ? form.success_message
                      : "送信ありがとうございました。"
                  ),
                }}
              />
            </div>
          ) : form.duplicate_policy === "block" && existingSubmission ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-3">回答済みの内容</h3>
                <div className="space-y-3">
                  {form.fields.map((field) => {
                    const value = (existingSubmission.data as any)?.[field.name];
                    if (value === undefined || value === null) return null;
                    return (
                      <div
                        key={field.id ?? field.name}
                        className="border-b border-border/50 pb-2 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-muted-foreground">
                          {field.label}
                        </div>
                        <div className="text-sm mt-1">
                          {Array.isArray(value) ? value.join(", ") : String(value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  回答日時:{" "}
                  {new Date(
                    existingSubmission.submitted_at
                  ).toLocaleString("ja-JP")}
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                このフォームは既に回答済みです。
              </div>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={handleSubmit}
              style={{
                ["--form-accent" as any]: form.accent_color || "#0cb386",
              }}
            >
              {form.require_line_friend && (
                <p className="text-xs text-muted-foreground">
                  このフォームはLINE友だち限定です。LINEから開くと自動で認証されます。
                </p>
              )}

              {form.fields.map((f) => {
                const fieldId = `field-${f.id || f.name}`;
                const isGroup = f.type === "radio" || f.type === "checkbox";

                const TopLabel = (
                  <label
                    className="text-sm font-medium"
                    {...(isGroup
                      ? { id: `${fieldId}-label` }
                      : { htmlFor: fieldId })}
                  >
                    {f.label}
                    {f.required && (
                      <span className="ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-destructive text-destructive-foreground">
                        必須
                      </span>
                    )}
                  </label>
                );

                return (
                  <div key={f.id ?? f.name} className="space-y-2">
                    {TopLabel}

                    {f.type === "textarea" && (
                      <Textarea
                        id={fieldId}
                        name={f.name}
                        placeholder={f.placeholder || ""}
                        rows={f.rows || 3}
                        required={!!f.required}
                        onChange={(e) => handleChange(f.name, e.target.value)}
                      />
                    )}

                    {(f.type === "text" || f.type === "email") && (
                      <Input
                        id={fieldId}
                        name={f.name}
                        type={f.type || "text"}
                        placeholder={f.placeholder || ""}
                        required={!!f.required}
                        onChange={(e) => handleChange(f.name, e.target.value)}
                      />
                    )}

                    {f.type === "select" && Array.isArray(f.options) && (
                      <div>
                        <Select onValueChange={(v) => handleChange(f.name, v)}>
                          <SelectTrigger
                            id={fieldId}
                            name={f.name}
                            className="px-3"
                            aria-labelledby={`${fieldId}-label`}
                          >
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
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {f.type === "radio" && Array.isArray(f.options) && (
                      <fieldset aria-labelledby={`${fieldId}-label`}>
                        <legend className="sr-only">{f.label}</legend>
                        <RadioGroup
                          value={values[f.name] || ""}
                          onValueChange={(v) => handleChange(f.name, v)}
                        >
                          <div className="flex flex-col gap-2">
                            {f.options.map((opt, index) => {
                              const radioId = `${fieldId}-radio-${index}`;
                              return (
                                <div
                                  key={opt}
                                  className="inline-flex items-center gap-2"
                                >
                                  <RadioGroupItem
                                    id={radioId}
                                    value={opt}
                                    className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white"
                                  />
                                  <label
                                    htmlFor={radioId}
                                    className="text-sm cursor-pointer"
                                  >
                                    {opt}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </RadioGroup>
                      </fieldset>
                    )}

                    {f.type === "checkbox" && Array.isArray(f.options) && (
                      <fieldset aria-labelledby={`${fieldId}-label`}>
                        <legend className="sr-only">{f.label}</legend>
                        <div className="flex flex-col gap-2" role="group">
                          {f.options.map((opt, index) => {
                            const checkboxId = `${fieldId}-checkbox-${index}`;
                            const checked =
                              Array.isArray(values[f.name]) &&
                              values[f.name].includes(opt);
                            return (
                              <div
                                key={opt}
                                className="inline-flex items-center gap-2"
                              >
                                <Checkbox
                                  id={checkboxId}
                                  name={`${f.name}[]`}
                                  className="border-[var(--form-accent)] data-[state=checked]:bg-[var(--form-accent)] data-[state=checked]:text-white"
                                  checked={!!checked}
                                  onCheckedChange={(v) => {
                                    const prev: string[] = Array.isArray(
                                      values[f.name]
                                    )
                                      ? values[f.name]
                                      : [];
                                    if (v === true) {
                                      handleChange(
                                        f.name,
                                        Array.from(new Set([...prev, opt]))
                                      );
                                    } else {
                                      handleChange(
                                        f.name,
                                        prev.filter((x) => x !== opt)
                                      );
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={checkboxId}
                                  className="text-sm cursor-pointer"
                                >
                                  {opt}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </fieldset>
                    )}
                  </div>
                );
              })}

              <Button
                type="submit"
                className="w-full"
                variant="default"
                style={{
                  backgroundColor: form.submit_button_bg_color || "#0cb386",
                  color: form.submit_button_text_color || "#ffffff",
                }}
              >
                {form.submit_button_text || "送信"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
