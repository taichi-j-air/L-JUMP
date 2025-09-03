import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, User, Settings, CreditCard, ArrowLeft, ArrowRight, ExternalLink, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  user_id: string;
  first_name?: string;
  last_name?: string;
  first_name_kana?: string;
  last_name_kana?: string;
  birth_date?: string;
  is_business?: boolean;
  phone_number?: string;
  onboarding_step: number;
  onboarding_completed: boolean;
  provider?: string;
  has_line_business?: boolean;
}

const ONBOARDING_STEPS = [
  { id: 1, title: "基本情報", description: "ユーザー情報を入力してください", icon: User },
  { id: 2, title: "LINEアカウント", description: "LINEビジネスアカウントの確認", icon: Settings },
  { id: 3, title: "LINE API設定", description: "LINE APIの設定を行います", icon: Settings },
  { id: 4, title: "動画視聴", description: "使い方を動画で確認", icon: Play },
  { id: 5, title: "プラン選択", description: "ご利用プランを選択してください", icon: CreditCard },
];

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstNameKana, setFirstNameKana] = useState("");
  const [lastNameKana, setLastNameKana] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [isBusiness, setIsBusiness] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [hasLineBusiness, setHasLineBusiness] = useState<boolean | null>(null);
  const [videoWatched, setVideoWatched] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUserAndLoadProfile();
  }, []);

  const checkUserAndLoadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      // プロフィール情報を取得
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error) throw error;

      if (profileData) {
        setProfile(profileData);
        setCurrentStep(profileData.onboarding_step || 1);
        setFirstName(profileData.first_name || "");
        setLastName(profileData.last_name || "");
        setFirstNameKana((profileData as any).first_name_kana || "");
        setLastNameKana((profileData as any).last_name_kana || "");
        setBirthDate((profileData as any).birth_date || "");
        setIsBusiness((profileData as any).is_business || false);
        setPhoneNumber(profileData.phone_number || "");
        setHasLineBusiness((profileData as any).has_line_business);

        // オンボーディング完了済みの場合はホームへ
        if (profileData.onboarding_completed) {
          navigate("/");
        }
      }
    } catch (error: any) {
      console.error("Profile loading error:", error);
      setError("プロフィール情報の読み込みに失敗しました。");
    }
  };

  const updateProfile = async (updateData: Partial<UserProfile>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("認証が必要です");

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', session.user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...updateData } : null);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const handleStep1Submit = async () => {
    if (!firstName.trim() || !lastName.trim() || !firstNameKana.trim() || !lastNameKana.trim() || !birthDate) {
      setError("必須項目をすべて入力してください。");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        first_name_kana: firstNameKana.trim(),
        last_name_kana: lastNameKana.trim(),
        birth_date: birthDate,
        is_business: isBusiness,
        phone_number: phoneNumber.trim(),
        display_name: `${firstName.trim()} ${lastName.trim()}`,
        onboarding_step: 2,
      } as any);

      toast({
        title: "基本情報を保存しました",
        description: "次はLINEビジネスアカウントの確認です。",
      });

      setCurrentStep(2);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async () => {
    if (hasLineBusiness === null) {
      setError("LINEビジネスアカウントの有無を選択してください。");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateProfile({
        has_line_business: hasLineBusiness,
        onboarding_step: 3,
      } as any);

      toast({
        title: "LINEアカウント情報を保存しました",
        description: hasLineBusiness ? "LINE API設定に進みます。" : "LINE API設定をスキップします。",
      });

      setCurrentStep(hasLineBusiness ? 3 : 4);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Skip = async () => {
    setLoading(true);
    try {
      await updateProfile({
        onboarding_step: 4,
      });

      toast({
        title: "LINE API設定をスキップしました",
        description: "後で設定画面から設定できます。",
      });

      setCurrentStep(4);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoComplete = async () => {
    setLoading(true);
    try {
      await updateProfile({
        onboarding_step: 5,
      });

      toast({
        title: "動画視聴完了",
        description: "プラン選択に進みます。",
      });

      setCurrentStep(5);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelection = async (plan: string) => {
    setLoading(true);
    try {
      if (plan === 'free') {
        await updateProfile({
          onboarding_completed: true,
          onboarding_step: 5,
        });

        toast({
          title: "フリープランでスタート！",
          description: "L!JUMPをお楽しみください。",
        });

        navigate("/");
      } else {
        // 有料プランの場合は決済画面へ
        navigate(`/checkout?plan=${plan}`);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoEnd = () => {
    setVideoEnded(true);
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progressPercentage = (currentStep / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src="/lovable-uploads/4d26a444-f601-4acc-8285-9d99146345e3.png" 
              alt="L!JUMP" 
              className="h-16" 
            />
          </div>
          <h1 className="text-3xl font-bold mb-2">L!JUMP セットアップ</h1>
          <p className="text-muted-foreground">簡単5ステップでセットアップ完了</p>
        </div>

        {/* Progress */}
        <div className="max-w-2xl mx-auto mb-8">
          <Progress value={progressPercentage} className="mb-4" />
          <div className="flex justify-between">
            {ONBOARDING_STEPS.map((step) => {
              const IconComponent = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              
              return (
                <div key={step.id} className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                    isCompleted ? "bg-primary text-primary-foreground" :
                    isCurrent ? "bg-primary/20 text-primary border-2 border-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <IconComponent className="w-5 h-5" />}
                  </div>
                  <span className={`text-sm font-medium ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className={`mx-auto ${currentStep === 5 ? 'max-w-6xl' : 'max-w-lg'}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {React.createElement(ONBOARDING_STEPS[currentStep - 1].icon, { className: "w-5 h-5" })}
                {ONBOARDING_STEPS[currentStep - 1].title}
              </CardTitle>
              <CardDescription>
                {ONBOARDING_STEPS[currentStep - 1].description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Step 1: 基本情報 */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  {profile?.provider === 'google' && (
                    <Alert className="mb-4">
                      <AlertDescription>
                        Googleアカウントから情報を取得しました。必要に応じて修正してください。
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">姓 *</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="田中"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">名 *</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="太郎"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstNameKana">姓（フリガナ）*</Label>
                      <Input
                        id="firstNameKana"
                        value={firstNameKana}
                        onChange={(e) => setFirstNameKana(e.target.value)}
                        placeholder="タナカ"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastNameKana">名（フリガナ）*</Label>
                      <Input
                        id="lastNameKana"
                        value={lastNameKana}
                        onChange={(e) => setLastNameKana(e.target.value)}
                        placeholder="タロウ"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="birthDate">生年月日 *</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="isBusiness" 
                      checked={isBusiness}
                      onCheckedChange={(checked) => setIsBusiness(checked as boolean)}
                    />
                    <Label htmlFor="isBusiness">法人でのご利用</Label>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">電話番号 *</Label>
                    <Input
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="090-1234-5678"
                      required
                    />
                    <p className="text-xs text-muted-foreground">※お電話をかけることはございません</p>
                  </div>

                  <Button 
                    onClick={handleStep1Submit} 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? "保存中..." : "保存して次へ"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}

              {/* Step 2: LINEビジネスアカウント確認 */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      L!JUMPを使用するにはLINEビジネスアカウントが必要です。
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <Label className="text-base font-medium">LINEビジネスアカウントをお持ちですか？</Label>
                    <RadioGroup value={hasLineBusiness?.toString() || ""} onValueChange={(value) => setHasLineBusiness(value === "true")}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true" id="has-line" />
                        <Label htmlFor="has-line">はい、持っています</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="false" id="no-line" />
                        <Label htmlFor="no-line">いいえ、持っていません</Label>
                      </div>
                    </RadioGroup>

                    {hasLineBusiness === false && (
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-medium mb-2">LINEビジネスアカウント作成手順</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          以下のリンクからLINEビジネスアカウントを作成してください。作成後、この画面に戻って「次へ」をクリックしてください。
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open('https://www.linebiz.com/jp/entry/', '_blank')}
                        >
                          LINEビジネスアカウント作成
                          <ExternalLink className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={goBack} disabled={loading}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      戻る
                    </Button>
                    <Button onClick={handleStep2Submit} disabled={loading || hasLineBusiness === null}>
                      {loading ? "保存中..." : "次へ"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: LINE API設定 */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <Alert>
                    <AlertDescription>
                      LINE APIの設定を行います。下記に入力して保存してください。
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="onboard-channel-token">Channel Access Token</Label>
                      <Input
                        id="onboard-channel-token"
                        type="password"
                        placeholder="Channel Access Tokenを入力"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        LINE Developers Console → Messaging API → Channel access tokenから取得
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="onboard-channel-secret">Channel Secret</Label>
                      <Input
                        id="onboard-channel-secret"
                        type="password"
                        placeholder="Channel Secretを入力"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        LINE Developers Console → Basic settings → Channel secretから取得
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="onboard-channel-id">チャネルID</Label>
                      <Input
                        id="onboard-channel-id"
                        placeholder="チャネルIDを入力（例: 1234567890）"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        LINE Developers Console → Basic settings → Channel IDから取得
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="onboard-line-bot-id">LINE Bot ID</Label>
                      <Input
                        id="onboard-line-bot-id"
                        placeholder="LINE Bot IDを入力（例: @your-bot-id）"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        LINE Developers Console → Messaging API → LINE公式アカウントから取得
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={goBack} disabled={loading}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      戻る
                    </Button>
                    <Button onClick={handleStep3Skip} disabled={loading}>
                      {loading ? "保存中..." : "設定して次へ"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: 動画視聴 */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <Alert>
                    <AlertDescription>
                      L!JUMPの使い方を動画で確認してください。動画終了後に次のステップに進めます。
                    </AlertDescription>
                  </Alert>

                  <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Play className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg font-medium mb-2">使い方動画</p>
                      <p className="text-sm text-muted-foreground mb-4">L!JUMPの基本的な使い方を学びましょう</p>
                      <Button 
                        variant="outline" 
                        size="lg" 
                        className="mt-2"
                        onClick={handleVideoEnd}
                      >
                        動画終了をシミュレート
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={goBack} disabled={loading}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      戻る
                    </Button>
                    <Button 
                      onClick={handleVideoComplete} 
                      disabled={loading || !videoEnded}
                      className={!videoEnded ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      {loading ? "保存中..." : "次へ"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 5: プラン選択 */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <Alert>
                    <AlertDescription>
                      ご利用プランを選択してください。フリープランでは月200通まで無料でご利用いただけます。
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* フリープラン */}
                    <div 
                      className={`p-6 border-2 rounded-xl cursor-pointer transition-all hover:shadow-lg ${
                        selectedPlan === 'free' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedPlan('free')}
                    >
                      <div className="text-center">
                        <h3 className="text-xl font-bold mb-2">フリープラン</h3>
                        <div className="text-3xl font-bold mb-4">¥0<span className="text-sm font-normal">/月</span></div>
                        <ul className="text-sm space-y-2 mb-6">
                          <li>月200通まで無料</li>
                          <li>基本機能利用可能</li>
                          <li>シナリオ3個まで</li>
                        </ul>
                        <Button 
                          variant={selectedPlan === 'free' ? 'default' : 'outline'}
                          className="w-full"
                        >
                          選択する
                        </Button>
                      </div>
                    </div>

                    {/* ゴールドプラン（おすすめ）*/}
                    <div 
                      className={`p-6 border-2 rounded-xl cursor-pointer transition-all hover:shadow-lg relative ${
                        selectedPlan === 'gold' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedPlan('gold')}
                    >
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                          おすすめ
                        </span>
                      </div>
                      <div className="text-center">
                        <h3 className="text-xl font-bold mb-2">ゴールドプラン</h3>
                        <div className="text-3xl font-bold mb-4">¥9,800<span className="text-sm font-normal">/月</span></div>
                        <ul className="text-sm space-y-2 mb-6">
                          <li>無制限配信</li>
                          <li>全機能利用可能</li>
                          <li>優先サポート</li>
                          <li>API利用可能</li>
                        </ul>
                        <Button 
                          variant={selectedPlan === 'gold' ? 'default' : 'outline'}
                          className="w-full"
                        >
                          選択する
                        </Button>
                      </div>
                    </div>

                    {/* シルバープラン */}
                    <div 
                      className={`p-6 border-2 rounded-xl cursor-pointer transition-all hover:shadow-lg ${
                        selectedPlan === 'silver' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedPlan('silver')}
                    >
                      <div className="text-center">
                        <h3 className="text-xl font-bold mb-2">シルバープラン</h3>
                        <div className="text-3xl font-bold mb-4">¥2,980<span className="text-sm font-normal">/月</span></div>
                        <ul className="text-sm space-y-2 mb-6">
                          <li>月1,000通まで</li>
                          <li>基本機能利用可能</li>
                          <li>シナリオ無制限</li>
                          <li>メールサポート</li>
                        </ul>
                        <Button 
                          variant={selectedPlan === 'silver' ? 'default' : 'outline'}
                          className="w-full"
                        >
                          選択する
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                    <Button variant="outline" onClick={goBack} disabled={loading}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      戻る
                    </Button>
                    <Button 
                      onClick={() => handlePlanSelection(selectedPlan)} 
                      disabled={loading || !selectedPlan}
                    >
                      {loading ? "処理中..." : selectedPlan === 'free' ? "開始" : "決済へ"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;