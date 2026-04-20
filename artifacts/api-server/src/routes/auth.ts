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

router.get("/auth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

  req.log.info({ clientId: clientId ? "set" : "missing", callbackUrl }, "Google OAuth init");

  if (!clientId || !callbackUrl) {
    req.log.error("Google OAuth not configured: missing GOOGLE_CLIENT_ID or GOOGLE_CALLBACK_URL");
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

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  req.log.info({ callbackUrl }, "Redirecting to Google OAuth");
  res.redirect(url);
});

router.get("/auth/google/callback", async (req, res) => {
  const { code, error: googleError } = req.query;

  req.log.info({ code: code ? "present" : "missing", googleError }, "Google OAuth callback received");

  if (googleError) {
    req.log.error({ googleError }, "Google returned an error");
    res.redirect(`/sign-in?error=google_denied`);
    return;
  }

  if (!code || typeof code !== "string") {
    req.log.error("No code in Google callback");
    res.redirect("/sign-in?error=google_failed");
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

  req.log.info({
    clientId: clientId ? "set" : "missing",
    clientSecret: clientSecret ? "set" : "missing",
    callbackUrl,
  }, "Google OAuth env check");

  if (!clientId || !clientSecret || !callbackUrl) {
    req.log.error("Google OAuth not configured in callback");
    res.redirect("/sign-in?error=google_not_configured");
    return;
  }

  try {
    // Step 1: Exchange code for tokens
    req.log.info({ callbackUrl }, "Exchanging code for tokens");

    const tokenBody = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    const tokenRaw = await tokenResponse.text();
    req.log.info({ status: tokenResponse.status, body: tokenRaw }, "Token exchange response");

    if (!tokenResponse.ok) {
      req.log.error({ status: tokenResponse.status, body: tokenRaw }, "Token exchange failed");
      res.redirect("/sign-in?error=google_token_failed");
      return;
    }

    let tokenData: { access_token?: string; error?: string };
    try {
      tokenData = JSON.parse(tokenRaw) as { access_token?: string; error?: string };
    } catch {
      req.log.error({ tokenRaw }, "Failed to parse token response");
      res.redirect("/sign-in?error=google_token_parse_failed");
      return;
    }

    if (!tokenData.access_token) {
      req.log.error({ tokenData }, "No access_token in token response");
      res.redirect("/sign-in?error=google_no_token");
      return;
    }

    // Step 2: Get user info
    req.log.info("Fetching Google user info");

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfoRaw = await userInfoResponse.text();
    req.log.info({ status: userInfoResponse.status, body: userInfoRaw }, "User info response");

    if (!userInfoResponse.ok) {
      req.log.error({ status: userInfoResponse.status, body: userInfoRaw }, "User info fetch failed");
      res.redirect("/sign-in?error=google_userinfo_failed");
      return;
    }

    let googleUser: { email?: string; name?: string; id?: string };
    try {
      googleUser = JSON.parse(userInfoRaw) as { email?: string; name?: string; id?: string };
    } catch {
      req.log.error({ userInfoRaw }, "Failed to parse user info");
      res.redirect("/sign-in?error=google_userinfo_parse_failed");
      return;
    }

    if (!googleUser.email) {
      req.log.error({ googleUser }, "No email in Google user info");
      res.redirect("/sign-in?error=google_no_email");
      return;
    }

    const email = normalizeEmail(googleUser.email);
    const name = googleUser.name || email.split("@")[0];

    req.log.info({ email, name }, "Google user identified");

    // Step 3: Find or create user in DB
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (!user) {
      req.log.info({ email }, "Creating new user from Google login");
      const [newUser] = await db
        .insert(usersTable)
        .values({ email, name, authProvider: "google", passwordHash: "" })
        .returning();
      user = newUser;
    } else {
      req.log.info({ email, userId: user.id }, "Existing user found, logging in");
    }

    // Step 4: Create session
    await createSession(res, String(user.id));
    req.log.info({ userId: user.id }, "Session created, redirecting to /admin");

    res.redirect("/admin");
  } catch (err) {
    req.log.error({ err: String(err), stack: err instanceof Error ? err.stack : undefined }, "Unexpected Google OAuth error");
    res.redirect("/sign-in?error=google_failed");
  }
});

export default router;
