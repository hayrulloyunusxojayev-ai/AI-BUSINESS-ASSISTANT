import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { analyzeCustomerMessage, parseProductsFromText } from "./ai";
import {
  getStoreByOwnerChatId,
  upsertStore,
  updateStoreProducts,
  getLatestActiveStore,
  type Product,
} from "./store-db";
import { logger } from "./logger";

// ── Conversation state machine (in-memory, ephemeral) ────────────────────────

type Stage =
  | "IDLE"
  | "AWAITING_STORE_NAME"
  | "AWAITING_PRODUCTS"
  | "AWAITING_CONFIRMATION";

type ConvState = {
  stage: Stage;
  pendingStoreName?: string;
  pendingProducts?: Product[];
};

const sessions = new Map<string, ConvState>();

function getState(chatId: string): ConvState {
  return sessions.get(chatId) ?? { stage: "IDLE" };
}
function setState(chatId: string, state: ConvState): void {
  sessions.set(chatId, state);
}
function clearState(chatId: string): void {
  sessions.set(chatId, { stage: "IDLE" });
}

// ── Phone number detection ───────────────────────────────────────────────────

const PHONE_RE =
  /(\+?998[\s\-]?)?(90|91|93|94|95|97|98|99|33|71|77)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|\+\d[\d\s\-()]{9,14}/;

const ORDER_CONFIRMATION =
  "✅ Rahmat! Buyurtmangiz qabul qilindi.\n" +
  "Tez orada menejerimiz siz bilan bog'lanadi!\n\n" +
  "Спасибо! Ваш заказ принят. Менеджер свяжется с вами в ближайшее время!";

const TECH_ERROR =
  "🙏 Hozircha tizimda texnik sozlash ketmoqda, iltimos birozdan so'ng qayta urinib ko'ring.\n\n" +
  "Система временно недоступна. Попробуйте позже.";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatProductList(products: Product[]): string {
  if (products.length === 0) return "_(mahsulotlar topilmadi)_";
  return products
    .map((p, i) => {
      let line = `${i + 1}. *${p.name}* — ${p.price}`;
      if (p.size) line += `\n   📐 O'lcham: ${p.size}`;
      if (p.description) line += `\n   📝 ${p.description}`;
      return line;
    })
    .join("\n\n");
}

// ── Core message handler ─────────────────────────────────────────────────────

