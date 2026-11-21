/**
 * Level names from /api/levels may already start with the level code ("J5 — Sơ cấp").
 * UI that renders the code as its own heading uses this to show the code exactly once.
 */
export function levelNameWithoutCode(name: string | null | undefined, code: string): string {
  const value = (name ?? "").trim();
  if (!code || value === code) return value === code ? "" : value;
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value.replace(new RegExp(`^${escaped}\\s*[—–\\-:：]\\s*`), "").trim();
}
