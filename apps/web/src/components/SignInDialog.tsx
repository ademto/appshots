/**
 * SignInDialog — email OTP sign-in.
 *
 * Step 1: enter email -> request code.
 * Step 2: enter the 6-digit code -> verify -> signed in.
 */
import { useState } from "react";
import { X, Loader2, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SignInDialog = ({ isOpen, onClose }: Props) => {
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setStep("email");
    setEmail("");
    setCode("");
    setError(null);
    setLoading(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestCode(email.trim());
      setStep("code");
    } catch {
      setError("Couldn't send a code. Check the email and try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyCode(email.trim(), code.trim());
      close();
    } catch {
      setError("That code didn't work. It may be wrong or expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-title"
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <button
          onClick={close}
          className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="mb-5 flex items-center gap-2">
          <Mail size={18} className="text-violet-400" />
          <h2 id="signin-title" className="text-lg font-semibold text-white">
            {step === "email" ? "Sign in to sync" : "Enter your code"}
          </h2>
        </div>

        {step === "email" ? (
          <form onSubmit={submitEmail} className="space-y-3">
            <p className="text-sm text-zinc-400">
              Sync your projects across devices. We'll email you a one-time code.
            </p>
            <label className="block">
              <span className="sr-only">Email address</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Send code
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-3">
            <p className="text-sm text-zinc-400">
              Enter the 6-digit code sent to{" "}
              <span className="text-zinc-200">{email}</span>.
            </p>
            <label className="block">
              <span className="sr-only">Verification code</span>
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-center text-lg tracking-[0.4em] text-white outline-none focus:border-violet-500"
              />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Verify & sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
