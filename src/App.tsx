import { useEffect, useState, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./components/AppSidebar";
import { AppHeader } from "./components/AppHeader";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
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
import TagsManager from "./pages/TagsManager";
import FriendsListPage from "./pages/FriendsListPage";
import StepDeliveryPage from "./pages/StepDeliveryPage";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import EmailVerify from "./pages/EmailVerify";
import ErrorPage from "./pages/ErrorPage";
import IndividualChatPage from "./pages/IndividualChatPage";
import ChatInboxPage from "./pages/ChatInboxPage";
import LiffAuth from "./pages/LiffAuth";
import LiffFormSecure from "./pages/LiffFormSecure";
import LineLoginPage from "./pages/LineLoginPage";
import LoginSuccess from "./pages/LoginSuccess";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import FormsBuilder from "./pages/FormsBuilder";
import PublicForm from "./pages/PublicForm";
import LiffForm from "./pages/LiffForm";
import FormResponses from "./pages/FormResponses";
import StripeSettings from "./pages/StripeSettings";
import PaymentManagement from "./pages/PaymentManagement";
import PlanManagement from "./pages/developer/PlanManagement";
import UserManagement from "./pages/developer/UserManagement";
import MaintenanceSettings from "./pages/developer/MaintenanceSettings";
import MasterMode from "./pages/developer/MasterMode";
import ProductManagement from "./pages/ProductManagement";
import ProductLandingPage from "./pages/ProductLandingPage";
import PlanSettings from "./pages/PlanSettings";
import RichMenuSettings from "./pages/RichMenuSettings";
import GreetingMessageSettings from "./pages/GreetingMessageSettings";
import MemberSitesList from "./pages/MemberSitesList";
import MemberSiteManagement from "./pages/MemberSiteManagement";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import CheckoutCancel from "./pages/CheckoutCancel";

const CMSFriendsPageBuilder = lazy(() => import('./pages/CMSFriendsPageBuilder'));
const CMSPublicPageBuilder = lazy(() => import('./pages/CMSPublicPageBuilder'));
const CMSFriendsPublicView = lazy(() => import('./pages/CMSFriendsPublicView'));
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
    return <LoadingSpinner message="アプリケーション初期化中..." size="lg" className="min-h-screen" />
  }

  const isAuthPage = window.location.pathname === '/auth' || 
                    window.location.pathname === '/verify' || 
                    window.location.pathname === '/reset-password'

  const isInvitePage = window.location.pathname.startsWith('/invite')
  const isLoginPage = window.location.pathname === '/login'
  const hasLineLoginSuccess = window.location.search.includes('line_login=success')
  const isPublicFormPage = window.location.pathname.startsWith('/form/') || window.location.pathname.startsWith('/liff-form/')
  const isCMSPublicPath = window.location.pathname.startsWith('/cms/f/')
  const isCMSPreviewPath = window.location.pathname.startsWith('/cms/preview/')
  const isProductLandingPage = window.location.pathname.startsWith('/product-landing/')
  const isCheckoutPage = window.location.pathname.startsWith('/checkout/')
  const isLiffPage = window.location.pathname.startsWith('/liff')

  // Show pages without sidebar/header: auth, public forms, liff, checkout, product landing, cms public
  if (isAuthPage || isPublicFormPage || isLiffPage || isProductLandingPage || isCheckoutPage || isCMSPublicPath || isCMSPreviewPath || (!user && !isInvitePage && !isLoginPage && !hasLineLoginSuccess)) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen">
          <Suspense fallback={<LoadingSpinner />}>
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
              <Route path="/form/:id" element={<PublicForm />} />
              <Route path="/liff-form/:id" element={<LiffForm />} />
              <Route path="/liff-form-secure/:id" element={<LiffFormSecure />} />
              <Route path="/product-landing/:productId" element={<ProductLandingPage />} />
              <Route path="/checkout/success" element={<CheckoutSuccess />} />
              <Route path="/checkout/cancel" element={<CheckoutCancel />} />
              <Route path="/cms/f/:shareCode" element={<CMSFriendsPublicView />} />
              <Route path="/cms/preview/:pageId" element={<CMSFriendsPublicView />} />
              <Route path="/error" element={<ErrorPage />} />
              <Route path="*" element={user ? <NotFound /> : <Auth />} />
            </Routes>
          </Suspense>
        </div>
      </ErrorBoundary>
    )
  }

  // LINEログイン成功時の処理
  if (hasLineLoginSuccess && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-green-600 mb-4">✅ LINEログイン成功</h2>
          <p className="text-gray-600 mb-4">ユーザー名: {decodeURIComponent(new URLSearchParams(window.location.search).get('user_name') || '')}</p>
          <Button 
            onClick={() => window.location.href = '/auth'}
            className="bg-blue-500 text-white"
          >
            メインページに戻る
          </Button>
        </div>
      </div>
    )
  }

  // Show main app with sidebar and header for authenticated users
  return (
    <ErrorBoundary>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          {user && <AppHeader user={user} />}
          {user && <AppSidebar user={user} />}
          <div className="flex-1 flex flex-col pt-14">
            <main className="flex-1 p-2">
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/rich-menu" element={<RichMenuSettings />} />
                  <Route path="/greeting-message" element={<GreetingMessageSettings />} />
                  <Route path="/member-sites" element={<MemberSitesList />} />
                  <Route path="/member-sites/management" element={<MemberSiteManagement />} />
                  <Route path="/" element={<Index />} />
                  <Route path="/line-api-settings" element={<LineApiSettings />} />
                  <Route path="/line-login-settings" element={<LineLoginSettings />} />
                  <Route path="/webhook-settings" element={<WebhookSettings />} />
                  <Route path="/profile-management" element={<ProfileManagement />} />
                  <Route path="/flex-message-designer" element={<FlexMessageDesigner />} />
                  <Route path="/media-library" element={<MediaLibrary />} />
                  <Route path="/friends-list" element={<FriendsListPage />} />
                  <Route path="/tags" element={<TagsManager />} />
                  <Route path="/payment/stripe-settings" element={<StripeSettings />} />
                  <Route path="/payment/products" element={<ProductManagement />} />
                  <Route path="/payment/orders" element={<PaymentManagement />} />
                  <Route path="/settings/plan" element={<PlanSettings />} />
                  <Route path="/developer/master-mode" element={<MasterMode />} />
                  <Route path="/developer/users" element={<UserManagement />} />
                  <Route path="/developer/user-management" element={<UserManagement />} />
                  <Route path="/developer/plan-management" element={<PlanManagement />} />
                  <Route path="/stripe-settings" element={<StripeSettings />} />
                  <Route path="/payment-management" element={<PaymentManagement />} />
                  <Route path="/developer/maintenance" element={<MaintenanceSettings />} />
                  <Route path="/step-delivery" element={<StepDeliveryPage />} />
                  <Route path="/chat-inbox" element={<ChatInboxPage />} />
                  <Route path="/chat/:friendId" element={<IndividualChatPage />} />
                  <Route path="/forms" element={<FormsBuilder />} />
                  <Route path="/forms/responses" element={<FormResponses />} />
                  <Route path="/cms/friends-page" element={<CMSFriendsPageBuilder />} />
                  <Route path="/cms/public-page" element={<CMSPublicPageBuilder />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ErrorBoundary>
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
