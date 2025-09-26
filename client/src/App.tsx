import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "./components/layout/sidebar";
import { TopBar } from "./components/layout/top-bar";
import Dashboard from "@/pages/dashboard";
import TokenLaunch from "@/pages/token-launch";
import BundleExecution from "@/pages/bundle-execution";
import Analytics from "@/pages/analytics";
import StealthFunding from "@/pages/stealth-funding";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/token-launch" component={TokenLaunch} />
      <Route path="/bundle-execution" component={BundleExecution} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/stealth-funding" component={StealthFunding} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <TopBar />
            <Router />
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
