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
            title: "Business created",
            description: "Your Zentra AI agent is ready to be configured.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Could not create business. Please try again.",
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
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Zentra AI</h1>
          <p className="text-muted-foreground text-balance">
            Let's start by giving your business a name. This will be visible to your customers in the chat interface.
          </p>
        </div>

        <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                placeholder="e.g. Acme Corp"
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
              {createBusiness.isPending ? "Creating..." : "Create Business"}
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
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Failed to copy", variant: "destructive" });
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
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-2">
          Here's what's happening with your AI agent today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="size-4" />
              Products Configured
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{summary?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active in your catalog
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="size-4" />
              Total Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{summary?.totalChats || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all time
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest conversations with your agent</CardDescription>
          </CardHeader>
          <CardContent>
            {!summary?.recentChats || summary.recentChats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                No conversations yet. Share your link to get started!
              </div>
            ) : (
              <div className="space-y-4">
                {summary.recentChats.map((chat) => (
                  <div key={chat.sessionId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border/40 bg-muted/20 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">Session {chat.sessionId.substring(0, 8)}...</span>
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
                      {chat.messageCount} msgs
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Share Link</CardTitle>
            <CardDescription>Send this to your customers</CardDescription>
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
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4 mr-2" />
                  Open in new tab
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
