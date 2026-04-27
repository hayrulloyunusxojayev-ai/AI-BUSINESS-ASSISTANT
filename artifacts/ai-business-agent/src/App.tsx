import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Analyze from "@/pages/analyze";
import { SignInPage, SignUpPage } from "@/pages/auth";
import AdminLayout from "@/pages/admin/layout";
import { AuthProvider, useAuth } from "@/lib/auth";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function HomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Redirect to="/app" />;
  return <Home />;
}

function PublicAuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Redirect to="/app" />;
  return <Component />;
}

function AppRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return null;
  if (!user) return <Redirect to={`/sign-in?next=${encodeURIComponent(location)}`} />;

  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function Routes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in" component={() => <PublicAuthRoute component={SignInPage} />} />
      <Route path="/sign-up" component={() => <PublicAuthRoute component={SignUpPage} />} />
      <Route path="/app" component={() => <AppRoute component={Analyze} />} />
      {/* Backwards compat: old /admin link still works */}
      <Route path="/admin" component={() => <Redirect to="/app" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider queryClient={queryClient}>
            <Routes />
          </AuthProvider>
        </QueryClientProvider>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
