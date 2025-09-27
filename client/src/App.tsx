import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "./components/layout/sidebar";
import { TopBar } from "./components/layout/top-bar";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import TokenLaunch from "@/pages/token-launch";
import BundleExecution from "@/pages/bundle-execution";
import Analytics from "@/pages/analytics";
import StealthFunding from "@/pages/stealth-funding";
import AdminPanel from "@/pages/admin/admin-panel";
import NotFound from "@/pages/not-found";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        {children}
      </div>
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  
  // Public routes (no authentication required)
  if (location === "/") {
    return <Route path="/" component={Login} />;
  }
  
  // Admin route (requires admin authentication)
  if (location.startsWith("/admin")) {
    return (
      <Switch>
        <Route path="/admin" component={AdminPanel} />
        <Route component={NotFound} />
      </Switch>
    );
  }
  
  // Protected routes (require authentication)
  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/token-launch" component={TokenLaunch} />
        <Route path="/bundle-execution" component={BundleExecution} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/stealth-funding" component={StealthFunding} />
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
