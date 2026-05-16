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
      await ctx.reply(reply, { reply_parameters: { message_id: ctx.message.message_id } });
      logger.info({ senderId }, "Telegram reply sent");
    } catch (err) {
      logger.error({ err: String(err), senderId }, "Failed to process Telegram message");
      await ctx.reply("Xabarni qayta ishlashda xato yuz berdi. Iltimos, qayta urinib ko'ring.").catch(() => null);
    }
  });

  bot.catch((err, ctx) => {
    logger.error({ err: String(err), updateType: ctx.updateType }, "Telegraf unhandled error");
  });

  return bot;
}

export async function launchBot(bot: Telegraf): Promise<void> {
  await bot.launch({ dropPendingUpdates: true });
  logger.info("Telegram bot started (long polling)");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
