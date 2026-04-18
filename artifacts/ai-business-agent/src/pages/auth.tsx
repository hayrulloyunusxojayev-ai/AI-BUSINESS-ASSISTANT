import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
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
      Zentra AI
    </div>
  );
}

export function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();
  const { signIn } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      setLocation("/admin");
    } catch (error) {
      toast({ title: "Kira olmadingiz", description: error instanceof Error ? error.message : "Email va parolni tekshiring.", variant: "destructive" });
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
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Elektron pochta</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Parol</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Kirilmoqda..." : "Kirish"}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground text-center mt-6">
              Zentra AI da yangi foydalanuvchimisiz? <Link href="/sign-up" className="text-primary font-medium hover:underline">Hisob yarating</Link>
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
      toast({ title: "Hisob yaratib bo'lmadi", description: error instanceof Error ? error.message : "Iltimos, qayta urinib ko'ring.", variant: "destructive" });
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
            <CardDescription>Biznesingiz uchun mahsulotlarni biladigan savdo agentini yarating.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Ism</Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Elektron pochta</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Parol</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Hisob yaratilmoqda..." : "Hisob yaratish"}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground text-center mt-6">
              Hisobingiz bormi? <Link href="/sign-in" className="text-primary font-medium hover:underline">Kiring</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
