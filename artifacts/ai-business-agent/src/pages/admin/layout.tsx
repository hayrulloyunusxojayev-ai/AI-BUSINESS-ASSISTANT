import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await signOut();
    queryClient.clear();
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <header className="h-16 border-b border-border/40 bg-card sticky top-0 z-10">
        <div className="h-full max-w-5xl mx-auto px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="size-7 bg-primary rounded-lg flex items-center justify-center">
              <div className="size-2.5 bg-background rounded-sm" />
            </div>
            Woxom AI
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <div className="text-sm font-medium truncate max-w-[200px]">
                {user?.name || "Foydalanuvchi"}
              </div>
              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                {user?.email}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Chiqish</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
