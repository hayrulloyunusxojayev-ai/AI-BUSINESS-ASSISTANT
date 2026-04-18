import { Router } from "express";
import crypto from "crypto";
import { promisify } from "util";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { LoginBody, SignupBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { createSession, destroySession, getSessionUserId } from "../lib/session";

const scryptAsync = promisify(crypto.scrypt);
const router = Router();

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

function toPublicUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    authProvider: user.authProvider,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const hashBuffer = Buffer.from(hash, "hex");
  return hashBuffer.length === derived.length && crypto.timingSafeEqual(hashBuffer, derived);
}

router.get("/auth/me", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.json({ user: null });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, Number(userId))).limit(1);
  res.json({ user: user ? toPublicUser(user) : null });
});

router.post("/auth/signup", async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const name = parsed.data.name.trim();
  if (!name || parsed.data.password.length < 8) {
    res.status(400).json({ error: "Name and an 8 character password are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      name,
      authProvider: "email",
      passwordHash: await hashPassword(parsed.data.password),
    })
    .returning();

  await createSession(res, String(user.id));
  res.status(201).json({ user: toPublicUser(user) });
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await createSession(res, String(user.id));
  res.json({ user: toPublicUser(user) });
});

router.post("/auth/logout", async (req, res) => {
  await destroySession(req, res);
  res.json({ success: true });
});

export default router;
