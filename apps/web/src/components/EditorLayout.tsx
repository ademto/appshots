import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { CanvasPreview } from "./CanvasPreview";
import { FontPicker } from "./FontPicker";
import { GitHubStarModal } from "./GitHubStarModal";
import { useEditor } from "../context/EditorContext";
import { useAuth } from "../context/AuthContext";
import { SignInDialog } from "./SignInDialog";
import { GITHUB_REPO_URL } from "../constants";
import { Star, X, Cloud, CloudOff, Loader2 } from "lucide-react";
import { useState } from "react";

export const EditorLayout = () => {
  const {
    isFontPickerOpen,
    setIsFontPickerOpen,
    isStarModalOpen,
    setIsStarModalOpen,
    activeScreenshot,
    updateActiveScreenshot,
  } = useEditor();

  const { user, status, signOut } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {showBanner && (
        <div className="flex items-center justify-center gap-2 bg-zinc-800 px-4 py-1.5 text-xs text-zinc-300 relative shrink-0">
          <Star size={12} className="text-yellow-400 fill-yellow-400" />
          <span>
            AppShots is open source —{" "}
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline underline-offset-2 hover:text-zinc-100"
            >
              Star us on GitHub
            </a>
          </span>
          <button
            onClick={() => setShowBanner(false)}
            className="absolute right-3 text-zinc-500 hover:text-zinc-300"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Account bar */}
      <div className="flex items-center justify-end gap-3 bg-[#0f0f0f] px-4 py-1.5 text-xs shrink-0 border-b border-zinc-900">
        {status === "loading" ? (
          <span className="flex items-center gap-1.5 text-zinc-500">
            <Loader2 size={12} className="animate-spin" />
            Checking session…
          </span>
        ) : status === "signed-in" && user ? (
          <>
            <span
              className="flex items-center gap-1.5 text-emerald-400"
              title="Projects sync to the cloud"
            >
              <Cloud size={13} />
              <span className="text-zinc-300">{user.email}</span>
            </span>
            <button
              onClick={() => void signOut()}
              className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowSignIn(true)}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white"
            title="Sign in to sync across devices"
          >
            <CloudOff size={13} />
            Sign in to sync
          </button>
        )}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <CanvasPreview />
        <RightSidebar />
        <FontPicker
          isOpen={isFontPickerOpen}
          onClose={() => setIsFontPickerOpen(false)}
          selectedFontFamily={activeScreenshot.fontFamily}
          onSelect={(fontFamily: string) =>
            updateActiveScreenshot({ fontFamily })
          }
        />
        <GitHubStarModal
          isOpen={isStarModalOpen}
          onClose={() => setIsStarModalOpen(false)}
        />
        <SignInDialog
          isOpen={showSignIn}
          onClose={() => setShowSignIn(false)}
        />
      </div>
    </div>
  );
};
