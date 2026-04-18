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
    res.status(400).json({ error: "Invalid share link" });
    return;
  }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.shareLinkId, paramsParsed.data.shareLinkId))
    .limit(1);

  if (!business) {
    res.status(404).json({ error: "Business not found" });
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
    res.status(400).json({ error: "Invalid share link" });
    return;
  }

  const bodyParsed = SendChatMessageBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid input", details: bodyParsed.error });
    return;
  }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.shareLinkId, paramsParsed.data.shareLinkId))
    .limit(1);

  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.businessId, business.id), eq(productsTable.userId, business.userId)));

  const productList = products
    .map((p) => `- ${p.name}: $${p.price} — ${p.description}`)
    .join("\n");

  const systemPrompt = `You are a sales assistant for "${business.businessName}". Only use the provided product list. Your goal is to help the customer choose and buy products. Be friendly and persuasive. Never make up products that aren't on the list.

Available products:
${productList || "No products available yet."}`;

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
      model: "gpt-5.2",
      max_completion_tokens: 8192,
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
    res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
    res.end();
  }
});

router.get("/chat/:shareLinkId/history", async (req, res) => {
  const paramsParsed = GetChatHistoryParams.safeParse({ shareLinkId: req.params.shareLinkId });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid share link" });
    return;
  }

  const queryParsed = GetChatHistoryQueryParams.safeParse({ sessionId: req.query.sessionId });
  if (!queryParsed.success) {
    res.status(400).json({ error: "sessionId query param required" });
    return;
  }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.shareLinkId, paramsParsed.data.shareLinkId))
    .limit(1);

  if (!business) {
    res.status(404).json({ error: "Business not found" });
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
