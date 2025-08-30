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
  const navigate = useNavigate();

  useEffect(() => {
    // Check current auth state
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        navigate("/");
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          
          // 新規登録またはGoogle初回ログインの場合はオンボーディングへ
          if (event === 'SIGNED_IN') {
            // プロファイル情報を取得してオンボーディング状況を確認
            const { data: profile } = await supabase
              .from('profiles')
              .select('onboarding_completed, onboarding_step')
              .eq('user_id', session.user.id)
              .single();
              
            if (profile && !profile.onboarding_completed) {
              navigate("/onboarding");
            } else {
              navigate("/");
            }
          } else {
            navigate("/");
          }
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Check if user was created but needs email confirmation
      if (data.user && !data.session) {
        setMessage("確認メールを送信しました。メールをチェックしてアカウントを確認してください。");
      } else if (data.session) {
        setMessage("アカウントが作成されました。オンボーディングページに移動します。");
        setTimeout(() => navigate("/onboarding"), 1500);
      }
    } catch (error: any) {
      if (error.message.includes("User already registered")) {
        setError("このメールアドレスは既に登録されています。ログインタブをお試しください。");
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    setMessage(null);

    try {
      const redirectUrl = `${window.location.origin}/onboarding`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });

      if (error) throw error;
    } catch (error: any) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
    } catch (error: any) {
      if (error.message.includes("Invalid login credentials")) {
        setError("メールアドレスまたはパスワードが正しくありません。");
      } else if (error.message.includes("Email not confirmed")) {
        setError("メールアドレスが確認されていません。確認メールをチェックしてください。");
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setError(error.message);
    } finally {
      setResetLoading(false);
    }
  };

  // Redirect if already authenticated
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/lovable-uploads/4d26a444-f601-4acc-8285-9d99146345e3.png" alt="L!JUMP" className="h-16" />
          </div>
          <CardTitle className="text-2xl font-bold">FlexMaster</CardTitle>
          <CardDescription>
            LINE APIを活用したフレキシブルなチャットボット管理システム
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={handleGoogleLogin}
              className="w-full bg-[#06C755] hover:bg-[#05B84D] text-white border-0"
              disabled={googleLoading}
            >
              {googleLoading ? "認証中..." : "Googleでログイン・アカウント作成"}
            </Button>
          </div>

          {error && (
            <Alert className="mt-4" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert className="mt-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;