import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { loadGoogleFonts } from "../lib/google-fonts";
import { EditorProvider } from "../context/EditorContext";
import { AuthProvider } from "../context/AuthContext";
import { EditorLayout } from "../components/EditorLayout";

const RouteComponent = () => {
  useEffect(() => {
    loadGoogleFonts();
  }, []);

  return (
    <AuthProvider>
      <EditorProvider>
        <EditorLayout />
      </EditorProvider>
    </AuthProvider>
  );
};

export const Route = createFileRoute("/")({
  component: RouteComponent,
});
