import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { analyzeCustomerMessage } from "./ai";
import { logger } from "./logger";

export function createTelegramBot(): Telegraf | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN is not set — Telegram bot will not start");
    return null;
  }

  const bot = new Telegraf(token);

  bot.on(message("text"), async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const userText = ctx.message.text.trim();
    if (!userText) return;

    const senderId = ctx.from.id;
    const username = ctx.from.username ?? String(senderId);
    const messageId = ctx.message.message_id;

    // ── Step 1: message received ─────────────────────────────────────────────
    logger.info(
      { senderId, username, messageId, text: userText },
      "[TG] Step 1 — message received",
    );

    try {
      // ── Step 2: typing indicator ───────────────────────────────────────────
      logger.info({ senderId }, "[TG] Step 2 — sending typing action");
      await ctx.sendChatAction("typing");

      // ── Step 3: call AI ────────────────────────────────────────────────────
      logger.info({ senderId }, "[TG] Step 3 — calling AI");
      const startMs = Date.now();
      const { reply } = await analyzeCustomerMessage(userText);
      const elapsedMs = Date.now() - startMs;

      logger.info(
        { senderId, elapsedMs, reply },
        "[TG] Step 4 — AI response received",
      );

      // ── Step 5: send reply ─────────────────────────────────────────────────
      logger.info({ senderId }, "[TG] Step 5 — sending reply to user");
      await ctx.reply(reply, {
        reply_parameters: { message_id: messageId },
      });

      logger.info({ senderId, elapsedMs }, "[TG] Step 6 — reply sent OK");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : undefined;
      logger.error(
        { senderId, err: errMessage, stack: errStack },
        "[TG] ERROR — failed to process message",
      );
      await ctx
        .reply(
          "Xabarni qayta ishlashda xato yuz berdi. Iltimos, qayta urinib ko'ring.",
        )
        .catch(() => null);
    }
  });

  bot.catch((err, ctx) => {
    const errMessage = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    logger.error(
      { err: errMessage, stack: errStack, updateType: ctx.updateType },
      "[TG] Unhandled Telegraf error",
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
            `[TG] 409 conflict — another polling session active. Retry ${retry}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s...`,
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          attempt(retry + 1);
        } else {
          logger.error(
            { err: errStr, retry },
            "[TG] Bot failed to start — will not retry",
          );
        }
      });
  };

  attempt(1);
  logger.info("[TG] Bot launch initiated (long polling, dropPendingUpdates=true)");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
