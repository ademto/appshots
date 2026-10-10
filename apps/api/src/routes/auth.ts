/**
 * Auth routes — email OTP (no password).
 *
 *   POST /auth/request-code  { email }        -> 200 (always, no enumeration)
 *   POST /auth/verify        { email, code }  -> 200 { user } + session cookie
 *   POST /auth/logout                         -> 200, clears cookie
 *   GET  /auth/me                             -> { user } | 401
 */
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  createLoginCode,
  isRateLimited,
  isValidEmail,
  normalizeEmail,
  verifyLoginCode,
} from "../auth/otp";
import {
  SESSION_COOKIE,
  createSession,
  revokeSession,
  sessionCookieOptions,
  upsertUser,
} from "../auth/session";
import { emailSender } from "../auth/email";
import { requireAuth } from "../auth/middleware";

export const authRoutes = new Hono();

authRoutes.post("/request-code", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ""));

  // Validate format but do not reveal whether the email exists.
  if (isValidEmail(email) && !(await isRateLimited(email))) {
    const code = await createLoginCode(email);
    await emailSender.sendLoginCode(email, code);
  }

  // Always 200 to avoid user enumeration / rate-limit probing.
  return c.json({ ok: true });
});

authRoutes.post("/verify", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ""));
  const code = String(body.code ?? "").trim();

  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const ok = await verifyLoginCode(email, code);
  if (!ok) {
    return c.json({ error: "invalid_code" }, 400);
  }

  const user = await upsertUser(email);
  const token = await createSession(user.id);
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions());

  return c.json({ user });
});

authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await revokeSession(token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, (c) => {
  return c.json({ user: c.get("user") });
});
