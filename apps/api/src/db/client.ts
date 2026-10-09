/**
 * Postgres client using Bun's built-in SQL driver (bun:sql).
 *
 * Exposes a tagged-template `sql` for parameterized queries, which prevents
 * SQL injection by binding values rather than interpolating them.
 */
import { SQL } from "bun";
import { env } from "../env";

export const sql = new SQL(env.DATABASE_URL);
