import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppSidebar } from "./components/AppSidebar";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import LineApiSettings from "./pages/LineApiSettings";
import WebhookSettings from "./pages/WebhookSettings";
import ProfileManagement from "./pages/ProfileManagement";
import FlexMessageDesigner from "./pages/FlexMessageDesigner";
import MediaLibrary from "./pages/MediaLibrary";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import EmailVerify from "./pages/EmailVerify";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <div className="flex-1 flex flex-col">
              <header className="h-12 flex items-center border-b px-4">
                <SidebarTrigger />
              </header>
              <main className="flex-1 p-4">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/verify" element={<EmailVerify />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/line-api-settings" element={<LineApiSettings />} />
                  <Route path="/webhook-settings" element={<WebhookSettings />} />
                  <Route path="/profile-management" element={<ProfileManagement />} />
                  <Route path="/flex-message-designer" element={<FlexMessageDesigner />} />
                  <Route path="/media-library" element={<MediaLibrary />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
