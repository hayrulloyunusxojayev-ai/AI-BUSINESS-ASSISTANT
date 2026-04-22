import crypto from "crypto";
import type { Request, Response } from "express";
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SESSION_COOKIE_NAME = "woxom_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

// Always use sameSite:"none" + secure:true so the cookie survives:
//   1. Cross-domain OAuth redirects (Google → callback → /admin)
//   2. Render / Replit reverse-proxy environments (always HTTPS in prod)
// In pure local http:// dev without a proxy this won't work, but Replit
// dev always runs behind an HTTPS proxy, so this is safe.
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  maxAge: SESSION_DURATION_MS,
  path: "/",
};

export function sessionExpiresAt() {
  return new Date(Date.now() + SESSION_DURATION_MS);
}

export function getSessionId(req: Request): string | null {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof sessionId === "string" && sessionId.length > 0 ? sessionId : null;
}

export async function createSession(res: Response, userId: string): Promise<void> {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  await db.insert(sessionsTable).values({
    id: sessionId,
    userId,
    expiresAt: sessionExpiresAt(),
  });
  res.cookie(SESSION_COOKIE_NAME, sessionId, COOKIE_OPTIONS);
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
}

export async function getSessionUserId(req: Request): Promise<string | null> {
  const sessionId = getSessionId(req);
  if (!sessionId) return null;

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);

  if (!session || session.expiresAt <= new Date()) return null;
  return session.userId;
}

export async function destroySession(req: Request, res: Response) {
  const sessionId = getSessionId(req);
  if (sessionId) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
  }
  clearSessionCookie(res);
}
