import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMyBusiness } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Package, Settings as SettingsIcon, LogOut, ExternalLink, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: business, isLoading: businessLoading } = useGetMyBusiness();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    queryClient.clear();
    setLocation("/");
  };

  const NavContent = () => (
    <>
      <div className="flex h-16 items-center px-6 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 font-semibold tracking-tight text-lg">
          <div className="size-6 bg-primary rounded-lg flex items-center justify-center">
            <div className="size-2 bg-background rounded-sm" />
          </div>
          Zentra AI
        </div>
      </div>
      <div className="flex-1 overflow-auto py-6 px-4 space-y-1">
        <div className="mb-6 px-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Your Business
          </div>
          {businessLoading ? (
            <Skeleton className="h-6 w-32" />
          ) : business ? (
            <div className="font-medium text-sm truncate">{business.businessName}</div>
          ) : (
            <div className="text-sm text-muted-foreground italic">No business setup yet</div>
          )}
        </div>

        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Menu
        </div>
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="p-4 border-t border-border/40 shrink-0">
        {business && (
          <Button variant="outline" className="w-full mb-4 justify-start gap-2" asChild>
            <a href={`/chat/${business.shareLinkId}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              View Chat Page
            </a>
          </Button>
        )}
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="size-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            <div className="text-xs font-medium">{user?.name?.charAt(0).toUpperCase() || "U"}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.name || "User"}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="size-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-muted/20">
      <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border/40 sticky top-0 h-screen">
        <NavContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-16 border-b border-border/40 bg-card flex items-center justify-between px-4 sticky top-0 z-10">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="size-6 bg-primary rounded-lg flex items-center justify-center">
              <div className="size-2 bg-background rounded-sm" />
            </div>
            Zentra AI
          </div>
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 flex flex-col w-72">
              <NavContent />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
