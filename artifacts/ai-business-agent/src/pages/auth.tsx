import { FormEvent, useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

function BrandHeader() {
  return (
    <div className="flex items-center justify-center gap-2 font-semibold text-xl tracking-tight">
      <div className="size-8 bg-primary rounded-xl flex items-center justify-center">
        <div className="size-3 bg-background rounded-sm" />
      </div>
      Woxom AI
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GoogleLoginButton({ label }: { label: string }) {
  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full flex items-center justify-center gap-3 h-12 text-sm font-medium border-border/60 hover:bg-muted/50"
      onClick={handleGoogleLogin}
    >
      <GoogleIcon />
      {label}
    </Button>
  );
}

function Divider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border/50" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">yoki</span>
      </div>
    </div>
  );
}

export function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { signIn } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const error = params.get("error");
    if (error === "google_failed") {
      toast({
        title: "Google orqali kirish muvaffaqiyatsiz",
        description: "Iltimos, qayta urinib ko'ring yoki email bilan kiring.",
        variant: "destructive",
      });
    } else if (error === "google_not_configured") {
      toast({
        title: "Google login sozlanmagan",
        description: "Administrator GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET ni sozlashi kerak.",
        variant: "destructive",
      });
    }
  }, [search, toast]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      setLocation("/admin");
    } catch (error) {
      toast({
        title: "Kira olmadingiz",
        description: error instanceof Error ? error.message : "Email va parolni tekshiring.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <BrandHeader />
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle>Qaytib keldingiz</CardTitle>
            <CardDescription>AI savdo agentingizni boshqarish uchun kiring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GoogleLoginButton label="Google bilan kirish" />

            {!showEmailForm ? (
              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
                onClick={() => setShowEmailForm(true)}
              >
                Email bilan kirish
              </button>
            ) : (
              <>
                <Divider />
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Elektron pochta</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Parol</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Kirilmoqda..." : "Kirish"}
                  </Button>
                </form>
              </>
            )}

            <p className="text-sm text-muted-foreground text-center mt-2">
              Woxom AI da yangi foydalanuvchimisiz?{" "}
              <Link href="/sign-up" className="text-primary font-medium hover:underline">
                Hisob yarating
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [, setLocation] = useLocation();
  const { signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await signUp(name, email, password);
      setLocation("/admin");
    } catch (error) {
      toast({
        title: "Hisob yaratib bo'lmadi",
        description: error instanceof Error ? error.message : "Iltimos, qayta urinib ko'ring.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <BrandHeader />
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle>Hisobingizni yarating</CardTitle>
            <CardDescription>Biznesingiz uchun AI savdo agentini 1 daqiqada sozlang.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GoogleLoginButton label="Google bilan ro'yxatdan o'tish" />

            {!showEmailForm ? (
              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
                onClick={() => setShowEmailForm(true)}
              >
                Email bilan ro'yxatdan o'tish
              </button>
            ) : (
              <>
                <Divider />
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Ism</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      autoComplete="name"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Elektron pochta</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Parol</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Hisob yaratilmoqda..." : "Hisob yaratish"}
                  </Button>
                </form>
              </>
            )}

            <p className="text-sm text-muted-foreground text-center mt-2">
              Hisobingiz bormi?{" "}
              <Link href="/sign-in" className="text-primary font-medium hover:underline">
                Kiring
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
