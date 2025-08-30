import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Separator } from "@/components/ui/separator";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    // 初期認証状態チェック
    const checkAuth = async () => {
      try {
        console.log('🔍 Initial auth check started...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Session error:', error);
          setError(`認証エラー: ${error.message}`);
          return;
        }

        console.log('📋 Initial session:', session);
        
        if (mounted) {
          if (session?.user) {
            console.log('✅ User found, setting user state');
            setUser(session.user);
            await handleSuccessfulAuth(session.user, 'INITIAL_SESSION');
          } else {
            console.log('❌ No user found in initial session');
            setUser(null);
          }
          setAuthInitialized(true);
        }
      } catch (error: any) {
        console.error('❌ Auth check error:', error);
        if (mounted) {
          setError(`認証チェックエラー: ${error.message}`);
          setAuthInitialized(true);
        }
      }
    };

    checkAuth();

    // 認証状態変更の監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.email || 'No user');
        
        if (!mounted) return;

        try {
          if (session?.user) {
            console.log('👤 User authenticated:', {
              event,
              userId: session.user.id,
              email: session.user.email,
              provider: session.user.app_metadata?.provider
            });
            
            setUser(session.user);
            setError(null);
            setGoogleLoading(false);
            
            await handleSuccessfulAuth(session.user, event);
          } else {
            console.log('🚪 User signed out or no session');
            setUser(null);
            setGoogleLoading(false);
          }
        } catch (error: any) {
          console.error('❌ Auth state change error:', error);
          setError(`認証状態エラー: ${error.message}`);
          setGoogleLoading(false);
        }
      }
    );

    return () => {
      console.log('🧹 Cleaning up auth listener');
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // 認証成功時の処理
  const handleSuccessfulAuth = async (user: User, event: string) => {
    try {
      console.log('🎉 Handling successful auth for:', user.email, 'Event:', event);
      
      // プロファイル情報を取得してオンボーディング状況を確認
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.log('⚠️ Profile not found or error:', profileError.message);
        // プロファイルが存在しない場合はオンボーディングが必要
        if (profileError.code === 'PGRST116') {
          console.log('🚀 New user, redirecting to onboarding');
          navigate("/onboarding");
          return;
        }
      }

      if (profile && !profile.onboarding_completed) {
        console.log('📝 Onboarding not completed, redirecting to onboarding');
        navigate("/onboarding");
      } else {
        console.log('✅ User fully set up, redirecting to dashboard');
        // Googleログインの場合も必ずオンボーディングを経由
        navigate("/onboarding");
      }
    } catch (error: any) {
      console.error('❌ Error in handleSuccessfulAuth:', error);
      setError(`プロファイル確認エラー: ${error.message}`);
    }
  };

  // Googleログイン処理
  const handleGoogleLogin = async () => {
    console.log('🔵 Google login initiated');
    setGoogleLoading(true);
    setError(null);
    setMessage(null);

    try {
      // 現在のURL取得
      const currentOrigin = window.location.origin;
      const redirectTo = `${currentOrigin}/`;
      
      console.log('📍 Redirect URL:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          scopes: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
        }
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        throw error;
      }

      console.log('🔵 Google OAuth initiated successfully:', data);
      // OAuth処理中はローディング状態を保持（リダイレクトまで）
      
    } catch (error: any) {
      console.error('❌ Google login error:', error);
      
      // エラーメッセージの詳細化
      let errorMessage = error.message;
      if (error.message.includes('OAuth')) {
        errorMessage = 'OAuth認証に失敗しました。設定を確認してください。';
      } else if (error.message.includes('CORS')) {
        errorMessage = 'ドメイン設定エラーです。Supabaseの設定を確認してください。';
      } else if (error.message.includes('redirect')) {
        errorMessage = 'リダイレクト設定に問題があります。';
      }
      
      setError(`Google認証エラー: ${errorMessage}`);
      setGoogleLoading(false);
    }
  };

  // 通常のサインアップ処理
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📧 Email signup initiated');
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const redirectUrl = `${window.location.origin}/onboarding`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName || `${firstName} ${lastName}`.trim(),
            first_name: firstName,
            last_name: lastName,
            phone_number: phoneNumber
          }
        }
      });

      if (error) throw error;

      console.log('📧 Signup result:', data);

      // Check if user was created but needs email confirmation
      if (data.user && !data.session) {
        setMessage("確認メールを送信しました。メールをチェックしてアカウントを確認してください。");
      } else if (data.session) {
        setMessage("アカウントが作成されました。オンボーディングページに移動します。");
        setTimeout(() => navigate("/onboarding"), 1500);
      }
    } catch (error: any) {
      console.error('❌ Signup error:', error);
      if (error.message.includes("User already registered")) {
        setError("このメールアドレスは既に登録されています。ログインタブをお試しください。");
      } else {
        setError(`サインアップエラー: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 通常のサインイン処理
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔑 Email signin initiated');
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      console.log('🔑 Signin successful:', data);
    } catch (error: any) {
      console.error('❌ Signin error:', error);
      if (error.message.includes("Invalid login credentials")) {
        setError("メールアドレスまたはパスワードが正しくありません。");
      } else if (error.message.includes("Email not confirmed")) {
        setError("メールアドレスが確認されていません。確認メールをチェックしてください。");
      } else {
        setError(`サインインエラー: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // パスワードリセット処理
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔄 Password reset initiated');
    setResetLoading(true);
    setError(null);
    setMessage(null);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setMessage("パスワードリセット用のメールを送信しました。メールをチェックしてください。");
      setResetEmail("");
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      setError(`パスワードリセットエラー: ${error.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  // 認証初期化前は何も表示しない
  if (!authInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4">認証状態を確認中...</p>
        </div>
      </div>
    );
  }

  // 既に認証されている場合はリダイレクト処理中
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4">ダッシュボードに移動中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/lovable-uploads/4d26a444-f601-4acc-8285-9d99146345e3.png" 
              alt="L!JUMP" 
              className="h-16" 
            />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Google認証ボタン */}
          <div className="space-y-4">
            <Button 
              onClick={handleGoogleLogin}
              className="w-full h-12 text-lg font-semibold"
              disabled={googleLoading}
            >
              {googleLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Google認証中...</span>
                </div>
              ) : (
                "Googleでログイン・アカウント作成"
              )}
            </Button>
          </div>

          {/* エラー・メッセージ表示 */}
          {error && (
            <Alert className="border-red-200 bg-red-50" variant="destructive">
              <AlertDescription className="text-red-800">
                <strong>エラー:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                <strong>成功:</strong> {message}
              </AlertDescription>
            </Alert>
          )}

          {/* デバッグ情報（開発環境のみ） */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-4 bg-gray-100 rounded text-xs">
              <strong>Debug Info:</strong>
              <div>Auth Initialized: {authInitialized ? '✅' : '❌'}</div>
              <div>User: {user ? '✅' : '❌'}</div>
              <div>Google Loading: {googleLoading ? '🔄' : '❌'}</div>
              <div>Current URL: {window.location.href}</div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
