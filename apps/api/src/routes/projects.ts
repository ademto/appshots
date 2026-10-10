/**
 * Project routes — all scoped to the signed-in user.
 *
 *   GET    /projects       -> list user's projects
 *   GET    /projects/:id   -> one project
 *   PUT    /projects/:id   -> upsert (last-write-wins by updatedAt)
 *   DELETE /projects/:id   -> delete
 *
 * The whole client Project object is stored as JSONB in `projects.data`.
 * `updated_at` mirrors the client's `updatedAt` and drives conflict resolution.
 */
import { Hono } from "hono";
import type { Project } from "@appshots/shared";
import { sql } from "../db/client";
import { requireAuth } from "../auth/middleware";

export const projectRoutes = new Hono();

projectRoutes.use("*", requireAuth);

// bun:sql returns JSONB columns as strings; parse defensively in case a future
// driver version returns an already-parsed object.
function parseProject(data: unknown): Project {
  return (typeof data === "string" ? JSON.parse(data) : data) as Project;
}

// List all projects for the user, newest-updated first.
projectRoutes.get("/", async (c) => {
  const user = c.get("user");
  const rows = await sql`
    SELECT data, updated_at
    FROM projects
    WHERE user_id = ${user.id}
    ORDER BY updated_at DESC
  `;
  const projects = rows.map((r: { data: string }) => parseProject(r.data));
  return c.json({ projects });
});

// Fetch a single project the user owns.
projectRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const rows = await sql`
    SELECT data FROM projects WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
  `;
  if (!rows[0]) return c.json({ error: "not_found" }, 404);
  return c.json({ project: parseProject(rows[0].data) });
});

// Upsert a project. Last-write-wins: if the stored copy is newer than the
// incoming one, keep the stored copy and return it so the client reconciles.
projectRoutes.put("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as
    | { project?: Project }
    | null;
  const project = body?.project;

  if (!project || project.id !== id) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const incomingUpdatedAt = new Date(project.updatedAt);

  const existing = await sql`
    SELECT updated_at FROM projects WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
  `;

  if (existing[0]) {
    const storedUpdatedAt = new Date(existing[0].updated_at);
    if (storedUpdatedAt > incomingUpdatedAt) {
      // Stored version is newer — do not overwrite. Return it to the client.
      const rows = await sql`
        SELECT data FROM projects WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
      `;
      return c.json({ project: parseProject(rows[0].data), conflict: true }, 409);
    }
  }

  await sql`
    INSERT INTO projects (id, user_id, data, updated_at)
    VALUES (${id}, ${user.id}, ${JSON.stringify(project)}::jsonb, ${incomingUpdatedAt})
    ON CONFLICT (user_id, id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
  `;

  return c.json({ project });
});

// Delete a project the user owns.
projectRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await sql`DELETE FROM projects WHERE id = ${id} AND user_id = ${user.id}`;
  return c.json({ ok: true });
});
