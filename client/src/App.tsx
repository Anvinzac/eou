import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import Index from "./views/Index";
import Auth from "./views/Auth";
import CreateQuiz from "./views/CreateQuiz";
import Dashboard from "./views/Dashboard";
import TakeQuiz from "./views/TakeQuiz";
import QuizResult from "./views/QuizResult";
import CoupleResult from "./views/CoupleResult";
import AdminPanel from "./views/AdminPanel";
import CreateVersus from "./views/CreateVersus";
import NotFound from "./views/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <LanguageSwitcher />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/create" element={<CreateQuiz />} />
            <Route path="/create-versus" element={<CreateVersus />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/quiz/:quizId" element={<TakeQuiz />} />
            <Route path="/result/:attemptId" element={<QuizResult />} />
            <Route path="/couple/:sessionCode" element={<CoupleResult />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
