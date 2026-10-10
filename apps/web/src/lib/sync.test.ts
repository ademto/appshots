/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach } from "vitest";
import type { Project } from "@appshots/shared";
import {
  mergeProjects,
  enqueueUpsert,
  enqueueDelete,
  hasMigrated,
  markMigrated,
} from "./sync";

const mk = (id: string, updatedAt: number, name = id): Project =>
  ({
    id,
    name,
    createdAt: 0,
    updatedAt,
    screenshots: [],
    selectedDeviceId: "iphone-15-pro-max",
    selectedColorId: "black",
    exportSizeId: "6.7",
    activeScreenshotId: "s1",
    headlineFontSize: 72,
    subheadlineFontSize: 42,
  }) as Project;

describe("mergeProjects (last-write-wins)", () => {
  it("keeps the newer copy per id", () => {
    const local = [mk("a", 100, "local-a"), mk("b", 500, "local-b")];
    const remote = [mk("a", 300, "remote-a"), mk("c", 50, "remote-c")];
    const merged = mergeProjects(local, remote);
    const byId = Object.fromEntries(merged.map((p) => [p.id, p]));
    expect(byId.a.name).toBe("remote-a"); // remote newer
    expect(byId.b.name).toBe("local-b"); // local only
    expect(byId.c.name).toBe("remote-c"); // remote only
    expect(merged).toHaveLength(3);
  });

  it("prefers local when strictly newer", () => {
    const merged = mergeProjects([mk("a", 900, "local")], [mk("a", 100)]);
    expect(merged[0].name).toBe("local");
  });
});

describe("outbox + migration markers", () => {
  beforeEach(() => localStorage.clear());

  it("coalesces repeated upserts for the same id", () => {
    enqueueUpsert(mk("a", 1));
    enqueueUpsert(mk("a", 2));
    const raw = JSON.parse(localStorage.getItem("appshots-sync-outbox")!);
    expect(raw).toHaveLength(1);
    expect(raw[0].project.updatedAt).toBe(2);
  });

  it("delete removes a pending upsert for the same id", () => {
    enqueueUpsert(mk("a", 1));
    enqueueDelete("a");
    const raw = JSON.parse(localStorage.getItem("appshots-sync-outbox")!);
    expect(raw).toHaveLength(1);
    expect(raw[0]).toEqual({ kind: "delete", id: "a" });
  });

  it("tracks one-time migration per user", () => {
    expect(hasMigrated("u1")).toBe(false);
    markMigrated("u1");
    expect(hasMigrated("u1")).toBe(true);
    expect(hasMigrated("u2")).toBe(false);
  });
});
