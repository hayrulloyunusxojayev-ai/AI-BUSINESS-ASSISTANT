import { db } from "@workspace/db";
import { storesTable } from "@workspace/db";
import type { Product, Store } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export type { Product, Store };

export async function getStoreByOwnerChatId(ownerChatId: string): Promise<Store | null> {
  const rows = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.ownerChatId, ownerChatId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertStore(ownerChatId: string, storeName: string): Promise<Store> {
  const rows = await db
    .insert(storesTable)
    .values({ ownerChatId, storeName, products: [] })
    .onConflictDoUpdate({
      target: storesTable.ownerChatId,
      set: { storeName, updatedAt: new Date() },
    })
    .returning();
  return rows[0]!;
}

export async function updateStoreProducts(ownerChatId: string, products: Product[]): Promise<void> {
  await db
    .update(storesTable)
    .set({ products, updatedAt: new Date() })
    .where(eq(storesTable.ownerChatId, ownerChatId));
}

export async function getLatestActiveStore(): Promise<Store | null> {
  const rows = await db
    .select()
    .from(storesTable)
    .orderBy(desc(storesTable.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}
