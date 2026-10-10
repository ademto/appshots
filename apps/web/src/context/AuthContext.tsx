/**
 * AuthContext — session state and email-OTP sign-in actions.
 *
 * On mount it checks the existing session via /auth/me. The rest of the app
 * reads `user` / `status` to decide between local-only and cloud-synced modes.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getMe,
  logout as apiLogout,
  requestCode as apiRequestCode,
  verifyCode as apiVerifyCode,
  type AuthUser,
} from "../lib/auth-client";

type AuthStatus = "loading" | "signed-in" | "signed-out";

interface AuthContextType {
  user: AuthUser | null;
  status: AuthStatus;
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus(u ? "signed-in" : "signed-out");
      })
      .catch(() => {
        // Network/API down: treat as signed-out, app stays local-only.
        if (cancelled) return;
        setUser(null);
        setStatus("signed-out");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestCode = useCallback(async (email: string) => {
    await apiRequestCode(email);
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const u = await apiVerifyCode(email, code);
    setUser(u);
    setStatus("signed-in");
    return u;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setStatus("signed-out");
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, status, requestCode, verifyCode, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
