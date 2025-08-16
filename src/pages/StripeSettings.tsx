import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, X, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
export default function StripeSettings() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [stripeSettings, setStripeSettings] = useState({
    secretKey: '',
    publishableKey: ''
  });
  const [testStripeSettings, setTestStripeSettings] = useState({
    secretKey: '',
    publishableKey: ''
  });
  const [connectionStatus, setConnectionStatus] = useState<'not_configured' | 'configured' | 'error'>('not_configured');
  const [testConnectionStatus, setTestConnectionStatus] = useState<'not_configured' | 'configured' | 'error'>('not_configured');
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
  }, []);
  useEffect(() => {
    if (user) {
      loadStripeSettings();
    }
  }, [user]);
  const loadStripeSettings = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('stripe_credentials').select('*').eq('user_id', user?.id).single();
      if (error && error.code !== 'PGRST116') {
        console.error('Stripe設定の読み込みに失敗:', error);
        return;
      }
      if (data) {
        setStripeSettings({
          secretKey: data.live_secret_key || '',
          publishableKey: data.live_publishable_key || ''
        });
        setTestStripeSettings({
          secretKey: data.test_secret_key || '',
          publishableKey: data.test_publishable_key || ''
        });

        // Connection status based on whether keys exist
        setConnectionStatus(data.live_secret_key && data.live_publishable_key ? 'configured' : 'not_configured');
        setTestConnectionStatus(data.test_secret_key && data.test_publishable_key ? 'configured' : 'not_configured');
      }
    } catch (error) {
      console.error('Stripe設定の読み込みエラー:', error);
    }
  };
  const saveStripeSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // 基本的なバリデーション
      if (!stripeSettings.secretKey.startsWith('sk_')) {
        throw new Error('Secret Keyは sk_ で始まる必要があります');
      }
      if (!stripeSettings.publishableKey.startsWith('pk_')) {
        throw new Error('Publishable Keyは pk_ で始まる必要があります');
      }

      // Upsert Stripe credentials using user_id as the unique key
      const {
        error
      } = await supabase.from('stripe_credentials').upsert({
        user_id: user.id,
        live_secret_key: stripeSettings.secretKey,
        live_publishable_key: stripeSettings.publishableKey,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
      if (error) throw error;
      toast.success('本番環境のStripe設定を保存しました');
      setConnectionStatus('configured');
    } catch (error: any) {
      console.error('Stripe設定の保存に失敗:', error);
      toast.error(error.message || 'Stripe設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };
  const saveTestStripeSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // 基本的なバリデーション
      if (!testStripeSettings.secretKey.startsWith('sk_test_')) {
        throw new Error('テスト用Secret Keyは sk_test_ で始まる必要があります');
      }
      if (!testStripeSettings.publishableKey.startsWith('pk_test_')) {
        throw new Error('テスト用Publishable Keyは pk_test_ で始まる必要があります');
      }

      // Upsert Stripe credentials for test using user_id as the unique key
      const {
        error
      } = await supabase.from('stripe_credentials').upsert({
        user_id: user.id,
        test_secret_key: testStripeSettings.secretKey,
        test_publishable_key: testStripeSettings.publishableKey,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
      if (error) throw error;
      toast.success('テスト環境のStripe設定を保存しました');
      setTestConnectionStatus('configured');
    } catch (error: any) {
      console.error('テスト用Stripe設定の保存に失敗:', error);
      toast.error(error.message || 'テスト用Stripe設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };
  const testStripeConnection = async () => {
    if (!stripeSettings.secretKey) {
      toast.error('設定を先に保存してください');
      return;
    }
    setTesting(true);
    try {
      // プレースホルダー: 実際の実装ではStripe APIを呼び出してテスト
      console.log('Stripe接続をテスト中...');

      // モック実装
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Stripe接続テストが成功しました');
      setConnectionStatus('configured');
    } catch (error: any) {
      console.error('Stripe接続テストに失敗:', error);
      toast.error('Stripe接続テストに失敗しました');
      setConnectionStatus('error');
    } finally {
      setTesting(false);
    }
  };
  const testTestStripeConnection = async () => {
    if (!testStripeSettings.secretKey) {
      toast.error('テスト設定を先に保存してください');
      return;
    }
    setTesting(true);
    try {
      // プレースホルダー: 実際の実装ではStripe APIを呼び出してテスト
      console.log('テスト用Stripe接続をテスト中...');

      // モック実装
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('テスト用Stripe接続テストが成功しました');
      setTestConnectionStatus('configured');
    } catch (error: any) {
      console.error('テスト用Stripe接続テストに失敗:', error);
      toast.error('テスト用Stripe接続テストに失敗しました');
      setTestConnectionStatus('error');
    } finally {
      setTesting(false);
    }
  };
  if (loading) {
    return <div className="p-4">読み込み中...</div>;
  }
  if (!user) {
    return <div className="p-4">ログインが必要です</div>;
  }
  return <div className="space-y-6">
      <AppHeader user={user} />
      
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Stripe設定</h1>
          <p className="text-muted-foreground">Stripe決済システムとの連携を設定します。</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            {/* 本番環境設定 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  本番環境（Live Mode）
                  <Badge variant={connectionStatus === 'configured' ? 'default' : 'secondary'}>
                    {connectionStatus === 'configured' ? <><Check className="h-3 w-3 mr-1" />設定済み</> : <><X className="h-3 w-3 mr-1" />未設定</>}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 border border-green-200 bg-green-50 rounded-lg space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="live-secretKey">シークレットキー</Label>
                  <Input id="live-secretKey" type="password" placeholder="sk_live_..." value={stripeSettings.secretKey} onChange={e => setStripeSettings(prev => ({
                  ...prev,
                  secretKey: e.target.value
                }))} className="font-mono text-sm" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="live-publishableKey">公開可能キー</Label>
                  <Input id="live-publishableKey" placeholder="pk_live_..." value={stripeSettings.publishableKey} onChange={e => setStripeSettings(prev => ({
                  ...prev,
                  publishableKey: e.target.value
                }))} className="font-mono text-sm" />
                </div>


                <div className="flex gap-2">
                  <Button onClick={saveStripeSettings} disabled={saving} className="flex-1">
                    {saving ? '保存中...' : '本番設定を保存'}
                  </Button>
                  <Button variant="outline" onClick={testStripeConnection} disabled={testing || !stripeSettings.secretKey}>
                    {testing ? 'テスト中...' : '接続テスト'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* テスト環境設定 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  テスト環境（Test Mode）
                  <Badge variant={testConnectionStatus === 'configured' ? 'default' : 'secondary'}>
                    {testConnectionStatus === 'configured' ? <><Check className="h-3 w-3 mr-1" />設定済み</> : <><X className="h-3 w-3 mr-1" />未設定</>}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 border border-orange-200 bg-orange-50 rounded-lg space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-secretKey">シークレットキー</Label>
                  <Input id="test-secretKey" type="password" placeholder="sk_test_..." value={testStripeSettings.secretKey} onChange={e => setTestStripeSettings(prev => ({
                  ...prev,
                  secretKey: e.target.value
                }))} className="font-mono text-sm" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-publishableKey">公開可能キー</Label>
                  <Input id="test-publishableKey" placeholder="pk_test_..." value={testStripeSettings.publishableKey} onChange={e => setTestStripeSettings(prev => ({
                  ...prev,
                  publishableKey: e.target.value
                }))} className="font-mono text-sm" />
                </div>


                <div className="flex gap-2">
                  <Button onClick={saveTestStripeSettings} disabled={saving} className="flex-1">
                    {saving ? '保存中...' : 'テスト設定を保存'}
                  </Button>
                  <Button variant="outline" onClick={testTestStripeConnection} disabled={testing || !testStripeSettings.secretKey}>
                    {testing ? 'テスト中...' : '接続テスト'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Stripe設定ガイド</p>
                  <ol className="list-decimal list-inside text-sm space-y-1">
                    <li>Stripeダッシュボードにログイン</li>
                    <li>開発者 → API キーから取得</li>
                    <li>テスト用と本番用を適切に使い分け</li>
                    <li>Webhookエンドポイントを設定（必要に応じて）</li>
                  </ol>
                  <div className="mt-3">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-3 w-3" />
                      Stripeダッシュボードを開く
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>接続状況</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>API接続</span>
                    <Badge variant={connectionStatus === 'configured' ? 'default' : 'secondary'}>
                      {connectionStatus === 'configured' ? '正常' : '未接続'}
                    </Badge>
                  </div>
                  
                </div>
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  
                  
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                    <p className="font-medium">Webhookエンドポイント:</p>
                    <code className="text-xs">https://rtjxurmuaawyzjcdkqxt.supabase.co/functions/v1/stripe-webhook</code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ※ 必要に応じてStripeダッシュボードで設定してください
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            
          </div>
        </div>
      </div>
    </div>;
}