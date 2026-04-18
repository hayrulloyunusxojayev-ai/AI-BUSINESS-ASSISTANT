import { useEffect, useState } from "react";

export function useChatSession(shareLinkId: string) {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    if (!shareLinkId) return;
    
    const key = `chat_session_${shareLinkId}`;
    let storedSessionId = sessionStorage.getItem(key);
    
    if (!storedSessionId) {
      storedSessionId = crypto.randomUUID();
      sessionStorage.setItem(key, storedSessionId);
    }
    
    setSessionId(storedSessionId);
  }, [shareLinkId]);

  return sessionId;
}
