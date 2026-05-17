import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { analyzeCustomerMessage } from "./ai";
import { logger } from "./logger";

// Detects phone numbers in common Uzbek/international formats
const PHONE_REGEX =
  /(\+?998[\s\-]?)?(90|91|93|94|95|97|98|99|33|71|77)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|\+\d{1,3}[\s\-]?\(?\d{2,4}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/;

const ORDER_CONFIRMATION =
  "Rahmat! Buyurtmangiz qabul qilindi. ✅\n" +
  "Tez orada menejerimiz siz bilan bog'lanadi!\n\n" +
  "Спасибо! Ваш заказ принят. Менеджер свяжется с вами в ближайшее время!";

const ERROR_REPLY =
  "Hozircha tizimda texnik sozlash ketmoqda, iltimos birozdan so'ng qayta urinib ko'ring. 🙏\n\n" +
  "Система временно на техническом обслуживании. Попробуйте снова чуть позже.";

async function handleMessage(ctx: {
  chat: { type: string };
  from: { id: number; username?: string };
  message: { message_id: number; text: string };
  sendChatAction: (action: string) => Promise<void>;
  reply: (
    text: string,
    opts?: { reply_parameters?: { message_id: number } },
  ) => Promise<void>;
}): Promise<void> {
  if (ctx.chat.type !== "private") return;

  const userText = ctx.message.text.trim();
  if (!userText) return;

  const senderId = ctx.from.id;
  const username = ctx.from.username ?? String(senderId);
  const messageId = ctx.message.message_id;

  logger.info(
    { senderId, username, messageId, text: userText },
    "[TG] Step 1 — message received",
  );

  // ── Phone number / order finalization ─────────────────────────────────────
  if (PHONE_REGEX.test(userText)) {
    logger.info(
      { senderId },
      "[TG] Phone number detected — sending order confirmation (no DB query)",
    );
    await ctx.reply(ORDER_CONFIRMATION, {
      reply_parameters: { message_id: messageId },
    });
    return;
  }

  // ── Normal AI flow ─────────────────────────────────────────────────────────
  logger.info({ senderId }, "[TG] Step 2 — sending typing action");
  await ctx.sendChatAction("typing");

  logger.info({ senderId }, "[TG] Step 3 — calling AI");
  const startMs = Date.now();
  const { reply } = await analyzeCustomerMessage(userText);
  const elapsedMs = Date.now() - startMs;

  logger.info(
    { senderId, elapsedMs, reply },
    "[TG] Step 4 — AI response received",
  );

  logger.info({ senderId }, "[TG] Step 5 — sending reply to user");
  await ctx.reply(reply, {
    reply_parameters: { message_id: messageId },
  });

  logger.info({ senderId, elapsedMs }, "[TG] Step 6 — reply sent OK ✓");
}

export function createTelegramBot(): Telegraf | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN is not set — Telegram bot will not start");
    return null;
  }

  const bot = new Telegraf(token);

  // Each message is fully isolated — an error for one user never affects others
  bot.on(message("text"), async (ctx) => {
    try {
      await handleMessage(ctx);
    } catch (err) {
      // Log full details but NEVER let this propagate or crash the server
      console.error("[TG] Unhandled error in message handler:", err);
      logger.error(
        {
          senderId: ctx.from?.id,
          err: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        "[TG] ERROR — message handler failed",
      );

      // Always attempt a graceful reply to the user
      try {
        await ctx.reply(ERROR_REPLY);
      } catch (replyErr) {
        console.error("[TG] Could not send error reply:", replyErr);
      }
    }
  });

  // Catch any Telegraf-level errors (network glitches, etc.)
  bot.catch((err, ctx) => {
    console.error("[TG] Telegraf unhandled error:", err);
    logger.error(
      {
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        updateType: ctx.updateType,
      },
      "[TG] Telegraf-level error (server stays alive)",
    );
  });

  return bot;
}

export function launchBot(bot: Telegraf): void {
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 15_000;

  const attempt = (retry: number) => {
    bot
      .launch({ dropPendingUpdates: true })
      .then(() => {
        logger.info("[TG] Bot stopped cleanly");
      })
      .catch(async (err: unknown) => {
        const errStr = String(err);
        const is409 = errStr.includes("409");

        if (is409 && retry < MAX_RETRIES) {
          logger.warn(
            { retry, nextRetryMs: RETRY_DELAY_MS },
            `[TG] 409 conflict — retry ${retry}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s`,
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          attempt(retry + 1);
        } else {
          logger.error(
            { err: errStr, retry },
            "[TG] Bot polling stopped — no more retries",
          );
        }
      });
  };

  attempt(1);
  logger.info(
    "[TG] Bot launch initiated (long polling, dropPendingUpdates=true)",
  );

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
