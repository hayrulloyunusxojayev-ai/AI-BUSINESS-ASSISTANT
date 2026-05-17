import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export type Product = {
  name: string;
  price: string;
  description?: string;
  size?: string;
};

export const storesTable = pgTable("stores", {
  id: serial("id").primaryKey(),
  ownerChatId: text("owner_chat_id").notNull().unique(),
  storeName: text("store_name").notNull(),
  botToken: text("bot_token").unique(),
  products: jsonb("products").$type<Product[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Store = typeof storesTable.$inferSelect;
