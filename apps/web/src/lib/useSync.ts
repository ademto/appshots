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
  anonProjectsClaimed,
  clearOutbox,
  enqueueDelete,
  enqueueUpsert,
  flushOutbox,
  markAnonProjectsClaimed,
  mergeProjects,
  pullRemoteProjects,
} from "./sync";
import { pushProject } from "./projects-client";
import { resolveProjectImages } from "./images";

const PUSH_DEBOUNCE_MS = 1200;

interface UseSyncArgs {
  projects: Project[];
  /** Merge pulled projects into the editor (used for live sync reconciliation). */
  onRemoteProjects: (merged: Project[]) => void;
  /**
   * Replace the editor's projects entirely with this account's cloud projects.
   * Used on sign-in so one account never shows another account's work.
   */
  onReplaceProjects: (projects: Project[]) => void;
  /**
   * Called on an actual logout (signed-in -> signed-out) so the editor clears
   * the previous account's data and starts from a clean default.
   */
  onSignedOut: () => void;
}

export function useSync({
  projects,
  onRemoteProjects,
  onReplaceProjects,
  onSignedOut,
}: UseSyncArgs) {
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
        const remote = await pullRemoteProjects();
        if (cancelled) return;

        // First account ever on this machine: claim the anonymous local
        // projects by uploading them. Every later account skips this so one
        // account's work never leaks into another.
        const shouldMigrateLocal = !anonProjectsClaimed();

        if (shouldMigrateLocal) {
          await flushOutbox();
          const local = projectsRef.current;
          const merged = mergeProjects(local, remote);
          const remoteById = new Map(remote.map((p) => [p.id, p]));
          const resolvedMerged: Project[] = [];
          for (const p of merged) {
            const r = remoteById.get(p.id);
            if (!r || p.updatedAt > r.updatedAt) {
              const resolved = await resolveProjectImages(p).catch(() => p);
              resolvedMerged.push(resolved);
              try {
                await pushProject(resolved);
              } catch {
                enqueueUpsert(resolved);
              }
            } else {
              resolvedMerged.push(p);
            }
          }
          markAnonProjectsClaimed();
          lastSnapshot.current = new Map(resolvedMerged.map((p) => [p.id, p]));
          onReplaceProjects(resolvedMerged);
        } else {
          // Subsequent account: this account's cloud projects ARE the truth.
          // Do not upload local projects. Clear any stale outbox from a
          // previous account so it can't flush into this one.
          const sorted = [...remote].sort((a, b) => b.updatedAt - a.updatedAt);
          lastSnapshot.current = new Map(sorted.map((p) => [p.id, p]));
          onReplaceProjects(sorted);
        }
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

  // Handle sign-out. Distinguish a real logout (was signed-in) from the
  // initial load (loading -> signed-out), which must NOT wipe anonymous local
  // projects.
  const prevStatus = useRef(status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;

    if (status === "signed-out") {
      hydratedForUser.current = null;
      lastSnapshot.current = new Map();
      // Cancel any pending debounced pushes from the previous account.
      for (const t of pushTimers.current.values()) clearTimeout(t);
      pushTimers.current.clear();

      if (was === "signed-in") {
        // Real logout: clear the previous account's outbox and reset the editor
        // so nothing bleeds into the next account.
        clearOutbox();
        onSignedOut();
      }
    }
  }, [status, onSignedOut]);

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
          // Upload any base64 images to R2 first, then push the URL version.
          const resolved = await resolveProjectImages(project).catch(
            () => project,
          );
          const res = await pushProject(resolved);
          const winner = res.conflict ? res.project : resolved;
          // Hand the result back so the editor swaps base64 -> URLs locally
          // (and reconciles any server-newer copy).
          onRemoteProjects(mergeProjects(projectsRef.current, [winner]));
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
