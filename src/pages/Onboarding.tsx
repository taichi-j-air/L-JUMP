import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, User, Settings, CreditCard, ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  user_id: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  onboarding_step: number;
  onboarding_completed: boolean;
  provider?: string;
}

const ONBOARDING_STEPS = [
  { id: 1, title: "基本情報", description: "プロフィール情報を入力してください", icon: User },
  { id: 2, title: "LINE API設定", description: "LINE APIの設定を行います", icon: Settings },
  { id: 3, title: "プラン選択", description: "ご利用プランを選択してください", icon: CreditCard },
];

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
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
        setPhoneNumber(profileData.phone_number || "");

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
    if (!firstName.trim() || !lastName.trim()) {
      setError("姓名を入力してください。");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber.trim(),
        onboarding_step: 2,
      });

      toast({
        title: "基本情報を保存しました",
        description: "次はLINE APIの設定を行いましょう。",
      });

      setCurrentStep(2);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Skip = async () => {
    setLoading(true);
    try {
      await updateProfile({
        onboarding_step: 3,
      });

      toast({
        title: "LINE API設定をスキップしました",
        description: "後で設定画面から設定できます。",
      });

      setCurrentStep(3);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    setLoading(true);
    try {
      await updateProfile({
        onboarding_completed: true,
        onboarding_step: 3,
      });

      toast({
        title: "オンボーディング完了！",
        description: "FlexMasterをお楽しみください。",
      });

      navigate("/");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-3xl font-bold mb-2">FlexMaster セットアップ</h1>
          <p className="text-muted-foreground">簡単3ステップでセットアップ完了</p>
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
        <div className="max-w-lg mx-auto">
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">電話番号</Label>
                    <Input
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="090-1234-5678"
                    />
                  </div>

                  <Button 
                    onClick={handleStep1Submit} 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? "保存中..." : "次へ"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}

              {/* Step 2: LINE API設定 */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      LINE APIの設定は後で行うことができます。今すぐ設定するか、スキップして後で設定できます。
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={goBack} disabled={loading}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      戻る
                    </Button>
                    <Button onClick={handleStep2Skip} disabled={loading}>
                      {loading ? "保存中..." : "スキップ"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  
                  <Button 
                    onClick={() => navigate("/line-api-settings")} 
                    variant="outline" 
                    className="w-full"
                  >
                    今すぐLINE API設定
                  </Button>
                </div>
              )}

              {/* Step 3: プラン選択 */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      プランは後で変更できます。まずは無料プランでお試しください。
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={goBack} disabled={loading}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      戻る
                    </Button>
                    <Button onClick={handleCompleteOnboarding} disabled={loading}>
                      {loading ? "完了中..." : "完了"}
                      <CheckCircle className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  
                  <Button 
                    onClick={() => navigate("/plan-settings")} 
                    variant="outline" 
                    className="w-full"
                  >
                    プラン設定を見る
                  </Button>
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