/**
 * Project sync API calls.
 */
import type { Project } from "@appshots/shared";
import { apiFetch, ApiError } from "./api";

export async function fetchProjects(): Promise<Project[]> {
  const res = await apiFetch<{ projects: Project[] }>("/projects");
  return res.projects;
}

export interface PushResult {
  project: Project;
  /** True when the server kept a newer stored copy (409). */
  conflict: boolean;
}

/**
 * Upserts a project. On a last-write-wins conflict (server copy newer), returns
 * the server's project with `conflict: true` instead of throwing.
 */
export async function pushProject(project: Project): Promise<PushResult> {
  try {
    const res = await apiFetch<{ project: Project }>(
      `/projects/${project.id}`,
      {
        method: "PUT",
        body: JSON.stringify({ project }),
      },
    );
    return { project: res.project, conflict: false };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const body = err.body as { project: Project };
      return { project: body.project, conflict: true };
    }
    throw err;
  }
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetch(`/projects/${id}`, { method: "DELETE" });
}
