import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Copy, CheckCircle2, MessageCircle, Target, Loader2 } from "lucide-react";

type AnalyzeResult = {
  reply: string;
  guidance: string;
};

export default function Analyze() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setResult(null);
    setCopied(false);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok) {
        let errorMessage = "Tahlil qilib bo'lmadi";
        try {
          const data = await response.json();
          errorMessage = data?.error || errorMessage;
        } catch {
          // ignore
        }
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as AnalyzeResult;
      setResult(data);
    } catch (error) {
      toast({
        title: "Xato",
        description: error instanceof Error ? error.message : "Qayta urinib ko'ring.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyReply = async () => {
    if (!result?.reply) return;
    try {
      await navigator.clipboard.writeText(result.reply);
      setCopied(true);
      toast({ title: "Javob nusxalandi" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Nusxalab bo'lmadi", variant: "destructive" });
    }
  };

  const handleClear = () => {
    setMessage("");
    setResult(null);
    setCopied(false);
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
          <Sparkles className="size-6" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Mijoz xabarini savdoga aylantiring
        </h1>
        <p className="text-muted-foreground text-balance max-w-xl mx-auto">
          Mijozdan kelgan xabarni quyiga joylashtiring. AI yordamchi sizga mijozga yuborish uchun javob va keyingi qadam beradi.
        </p>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-5 md:p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="customer-message" className="text-sm font-medium">
              Mijoz xabari
            </label>
            <Textarea
              id="customer-message"
              placeholder="Masalan: Salom, sizdagi qora rangli krossovkangiz 42 o'lchamda bormi? Narxi qancha?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[140px] resize-none text-base"
              disabled={isLoading}
              maxLength={4000}
            />
            <div className="text-xs text-muted-foreground text-right">
              {message.length}/4000
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            {(message || result) && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                disabled={isLoading}
              >
                Tozalash
              </Button>
            )}
            <Button
              type="button"
              onClick={handleAnalyze}
              disabled={!message.trim() || isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Tahlil qilinmoqda...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Tahlil qilish
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <Card className="border-primary/30 bg-primary/5 shadow-sm">
            <CardContent className="p-5 md:p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-primary">
                  <MessageCircle className="size-5" />
                  <h2 className="font-semibold">Mijozga javob</h2>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyReply}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="size-4 text-green-500" />
                      Nusxalandi
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Nusxalash
                    </>
                  )}
                </Button>
              </div>
              <p className="text-base leading-relaxed whitespace-pre-wrap">
                {result.reply}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-5 md:p-6 space-y-3">
              <div className="flex items-center gap-2 text-foreground">
                <Target className="size-5 text-amber-500" />
                <h2 className="font-semibold">Sizning keyingi qadamingiz</h2>
              </div>
              <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {result.guidance}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
