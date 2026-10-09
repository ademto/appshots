/**
 * Environment configuration with fail-fast validation.
 *
 * Required vars throw at startup if missing (R8.3). Email delivery is deferred
 * for v1 (EMAIL_PROVIDER=console logs codes to the console), so no email
 * provider credentials are required to run. R2 vars are only required once
 * image upload is exercised; they are validated lazily in storage/r2.ts.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  // Server
  PORT: Number(optional("PORT", "3000")),
  NODE_ENV: optional("NODE_ENV", "development"),

  // Database
  DATABASE_URL: required("DATABASE_URL"),

  // Sessions
  SESSION_SECRET: required("SESSION_SECRET"),
  SESSION_TTL_DAYS: Number(optional("SESSION_TTL_DAYS", "30")),

  // Email (deferred for v1): console | ses | ...
  EMAIL_PROVIDER: optional("EMAIL_PROVIDER", "console"),

  // CORS / web origin (for credentialed cookie requests)
  WEB_ORIGIN: optional("WEB_ORIGIN", "http://localhost:5173"),

  // Cloudflare R2 (validated lazily in storage/r2.ts)
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ?? "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "",
  R2_BUCKET: process.env.R2_BUCKET ?? "appshots",
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL ?? "",
} as const;

export const isProd = env.NODE_ENV === "production";
