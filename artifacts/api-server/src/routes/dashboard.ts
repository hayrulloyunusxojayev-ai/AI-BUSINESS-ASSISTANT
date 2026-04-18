import { Router } from "express";
import { db } from "@workspace/db";
import { businessesTable, productsTable, chatMessagesTable } from "@workspace/db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.userId, userId))
    .limit(1);

  if (!business) {
    res.json({
      totalProducts: 0,
      totalChats: 0,
      recentChats: [],
      shareLinkId: null,
    });
    return;
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.userId, userId), eq(productsTable.businessId, business.id)));

  const chatSessions = await db
    .select({
      sessionId: chatMessagesTable.sessionId,
      messageCount: count(chatMessagesTable.id),
      lastMessage: sql<string>`MAX(${chatMessagesTable.content})`,
      lastMessageAt: sql<string>`MAX(${chatMessagesTable.createdAt})`,
    })
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.businessId, business.id))
    .groupBy(chatMessagesTable.sessionId)
    .orderBy(desc(sql`MAX(${chatMessagesTable.createdAt})`))
    .limit(10);

  res.json({
    totalProducts: products.length,
    totalChats: chatSessions.length,
    recentChats: chatSessions.map((s) => ({
      sessionId: s.sessionId,
      messageCount: Number(s.messageCount),
      lastMessage: s.lastMessage,
      lastMessageAt: s.lastMessageAt,
    })),
    shareLinkId: business.shareLinkId,
  });
});

export default router;
