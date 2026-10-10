/**
 * Cloud sync primitives for projects.
 *
 * Strategy:
 * - localStorage remains the source of truth locally (offline-first). The app
 *   writes there first; sync is layered on top.
 * - On sign-in we PULL remote projects and MERGE with local by last-write-wins
 *   (max updatedAt per id).
 * - On change we PUSH changed projects (debounced upstream in the hook). Failed
 *   pushes are queued in a localStorage OUTBOX and retried.
 */
import type { Project } from "@appshots/shared";
import { fetchProjects, pushProject, deleteProject } from "./projects-client";

const OUTBOX_KEY = "appshots-sync-outbox";
const MIGRATED_KEY_PREFIX = "appshots-cloud-migrated:";

type OutboxEntry =
  | { kind: "upsert"; project: Project }
  | { kind: "delete"; id: string };

// ---- Outbox (pending writes that failed or occurred offline) ----

function readOutbox(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage errors
  }
}

/** Queue an upsert, replacing any earlier pending write for the same id. */
export function enqueueUpsert(project: Project): void {
  const entries = readOutbox().filter(
    (e) => !(e.kind === "upsert" && e.project.id === project.id),
  );
  entries.push({ kind: "upsert", project });
  writeOutbox(entries);
}

/** Queue a delete, dropping any pending upsert for the same id. */
export function enqueueDelete(id: string): void {
  const entries = readOutbox().filter(
    (e) => !(e.kind === "upsert" && e.project.id === id),
  );
  entries.push({ kind: "delete", id });
  writeOutbox(entries);
}

/**
 * Flush the outbox to the server. Entries that fail stay queued for next time.
 * Returns any server-side newer projects discovered via conflict responses so
 * the caller can reconcile local state.
 */
export async function flushOutbox(): Promise<Project[]> {
  const entries = readOutbox();
  if (entries.length === 0) return [];

  const remaining: OutboxEntry[] = [];
  const reconciled: Project[] = [];

  for (const entry of entries) {
    try {
      if (entry.kind === "upsert") {
        const res = await pushProject(entry.project);
        if (res.conflict) reconciled.push(res.project);
      } else {
        await deleteProject(entry.id);
      }
    } catch {
      // Keep it queued; retry later.
      remaining.push(entry);
    }
  }

  writeOutbox(remaining);
  return reconciled;
}

// ---- Merge (last-write-wins per project id) ----

export function mergeProjects(local: Project[], remote: Project[]): Project[] {
  const byId = new Map<string, Project>();
  for (const p of remote) byId.set(p.id, p);
  for (const p of local) {
    const existing = byId.get(p.id);
    if (!existing || p.updatedAt > existing.updatedAt) {
      byId.set(p.id, p);
    }
  }
  return [...byId.values()];
}

// ---- Pull ----

export async function pullRemoteProjects(): Promise<Project[]> {
  return fetchProjects();
}

// ---- One-time migration marker ----

export function hasMigrated(userId: string): boolean {
  return localStorage.getItem(MIGRATED_KEY_PREFIX + userId) === "1";
}

export function markMigrated(userId: string): void {
  localStorage.setItem(MIGRATED_KEY_PREFIX + userId, "1");
}
