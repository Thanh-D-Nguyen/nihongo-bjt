"use client";

import { useAmbientMode } from "../_hooks/use-ambient-mode";

export function AmbientOverlay() {
  const { active } = useAmbientMode();
  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9] transition-opacity duration-1000"
      style={{
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.03) 100%)",
      }}
    />
  );
}
