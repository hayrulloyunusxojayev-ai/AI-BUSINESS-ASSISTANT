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

    logger.info({ senderId, username }, "Telegram message received");

    try {
      await ctx.sendChatAction("typing");

      const { reply } = await analyzeCustomerMessage(userText);

      await ctx.reply(reply, {
        reply_parameters: { message_id: ctx.message.message_id },
      });

      logger.info({ senderId }, "Telegram reply sent");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : undefined;
      logger.error(
        { err: errMessage, stack: errStack, senderId },
        "Failed to process Telegram message",
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
      "Telegraf unhandled error",
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
        logger.info("Telegram bot stopped cleanly");
      })
      .catch(async (err: unknown) => {
        const errStr = String(err);
        const is409 = errStr.includes("409");

        if (is409 && retry < MAX_RETRIES) {
          logger.warn(
            { retry, nextRetryMs: RETRY_DELAY_MS },
            "Telegram 409 conflict — another polling session is active. Retrying...",
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          attempt(retry + 1);
        } else {
          logger.error(
            { err: errStr, retry },
            "Telegram bot failed to start — will not retry",
          );
        }
      });
  };

  attempt(1);
  logger.info("Telegram bot starting (long polling)...");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
