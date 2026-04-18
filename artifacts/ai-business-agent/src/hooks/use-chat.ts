import { useState, useCallback, useRef } from "react";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export function useChat(shareLinkId: string, sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const newUserMessage: Message = { role: "user", content };
      const currentMessages = [...messages, newUserMessage];
      setMessages(currentMessages);
      setIsLoading(true);

      const assistantMessageIndex = currentMessages.length;
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`/api/chat/${shareLinkId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: content,
            sessionId,
            history: messages, // Send history without the new message
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.replace("data: ", "").trim();
                if (!dataStr) continue;

                try {
                  const data = JSON.parse(dataStr);
                  if (data.content) {
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      if (newMessages[assistantMessageIndex]) {
                        newMessages[assistantMessageIndex].content += data.content;
                      }
                      return newMessages;
                    });
                  }
                  if (data.done) {
                    // Chat stream finished
                  }
                } catch (e) {
                  console.error("Error parsing SSE data", e);
                }
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Chat error:", error);
          setMessages((prev) => {
            const newMessages = [...prev];
            if (newMessages[assistantMessageIndex]) {
              newMessages[assistantMessageIndex].content = "Sorry, I encountered an error responding to your message.";
            }
            return newMessages;
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, shareLinkId, sessionId]
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    setMessages,
    sendMessage,
    isLoading,
    stopStreaming,
  };
}
