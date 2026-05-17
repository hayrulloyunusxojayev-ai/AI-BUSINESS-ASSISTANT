/**
 * Main Admin Bot — @woxsom_ai_bot
 * Strictly for business owners to set up and manage their stores.
 * Customers NEVER use this bot — they use each store's dedicated bot.
 */
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { parseProductsFromText } from "./ai";
import {
  getStoreByOwnerChatId,
  upsertStore,
  updateStoreProducts,
  type Product,
} from "./store-db";
import { launchStoreBot } from "./bot-manager";
import { logger } from "./logger";

// ── Conversation state machine ────────────────────────────────────────────────

type Stage =
  | "IDLE"
  | "AWAITING_STORE_NAME"
  | "AWAITING_BOT_TOKEN"
  | "AWAITING_PRODUCTS"
  | "AWAITING_CONFIRMATION";

type FlowType = "setup" | "update";

type ConvState = {
  stage: Stage;
  flow?: FlowType;
  pendingStoreName?: string;
  pendingBotToken?: string;
  pendingBotUsername?: string;
  pendingProducts?: Product[];
};

const sessions = new Map<string, ConvState>();

function getState(chatId: string): ConvState {
  return sessions.get(chatId) ?? { stage: "IDLE" };
}
function setState(chatId: string, s: ConvState): void {
  sessions.set(chatId, s);
}
function clearState(chatId: string): void {
  sessions.set(chatId, { stage: "IDLE" });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TECH_ERROR =
  "❌ Texnik xatolik yuz berdi. Iltimos, qayta urinib ko'ring.\n\n" +
  "Произошла техническая ошибка. Попробуйте снова.";

function formatProductList(products: Product[]): string {
  if (products.length === 0) return "_(mahsulotlar topilmadi)_";
  return products
    .map((p, i) => {
      let line = `${i + 1}. *${p.name}* — ${p.price}`;
      if (p.size) line += `\n   📐 ${p.size}`;
      if (p.description) line += `\n   📝 ${p.description}`;
      return line;
    })
    .join("\n\n");
}

async function validateBotToken(
  token: string,
): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as { ok: boolean; result?: { username?: string } };
    if (!data.ok || !data.result?.username) {
      return { valid: false, error: "Token yaroqsiz — @BotFather dan to'g'ri tokenni oling." };
    }
    const username = data.result.username.toLowerCase();
    if (!username.includes("woxsom_bot")) {
      return {
        valid: false,
        error:
          `❌ Bot username @${data.result.username} qabul qilinmadi.\n\n` +
          "Woxom AI brendi uchun bot username *_woxsom_bot* so'zini o'z ichiga olishi kerak.\n" +
          "Masalan: `@techstore_woxsom_bot`, `@fashion_woxsom_bot`\n\n" +
          "@BotFather da `/setusername` buyrug'i bilan o'zgartiring, so'ng tokenni qayta yuboring.",
      };
    }
    return { valid: true, username: data.result.username };
  } catch {
    return { valid: false, error: "Telegram API ga ulanib bo'lmadi. Qayta urinib ko'ring." };
  }
}

// ── Core message router ───────────────────────────────────────────────────────