async function handleText(
  chatId: string,
  username: string,
  text: string,
  reply: (msg: string, opts?: object) => Promise<unknown>,
  sendTyping: () => Promise<unknown>,
): Promise<void> {
  const state = getState(chatId);
  logger.info({ chatId, username, stage: state.stage, text }, "[TG] message in");

  // ── AWAITING_STORE_NAME ──────────────────────────────────────────────────
  if (state.stage === "AWAITING_STORE_NAME") {
    const storeName = text.trim();
    if (storeName.length < 2) {
      await reply("Do'kon nomi juda qisqa. Iltimos, to'liq nomini kiriting:");
      return;
    }
    setState(chatId, { stage: "AWAITING_PRODUCTS", pendingStoreName: storeName });
    await reply(
      `✅ Ajoyib! *${storeName}* — zo'r nom!\n\n` +
        "Endi Telegram kanal yoki guruhingizdan mahsulotlar, narxlar va o'lchamlar haqidagi matnni nusxalab, shu yerga yuboring:\n\n" +
        "_(Masalan: Kanal postlarini, narx listini yoki mahsulot tavsiflarini)_",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // ── AWAITING_PRODUCTS ────────────────────────────────────────────────────
  if (state.stage === "AWAITING_PRODUCTS") {
    if (text.trim().length < 10) {
      await reply("Matn juda qisqa. Iltimos, mahsulotlar haqida to'liq ma'lumot yuboring:");
      return;
    }
    await sendTyping();
    await reply("⏳ AI mahsulotlarni tahlil qilmoqda...");

    const products = await parseProductsFromText(text);

    if (products.length === 0) {
      await reply(
        "❌ Matndan hech qanday mahsulot topilmadi.\n\n" +
          "Mahsulot nomi va narxlari aniq ko'rsatilgan matnni yuboring.\n" +
          "Masalan:\n`Nike Air Max — 450 000 so'm, o'lcham: 40-45`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    setState(chatId, {
      stage: "AWAITING_CONFIRMATION",
      pendingStoreName: state.pendingStoreName,
      pendingProducts: products,
    });

    await reply(
      `🔍 AI ${products.length} ta mahsulot topdi:\n\n` +
        formatProductList(products) +
        "\n\n---\n✅ *To'g'rimi?* Tasdiqlash uchun *Ha* yoki rad etish uchun *Yo'q* yuboring.",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // ── AWAITING_CONFIRMATION ────────────────────────────────────────────────
  if (state.stage === "AWAITING_CONFIRMATION") {
    const lower = text.trim().toLowerCase();
    const isYes = ["ha", "yes", "да", "✅", "ok", "+", "to'g'ri", "to'g'ri"].some((w) =>
      lower.includes(w),
    );
    const isNo = ["yo'q", "no", "нет", "❌", "-", "xato"].some((w) => lower.includes(w));

    if (isYes) {
      await upsertStore(chatId, state.pendingStoreName ?? "Do'konim");
      await updateStoreProducts(chatId, state.pendingProducts ?? []);
      clearState(chatId);
      await reply(
        `🎉 *Tabriklaymiz!* Do'koningiz botga ulandi!\n\n` +
          `🏪 *${state.pendingStoreName}*\n` +
          `📦 ${state.pendingProducts?.length ?? 0} ta mahsulot saqlandi.\n\n` +
          "Endi mijozlar botga yozsa, AI avtomatik javob beradi!\n\n" +
          "Mahsulotlarni yangilash uchun /update yuboring.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    if (isNo) {
      setState(chatId, {
        stage: "AWAITING_PRODUCTS",
        pendingStoreName: state.pendingStoreName,
      });
      await reply(
        "🔄 Qayta yuboring. Telegram kanal yoki guruhingizdan mahsulotlar matnini nusxalab, shu yerga yuboring:",
      );
      return;
    }

    await reply("Iltimos, *Ha* yoki *Yo'q* deb javob bering.", { parse_mode: "Markdown" });
    return;
  }

  // ── IDLE — route by ownership ────────────────────────────────────────────
  const store = await getStoreByOwnerChatId(chatId);

  if (store) {
    // Owner is testing their own bot in preview mode
    logger.info({ chatId, storeName: store.storeName }, "[TG] owner preview mode");
    await sendTyping();

    if (PHONE_RE.test(text)) {
      await reply(ORDER_CONFIRMATION);
      return;
    }

    const { reply: aiReply } = await analyzeCustomerMessage(text, store.products as Product[]);
    await reply(`_(Bot preview: mijozlaringiz shunday ko'radi)_\n\n${aiReply}`, {
      parse_mode: "Markdown",
    });
    return;
  }

  // ── Customer mode ────────────────────────────────────────────────────────
  logger.info({ chatId }, "[TG] customer mode");

  if (PHONE_RE.test(text)) {
    await reply(ORDER_CONFIRMATION);
    return;
  }

  await sendTyping();

  const activeStore = await getLatestActiveStore();
  const products = (activeStore?.products as Product[] | null) ?? [];

  logger.info(
    { chatId, storeName: activeStore?.storeName, productCount: products.length },
    "[TG] Step 3 — calling AI",
  );

  const startMs = Date.now();
  const { reply: aiReply } = await analyzeCustomerMessage(text, products);
  logger.info({ chatId, elapsedMs: Date.now() - startMs, aiReply }, "[TG] Step 4 — AI done");

  await reply(aiReply);
  logger.info({ chatId }, "[TG] Step 6 — reply sent ✓");
}

// ── Bot factory ──────────────────────────────────────────────────────────────

export function createTelegramBot(): Telegraf | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot will not start");
    return null;
  }

  const bot = new Telegraf(token);

  // /start — owner onboarding entry point
  bot.command("start", async (ctx) => {
    try {
      const chatId = String(ctx.from.id);
      const username = ctx.from.username ?? chatId;

      const existing = await getStoreByOwnerChatId(chatId);
      if (existing) {
        clearState(chatId);
        await ctx.reply(
          `👋 Xush kelibsiz! *${existing.storeName}* do'koningiz allaqachon sozlangan.\n\n` +
            `📦 ${(existing.products as Product[]).length} ta mahsulot mavjud.\n\n` +
            "Mahsulotlarni yangilash uchun /update yuboring.",
          { parse_mode: "Markdown" },
        );
        return;
      }

      setState(chatId, { stage: "AWAITING_STORE_NAME" });
      logger.info({ chatId, username }, "[TG] owner onboarding started");

      await ctx.reply(
        "🌟 *Woxom AI Platform*ga xush kelibsiz!\n\n" +
          "Savdo botingizni yarataylik. Bu atigi 2 qadam:\n" +
          "1️⃣ Do'kon nomini kiriting\n" +
          "2️⃣ Mahsulotlar matnini yuboring\n\n" +
          "➡️ Boshlaylik! *Do'koningiz nomini* kiriting:",
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      console.error("[TG /start] error:", err);
      await ctx.reply(TECH_ERROR).catch(() => null);
    }
  });

  // /update — owner re-uploads product catalog
  bot.command("update", async (ctx) => {
    try {
      const chatId = String(ctx.from.id);
      const store = await getStoreByOwnerChatId(chatId);
      if (!store) {
        await ctx.reply("Avval /start buyrug'ini yuboring.");
        return;
      }
      setState(chatId, { stage: "AWAITING_PRODUCTS", pendingStoreName: store.storeName });
      await ctx.reply(
        `🔄 *${store.storeName}* mahsulotlarini yangilaylik.\n\n` +
          "Telegram kanal yoki guruhingizdan yangi mahsulotlar matnini nusxalab, shu yerga yuboring:",
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      console.error("[TG /update] error:", err);
      await ctx.reply(TECH_ERROR).catch(() => null);
    }
  });

  // /mystores — owner sees their current catalog
  bot.command("mystores", async (ctx) => {
    try {
      const chatId = String(ctx.from.id);
      const store = await getStoreByOwnerChatId(chatId);
      if (!store) {
        await ctx.reply("Siz hali do'kon sozlamagansiz. Boshlash uchun /start yuboring.");
        return;
      }
      const products = store.products as Product[];
      await ctx.reply(
        `🏪 *${store.storeName}*\n\n` +
          `📦 Mahsulotlar (${products.length} ta):\n\n` +
          formatProductList(products),
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      console.error("[TG /mystores] error:", err);
      await ctx.reply(TECH_ERROR).catch(() => null);
    }
  });

  // Text messages — fully isolated per-user
  bot.on(message("text"), async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const chatId = String(ctx.from.id);
    const username = ctx.from.username ?? chatId;
    const text = ctx.message.text.trim();
    if (!text) return;

    try {
      await handleText(
        chatId,
        username,
        text,
        (msg, opts) => ctx.reply(msg, opts as never),
        () => ctx.sendChatAction("typing"),
      );
    } catch (err) {
      console.error("[TG] message handler error:", err);
      logger.error(
        {
          chatId,
          err: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        "[TG] ERROR — message handler failed",
      );
      await ctx.reply(TECH_ERROR).catch(() => null);
    }
  });

  bot.catch((err, ctx) => {
    console.error("[TG] Telegraf error:", err);
    logger.error(
      {
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        updateType: ctx.updateType,
      },
      "[TG] Telegraf-level error",
    );
  });

  return bot;
}

// ── Bot launcher with 409 retry ──────────────────────────────────────────────

export function launchBot(bot: Telegraf): void {
  const MAX_RETRIES = 5;
  const RETRY_MS = 15_000;

  const attempt = (retry: number) => {
    bot
      .launch({ dropPendingUpdates: true })
      .then(() => logger.info("[TG] Bot stopped cleanly"))
      .catch(async (err: unknown) => {
        const s = String(err);
        if (s.includes("409") && retry < MAX_RETRIES) {
          logger.warn({ retry }, `[TG] 409 conflict — retry ${retry}/${MAX_RETRIES} in ${RETRY_MS / 1000}s`);
          await new Promise((r) => setTimeout(r, RETRY_MS));
          attempt(retry + 1);
        } else {
          logger.error({ err: s }, "[TG] Bot polling stopped — no more retries");
        }
      });
  };

  attempt(1);
  logger.info("[TG] Bot launch initiated (long polling, dropPendingUpdates=true)");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
