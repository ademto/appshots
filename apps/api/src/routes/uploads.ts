/**
 * Upload route — stores an image in R2 and returns its public URL.
 *
 *   POST /uploads   (multipart/form-data, field "file")   [requireAuth]
 *     -> { url }
 *
 * Images are keyed by `${userId}/${uuid}.${ext}` so they are user-scoped.
 */
import { Hono } from "hono";
import { requireAuth } from "../auth/middleware";
import { putObject } from "../storage/r2";

export const uploadRoutes = new Hono();

uploadRoutes.use("*", requireAuth);

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

uploadRoutes.post("/", async (c) => {
  const user = c.get("user");

  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return c.json({ error: "no_file" }, 400);
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return c.json({ error: "unsupported_type", type: file.type }, 400);
  }

  if (file.size > MAX_BYTES) {
    return c.json({ error: "too_large", maxBytes: MAX_BYTES }, 400);
  }

  const key = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const { url } = await putObject(key, bytes, file.type);
    return c.json({ url });
  } catch (err) {
    console.error("Upload failed:", err);
    return c.json({ error: "upload_failed" }, 502);
  }
});
