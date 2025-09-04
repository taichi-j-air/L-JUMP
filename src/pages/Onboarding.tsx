import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { CheckCircle2, User as UserIcon, Settings, CreditCard, Play, Video, ExternalLink } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";

interface BasicInfo {
  firstName: string;
  lastName: string;
  displayName: string;
  phoneNumber: string;
  birthDate: string;
  isBusiness: boolean;
}

interface ApiSettings {
  channelId: string;
  channelSecret: string;
  lineBotId: string;
  channelAccessToken: string;
}

const Onboarding = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [hasLineAccount, setHasLineAccount] = useState<boolean | null>(null);
  const [businessType, setBusinessType] = useState("");
  const [showLineAccountDialog, setShowLineAccountDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    firstName: "",
    lastName: "",
    displayName: "",
    phoneNumber: "",
    birthDate: "",
    isBusiness: false
  });
  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    channelId: "",
    channelSecret: "",
    lineBotId: "",
    channelAccessToken: ""
  });
  const [activeVideoTab, setActiveVideoTab] = useState("channel_id");
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [showCreationGuide, setShowCreationGuide] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkUserAndLoadData();
  }, []);

  const checkUserAndLoadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // 既存の設定を読み込み
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (profile) {
        // 基本情報の設定
        setBasicInfo({
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          displayName: profile.display_name || "",
          phoneNumber: profile.phone_number || "",
          birthDate: profile.birth_date || "",
          isBusiness: profile.is_business || false
        });

        // API設定の自動表示
        setApiSettings({
          channelId: profile.line_channel_id || "",
          channelSecret: profile.line_channel_secret || "",
          lineBotId: profile.line_bot_id || "",
          channelAccessToken: profile.line_channel_access_token || ""
        });

        setBusinessType(profile.is_business ? "company" : "individual");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("データの読み込みに失敗しました");
    }
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return basicInfo.firstName && basicInfo.lastName && basicInfo.displayName && 
               basicInfo.phoneNumber && basicInfo.birthDate && businessType;
      case 2:
        return hasLineAccount !== null;
      case 3:
        return apiSettings.channelId && apiSettings.channelSecret && 
               apiSettings.lineBotId && apiSettings.channelAccessToken;
      case 4:
        return videoCompleted;
      case 5:
        return selectedPlan;
      default:
        return true;
    }
  };

  const handleNextStep = async () => {
    if (!validateCurrentStep()) {
      toast.error('すべての必須項目を入力してください');
      return;
    }

    if (currentStep === 1) {
      // Save basic info to database
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: basicInfo.firstName,
          last_name: basicInfo.lastName,
          display_name: basicInfo.displayName,
          phone_number: basicInfo.phoneNumber,
          birth_date: basicInfo.birthDate || null,
          is_business: basicInfo.isBusiness
        })
        .eq('user_id', user!.id);

      if (error) {
        console.error('Error saving basic info:', error);
        toast.error('基本情報の保存に失敗しました');
        return;
      }
    }

    if (currentStep === 2 && hasLineAccount === false) {
      setShowLineAccountDialog(true);
      return;
    }

    if (currentStep === 3) {
      // Save API settings
      const { error } = await supabase
        .from('profiles')
        .update({
          line_channel_id: apiSettings.channelId,
          line_channel_secret: apiSettings.channelSecret,
          line_bot_id: apiSettings.lineBotId,
          line_channel_access_token: apiSettings.channelAccessToken,
          line_api_status: 'configured'
        })
        .eq('user_id', user!.id);

      if (error) {
        console.error('Error saving API settings:', error);
        toast.error('API設定の保存に失敗しました');
        return;
      }
    }

    if (currentStep === 2 && hasLineAccount === true) {
      setCurrentStep(3);
    } else if (currentStep === 2 && hasLineAccount === false) {
      setCurrentStep(3); // Always go to API settings after LINE account check
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleLineAccountCreated = () => {
    setShowLineAccountDialog(false);
    setHasLineAccount(true);
    setCurrentStep(3);
  };

  const handleLineAccountNotCreated = () => {
    setShowLineAccountDialog(false);
    toast.error('LINE公式アカウントを作成しないとツールを利用できません');
  };

  const handleComplete = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true
        })
        .eq('user_id', user!.id);

      if (error) {
        console.error('Error completing onboarding:', error);
        toast.error('完了処理に失敗しました');
        return;
      }

      toast.success('セットアップが完了しました！');
      navigate("/");
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('完了処理に失敗しました');
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  const steps = [
    { id: 1, title: "基本情報", icon: UserIcon },
    { id: 2, title: "LINE アカウント", icon: Settings },
    { id: 3, title: "LINE API設定", icon: Settings },
    { id: 4, title: "使い方動画", icon: Video },
    { id: 5, title: "プラン選択", icon: CreditCard }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">L!JUMP セットアップ</h1>
          <div className="flex justify-center items-center gap-4 mb-6">
            {steps.map((step, index) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const Icon = step.icon;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-green-500 text-white' :
                      isActive ? 'bg-blue-500 text-white' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <p className={`text-sm mt-2 ${isActive ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-0.5 ${currentStep > step.id ? 'bg-green-500' : 'bg-gray-300'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>
                ステップ {currentStep}: {steps[currentStep - 1].title}
              </CardTitle>
              <CardDescription>
                {currentStep === 1 && "基本情報を入力してください"}
                {currentStep === 2 && "LINE公式アカウントをお持ちですか？"}
                {currentStep === 3 && "LINE APIの設定を行います"}
                {currentStep === 4 && "使い方動画をご覧ください"}
                {currentStep === 5 && "ご利用プランを選択してください"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Step 1: 基本情報 */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">名前（姓） <span className="text-red-500">*</span></Label>
                      <Input
                        id="firstName"
                        value={basicInfo.firstName}
                        onChange={(e) => setBasicInfo(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="山田"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">名前（名） <span className="text-red-500">*</span></Label>
                      <Input
                        id="lastName"
                        value={basicInfo.lastName}
                        onChange={(e) => setBasicInfo(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="太郎"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">表示名 <span className="text-red-500">*</span></Label>
                    <Input
                      id="displayName"
                      value={basicInfo.displayName}
                      onChange={(e) => setBasicInfo(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="山田太郎"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">電話番号 <span className="text-red-500">*</span></Label>
                    <Input
                      id="phoneNumber"
                      value={basicInfo.phoneNumber}
                      onChange={(e) => setBasicInfo(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      placeholder="090-1234-5678"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">生年月日 <span className="text-red-500">*</span></Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={basicInfo.birthDate}
                      onChange={(e) => setBasicInfo(prev => ({ ...prev, birthDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>事業形態 <span className="text-red-500">*</span></Label>
                    <Select value={businessType} onValueChange={setBusinessType}>
                      <SelectTrigger>
                        <SelectValue placeholder="事業形態を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">個人事業主</SelectItem>
                        <SelectItem value="company">法人</SelectItem>
                        <SelectItem value="other">その他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Step 2: LINE公式アカウント確認 */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <Label>LINE公式アカウントをお持ちですか？ <span className="text-red-500">*</span></Label>
                  <RadioGroup 
                    value={hasLineAccount?.toString()} 
                    onValueChange={(value) => {
                      setHasLineAccount(value === 'true');
                      setShowCreationGuide(value === 'false');
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="has-line" />
                      <Label htmlFor="has-line">はい、持っています</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="no-line" />
                      <Label htmlFor="no-line">いいえ、持っていません</Label>
                    </div>
                  </RadioGroup>

                  {showCreationGuide && (
                    <div className="mt-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold mb-4 text-gray-900">LINE公式アカウントの作成手順</h3>
                      <div className="space-y-3 text-sm text-gray-700">
                        <p>1. 以下のリンクからLINE for Business にアクセス</p>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => window.open('https://entry.line.biz/start/jp/', '_blank')}
                            className="border-green-300 text-green-700 hover:bg-green-50 bg-green-600 text-white hover:bg-green-700"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            LINE for Business
                          </Button>
                        </div>
                        <p>2. 「アカウントの開設」をクリック</p>
                        <p>3. LINE公式アカウントの情報を入力</p>
                        <p>4. アカウント作成完了後、APIキー等の取得を行ってください</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: LINE API設定 */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="mb-6">
                    <Tabs value={activeVideoTab} onValueChange={setActiveVideoTab} className="w-full">
                       <TabsContent value="channel_id">
                         <VideoPlayer 
                           videoType="channel_id"
                           showTimer={false}
                           requiredCompletionPercentage={0}
                         />
                       </TabsContent>
                      <TabsContent value="channel_secret">
                        <VideoPlayer 
                          videoType="channel_secret"
                          showTimer={false}
                        />
                      </TabsContent>
                      <TabsContent value="line_bot_id">
                        <VideoPlayer 
                          videoType="line_bot_id"
                          showTimer={false}
                        />
                      </TabsContent>
                      <TabsContent value="channel_access_token">
                        <VideoPlayer 
                          videoType="channel_access_token"
                          showTimer={false}
                        />
                      </TabsContent>
                      <TabsList className="grid w-full grid-cols-4 bg-muted/30">
                        <TabsTrigger value="channel_id" className="text-sm">チャネルID</TabsTrigger>
                        <TabsTrigger value="channel_secret" className="text-sm">チャネルシークレット</TabsTrigger>
                        <TabsTrigger value="line_bot_id" className="text-sm">LINEボットID</TabsTrigger>
                        <TabsTrigger value="channel_access_token" className="text-sm">アクセストークン</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="channelId">チャネルID（Channel ID）<span className="text-red-500">*</span></Label>
                      <Input
                        id="channelId"
                        value={apiSettings.channelId}
                        onChange={(e) => setApiSettings(prev => ({ ...prev, channelId: e.target.value }))}
                        placeholder="1234567890"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="channelSecret">チャネルシークレット（Channel Secret）<span className="text-red-500">*</span></Label>
                      <Input
                        id="channelSecret"
                        type="password"
                        value={apiSettings.channelSecret}
                        onChange={(e) => setApiSettings(prev => ({ ...prev, channelSecret: e.target.value }))}
                        placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lineBotId">LINEボットID（LINE Bot ID）<span className="text-red-500">*</span></Label>
                      <Input
                        id="lineBotId"
                        value={apiSettings.lineBotId}
                        onChange={(e) => setApiSettings(prev => ({ ...prev, lineBotId: e.target.value }))}
                        placeholder="@xxxxxxxxx"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="channelAccessToken">チャネルアクセストークン（Channel Access Token）<span className="text-red-500">*</span></Label>
                      <Input
                        id="channelAccessToken"
                        type="password"
                        value={apiSettings.channelAccessToken}
                        onChange={(e) => setApiSettings(prev => ({ ...prev, channelAccessToken: e.target.value }))}
                        placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: 使い方動画 */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-yellow-800 font-medium">
                      ⚠️ この動画は必ず視聴してください
                    </p>
                    <p className="text-yellow-700 text-sm mt-1">
                      動画を最後まで視聴しないと次のステップに進むことができません。L!JUMPの基本機能をご確認ください。
                    </p>
                  </div>
                  
                  <VideoPlayer 
                    videoType="step4" 
                    onVideoComplete={() => setVideoCompleted(true)}
                    showTimer={true}
                    requiredCompletionPercentage={30}
                    disabled={false}
                  />
                </div>
              )}

              {/* Step 5: プラン選択 */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="mb-6">
                    <VideoPlayer 
                      videoType="plan_selection_video"
                      showTimer={false}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label>プランを選択してください <span className="text-red-500">*</span></Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className={`cursor-pointer transition-all hover:shadow-lg ${selectedPlan === 'free' ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => setSelectedPlan('free')}>
                        <CardHeader className="text-center">
                          <CardTitle className="text-lg">フリー</CardTitle>
                          <div className="text-3xl font-bold">¥0</div>
                          <p className="text-sm text-muted-foreground">月額</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-center">
                            <p className="font-semibold">月200通まで</p>
                            <p className="text-sm text-muted-foreground">基本機能</p>
                          </div>
                          <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                            <div className="flex items-center justify-center">
                              <RadioGroupItem value="free" id="plan-free" />
                            </div>
                          </RadioGroup>
                        </CardContent>
                      </Card>

                      <Card className={`cursor-pointer transition-all hover:shadow-lg relative ${selectedPlan === 'gold' ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => setSelectedPlan('gold')}>
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">おすすめ</span>
                        </div>
                        <CardHeader className="text-center">
                          <CardTitle className="text-lg">ゴールド</CardTitle>
                          <div className="text-3xl font-bold">¥9,800</div>
                          <p className="text-sm text-muted-foreground">月額</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-center">
                            <p className="font-semibold">無制限</p>
                            <p className="text-sm text-muted-foreground">全機能利用可能</p>
                          </div>
                          <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                            <div className="flex items-center justify-center">
                              <RadioGroupItem value="gold" id="plan-gold" />
                            </div>
                          </RadioGroup>
                        </CardContent>
                      </Card>

                      <Card className={`cursor-pointer transition-all hover:shadow-lg ${selectedPlan === 'silver' ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => setSelectedPlan('silver')}>
                        <CardHeader className="text-center">
                          <CardTitle className="text-lg">シルバー</CardTitle>
                          <div className="text-3xl font-bold">¥4,980</div>
                          <p className="text-sm text-muted-foreground">月額</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-center">
                            <p className="font-semibold">月1000通まで</p>
                            <p className="text-sm text-muted-foreground">拡張機能</p>
                          </div>
                          <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                            <div className="flex items-center justify-center">
                              <RadioGroupItem value="silver" id="plan-silver" />
                            </div>
                          </RadioGroup>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 flex justify-between">
            {currentStep > 1 && (
              <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                前のステップへ
              </Button>
            )}
            <div className="ml-auto">
              {currentStep < 5 ? (
                <Button 
                  onClick={handleNextStep} 
                  disabled={!validateCurrentStep()}
                >
                  次のステップへ
                </Button>
              ) : (
                <Button onClick={handleComplete} disabled={!validateCurrentStep()}>
                  セットアップ完了
                </Button>
              )}
            </div>
          </div>

          <AlertDialog open={showLineAccountDialog} onOpenChange={setShowLineAccountDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>LINE公式アカウントの作成</AlertDialogTitle>
                <AlertDialogDescription>
                  LINE公式アカウントを作成しましたか？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleLineAccountNotCreated}>
                  いいえ
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleLineAccountCreated}>
                  はい、作成しました
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;