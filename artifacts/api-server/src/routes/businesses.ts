import { Router } from "express";
import { db } from "@workspace/db";
import { businessesTable } from "@workspace/db";
import { CreateBusinessBody, UpdateBusinessBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import crypto from "crypto";

const router = Router();

router.get("/businesses", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.userId, userId))
    .limit(1);

  res.json(business ?? null);
});

router.post("/businesses", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = CreateBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error });
    return;
  }

  const existing = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Business already exists" });
    return;
  }

  const shareLinkId = crypto.randomBytes(8).toString("hex");
  const [business] = await db
    .insert(businessesTable)
    .values({
      userId,
      businessName: parsed.data.businessName,
      shareLinkId,
    })
    .returning();

  res.status(201).json(business);
});

router.put("/businesses", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = UpdateBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error });
    return;
  }

  const [updated] = await db
    .update(businessesTable)
    .set({ businessName: parsed.data.businessName })
    .where(eq(businessesTable.userId, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "No business found" });
    return;
  }

  res.json(updated);
});

export default router;
