/**
 * useSync — bridges auth + the editor's project list to cloud sync.
 *
 * - On sign-in: flush any pending outbox, pull remote, merge with local
 *   (last-write-wins), push any local-only/newer projects (one-time migration
 *   is just the first such push), and hand the merged list back to the editor.
 * - While signed in: debounce project changes and push changed projects; failed
 *   pushes fall into the outbox for retry.
 * - Signed out: no-op. The editor keeps working on localStorage alone.
 */
import { useEffect, useRef } from "react";
import type { Project } from "@appshots/shared";
import { useAuth } from "../context/AuthContext";
import {
  enqueueDelete,
  enqueueUpsert,
  flushOutbox,
  hasMigrated,
  markMigrated,
  mergeProjects,
  pullRemoteProjects,
} from "./sync";
import { pushProject } from "./projects-client";

const PUSH_DEBOUNCE_MS = 1200;

interface UseSyncArgs {
  projects: Project[];
  /** Called with the merged project list after a pull, to hydrate the editor. */
  onRemoteProjects: (merged: Project[]) => void;
}

export function useSync({ projects, onRemoteProjects }: UseSyncArgs) {
  const { user, status } = useAuth();

  // Snapshot of what we last saw, to detect which projects changed / were removed.
  const lastSnapshot = useRef<Map<string, Project>>(new Map());
  const pushTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const hydratedForUser = useRef<string | null>(null);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  // --- Initial pull + merge + migration on sign-in ---
  useEffect(() => {
    if (status !== "signed-in" || !user) return;
    if (hydratedForUser.current === user.id) return;
    hydratedForUser.current = user.id;

    let cancelled = false;
    (async () => {
      try {
        // Push anything stuck in the outbox first.
        await flushOutbox();

        const remote = await pullRemoteProjects();
        if (cancelled) return;

        const local = projectsRef.current;
        const merged = mergeProjects(local, remote);

        // Upload local projects that are new or newer than remote.
        const remoteById = new Map(remote.map((p) => [p.id, p]));
        const firstMigration = !hasMigrated(user.id);
        for (const p of merged) {
          const r = remoteById.get(p.id);
          if (!r || p.updatedAt > r.updatedAt) {
            try {
              await pushProject(p);
            } catch {
              enqueueUpsert(p);
            }
          }
        }
        if (firstMigration) markMigrated(user.id);

        // Seed the change-detection snapshot with the merged set.
        lastSnapshot.current = new Map(merged.map((p) => [p.id, p]));
        onRemoteProjects(merged);
      } catch {
        // Pull failed (offline/API down). Stay local-only; snapshot current.
        lastSnapshot.current = new Map(
          projectsRef.current.map((p) => [p.id, p]),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, user, onRemoteProjects]);

  // Reset hydration flag on sign-out so a future sign-in re-pulls.
  useEffect(() => {
    if (status === "signed-out") {
      hydratedForUser.current = null;
      lastSnapshot.current = new Map();
    }
  }, [status]);

  // --- Push on change (debounced per project) ---
  useEffect(() => {
    if (status !== "signed-in" || !user) return;
    if (hydratedForUser.current !== user.id) return; // wait until initial hydrate

    const prev = lastSnapshot.current;
    const nextSnapshot = new Map<string, Project>();

    for (const p of projects) {
      nextSnapshot.set(p.id, p);
      const before = prev.get(p.id);
      if (!before || before.updatedAt !== p.updatedAt || before !== p) {
        schedulePush(p);
      }
    }

    // Detect deletions.
    for (const id of prev.keys()) {
      if (!nextSnapshot.has(id)) {
        enqueueDelete(id);
        void flushOutbox();
      }
    }

    lastSnapshot.current = nextSnapshot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, status, user]);

  function schedulePush(project: Project) {
    const timers = pushTimers.current;
    const existing = timers.get(project.id);
    if (existing) clearTimeout(existing);
    timers.set(
      project.id,
      setTimeout(async () => {
        timers.delete(project.id);
        try {
          const res = await pushProject(project);
          if (res.conflict) {
            // Server had a newer copy; reconcile by handing it back.
            onRemoteProjects(
              mergeProjects(projectsRef.current, [res.project]),
            );
          }
        } catch {
          enqueueUpsert(project);
        }
      }, PUSH_DEBOUNCE_MS),
    );
  }

  // Flush outbox when connectivity returns.
  useEffect(() => {
    const onOnline = () => {
      if (status === "signed-in") void flushOutbox();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [status]);
}
