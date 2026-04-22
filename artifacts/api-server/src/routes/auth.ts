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

// Single source of truth for the OAuth callback URL.
// Must match exactly what is registered in Google Cloud Console.
function getCallbackUrl(): string {
  const url = process.env.GOOGLE_CALLBACK_URL;
  if (!url) {
    throw new Error("GOOGLE_CALLBACK_URL is not set");
  }
  return url;
}

// ── Standard auth routes ────────────────────────────────────────────────────

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
    .values({ email, name, authProvider: "email", passwordHash: await hashPassword(parsed.data.password) })
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

// ── Google OAuth routes ─────────────────────────────────────────────────────

router.get("/auth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
    req.log.error("Google OAuth env vars missing");
    res.redirect("/sign-in?error=google_not_configured");
    return;
  }

  const callbackUrl = getCallbackUrl();
  req.log.info({ callbackUrl }, "Google OAuth init");

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
  const { code, error: googleError } = req.query;

  req.log.info({ code: code ? "present" : "missing", googleError }, "Google OAuth callback received");

  if (googleError) {
    req.log.warn({ googleError }, "Google denied access");
    res.redirect("/sign-in?error=google_denied");
    return;
  }

  if (!code || typeof code !== "string") {
    req.log.error("No auth code in Google callback");
    res.redirect("/sign-in?error=google_failed");
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    req.log.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in callback");
    res.redirect("/sign-in?error=google_not_configured");
    return;
  }

  // The callback URL must be the same value used in the initial redirect
  const callbackUrl = getCallbackUrl();
  req.log.info({ callbackUrl }, "Using callback URL for token exchange");

  try {
    // Step 1: Exchange code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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

    const tokenText = await tokenRes.text();
    req.log.info({ status: tokenRes.status, body: tokenText }, "Token exchange result");

    if (!tokenRes.ok) {
      req.log.error({ status: tokenRes.status, body: tokenText }, "Token exchange failed");
      res.redirect("/sign-in?error=google_token_failed");
      return;
    }

    const tokenData = JSON.parse(tokenText) as { access_token?: string };
    if (!tokenData.access_token) {
      req.log.error({ tokenData }, "No access_token in response");
      res.redirect("/sign-in?error=google_no_token");
      return;
    }

    // Step 2: Get Google user info
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfoText = await userInfoRes.text();
    req.log.info({ status: userInfoRes.status, body: userInfoText }, "User info result");

    if (!userInfoRes.ok) {
      req.log.error({ status: userInfoRes.status }, "User info fetch failed");
      res.redirect("/sign-in?error=google_userinfo_failed");
      return;
    }

    const googleUser = JSON.parse(userInfoText) as { email?: string; name?: string };
    if (!googleUser.email) {
      req.log.error({ googleUser }, "No email in Google user info");
      res.redirect("/sign-in?error=google_no_email");
      return;
    }

    const email = normalizeEmail(googleUser.email);
    const name = googleUser.name || email.split("@")[0];
    req.log.info({ email, name }, "Google user identified");

    // Step 3: Find or create user
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      req.log.info({ email }, "Creating new user from Google");
      const [created] = await db
        .insert(usersTable)
        .values({ email, name, authProvider: "google", passwordHash: "" })
        .returning();
      user = created;
    } else {
      req.log.info({ email, userId: user.id }, "Existing user — logging in");
    }

    // Step 4: Create session and redirect
    await createSession(res, String(user.id));
    req.log.info({ userId: user.id }, "Session created — redirecting to /admin");
    res.redirect("/admin");
  } catch (err) {
    req.log.error(
      { err: String(err), stack: err instanceof Error ? err.stack : undefined },
      "Unexpected error in Google callback"
    );
    res.redirect("/sign-in?error=google_failed");
  }
});

export default router;
