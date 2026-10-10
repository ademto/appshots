/**
 * Sessions.
 *
 * - Random opaque token (32 bytes). Only its hash is stored.
 * - Delivered to the client as an HttpOnly, Secure, SameSite=Lax cookie.
 * - Verified by hashing the presented token and matching the stored hash.
 */
import { sql } from "../db/client";
import { env, isProd } from "../env";

export const SESSION_COOKIE = "appshots_session";

function hashToken(token: string): string {
  const data = new TextEncoder().encode(`${env.SESSION_SECRET}:${token}`);
  // SHA-256 via Bun's crypto (sync hashing through subtle is async; use node)
  const hash = require("node:crypto")
    .createHash("sha256")
    .update(data)
    .digest("hex");
  return hash;
}

export interface SessionUser {
  id: string;
  email: string;
}

/**
 * Finds an existing user by email or creates one. Returns the user.
 */
export async function upsertUser(email: string): Promise<SessionUser> {
  const rows = await sql`
    INSERT INTO users (email)
    VALUES (${email})
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id, email
  `;
  return rows[0] as SessionUser;
}

/**
 * Creates a session for the user and returns the plaintext token (to set as a
 * cookie).
 */
export async function createSession(userId: string): Promise<string> {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    "hex",
  );
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;

  return token;
}

/**
 * Resolves the user for a session token, or null if invalid/expired.
 */
export async function getUserForToken(
  token: string,
): Promise<SessionUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await sql`
    SELECT u.id, u.email
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > now()
    LIMIT 1
  `;
  return (rows[0] as SessionUser) ?? null;
}

/**
 * Revokes a session by token (logout).
 */
export async function revokeSession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax" as const,
    path: "/",
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}
