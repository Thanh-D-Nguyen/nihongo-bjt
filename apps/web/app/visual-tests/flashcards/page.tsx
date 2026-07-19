import { notFound } from "next/navigation";

import { FlashcardThemeVisualHarness } from "./visual-harness";

export default function FlashcardThemeVisualPage() {
  if (process.env.NODE_ENV === "production" && process.env.FLASHCARD_VISUAL_TESTS !== "1") {
    notFound();
  }
  return <FlashcardThemeVisualHarness />;
}
