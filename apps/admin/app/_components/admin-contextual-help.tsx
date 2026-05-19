"use client";

import { ContextualHelpButton } from "@nihongo-bjt/ui";
import { usePathname } from "next/navigation";

import { getAdminHelpContent } from "@/lib/admin-help-content";

/**
 * Auto-resolving contextual help button.
 * Reads current pathname, looks up help content, renders button if content exists.
 */
export function AdminContextualHelp({
  locale,
  overridePath,
  buttonLabel = "Hướng dẫn",
}: {
  locale?: string;
  /** Override automatic path detection */
  overridePath?: string;
  buttonLabel?: string;
}) {
  const pathname = usePathname() ?? "";

  // Strip locale prefix: /vi/content → /content
  const segments = pathname.split("/").filter(Boolean);
  const pathWithoutLocale = segments.length > 1
    ? `/${segments.slice(1).join("/")}`
    : "/";

  const resolvedPath = overridePath ?? pathWithoutLocale;
  const content = getAdminHelpContent(resolvedPath);

  if (!content) return null;

  return (
    <ContextualHelpButton
      buttonLabel={buttonLabel}
      className="shadow-lg shadow-blue-100/50 border-blue-200 bg-white hover:shadow-xl hover:shadow-blue-200/50 transition-shadow"
      content={content}
      locale={locale}
    />
  );
}
