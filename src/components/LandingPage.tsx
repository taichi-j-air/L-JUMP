import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, MessageSquare, Settings, Users, Zap, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: MessageSquare,
      title: "Flexメッセージデザイナー",
      description: "LINE公式アカウントのリッチなメッセージを簡単に作成"
    },
    {
      icon: Users,
      title: "友だち管理",
      description: "LINE友だちの詳細な管理とタグ機能"
    },
    {
      icon: Settings,
      title: "シナリオ配信",
      description: "ステップメール風の自動配信システム"
    },
    {
      icon: BarChart3,
      title: "分析ダッシュボード",
      description: "配信効果や友だち分析を可視化"
    },
    {
      icon: Zap,
      title: "API連携",
      description: "外部サービスとの連携でさらに機能拡張"
    }
  ];

  const plans = [
    {
      name: "無料プラン",
      price: "¥0",
      period: "/月",
      features: [
        "メッセージ配信 200通/月",
        "友だち登録 100人まで",
        "基本的なシナリオ機能",
        "コミュニティサポート"
      ],
      recommended: false
    },
    {
      name: "ベーシック",
      price: "¥2,980",
      period: "/月",
      features: [
        "メッセージ配信 5,000通/月",
        "友だち登録 1,000人まで",
        "全シナリオ機能",
        "フォーム機能",
        "優先サポート"
      ],
      recommended: true
    },
    {
      name: "プロ",
      price: "¥9,980",
      period: "/月",
      features: [
        "メッセージ配信 無制限",
        "友だち登録 無制限",
        "全機能使い放題",
        "API アクセス",
        "専任サポート"
      ],
      recommended: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              FlexMaster
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              LINE公式アカウントを活用したフレキシブルなチャットボット管理システム<br />
              誰でも簡単に、プロフェッショナルなLINE配信を実現
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="text-lg px-8 py-6"
              >
                無料でアカウント作成
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="text-lg px-8 py-6"
              >
                デモを見る
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">主な機能</h2>
            <p className="text-muted-foreground text-lg">
              LINE配信に必要な機能を全て搭載
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <IconComponent className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">料金プラン</h2>
            <p className="text-muted-foreground text-lg">
              あなたのビジネス規模に合わせたプランをご用意
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.recommended ? 'border-primary shadow-lg scale-105' : ''}`}>
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                      おすすめ
                    </span>
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.recommended ? "default" : "outline"}
                    onClick={() => navigate("/auth")}
                  >
                    {plan.name === "無料プラン" ? "無料で始める" : "プランを選択"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">今すぐFlexMasterを始めましょう</h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            アカウント作成は30秒で完了。無料プランから始めて、必要に応じてアップグレードできます。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => navigate("/auth")}
              className="text-lg px-8 py-6"
            >
              無料アカウント作成
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 py-6 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              資料請求
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">FlexMaster</h3>
              <p className="text-muted-foreground text-sm">
                LINE公式アカウントを活用したフレキシブルなチャットボット管理システム
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">製品</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>機能一覧</li>
                <li>料金プラン</li>
                <li>API仕様</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">サポート</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>ヘルプセンター</li>
                <li>お問い合わせ</li>
                <li>システム状況</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">会社</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>会社概要</li>
                <li>プライバシーポリシー</li>
                <li>利用規約</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-muted-foreground text-sm">
            © 2024 FlexMaster. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;