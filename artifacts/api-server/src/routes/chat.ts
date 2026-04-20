import { Router } from "express";
import { db } from "@workspace/db";
import { businessesTable, productsTable, chatMessagesTable } from "@workspace/db";
import { GetChatBusinessParams, SendChatMessageParams, SendChatMessageBody, GetChatHistoryParams, GetChatHistoryQueryParams } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.get("/chat/:shareLinkId", async (req, res) => {
  const paramsParsed = GetChatBusinessParams.safeParse({ shareLinkId: req.params.shareLinkId });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Noto'g'ri havola" });
    return;
  }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.shareLinkId, paramsParsed.data.shareLinkId))
    .limit(1);

  if (!business) {
    res.status(404).json({ error: "Biznes topilmadi" });
    return;
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.businessId, business.id), eq(productsTable.userId, business.userId)));

  res.json({
    businessName: business.businessName,
    productCount: products.length,
  });
});

router.post("/chat/:shareLinkId/messages", async (req, res) => {
  const paramsParsed = SendChatMessageParams.safeParse({ shareLinkId: req.params.shareLinkId });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Noto'g'ri havola" });
    return;
  }

  const bodyParsed = SendChatMessageBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Noto'g'ri ma'lumot", details: bodyParsed.error });
    return;
  }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.shareLinkId, paramsParsed.data.shareLinkId))
    .limit(1);

  if (!business) {
    res.status(404).json({ error: "Biznes topilmadi" });
    return;
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.businessId, business.id), eq(productsTable.userId, business.userId)));

  const productList = products
    .map((p) => `- ${p.name}: ${p.price} so'm — ${p.description}`)
    .join("\n");

  const systemPrompt = `Siz "${business.businessName}" do'konining savdo yordamchisisiz. Sizning ismingiz Woxom AI. Siz hech qachon ChatGPT, OpenAI yoki boshqa AI tizimi ekanligingizni aytmaysiz. Faqat o'zbek tilida gaplashing.

Maqsadingiz: mijozlarga mahsulotlarni tanlashda yordam berish, savollariga javob berish va xaridga undash. Do'stona, ishontiruvchan va qisqa javob bering. Ro'yxatda bo'lmagan mahsulotlarni o'ylab topmang.

${productList
  ? `Mavjud mahsulotlar:\n${productList}`
  : "Hozir mahsulotlar qo'shilmoqda. Siz nimani qidiryapsiz?"
}

Mijoz biror mahsulot haqida so'rasa, uning afzalliklarini ayt va xaridga taklif qil. Agar mahsulot yo'q bo'lsa, "Hozir mahsulotlar qo'shilmoqda. Siz nimani qidiryapsiz?" deb so'ra.`;

  const historyMessages = (bodyParsed.data.history || []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: bodyParsed.data.message },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 1024,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db.insert(chatMessagesTable).values([
      {
        businessId: business.id,
        sessionId: bodyParsed.data.sessionId,
        role: "user",
        content: bodyParsed.data.message,
      },
      {
        businessId: business.id,
        sessionId: bodyParsed.data.sessionId,
        role: "assistant",
        content: fullResponse,
      },
    ]);

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    req.log.error({ error }, "Chat completion error");
    res.write(`data: ${JSON.stringify({ error: "Javob yaratishda xato yuz berdi" })}\n\n`);
    res.end();
  }
});

router.get("/chat/:shareLinkId/history", async (req, res) => {
  const paramsParsed = GetChatHistoryParams.safeParse({ shareLinkId: req.params.shareLinkId });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Noto'g'ri havola" });
    return;
  }

  const queryParsed = GetChatHistoryQueryParams.safeParse({ sessionId: req.query.sessionId });
  if (!queryParsed.success) {
    res.status(400).json({ error: "sessionId query parametri talab qilinadi" });
    return;
  }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.shareLinkId, paramsParsed.data.shareLinkId))
    .limit(1);

  if (!business) {
    res.status(404).json({ error: "Biznes topilmadi" });
    return;
  }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(
      and(
        eq(chatMessagesTable.businessId, business.id),
        eq(chatMessagesTable.sessionId, queryParsed.data.sessionId)
      )
    )
    .orderBy(chatMessagesTable.createdAt);

  res.json(messages);
});

export default router;
