/**
 * One-time login codes (OTP).
 *
 * - 6-digit cryptographically-random code.
 * - Only a hash of the code is stored; plaintext exists only in the email.
 * - Codes expire after 10 minutes and are single-use.
 * - Rate limited per email; verify attempts are capped per code.
 */
import { sql } from "../db/client";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;
const REQUEST_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode(): string {
  // 6 digits, zero-padded, from a cryptographically-secure source.
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

async function hashCode(email: string, code: string): Promise<string> {
  // Bind the hash to the email so a code is only valid for its address.
  const data = new TextEncoder().encode(`${email.toLowerCase()}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Returns true if this email has exceeded the request rate limit.
 */
export async function isRateLimited(email: string): Promise<boolean> {
  const since = new Date(Date.now() - REQUEST_WINDOW_MS);
  const rows = await sql`
    SELECT count(*)::int AS count
    FROM login_codes
    WHERE email = ${email} AND created_at > ${since}
  `;
  return (rows[0]?.count ?? 0) >= MAX_REQUESTS_PER_WINDOW;
}

/**
 * Generates a code, stores its hash with an expiry, and returns the plaintext
 * code (to be emailed).
 */
export async function createLoginCode(email: string): Promise<string> {
  const code = generateCode();
  const codeHash = await hashCode(email, code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await sql`
    INSERT INTO login_codes (email, code_hash, expires_at)
    VALUES (${email}, ${codeHash}, ${expiresAt})
  `;

  return code;
}

/**
 * Verifies a submitted code against the newest unconsumed, unexpired code for
 * the email. On success, marks it consumed and returns true.
 */
export async function verifyLoginCode(
  email: string,
  code: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT id, code_hash, attempts
    FROM login_codes
    WHERE email = ${email}
      AND consumed_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return false;

  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    // Too many attempts — invalidate the code.
    await sql`UPDATE login_codes SET consumed_at = now() WHERE id = ${row.id}`;
    return false;
  }

  const submittedHash = await hashCode(email, code);
  if (submittedHash !== row.code_hash) {
    await sql`UPDATE login_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;
    return false;
  }

  await sql`UPDATE login_codes SET consumed_at = now() WHERE id = ${row.id}`;
  return true;
}