async function handleText(
  chatId: string,
  text: string,
  reply: (msg: string, opts?: object) => Promise<unknown>,
  sendTyping: () => Promise<unknown>,
): Promise<void> {
  const state = getState(chatId);
  logger.info({ chatId, stage: state.stage, text }, "[ADMIN-BOT] message in");

  // ── AWAITING_STORE_NAME ──────────────────────────────────────────────────
  if (state.stage === "AWAITING_STORE_NAME") {
    const storeName = text.trim();
    if (storeName.length < 2) {
      await reply("Do'kon nomi juda qisqa. Iltimos, to'liq nomini kiriting:");
      return;
    }
    setState(chatId, { stage: "AWAITING_BOT_TOKEN", flow: "setup", pendingStoreName: storeName });
    await reply(
      `✅ *${storeName}* — ajoyib nom!\n\n` +
        "2-qadam: Mijozlar uchun *dedikatsiyalangan bot* yarating.\n\n" +
        "📋 *Qanday qilish:*\n" +
        "1. @BotFather ga yozing → /newbot\n" +
        "2. Bot nomini kiriting\n" +
        "3. Username oxiri `_woxsom_bot` bilan tugashi kerak\n" +
        "   _(masalan: `techstore_woxsom_bot`)_\n" +
        "4. BotFather bergan *tokenni* shu yerga yuboring\n\n" +
        "⬇️ Token ko'rinishi: `7123456789:AAF...`",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // ── AWAITING_BOT_TOKEN ───────────────────────────────────────────────────
  if (state.stage === "AWAITING_BOT_TOKEN") {
    const token = text.trim().replace(/\s/g, "");
    if (!/^\d{8,12}:[\w\-]{35,}$/.test(token)) {
      await reply(
        "❌ Token formati noto'g'ri.\n\n" +
          "To'g'ri format: `1234567890:AAF_abc123...`\n" +
          "@BotFather dan olgan tokenni aynan shu ko'rinishda yuboring.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    await reply("⏳ Token tekshirilmoqda...");
    const { valid, username, error } = await validateBotToken(token);

    if (!valid) {
      await reply(error ?? "Token yaroqsiz.", { parse_mode: "Markdown" });
      return;
    }

    setState(chatId, {
      ...state,
      stage: "AWAITING_PRODUCTS",
      pendingBotToken: token,
      pendingBotUsername: username,
    });

    await reply(
      `✅ Token tasdiqlandi! Bot: *@${username}*\n\n` +
        "3-qadam: Telegram kanal yoki guruhingizdan mahsulotlar, narxlar va o'lchamlar haqidagi *matnni nusxalab* shu yerga yuboring:\n\n" +
        "_(Kanal postlari, narx-list, mahsulot tavsiflarini to'liq yuboring)_",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // ── AWAITING_PRODUCTS ────────────────────────────────────────────────────
  if (state.stage === "AWAITING_PRODUCTS") {
    if (text.trim().length < 10) {
      await reply("Matn juda qisqa. Mahsulotlar haqida to'liq ma'lumot yuboring:");
      return;
    }
    await sendTyping();
    await reply("⏳ AI mahsulotlarni tahlil qilmoqda...");

    let products: Product[];
    try {
      products = await parseProductsFromText(text);
    } catch (err) {
      await reply(`❌ AI tahlil qilishda xato: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    if (products.length === 0) {
      await reply(
        "❌ Matndan hech qanday mahsulot topilmadi.\n\n" +
          "Mahsulot nomi va narxi aniq ko'rsatilgan matnni yuboring.\n" +
          "Masalan: `Nike Air Max — 450 000 so'm, o'lcham: 40-45`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    setState(chatId, { ...state, stage: "AWAITING_CONFIRMATION", pendingProducts: products });

    await reply(
      `🔍 AI *${products.length}* ta mahsulot topdi:\n\n` +
        formatProductList(products) +
        "\n\n---\n✅ *To'g'rimi?* Tasdiqlash uchun *Ha*, rad etish uchun *Yo'q* yuboring.",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // ── AWAITING_CONFIRMATION ────────────────────────────────────────────────
  if (state.stage === "AWAITING_CONFIRMATION") {
    const lower = text.trim().toLowerCase();
    const isYes = ["ha", "yes", "да", "✅", "ok", "+", "to'g'ri"].some((w) =>
      lower.includes(w),
    );
    const isNo = ["yo'q", "no", "нет", "❌", "-", "xato", "qayta"].some((w) =>
      lower.includes(w),
    );

    if (isYes) {
      const products = state.pendingProducts ?? [];

      if (state.flow === "update") {
        // Product-only update (token already saved)
        await updateStoreProducts(chatId, products);
        clearState(chatId);
        await reply(
          `✅ *${products.length}* ta mahsulot yangilandi!\n\n` +
            "Mijozlar botiga o'zgarishlar darhol qo'llanildi.",
          { parse_mode: "Markdown" },
        );
        return;
      }

      // Full setup — save store and launch its bot
      const storeName = state.pendingStoreName ?? "Do'konim";
      const botToken = state.pendingBotToken!;
      const botUsername = state.pendingBotUsername ?? "";

      await upsertStore(chatId, { storeName, botToken, products });
      clearState(chatId);

      // Launch the dedicated customer bot immediately
      launchStoreBot(botToken, storeName);

      await reply(
        `🎉 *Tabriklaymiz! Do'koningiz ishga tushdi!*\n\n` +
          `🏪 Do'kon: *${storeName}*\n` +
          `🤖 Bot: *@${botUsername}*\n` +
          `📦 Mahsulotlar: *${products.length}* ta\n\n` +
          `Mijozlar *@${botUsername}* ga yozsa, AI avtomatik savdo qiladi!\n\n` +
          "📌 Buyruqlar:\n" +
          "/update — mahsulotlarni yangilash\n" +
          "/mystores — do'kon ma'lumotlari",
        { parse_mode: "Markdown" },
      );
      return;
    }

    if (isNo) {
      // Go back to product input step
      setState(chatId, { ...state, stage: "AWAITING_PRODUCTS", pendingProducts: undefined });
      await reply(
        "🔄 Qaytadan yuboring. Mahsulotlar matnini nusxalab yuboring:",
      );
      return;
    }

    await reply("Iltimos, *Ha* yoki *Yo'q* deb javob bering.", { parse_mode: "Markdown" });
    return;
  }

  // ── IDLE — owner already set up ──────────────────────────────────────────
  const store = await getStoreByOwnerChatId(chatId);
  if (store) {
    await reply(
      `Bu *admin panel*. Mijozlar *@${store.botToken ? (await fetch(`https://api.telegram.org/bot${store.botToken}/getMe`).then(r => r.json()).then((d: { result?: { username?: string } }) => d.result?.username ?? "botingiz").catch(() => "botingiz")) : "botingiz"}* ga yozishi kerak.\n\n` +
        "📌 Mavjud buyruqlar:\n" +
        "/update — mahsulotlarni yangilash\n" +
        "/mystores — do'kon ma'lumotlari",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // Unknown user trying to chat — prompt them to onboard
  await reply(
    "Bu bot *business owner*lar uchun admin panel.\n\n" +
      "Do'kon yaratish uchun /start yuboring.",
    { parse_mode: "Markdown" },
  );
}

// ── Bot factory ───────────────────────────────────────────────────────────────

export function createTelegramBot(): Telegraf | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — admin bot will not start");
    return null;
  }

  const bot = new Telegraf(token);

  // /start — entry point for owner onboarding
  bot.command("start", async (ctx) => {
    try {
      const chatId = String(ctx.from.id);
      const existing = await getStoreByOwnerChatId(chatId);

      if (existing) {
        clearState(chatId);
        const products = (existing.products as Product[]).length;
        await ctx.reply(
          `👋 Xush kelibsiz! *${existing.storeName}* do'koningiz sozlangan.\n\n` +
            `📦 Mahsulotlar: *${products}* ta\n` +
            `🤖 Bot token: \`${existing.botToken?.slice(0, 15)}...\`\n\n` +
            "📌 Buyruqlar:\n" +
            "/update — mahsulotlarni yangilash\n" +
            "/mystores — to'liq ma'lumot",
          { parse_mode: "Markdown" },
        );
        return;
      }

      setState(chatId, { stage: "AWAITING_STORE_NAME", flow: "setup" });
      logger.info({ chatId }, "[ADMIN-BOT] owner onboarding started");

      await ctx.reply(
        "🌟 *Woxom AI Platform*ga xush kelibsiz!\n\n" +
          "Har bir do'kon o'zining dedikatsiyalangan Telegram botiga ega bo'ladi. " +
          "Sozlash atigi *3 qadam*:\n\n" +
          "1️⃣ Do'kon nomi\n" +
          "2️⃣ Dedikatsiyalangan bot token (@BotFather orqali)\n" +
          "3️⃣ Mahsulotlar katalogi\n\n" +
          "➡️ Boshlaylik! *Do'koningiz nomini* kiriting:",
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      console.error("[ADMIN-BOT /start] error:", err);
      await ctx.reply(TECH_ERROR).catch(() => null);
    }
  });

  // /update — re-upload product catalog
  bot.command("update", async (ctx) => {
    try {
      const chatId = String(ctx.from.id);
      const store = await getStoreByOwnerChatId(chatId);
      if (!store) {
        await ctx.reply("Avval /start buyrug'ini yuboring.");
        return;
      }
      setState(chatId, {
        stage: "AWAITING_PRODUCTS",
        flow: "update",
        pendingStoreName: store.storeName,
        pendingBotToken: store.botToken ?? undefined,
      });
      await ctx.reply(
        `🔄 *${store.storeName}* mahsulotlarini yangilaylik.\n\n` +
          "Yangi mahsulotlar matnini nusxalab yuboring:",
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      console.error("[ADMIN-BOT /update] error:", err);
      await ctx.reply(TECH_ERROR).catch(() => null);
    }
  });

  // /mystores — view store details
  bot.command("mystores", async (ctx) => {
    try {
      const chatId = String(ctx.from.id);
      const store = await getStoreByOwnerChatId(chatId);
      if (!store) {
        await ctx.reply("Siz hali do'kon sozlamagansiz. /start buyrug'ini yuboring.");
        return;
      }
      const products = store.products as Product[];
      await ctx.reply(
        `🏪 *${store.storeName}*\n` +
          `🤖 Bot token: \`${store.botToken?.slice(0, 20)}...\`\n` +
          `📦 Mahsulotlar: *${products.length}* ta\n\n` +
          formatProductList(products),
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      console.error("[ADMIN-BOT /mystores] error:", err);
      await ctx.reply(TECH_ERROR).catch(() => null);
    }
  });

  // Text messages
  bot.on(message("text"), async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const chatId = String(ctx.from.id);
    const text = ctx.message.text.trim();
    if (!text) return;

    try {
      await handleText(
        chatId,
        text,
        (msg, opts) => ctx.reply(msg, opts as never),
        () => ctx.sendChatAction("typing"),
      );
    } catch (err) {
      console.error("[ADMIN-BOT] message error:", err);
      logger.error(
        {
          chatId,
          err: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        "[ADMIN-BOT] ERROR — message handler failed",
      );
      await ctx.reply(TECH_ERROR).catch(() => null);
    }
  });

  bot.catch((err, ctx) => {
    console.error("[ADMIN-BOT] Telegraf error:", err);
    logger.error({ err: String(err), updateType: ctx.updateType }, "[ADMIN-BOT] Telegraf error");
  });

  return bot;
}

// ── Admin bot launcher with 409 retry ────────────────────────────────────────

export function launchBot(bot: Telegraf): void {
  const attempt = (retry: number) => {
    bot
      .launch({ dropPendingUpdates: true })
      .then(() => logger.info("[ADMIN-BOT] stopped cleanly"))
      .catch(async (err: unknown) => {
        const s = String(err);
        if (s.includes("409") && retry < 5) {
          logger.warn({ retry }, `[ADMIN-BOT] 409 conflict — retry ${retry}/5 in 15s`);
          await new Promise((r) => setTimeout(r, 15_000));
          attempt(retry + 1);
        } else {
          logger.error({ err: s }, "[ADMIN-BOT] polling stopped");
        }
      });
  };

  attempt(1);
  logger.info("[ADMIN-BOT] launch initiated (long polling)");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
