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
import ScenarioDeliveryDashboard from "./pages/ScenarioDeliveryDashboard";
import LiffInvitePage from "./pages/LiffInvitePage";
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
import LiffAuth from "./pages/LiffAuth";
import LineLoginPage from "./pages/LineLoginPage";
import LoginSuccess from "./pages/LoginSuccess";
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

  const isInvitePage = window.location.pathname.startsWith('/invite')
  const hasLineLoginSuccess = window.location.search.includes('line_login=success')

  // Show auth pages without sidebar/header  
  if (isAuthPage || (!user && !isInvitePage && !hasLineLoginSuccess)) {
    return (
      <div className="min-h-screen">
        <Routes>
          <Route path="/liff" element={<LiffAuth />} />
          <Route path="/liff-handler" element={<LiffHandler />} />
          <Route path="/liff-invite" element={<LiffInvitePage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/invite/:inviteCode" element={<InvitePage />} />
          <Route path="/login" element={<LineLoginPage />} />
          <Route path="/login-success" element={<LoginSuccess />} />
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-green-600 mb-4">✅ LINEログイン成功</h2>
          <p className="text-gray-600 mb-4">ユーザー名: {decodeURIComponent(new URLSearchParams(window.location.search).get('user_name') || '')}</p>
          <button 
            onClick={() => window.location.href = '/auth'}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            メインページに戻る
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
              <Route path="/liff" element={<LiffAuth />} />
              <Route path="/liff-handler" element={<LiffHandler />} />
              <Route path="/liff-invite" element={<LiffInvitePage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path="/invite/:inviteCode" element={<InvitePage />} />
              <Route path="/login" element={<LineLoginPage />} />
              <Route path="/login-success" element={<LoginSuccess />} />
              <Route path="/line-api-settings" element={<LineApiSettings />} />
              <Route path="/line-login-settings" element={<LineLoginSettings />} />
              <Route path="/webhook-settings" element={<WebhookSettings />} />
              <Route path="/profile-management" element={<ProfileManagement />} />
              <Route path="/flex-message-designer" element={<FlexMessageDesigner />} />
              <Route path="/media-library" element={<MediaLibrary />} />
              <Route path="/friends-list" element={<FriendsListPage />} />
              <Route path="/step-delivery" element={<StepDeliveryPage />} />
              <Route path="/delivery-dashboard" element={<ScenarioDeliveryDashboard />} />
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
