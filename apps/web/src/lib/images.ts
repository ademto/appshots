/**
 * Image upload + project image resolution.
 *
 * Images are added to projects as `data:` URLs for instant, offline-friendly
 * UX. Before a project is pushed to the cloud, `resolveProjectImages` uploads
 * any remaining `data:` images to R2 and rewrites them to public URLs. This one
 * mechanism covers both newly-added images and the one-time migration of
 * pre-existing base64 images.
 */
import type { Project } from "@appshots/shared";
import { apiFetch, API_URL } from "./api";

const dataUrlCache = new Map<string, string>();

function isDataUrl(src: string | null | undefined): src is string {
  return typeof src === "string" && src.startsWith("data:");
}

async function dataUrlToFile(dataUrl: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
  return new File([blob], `image.${ext}`, { type: blob.type });
}

/**
 * Uploads a single data URL to R2 and returns the public URL. Cached so the
 * same base64 image isn't uploaded twice within a session.
 */
export async function uploadDataUrl(dataUrl: string): Promise<string> {
  const cached = dataUrlCache.get(dataUrl);
  if (cached) return cached;

  const file = await dataUrlToFile(dataUrl);
  const form = new FormData();
  form.append("file", file);

  const res = await apiFetch<{ url: string }>("/uploads", {
    method: "POST",
    body: form,
  });
  dataUrlCache.set(dataUrl, res.url);
  return res.url;
}

/**
 * Returns a copy of the project with every `data:` image (device screenshots
 * and overlay images) replaced by an uploaded R2 URL. Non-data URLs are left
 * untouched. If an upload fails, the original data URL is kept so nothing is
 * lost; the caller can retry on the next push.
 */
export async function resolveProjectImages(project: Project): Promise<Project> {
  let changed = false;

  const screenshots = await Promise.all(
    project.screenshots.map(async (screenshot) => {
      const devices = await Promise.all(
        screenshot.devices.map(async (device) => {
          if (isDataUrl(device.screenshotSrc)) {
            try {
              const url = await uploadDataUrl(device.screenshotSrc);
              changed = true;
              return { ...device, screenshotSrc: url };
            } catch {
              return device;
            }
          }
          return device;
        }),
      );

      const overlayImages = await Promise.all(
        screenshot.overlayImages.map(async (img) => {
          if (isDataUrl(img.src)) {
            try {
              const url = await uploadDataUrl(img.src);
              changed = true;
              return { ...img, src: url };
            } catch {
              return img;
            }
          }
          return img;
        }),
      );

      return { ...screenshot, devices, overlayImages };
    }),
  );

  if (!changed) return project;
  return { ...project, screenshots };
}

export { API_URL };
