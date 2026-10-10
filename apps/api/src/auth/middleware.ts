/**
 * requireAuth middleware — resolves the session cookie to a user and attaches
 * it to the context. Responds 401 if there is no valid session.
 */
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE, getUserForToken, type SessionUser } from "./session";

declare module "hono" {
  interface ContextVariableMap {
    user: SessionUser;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  const user = token ? await getUserForToken(token) : null;
  if (!user) {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("user", user);
  await next();
}
