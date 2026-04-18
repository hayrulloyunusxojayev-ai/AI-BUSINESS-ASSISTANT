import { Router } from "express";
import { db } from "@workspace/db";
import { businessesTable, productsTable } from "@workspace/db";
import { CreateProductBody, UpdateProductBody, GetProductParams, UpdateProductParams, DeleteProductParams } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

async function getUserBusiness(userId: string) {
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.userId, userId))
    .limit(1);
  return business;
}

router.get("/products", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const business = await getUserBusiness(userId);

  if (!business) {
    res.json([]);
    return;
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.userId, userId), eq(productsTable.businessId, business.id)));

  res.json(products);
});

router.post("/products", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error });
    return;
  }

  const business = await getUserBusiness(userId);
  if (!business) {
    res.status(404).json({ error: "Create a business first" });
    return;
  }

  const [product] = await db
    .insert(productsTable)
    .values({
      userId,
      businessId: business.id,
      name: parsed.data.name,
      price: parsed.data.price,
      description: parsed.data.description,
      image: parsed.data.image ?? null,
    })
    .returning();

  res.status(201).json(product);
});

router.get("/products/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const paramsParsed = GetProductParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const business = await getUserBusiness(userId);
  if (!business) {
    res.status(404).json({ error: "No business found" });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, paramsParsed.data.id), eq(productsTable.userId, userId), eq(productsTable.businessId, business.id)));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(product);
});

router.put("/products/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const paramsParsed = UpdateProductParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error });
    return;
  }

  const business = await getUserBusiness(userId);
  if (!business) {
    res.status(404).json({ error: "No business found" });
    return;
  }

  const [updated] = await db
    .update(productsTable)
    .set({
      name: parsed.data.name,
      price: parsed.data.price,
      description: parsed.data.description,
      image: parsed.data.image ?? null,
    })
    .where(and(eq(productsTable.id, paramsParsed.data.id), eq(productsTable.userId, userId), eq(productsTable.businessId, business.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(updated);
});

router.delete("/products/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const paramsParsed = DeleteProductParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const business = await getUserBusiness(userId);
  if (!business) {
    res.status(404).json({ error: "No business found" });
    return;
  }

  await db
    .delete(productsTable)
    .where(and(eq(productsTable.id, paramsParsed.data.id), eq(productsTable.userId, userId), eq(productsTable.businessId, business.id)));

  res.status(204).send();
});

export default router;
