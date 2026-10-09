/**
 * Applies the SQL schema. Idempotent — run with `bun run migrate`.
 */
import { sql } from "./client";

const schema = await Bun.file(new URL("./schema.sql", import.meta.url)).text();

console.log("Applying schema...");
await sql.unsafe(schema);
console.log("Schema applied.");

await sql.end();
