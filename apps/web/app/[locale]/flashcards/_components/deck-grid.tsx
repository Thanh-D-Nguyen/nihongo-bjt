"use client";

import type { ReactNode } from "react";

export function DeckGrid({
  mode,
  children
}: {
  mode: "grid" | "list";
  children: ReactNode;
}) {
  if (mode === "list") {
    return <div className="flex flex-col gap-2">{children}</div>;
  }
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">{children}</div>;
}
