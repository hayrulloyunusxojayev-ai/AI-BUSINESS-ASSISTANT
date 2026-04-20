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
  const userId = await getSessionUserId(req);
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
    res.status(400).json({ error: "Noto'g'ri ma'lumot", details: parsed.error });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const name = parsed.data.name.trim();
  if (!name || parsed.data.password.length < 8) {
    res.status(400).json({ error: "Ism va kamida 8 ta belgidan iborat parol talab qilinadi" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Bu email allaqachon ro'yxatdan o'tgan" });
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
    res.status(400).json({ error: "Noto'g'ri ma'lumot", details: parsed.error });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Email yoki parol noto'g'ri" });
    return;
  }

  await createSession(res, String(user.id));
  res.json({ user: toPublicUser(user) });
});

router.post("/auth/logout", async (req, res) => {
  await destroySession(req, res);
  res.json({ success: true });
});

router.get("/auth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

  if (!clientId || !callbackUrl) {
    res.redirect("/sign-in?error=google_not_configured");
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/auth/google/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error || !code || typeof code !== "string") {
    res.redirect("/sign-in?error=google_failed");
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

  if (!clientId || !clientSecret || !callbackUrl) {
    res.redirect("/sign-in?error=google_not_configured");
    return;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      req.log.error({ status: tokenResponse.status }, "Google token exchange failed");
      res.redirect("/sign-in?error=google_failed");
      return;
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };

    if (!tokenData.access_token) {
      res.redirect("/sign-in?error=google_failed");
      return;
    }

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      res.redirect("/sign-in?error=google_failed");
      return;
    }

    const googleUser = (await userInfoResponse.json()) as {
      email?: string;
      name?: string;
      id?: string;
    };

    if (!googleUser.email) {
      res.redirect("/sign-in?error=google_failed");
      return;
    }

    const email = normalizeEmail(googleUser.email);
    const name = googleUser.name || email.split("@")[0];

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (!user) {
      const [newUser] = await db
        .insert(usersTable)
        .values({
          email,
          name,
          authProvider: "google",
          passwordHash: "",
        })
        .returning();
      user = newUser;
    } else if (user.authProvider !== "google") {
      await db
        .update(usersTable)
        .set({ authProvider: "google" })
        .where(eq(usersTable.id, user.id));
    }

    await createSession(res, String(user.id));
    res.redirect("/admin");
  } catch (err) {
    req.log.error({ err }, "Google OAuth callback error");
    res.redirect("/sign-in?error=google_failed");
  }
});

export default router;
