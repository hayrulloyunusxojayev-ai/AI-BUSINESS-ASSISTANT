import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Chat from "@/pages/chat";
import { SignInPage, SignUpPage } from "@/pages/auth";
import AdminLayout from "@/pages/admin/layout";
import Dashboard from "@/pages/admin/dashboard";
import Products from "@/pages/admin/products";
import Settings from "@/pages/admin/settings";
import { AuthProvider, useAuth } from "@/lib/auth";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function HomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Redirect to="/admin" />;
  return <Home />;
}

function PublicAuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Redirect to="/admin" />;
  return <Component />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
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
      <Route path="/chat/:shareLinkId" component={Chat} />
      <Route path="/admin" component={() => <AdminRoute component={Dashboard} />} />
      <Route path="/admin/products" component={() => <AdminRoute component={Products} />} />
      <Route path="/admin/settings" component={() => <AdminRoute component={Settings} />} />
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
