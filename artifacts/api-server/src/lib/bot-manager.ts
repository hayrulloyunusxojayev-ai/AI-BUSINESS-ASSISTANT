import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { getAllStoresWithToken, getStoreByBotToken } from "./store-db";
import { analyzeCustomerMessage } from "./ai";
import type { Product } from "./store-db";
import { logger } from "./logger";

// ── Phone number detection ───────────────────────────────────────────────────

const PHONE_RE =
  /(\+?998[\s\-]?)?(90|91|93|94|95|97|98|99|33|71|77)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|\+\d[\d\s\-()]{9,14}/;

const ORDER_CONFIRMATION =
  "✅ Rahmat! Buyurtmangiz qabul qilindi.\n" +
  "Tez orada menejerimiz siz bilan bog'lanadi!\n\n" +
  "Спасибо! Ваш заказ принят. Менеджер свяжется с вами в ближайшее время!";

const TECH_ERROR =
  "🙏 Hozircha tizimda texnik xatolik. Iltimos, birozdan so'ng qayta urinib ko'ring.\n\n" +
  "Произошла техническая ошибка. Попробуйте позже.";

// ── Active store bot registry ─────────────────────────────────────────────────

const activeBots = new Map<string, Telegraf>();

function tokenKey(token: string): string {
  return token.split(":")[0] ?? token;
}

// ── Build a single customer-only bot ─────────────────────────────────────────

function buildStoreBot(token: string, storeName: string): Telegraf {
  const bot = new Telegraf(token);

  bot.command("start", async (ctx) => {
    try {
      await ctx.reply(
        `👋 Salom! *${storeName}* do'koniga xush kelibsiz!\n\n` +
          "Mahsulotlarimiz haqida savol bering yoki buyurtma bering. 🛍",
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      console.error(`[BOT:${tokenKey(token)}] /start error:`, err);
    }
  });

  bot.on(message("text"), async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const chatId = String(ctx.from.id);
    const text = ctx.message.text.trim();
    if (!text) return;

    try {
      logger.info(
        { bot: tokenKey(token), chatId, text },
        "[CLIENT-BOT] customer message received",
      );

      // Phone number → instant order confirmation
      if (PHONE_RE.test(text)) {
        await ctx.reply(ORDER_CONFIRMATION);
        return;
      }

      await ctx.sendChatAction("typing");

      // Always fetch fresh products from DB so /update changes propagate instantly
      const store = await getStoreByBotToken(token);
      const products = (store?.products ?? []) as Product[];

      const startMs = Date.now();
      const { reply } = await analyzeCustomerMessage(text, products);
      logger.info(
        { bot: tokenKey(token), chatId, elapsedMs: Date.now() - startMs },
        "[CLIENT-BOT] AI reply generated",
      );

      await ctx.reply(reply, {
        reply_parameters: { message_id: ctx.message.message_id },
      });
    } catch (err) {
      console.error(`[BOT:${tokenKey(token)}] message error:`, err);
      logger.error(
        {
          bot: tokenKey(token),
          chatId,
          err: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        "[CLIENT-BOT] ERROR — message handler failed",
      );
      await ctx.reply(TECH_ERROR).catch(() => null);
    }
  });

  bot.catch((err) => {
    console.error(`[BOT:${tokenKey(token)}] Telegraf error:`, err);
    logger.error(
      { bot: tokenKey(token), err: String(err) },
      "[CLIENT-BOT] Telegraf-level error",
    );
  });

  return bot;
}

// ── Launch a single store bot ─────────────────────────────────────────────────

export function launchStoreBot(token: string, storeName: string): void {
  // Stop any existing instance for this token first
  const existing = activeBots.get(token);
  if (existing) {
    try {
      existing.stop();
    } catch {
      // ignore stop errors
    }
    activeBots.delete(token);
  }

  const bot = buildStoreBot(token, storeName);

  const attempt = (retry: number) => {
    bot
      .launch({ dropPendingUpdates: true })
      .then(() => {
        logger.info({ bot: tokenKey(token) }, "[CLIENT-BOT] stopped cleanly");
        activeBots.delete(token);
      })
      .catch(async (err: unknown) => {
        const s = String(err);
        const is409 = s.includes("409");
        if (is409 && retry < 4) {
          logger.warn(
            { bot: tokenKey(token), retry },
            "[CLIENT-BOT] 409 conflict — retrying in 15s",
          );
          await new Promise((r) => setTimeout(r, 15_000));
          attempt(retry + 1);
        } else {
          logger.error(
            { bot: tokenKey(token), err: s },
            "[CLIENT-BOT] polling stopped — no more retries",
          );
          activeBots.delete(token);
        }
      });
  };

  attempt(1);
  activeBots.set(token, bot);
  logger.info({ bot: tokenKey(token), storeName }, "[CLIENT-BOT] launched");
}

// ── Stop a store bot ──────────────────────────────────────────────────────────

export function stopStoreBot(token: string): void {
  const bot = activeBots.get(token);
  if (bot) {
    try {
      bot.stop();
    } catch {
      // ignore
    }
    activeBots.delete(token);
    logger.info({ bot: tokenKey(token) }, "[CLIENT-BOT] stopped manually");
  }
}

// ── On startup: launch all persisted store bots ───────────────────────────────

export async function startAllStoreBots(): Promise<void> {
  const stores = await getAllStoresWithToken();
  logger.info({ count: stores.length }, "[BOT-MANAGER] launching store bots");

  for (const store of stores) {
    if (!store.botToken) continue;
    try {
      launchStoreBot(store.botToken, store.storeName);
    } catch (err) {
      logger.error(
        { storeName: store.storeName, err: String(err) },
        "[BOT-MANAGER] failed to launch store bot",
      );
    }
  }
}
