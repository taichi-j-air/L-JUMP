import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppSidebar } from "./components/AppSidebar";
import { AppHeader } from "./components/AppHeader";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import InvitePage from "./pages/InvitePage";
import LiffHandler from "./pages/LiffHandler";
import LineApiSettings from "./pages/LineApiSettings";
import LineLoginSettings from "./pages/LineLoginSettings";
import WebhookSettings from "./pages/WebhookSettings";
import ProfileManagement from "./pages/ProfileManagement";
import FlexMessageDesigner from "./pages/FlexMessageDesigner";
import MediaLibrary from "./pages/MediaLibrary";
import FriendsListPage from "./pages/FriendsListPage";
import StepDeliveryPage from "./pages/StepDeliveryPage";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import EmailVerify from "./pages/EmailVerify";
import ErrorPage from "./pages/ErrorPage";
import IndividualChatPage from "./pages/IndividualChatPage";
import ChatInboxPage from "./pages/ChatInboxPage";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const queryClient = new QueryClient();

function AppContent() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">読み込み中...</div>
  }

  const isAuthPage = window.location.pathname === '/auth' || 
                    window.location.pathname === '/verify' || 
                    window.location.pathname === '/reset-password'

  const isInvitePage = window.location.pathname.startsWith('/invite/')
  const hasLineLoginSuccess = window.location.search.includes('line_login=success')

  // Show auth pages without sidebar/header  
  if (isAuthPage || (!user && !isInvitePage && !hasLineLoginSuccess)) {
    return (
      <div className="min-h-screen">
        <Routes>
          <Route path="/liff-handler" element={<LiffHandler />} />
          <Route path="/invite/:inviteCode" element={<InvitePage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/verify" element={<EmailVerify />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/error" element={<ErrorPage />} />
          <Route path="*" element={<Auth />} />
        </Routes>
      </div>
    )
  }

  // LINEログイン成功時の処理
  if (hasLineLoginSuccess && !user) {
    const params = new URLSearchParams(window.location.search);
    const userName = decodeURIComponent(params.get('user_name') || 'LINEユーザー');
    const scenarioRegistered = params.get('scenario_registered') === 'true';
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">友達追加完了！</h2>
            <p className="text-gray-600 mb-4">
              {userName}さん、LINEでのログインが完了しました。
            </p>
            {scenarioRegistered && (
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-700">
                  🎉 シナリオへの登録も完了しました！<br/>
                  LINEでメッセージが届くのをお待ちください。
                </p>
              </div>
            )}
          </div>
          <button 
            onClick={() => window.close()}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium w-full transition-colors"
          >
            このページを閉じる
          </button>
        </div>
      </div>
    )
  }

  // Show main app with sidebar and header for authenticated users
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {user && <AppHeader user={user} />}
        {user && <AppSidebar user={user} />}
        <div className="flex-1 flex flex-col pt-14">
          <main className="flex-1 p-2">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/liff-handler" element={<LiffHandler />} />
              <Route path="/invite/:inviteCode" element={<InvitePage />} />
              <Route path="/line-api-settings" element={<LineApiSettings />} />
              <Route path="/line-login-settings" element={<LineLoginSettings />} />
              <Route path="/webhook-settings" element={<WebhookSettings />} />
              <Route path="/profile-management" element={<ProfileManagement />} />
              <Route path="/flex-message-designer" element={<FlexMessageDesigner />} />
              <Route path="/media-library" element={<MediaLibrary />} />
              <Route path="/friends-list" element={<FriendsListPage />} />
              <Route path="/step-delivery" element={<StepDeliveryPage />} />
              <Route path="/chat-inbox" element={<ChatInboxPage />} />
              <Route path="/chat/:friendId" element={<IndividualChatPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
