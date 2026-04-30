/**
 * Optional client-side feature flags for admin nav and shells.
 * Set `NEXT_PUBLIC_ADMIN_FEATURE_FLAGS` to JSON, e.g. `{"adminNav.battle":true}` to enable.
 * Keys in `ADMIN_FEATURE_FLAG_DEFAULTS_OFF` are **off by default** unless explicitly enabled via env.
 * Other keys omitted from the env object default to **enabled**.
 */

/**
 * Feature flag keys that are disabled by default for MVP.
 * - `adminNav.battle`: battle admin is feature_disabled_for_mvp (PHASE-11 scope).
 * - `adminNav.phase11.*`: all PHASE-11 deferred admin groups are hidden until phase-11 ships.
 *
 * To enable in development or staging, set:
 * `NEXT_PUBLIC_ADMIN_FEATURE_FLAGS='{"adminNav.battle":true,"adminNav.phase11.assessment":true}'`
 */
const ADMIN_FEATURE_FLAG_DEFAULTS_OFF: readonly string[] = [];

export function readClientAdminFeatureFlags(): Record<string, boolean> {
  if (typeof process === "undefined" || !process.env.NEXT_PUBLIC_ADMIN_FEATURE_FLAGS) {
    return {};
  }
  try {
    return JSON.parse(process.env.NEXT_PUBLIC_ADMIN_FEATURE_FLAGS) as Record<string, boolean>;
  } catch {
    return {};
  }
}

/**
 * Returns `true` if the feature is off (item should be hidden/disabled).
 * Env override always takes precedence; then defaults-off list; then enabled by default.
 */
export function isAdminFeatureExplicitlyOff(key: string | undefined, flags: Record<string, boolean>): boolean {
  if (!key) {
    return false;
  }
  // Explicit env override takes precedence (can turn a default-off feature on)
  if (Object.hasOwn(flags, key)) {
    return flags[key] === false;
  }
  // Features that are off by default for MVP / PHASE-11 deferral
  return (ADMIN_FEATURE_FLAG_DEFAULTS_OFF as string[]).includes(key);
}
