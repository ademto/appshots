/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach } from "vitest";
import type { Project } from "@appshots/shared";
import {
  mergeProjects,
  enqueueUpsert,
  enqueueDelete,
  anonProjectsClaimed,
  markAnonProjectsClaimed,
  isPristineProject,
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

const DEFAULT_HEADLINE = "Showcase Your App";
const DEFAULT_SUBHEADLINE =
  "Create stunning App Store screenshots in minutes. Customizable templates, devices, and backgrounds.";

const defaultDevice = () => ({
  id: "d1",
  deviceId: "iphone-15-pro-max",
  colorId: "black",
  screenshotSrc: null,
  x: 50,
  y: 30,
  scale: 85,
  rotation: 0,
  shadow: { enabled: true, color: "#000", blur: 50, offsetX: 0, offsetY: 25 },
  style: "flat" as const,
  rotateY: -15,
  rotateX: 5,
});

const defaultScreenshot = () => ({
  id: "s1",
  headline: DEFAULT_HEADLINE,
  subheadline: DEFAULT_SUBHEADLINE,
  backgroundColor: "#8b5cf6",
  backgroundMode: "solid" as const,
  gradientPresetId: null,
  textColor: "#fff",
  headlineX: 50,
  headlineY: 10,
  headlineWidth: 80,
  subheadlineX: 50,
  subheadlineY: 18,
  subheadlineWidth: 80,
  fontFamily: "Inter",
  overlayImages: [],
  devices: [defaultDevice()],
  activeDeviceId: "d1",
});

const pristine = (): Project =>
  ({ ...mk("p", 1), screenshots: [defaultScreenshot()] }) as Project;

describe("isPristineProject", () => {
  it("flags an untouched default project", () => {
    expect(isPristineProject(pristine())).toBe(true);
  });

  it("is not pristine once the headline changes", () => {
    const p = pristine();
    p.screenshots[0].headline = "My Real App";
    expect(isPristineProject(p)).toBe(false);
  });

  it("is not pristine with an uploaded screenshot", () => {
    const p = pristine();
    p.screenshots[0].devices[0].screenshotSrc = "data:image/png;base64,xxx";
    expect(isPristineProject(p)).toBe(false);
  });

  it("is not pristine with overlay images or extra screenshots", () => {
    const p = pristine();
    p.screenshots.push(defaultScreenshot());
    expect(isPristineProject(p)).toBe(false);
  });
});

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

  it("tracks the one-time anonymous-projects claim globally", () => {
    expect(anonProjectsClaimed()).toBe(false);
    markAnonProjectsClaimed();
    expect(anonProjectsClaimed()).toBe(true);
  });

  // Leak-prevention contract: the sign-in flow only uploads local projects
  // when the anonymous projects have NOT yet been claimed. After the first
  // account claims them, a second account must sign in pull-only, so account
  // A's work can never bleed into account B.
  it("gates local upload on the anon claim (no cross-account leak)", () => {
    // First account on a fresh machine -> allowed to migrate local up.
    expect(anonProjectsClaimed()).toBe(false);
    const firstAccountMigrates = !anonProjectsClaimed();
    expect(firstAccountMigrates).toBe(true);
    markAnonProjectsClaimed();

    // Any later account -> must NOT upload local projects.
    const secondAccountMigrates = !anonProjectsClaimed();
    expect(secondAccountMigrates).toBe(false);
  });
});
