import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import NewBet from "./pages/NewBet";
import ImportBet from "./pages/ImportBet";
import PendingBets from "./pages/PendingBets";
import Results from "./pages/Results";
import Bankroll from "./pages/Bankroll";
import Templates from "./pages/Templates";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Protected = ({ children, requireRole }: any) => (
  <ProtectedRoute requireRole={requireRole}><AppLayout>{children}</AppLayout></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/bets/new" element={<Protected requireRole={['admin','editor']}><NewBet /></Protected>} />
            <Route path="/bets/import" element={<Protected requireRole={['admin','editor']}><ImportBet /></Protected>} />
            <Route path="/bets/pending" element={<Protected><PendingBets /></Protected>} />
            <Route path="/bets/results" element={<Protected><Results /></Protected>} />
            <Route path="/bankroll" element={<Protected><Bankroll /></Protected>} />
            <Route path="/templates" element={<Protected><Templates /></Protected>} />
            <Route path="/settings" element={<Protected requireRole="admin"><SettingsPage /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
