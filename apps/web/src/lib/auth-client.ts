/**
 * Auth API calls (email OTP).
 */
import { apiFetch, ApiError } from "./api";

export interface AuthUser {
  id: string;
  email: string;
}

export async function requestCode(email: string): Promise<void> {
  await apiFetch("/auth/request-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyCode(
  email: string,
  code: string,
): Promise<AuthUser> {
  const res = await apiFetch<{ user: AuthUser }>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  return res.user;
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await apiFetch<{ user: AuthUser }>("/auth/me");
    return res.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}
