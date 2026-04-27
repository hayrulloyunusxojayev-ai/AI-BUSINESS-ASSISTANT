import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <header className="container mx-auto px-6 h-20 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-2 font-semibold text-xl tracking-tight">
          <div className="size-8 bg-primary rounded-xl flex items-center justify-center">
            <div className="size-3 bg-background rounded-sm" />
          </div>
          Woxom AI
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors">
            Kirish
          </Link>
          <Link href="/sign-up" className="text-sm font-medium bg-primary text-primary-foreground px-5 py-2.5 rounded-full hover:bg-primary/90 transition-all hover-elevate">
            Boshlash
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 md:py-32">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-primary"></span>
            </span>
            Mijoz xabarini savdoga aylantiring
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-balance">
            Mijoz xabarlarini <span className="text-primary">savdoga aylantiruvchi AI yordamchi.</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
            Mijoz xabarini joylashtiring — AI yordamchi mijozga yuborish uchun tayyor javobni va xaridni yopish uchun keyingi qadamni darhol beradi.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link href="/sign-up" className="w-full sm:w-auto text-base font-medium bg-primary text-primary-foreground px-8 py-4 rounded-full hover:bg-primary/90 transition-all hover-elevate">
              Bepul boshlash
            </Link>
          </div>
        </div>

        <div className="mt-24 md:mt-32 max-w-4xl w-full mx-auto">
          <div className="rounded-2xl border border-border/50 bg-card p-6 md:p-8 shadow-2xl text-left space-y-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Mijoz xabari</div>
              <div className="bg-muted/50 border border-border/40 px-4 py-3 rounded-xl text-sm">
                "Salom, sizdagi qora rangli krossovkangiz 42 o'lchamda bormi? Narxi qancha?"
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-primary">Mijozga javob</div>
                <p className="text-sm leading-relaxed">
                  "Ha, qora 42-o'lcham omborda mavjud, narxi 590 000 so'm. Hoziroq band qilib qo'yaymi?"
                </p>
              </div>
              <div className="bg-card border border-border/50 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sizning keyingi qadamingiz</div>
                <p className="text-sm leading-relaxed">
                  Mijoz aniq qiziqmoqda — yetkazib berish manzilini so'rab, hoziroq xaridni yoping.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 py-12 text-center text-muted-foreground text-sm">
        <p>© {new Date().getFullYear()} Woxom AI. Replit bilan yaratilgan.</p>
      </footer>
    </div>
  );
}
