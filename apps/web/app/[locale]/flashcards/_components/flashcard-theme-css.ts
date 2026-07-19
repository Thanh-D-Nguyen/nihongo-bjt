import { safeFlashcardThemeConfig, type FlashcardThemeConfig } from "@nihongo-bjt/shared";
import type { CSSProperties } from "react";

export type FlashcardThemeCssProperties = CSSProperties & {
  "--flashcard-accent": string;
  "--flashcard-accent-foreground": string;
  "--flashcard-background": string;
  "--flashcard-border": string;
  "--flashcard-content-surface": string;
  "--flashcard-control-background": string;
  "--flashcard-control-foreground": string;
  "--flashcard-focus-ring": string;
  "--flashcard-foreground": string;
  "--flashcard-muted-foreground": string;
  "--flashcard-overlay": string;
};

export function flashcardThemeCss(
  input: FlashcardThemeConfig | Record<string, unknown> | null | undefined
): FlashcardThemeCssProperties {
  const theme = safeFlashcardThemeConfig(input);
  return {
    "--flashcard-accent": theme.accent,
    "--flashcard-accent-foreground": theme.accentForeground,
    "--flashcard-background": theme.background,
    "--flashcard-border": theme.border,
    "--flashcard-content-surface": theme.contentSurface,
    "--flashcard-control-background": theme.controlBackground,
    "--flashcard-control-foreground": theme.controlForeground,
    "--flashcard-focus-ring": theme.focusRing,
    "--flashcard-foreground": theme.foreground,
    "--flashcard-muted-foreground": theme.mutedForeground,
    "--flashcard-overlay": theme.overlay ?? theme.contentSurface,
    background: theme.background,
    borderColor: theme.border,
    borderRadius: theme.borderRadius,
    boxShadow: theme.shadow,
    color: theme.foreground,
    fontFamily: theme.fontFamily
  };
}
