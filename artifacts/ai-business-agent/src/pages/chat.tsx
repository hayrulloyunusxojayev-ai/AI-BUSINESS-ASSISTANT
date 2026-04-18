import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { 
  useGetChatBusiness, 
  getGetChatBusinessQueryKey,
  useGetChatHistory,
  getGetChatHistoryQueryKey
} from "@workspace/api-client-react";
import { useChatSession } from "@/hooks/use-chat-session";
import { useChat } from "@/hooks/use-chat";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Store, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Chat() {
  const { shareLinkId } = useParams();
  
  if (!shareLinkId) {
    return <ChatError message="Noto'g'ri chat havolasi." />;
  }

  return <ChatInterface shareLinkId={shareLinkId} />;
}

function ChatInterface({ shareLinkId }: { shareLinkId: string }) {
  const sessionId = useChatSession(shareLinkId);
  
  const { 
    data: business, 
    isLoading: businessLoading, 
    error: businessError 
  } = useGetChatBusiness(shareLinkId, { 
    query: { 
      enabled: !!shareLinkId, 
      queryKey: getGetChatBusinessQueryKey(shareLinkId) 
    } 
  });

  const { 
    data: history, 
    isLoading: historyLoading 
  } = useGetChatHistory(shareLinkId, { sessionId }, {
    query: {
      enabled: !!shareLinkId && !!sessionId,
      queryKey: getGetChatHistoryQueryKey(shareLinkId, { sessionId })
    }
  });

  const { messages, setMessages, sendMessage, isLoading: isChatLoading } = useChat(shareLinkId, sessionId);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (history && !historyLoaded) {
      setMessages(
        history.map((msg) => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        }))
      );
      setHistoryLoaded(true);
    }
  }, [history, historyLoaded, setMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isChatLoading) return;
    
    const message = inputValue;
    setInputValue("");
    sendMessage(message);
  };

  if (businessError) {
    return <ChatError message="Bu biznes mavjud emas yoki hozir mavjud emas." />;
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground max-w-4xl mx-auto w-full border-x border-border/40 shadow-sm relative">
      {/* Sarlavha */}
      <header className="h-16 shrink-0 border-b border-border/40 flex items-center px-6 bg-card z-10">
        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mr-4 shrink-0">
          <Store className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          {businessLoading ? (
            <>
              <Skeleton className="h-5 w-40 mb-1" />
              <Skeleton className="h-3 w-24" />
            </>
          ) : (
            <>
              <h1 className="font-semibold text-base truncate">{business?.businessName}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-green-500"></span>
                </span>
                AI Yordamchi Onlayn
              </p>
            </>
          )}
        </div>
      </header>

      {/* Xabarlar */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-muted/10 pb-32"
      >
        {/* Salomlashuv xabari */}
        {!historyLoading && messages.length === 0 && (
          <div className="flex justify-center my-8">
            <div className="bg-card border border-border/50 text-center p-6 rounded-2xl max-w-sm shadow-sm">
              <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                <Store className="size-6" />
              </div>
              <h3 className="font-medium mb-2">{business?.businessName}ga xush kelibsiz</h3>
              <p className="text-sm text-muted-foreground">
                Assalomu alaykum! Sizga qanday yordam bera olaman?
              </p>
            </div>
          </div>
        )}

        {(historyLoading && !historyLoaded) ? (
          <div className="space-y-6">
            <div className="flex gap-3 max-w-[80%]">
              <Skeleton className="size-8 rounded-full shrink-0" />
              <Skeleton className="h-20 w-[250px] rounded-2xl rounded-tl-sm" />
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              className={cn(
                "flex w-full",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex gap-3 max-w-[85%] sm:max-w-[75%]",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}>
                {msg.role === "assistant" && (
                  <div className="size-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                    <div className="size-2 bg-primary-foreground rounded-sm" />
                  </div>
                )}
                <div 
                  className={cn(
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-tr-sm shadow-sm" 
                      : "bg-card border border-border/50 text-card-foreground rounded-tl-sm shadow-sm"
                  )}
                >
                  {msg.role === "assistant" && !msg.content ? (
                    <div className="flex gap-1 items-center h-5 px-1">
                      <div className="size-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="size-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="size-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Xabar yozish */}
      <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border/40 p-4">
        <form 
          onSubmit={handleSubmit}
          className="flex items-end gap-2 max-w-3xl mx-auto relative"
        >
          <Input
            placeholder="Xabaringizni yozing..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isChatLoading || businessLoading}
            className="flex-1 rounded-2xl bg-card border-border/50 shadow-sm pr-12 py-6"
            autoComplete="off"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!inputValue.trim() || isChatLoading || businessLoading}
            className="absolute right-2 bottom-2 rounded-xl size-8 transition-transform active:scale-95"
          >
            <Send className="size-4" />
            <span className="sr-only">Yuborish</span>
          </Button>
        </form>
        <div className="text-center mt-3">
          <p className="text-[10px] text-muted-foreground">
            AI Yordamchi noto'g'ri ma'lumot berishi mumkin.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="size-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="size-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Chat Mavjud Emas</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
