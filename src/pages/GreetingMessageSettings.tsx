import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, MessageCircle, Link, Copy, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeCanvas } from 'qrcode.react';
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MediaLibrarySelector } from "@/components/MediaLibrarySelector";

interface Scenario {
  id: string;
  name: string;
}

type GreetingImageMode = "none" | "link" | "postback";

const DEFAULT_FLEX_IMAGE_URL = "https://developers-resource.landpress.line.me/fx/clip/clip3.jpg";

const GreetingMessageSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [greetingMessage, setGreetingMessage] = useState("");
  const [friendUrl, setFriendUrl] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [imageMode, setImageMode] = useState<GreetingImageMode>("none");
  const [imageUrl, setImageUrl] = useState("");
  const [imageLinkUrl, setImageLinkUrl] = useState("");
  const [postbackLabel, setPostbackLabel] = useState("action");
  const [postbackDisplayText, setPostbackDisplayText] = useState("");
  const [postbackToken, setPostbackToken] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [restrictOnce, setRestrictOnce] = useState(true);
  const [aspectRatio, setAspectRatio] = useState("1:1");

  const resetImageConfig = () => {
    setImageMode("none");
    setImageUrl("");
    setImageLinkUrl("");
    setPostbackLabel("action");
    setPostbackDisplayText("");
    setPostbackToken("");
    setSelectedScenario(null);
    setRestrictOnce(true);
    setAspectRatio("1:1");
  };

  const applyImageConfig = (config: any | null | undefined) => {
    resetImageConfig();
    if (!config || config.mode === "none") {
      return;
    }

    if (config.mode) {
      setImageMode(config.mode);
    }

    if (config.imageUrl) {
      setImageUrl(config.imageUrl);
    }

    if (config.aspectRatio) {
      setAspectRatio(config.aspectRatio);
    }

    const actionLabel =
      config.actionLabel ??
      config.postback?.label ??
      "action";
    setPostbackLabel(actionLabel || "action");

    if (config.mode === "link") {
      setImageLinkUrl(config.linkUrl || "");
    } else {
      setImageLinkUrl("");
    }

    if (config.mode === "postback" && config.postback) {
      setSelectedScenario(config.postback.scenarioId ?? null);
      setRestrictOnce(config.postback.once !== false);
      setPostbackDisplayText(config.postback.displayText ?? "");
      setPostbackToken(config.postback.token ?? "");
    }
  };

  const buildImageConfigForSave = () => {
    if (imageMode === "none") {
      return null;
    }

    const trimmedUrl = imageUrl.trim();
    const trimmedAspect = aspectRatio.trim() || "1:1";
    const actionLabel = postbackLabel || "action";

    if (!trimmedUrl) {
      return null;
    }

    const baseConfig: Record<string, unknown> = {
      mode: imageMode,
      imageUrl: trimmedUrl,
      aspectRatio: trimmedAspect,
      actionLabel,
      altText: "Greeting image"
    };

    if (imageMode === "link") {
      const trimmedLink = imageLinkUrl.trim();
      baseConfig.linkUrl = trimmedLink || null;
    }

    if (imageMode === "postback") {
      baseConfig.postback = {
        label: actionLabel,
        displayText: postbackDisplayText.trim() || null,
        token: postbackToken.trim() || null,
        scenarioId: selectedScenario,
        once: restrictOnce
      };
    }

    return baseConfig;
  };

  useEffect(() => {
    loadGreetingMessage();
    loadProfile();
    loadScenarios();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('line_bot_id')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setProfile(data);
        if (data.line_bot_id) {
          const botId = data.line_bot_id.startsWith('@') ? data.line_bot_id.substring(1) : data.line_bot_id;
          setFriendUrl(`https://line.me/R/ti/p/%40${botId}`);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadScenarios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('step_scenarios')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (!error && data) {
        setScenarios(
          data.map((scenario) => ({
            id: scenario.id,
            name: scenario.name || "名称未設定"
          }))
        );
      }
    } catch (error) {
      console.error('Error loading scenarios:', error);
    }
  };

  const handleDownloadPNG = () => {
    const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = "line-add-friend-qr.png";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const loadGreetingMessage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('line_greeting_settings')
        .select('greeting_message, greeting_image_config')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setGreetingMessage(data.greeting_message || '');
        applyImageConfig(data.greeting_image_config);
      }
    } catch (error) {
      console.error('Error loading greeting message:', error);
    }
  };

  const postbackDataString = useMemo(() => {
    if (imageMode !== "postback") return "";

    const payload: Record<string, unknown> = {
      action: "trigger_scenario",
      source: "greeting_image",
      once: restrictOnce,
    };

    if (selectedScenario) {
      payload.scenario_id = selectedScenario;
    }

    if (postbackToken.trim().length > 0) {
      payload.token = postbackToken.trim();
    }

    return JSON.stringify(payload);
  }, [imageMode, postbackToken, restrictOnce, selectedScenario]);

  const flexMessagePreview = useMemo(() => {
    const baseImage: Record<string, any> = {
      type: "image",
      url: imageUrl || DEFAULT_FLEX_IMAGE_URL,
      size: "full",
      aspectMode: "fit",
      aspectRatio: aspectRatio || "1:1",
      gravity: "center",
    };

    if (imageMode === "link" && imageLinkUrl) {
      baseImage.action = {
        type: "uri",
        label: postbackLabel || "open",
        uri: imageLinkUrl,
      };
    }

    if (imageMode === "postback") {
      baseImage.action = {
        type: "postback",
        label: postbackLabel || "action",
        data: postbackDataString,
      };

      if (postbackDisplayText) {
        baseImage.action.displayText = postbackDisplayText;
      }
    }

    const payload = {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [baseImage],
        paddingAll: "0px",
      },
    };

    return JSON.stringify(payload, null, 2);
  }, [
    aspectRatio,
    imageLinkUrl,
    imageMode,
    imageUrl,
    postbackDataString,
    postbackDisplayText,
    postbackLabel,
  ]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!greetingMessage.trim()) {
        toast({
          title: "エラー",
          description: "あいさつメッセージを入力してください",
          variant: "destructive",
        });
        return;
      }

      const trimmedImageUrl = imageUrl.trim();
      const trimmedLinkUrl = imageLinkUrl.trim();

      if (imageMode !== "none" && !trimmedImageUrl) {
        toast({
          title: "エラー",
          description: "画像を送信する場合は画像URLを入力してください",
          variant: "destructive",
        });
        return;
      }

      if (imageMode === "link" && !trimmedLinkUrl) {
        toast({
          title: "エラー",
          description: "リンク付き画像にはリンクURLを入力してください",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "エラー",
          description: "ログインが必要です",
          variant: "destructive",
        });
        return;
      }

      const imageConfig = buildImageConfigForSave();

      const payload = {
        user_id: user.id,
        greeting_type: 'message',
        greeting_message: greetingMessage,
        scenario_id: null,
        greeting_image_config: imageConfig,
      };

      console.debug("Greeting image configuration (pending persistence):", {
        imageMode,
        imageUrl,
        imageLinkUrl,
        postbackLabel,
        postbackDisplayText,
        postbackToken,
        selectedScenario,
        restrictOnce,
        aspectRatio,
        flexMessagePreview,
        imageConfig,
      });

      const { error } = await supabase
        .from('line_greeting_settings')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        throw error;
      }

      toast({
        title: "成功",
        description: "あいさつメッセージ設定を保存しました",
      });
    } catch (error) {
      console.error('Error saving greeting message:', error);
      toast({
        title: "エラー",
        description: "あいさつメッセージの保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFlexJson = async () => {
    try {
      await navigator.clipboard.writeText(flexMessagePreview);
      toast({
        title: "コピーしました",
        description: "FlexメッセージのJSONコードをクリップボードにコピーしました。",
      });
    } catch (error) {
      toast({
        title: "コピーに失敗しました",
        description: "ブラウザがクリップボードへのアクセスを拒否しました。",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              戻る
            </Button>
            <MessageCircle className="w-6 h-6" />
            <h1 className="text-2xl font-bold">あいさつメッセージ設定</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>あいさつメッセージ</CardTitle>
              <CardDescription>
                友だち追加時に送信されるメッセージを設定します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="greeting">あいさつメッセージ</Label>
                    <Textarea
                      id="greeting"
                      value={greetingMessage}
                      onChange={(e) => setGreetingMessage(e.target.value)}
                      placeholder="友だち追加ありがとうございます！"
                      rows={6}
                    />
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        最大500文字まで入力できます
                      </p>
                      <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                        <p className="font-medium mb-1">使用可能なトークン：</p>
                        <ul className="space-y-0.5 ml-4">
                          <li><code className="bg-background px-1 py-0.5 rounded">[UID]</code> - 友だちの固有ID</li>
                          <li><code className="bg-background px-1 py-0.5 rounded">[LINE_NAME]</code> - 友だちの表示名</li>
                          <li><code className="bg-background px-1 py-0.5 rounded">[LINE_NAME_SAN]</code> - 友だちの表示名 + さん</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "保存中..." : "設定を保存"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>画像メッセージ</CardTitle>
              <CardDescription>
                あいさつメッセージ送信後に続けて送る画像とタップアクションを設定します。ポストバックを使う場合はシナリオと1回限りの実行可否を選んでください。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>画像の扱い</Label>
                <RadioGroup
                  value={imageMode}
                  onValueChange={(value) => setImageMode(value as GreetingImageMode)}
                  className="grid gap-3 md:grid-cols-3"
                >
                  <div className="flex items-start gap-2 rounded-md border p-3 hover:bg-muted/40 transition-colors">
                    <RadioGroupItem value="none" id="greeting-image-none" className="mt-1" />
                    <div>
                      <Label htmlFor="greeting-image-none" className="text-sm font-medium">
                        送信しない
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">テキストのみを送信します。</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border p-3 hover:bg-muted/40 transition-colors">
                    <RadioGroupItem value="link" id="greeting-image-link" className="mt-1" />
                    <div>
                      <Label htmlFor="greeting-image-link" className="text-sm font-medium">
                        URL埋め込み
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">画像タップで外部リンクを開きます。</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border p-3 hover:bg-muted/40 transition-colors">
                    <RadioGroupItem value="postback" id="greeting-image-postback" className="mt-1" />
                    <div>
                      <Label htmlFor="greeting-image-postback" className="text-sm font-medium">
                        ポストバック
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">画像タップでシナリオ遷移をトリガーします。</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {imageMode !== "none" && (
                <div className="space-y-3">
                  <Label htmlFor="greeting-image-url">画像URL</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="greeting-image-url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/image.png"
                      className="flex-1"
                    />
                    <MediaLibrarySelector
                      trigger={
                        <Button type="button" variant="outline" className="w-full sm:w-auto">
                          ライブラリから選択
                        </Button>
                      }
                      onSelect={(url) => setImageUrl(url)}
                      selectedUrl={imageUrl}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    画像URLを直接入力するか、ファイルライブラリから選択してください。未設定の場合は既定のテスト画像でプレビューします。
                  </p>
                  {imageUrl ? (
                    <div className="rounded-md border bg-muted/40 p-3 flex items-center justify-center">
                      <img
                        src={imageUrl}
                        alt="Greeting image preview"
                        className="max-h-40 w-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="rounded-md border bg-muted/40 p-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                      <span>プレビューにはサンプル画像 {DEFAULT_FLEX_IMAGE_URL} を使用します。</span>
                    </div>
                  )}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="greeting-image-aspect">アスペクト比</Label>
                      <Input
                        id="greeting-image-aspect"
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        placeholder="1:1"
                      />
                      <p className="text-xs text-muted-foreground">Flexメッセージの aspectRatio にそのまま反映されます。</p>
                    </div>
                  </div>
                </div>
              )}

              {imageMode === "link" && (
                <div className="space-y-2">
                  <Label htmlFor="greeting-image-link-url">タップ時のリンクURL</Label>
                  <Input
                    id="greeting-image-link-url"
                    value={imageLinkUrl}
                    onChange={(e) => setImageLinkUrl(e.target.value)}
                    placeholder="https://example.com/landing"
                  />
                  <p className="text-xs text-muted-foreground">画像タップで開く外部URLを設定します。</p>
                </div>
              )}

              {imageMode === "postback" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="greeting-image-scenario">遷移シナリオ</Label>
                    <Select
                      value={selectedScenario ?? undefined}
                      onValueChange={(value) =>
                        setSelectedScenario(
                          value && value !== "__no-scenario" && value !== "__none__" ? value : null
                        )
                      }
                    >
                      <SelectTrigger id="greeting-image-scenario" className="w-full">
                        <SelectValue placeholder="シナリオを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">選択しない</SelectItem>
                        {scenarios.length === 0 ? (
                          <SelectItem value="__no-scenario" disabled>
                            利用可能なシナリオがありません
                          </SelectItem>
                        ) : (
                          scenarios.map((scenario) => (
                            <SelectItem key={scenario.id} value={scenario.id}>
                              {scenario.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      画像タップで遷移させるシナリオを選択します。空欄の場合はカスタムデータのみ送信します。
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="greeting-image-postback-label">アクションラベル</Label>
                      <Input
                        id="greeting-image-postback-label"
                        value={postbackLabel}
                        onChange={(e) => setPostbackLabel(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Flexメッセージの action.label に使用します。</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="greeting-image-display-text">表示テキスト (任意)</Label>
                      <Input
                        id="greeting-image-display-text"
                        value={postbackDisplayText}
                        onChange={(e) => setPostbackDisplayText(e.target.value)}
                        placeholder="ユーザーに表示するテキスト"
                      />
                      <p className="text-xs text-muted-foreground">設定するとタップ時にユーザーへ表示されます。</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="greeting-image-token">カスタムデータ (任意)</Label>
                    <Input
                      id="greeting-image-token"
                      value={postbackToken}
                      onChange={(e) => setPostbackToken(e.target.value)}
                      placeholder="backend-token"
                    />
                    <p className="text-xs text-muted-foreground">
                      追加で渡したいパラメータがある場合に設定します。scenario / once パラメータと一緒にエンコードされます。
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">1度だけ反応させる</p>
                      <p className="text-xs text-muted-foreground">
                        画像タップを1回限りに制限します。無効にすると複数回起動できます。
                      </p>
                    </div>
                    <Switch checked={restrictOnce} onCheckedChange={setRestrictOnce} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Flexメッセージ JSON プレビュー</Label>
                <Textarea
                  value={flexMessagePreview}
                  readOnly
                  rows={12}
                  className="font-mono text-xs bg-muted/40 border border-border"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
                  <span>送信処理ではこのJSONを利用してFlexメッセージを構築してください。</span>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyFlexJson}>
                    <Copy className="mr-2 h-4 w-4" />
                    JSONをコピー
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 友だち追加URL & QR */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="w-5 h-5" />
                友だち追加URL & QR
              </CardTitle>
              <CardDescription>
                通常の友だち追加用のURLとQRコードです（LINEログイン無し）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {friendUrl ? (
                <>
                  <div className="space-y-2">
                    <Label>友だち追加URL</Label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={friendUrl} 
                        readOnly
                        className="flex-1 px-3 py-2 border rounded-md bg-muted font-mono text-sm"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => navigator.clipboard.writeText(friendUrl)}
                      >
                        コピー
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4 text-center">
                    <div className="flex items-center justify-center p-4 border rounded-lg bg-white w-40 mx-auto">
                        <QRCodeCanvas id="qr-code-canvas" value={friendUrl} size={128} />
                    </div>
                    <Button variant="outline" onClick={handleDownloadPNG}>
                        PNGとして保存
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>LINE Bot IDが設定されていません</p>
                  <p className="text-sm">LINE API設定で先にBOT IDを設定してください</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default GreetingMessageSettings;
