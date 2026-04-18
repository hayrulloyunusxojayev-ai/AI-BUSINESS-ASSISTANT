import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <header className="container mx-auto px-6 h-20 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-2 font-semibold text-xl tracking-tight">
          <div className="size-8 bg-primary rounded-xl flex items-center justify-center">
            <div className="size-3 bg-background rounded-sm" />
          </div>
          Zentra AI
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors">
            Sign In
          </Link>
          <Link href="/sign-up" className="text-sm font-medium bg-primary text-primary-foreground px-5 py-2.5 rounded-full hover:bg-primary/90 transition-all hover-elevate">
            Get Started
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
            Meet your new top performer
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-balance">
            The AI sales assistant that <span className="text-primary">knows your business.</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
            Upload your product catalog and get a dedicated, intelligent concierge ready to answer customer questions and close sales, 24/7.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link href="/sign-up" className="w-full sm:w-auto text-base font-medium bg-primary text-primary-foreground px-8 py-4 rounded-full hover:bg-primary/90 transition-all hover-elevate">
              Start Building Free
            </Link>
          </div>
        </div>

        <div className="mt-24 md:mt-32 max-w-5xl w-full mx-auto relative">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 h-full" />
          <div className="rounded-2xl border border-border/50 bg-card p-2 md:p-4 shadow-2xl overflow-hidden">
            <div className="rounded-xl border border-border/50 bg-background overflow-hidden flex flex-col h-[500px]">
              <div className="h-14 border-b border-border/50 flex items-center px-6 gap-3 bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-red-400/80" />
                  <div className="size-3 rounded-full bg-amber-400/80" />
                  <div className="size-3 rounded-full bg-green-400/80" />
                </div>
                <div className="ml-4 text-xs font-medium text-muted-foreground px-3 py-1.5 bg-background rounded-md border border-border/50">
                  chat.zentra.ai/your-business
                </div>
              </div>
              <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm">
                    Do you have any mechanical keyboards suitable for an open office?
                  </div>
                </div>
                <div className="flex gap-4 max-w-[80%]">
                  <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                    <div className="size-2 bg-primary rounded-sm" />
                  </div>
                  <div className="bg-muted px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-foreground leading-relaxed">
                    Yes, I'd recommend the <span className="font-semibold">Keychron K8 Pro</span>. It uses Gateron Red switches which are tactile but silent, making it perfect for an open office environment without disturbing your coworkers. It's currently in stock for $99. Would you like to see the specifications?
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 py-12 text-center text-muted-foreground text-sm">
        <p>© {new Date().getFullYear()} Zentra AI. Built with Replit.</p>
      </footer>
    </div>
  );
}
