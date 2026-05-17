import { db } from "@workspace/db";
import { storesTable } from "@workspace/db";
import type { Product, Store } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";

export type { Product, Store };

export async function getStoreByOwnerChatId(ownerChatId: string): Promise<Store | null> {
  const rows = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.ownerChatId, ownerChatId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getStoreByBotToken(botToken: string): Promise<Store | null> {
  const rows = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.botToken, botToken))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAllStoresWithToken(): Promise<Store[]> {
  return db
    .select()
    .from(storesTable)
    .where(isNotNull(storesTable.botToken));
}

export async function upsertStore(
  ownerChatId: string,
  data: { storeName: string; botToken: string; products: Product[] },
): Promise<Store> {
  const rows = await db
    .insert(storesTable)
    .values({ ownerChatId, ...data })
    .onConflictDoUpdate({
      target: storesTable.ownerChatId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  return rows[0]!;
}

export async function updateStoreProducts(
  ownerChatId: string,
  products: Product[],
): Promise<void> {
  await db
    .update(storesTable)
    .set({ products, updatedAt: new Date() })
    .where(eq(storesTable.ownerChatId, ownerChatId));
}
