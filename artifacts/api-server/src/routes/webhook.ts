import { Router } from "express";
import { analyzeCustomerMessage } from "../lib/ai";

const router = Router();

const GRAPH_API_URL = "https://graph.facebook.com/v21.0/me/messages";

async function sendInstagramMessage(recipientId: string, text: string): Promise<void> {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("PAGE_ACCESS_TOKEN is not configured");
  }

  const response = await fetch(`${GRAPH_API_URL}?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Graph API error ${response.status}: ${body}`);
  }
}

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    req.log.info("Instagram webhook verified");
    res.status(200).send(challenge);
  } else {
    req.log.warn({ mode, token }, "Instagram webhook verification failed");
    res.sendStatus(403);
  }
});

router.post("/webhook", (req, res) => {
  const body = req.body as InstagramWebhookPayload;

  if (body?.object !== "instagram") {
    res.sendStatus(404);
    return;
  }

  res.sendStatus(200);

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const senderId = event.sender?.id;
      const text = event.message?.text;

      if (!senderId || !text || event.message?.is_echo) {
        continue;
      }

      (async () => {
        try {
          req.log.info({ senderId }, "Instagram message received");
          const { reply } = await analyzeCustomerMessage(text);
          await sendInstagramMessage(senderId, reply);
          req.log.info({ senderId }, "Instagram reply sent");
        } catch (err) {
          req.log.error({ err: String(err), senderId }, "Failed to process Instagram message");
        }
      })();
    }
  }
});

type InstagramWebhookPayload = {
  object: string;
  entry?: Array<{
    id: string;
    time: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        is_echo?: boolean;
      };
    }>;
  }>;
};

export default router;
