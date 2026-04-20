import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyBusiness,
  getGetMyBusinessQueryKey,
  useGetDashboardSummary,
  useCreateBusiness,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Package,
  Clock,
  ExternalLink,
  Copy,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: business, isLoading: businessLoading } = useGetMyBusiness();

  if (businessLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!business) {
    return <SetupBusiness />;
  }

  return <DashboardContent />;
}

function SetupBusiness() {
  const [businessName, setBusinessName] = useState("");
  const createBusiness = useCreateBusiness();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = () => {
    if (!businessName.trim()) return;
    createBusiness.mutate(
      { data: { businessName } },
      {
        onSuccess: (newBusiness) => {
          queryClient.setQueryData(getGetMyBusinessQueryKey(), newBusiness);
          toast({
            title: "Biznes yaratildi",
            description: "Woxom AI agentingiz sozlanishga tayyor.",
          });
        },
        onError: () => {
          toast({
            title: "Xato",
            description: "Biznes yaratib bo'lmadi. Iltimos, qayta urinib ko'ring.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[calc(100vh-4rem)]">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <div className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="size-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Woxom AI ga xush kelibsiz</h1>
          <p className="text-muted-foreground text-balance">
            Biznesingizga nom berishdan boshlaylik. Bu chat interfeysida mijozlaringizga ko'rinadi.
          </p>
        </div>

        <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="businessName">Biznes nomi</Label>
              <Input
                id="businessName"
                placeholder="masalan: Acme Corp"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={!businessName.trim() || createBusiness.isPending}
            >
              {createBusiness.isPending ? "Yaratilmoqda..." : "Biznes yaratish"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardContent() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const shareUrl = summary?.shareLinkId
    ? `${window.location.origin}/chat/${summary.shareLinkId}`
    : "";

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Buferga nusxalandi" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Nusxalab bo'lmadi", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Umumiy ko'rinish</h1>
        <p className="text-muted-foreground mt-2">
          AI agentingiz bilan bugun nima bo'lyapti.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="size-4" />
              Sozlangan mahsulotlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{summary?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Katalogingizda faol
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="size-4" />
              Jami suhbatlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{summary?.totalChats || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Barcha vaqt davomida
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>So'nggi faollik</CardTitle>
            <CardDescription>Agentingiz bilan so'nggi suhbatlar</CardDescription>
          </CardHeader>
          <CardContent>
            {!summary?.recentChats || summary.recentChats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                Hali suhbatlar yo'q. Boshlash uchun havolangizni ulashing!
              </div>
            ) : (
              <div className="space-y-4">
                {summary.recentChats.map((chat) => (
                  <div key={chat.sessionId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border/40 bg-muted/20 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">Sessiya {chat.sessionId.substring(0, 8)}...</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        "{chat.lastMessage}"
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2 text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                      <MessageSquare className="size-3" />
                      {chat.messageCount} xabar
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Havola ulashish</CardTitle>
            <CardDescription>Mijozlaringizga yuboring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-background border rounded-lg text-sm break-all font-mono">
              {shareUrl}
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={handleCopy} className="w-full justify-start" variant="secondary">
                {copied ? (
                  <CheckCircle2 className="size-4 mr-2 text-green-500" />
                ) : (
                  <Copy className="size-4 mr-2" />
                )}
                {copied ? "Nusxalandi!" : "Havolani nusxalash"}
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4 mr-2" />
                  Yangi oynada ochish
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
