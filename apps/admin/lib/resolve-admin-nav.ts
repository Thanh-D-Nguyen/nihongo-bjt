import type { AdminNavGroupDefinition, AdminNavGroupResolved, AdminNavItemResolved } from "@nihongo-bjt/ui";

import { navIcon } from "./admin-nav-icons";
import { isAdminFeatureExplicitlyOff } from "./admin-feature-flags";

/**
 * Resolves i18n keys like `shell.navGroups.overview` using nested `shell.navGroups` / `shell.navItems` maps.
 */
export function getShellNavLabel(
  navLabels: { navGroups: Record<string, string>; navItems: Record<string, string> },
  key: string
): string {
  if (key.startsWith("shell.navGroups.")) {
    const id = key.replace("shell.navGroups.", "");
    return navLabels.navGroups[id] ?? key;
  }
  if (key.startsWith("shell.navItems.")) {
    const id = key.replace("shell.navItems.", "");
    return navLabels.navItems[id] ?? key;
  }
  return key;
}

function canAccessItem(
  permissions: string[] | null,
  required: string | string[] | undefined
): boolean {
  if (!required) {
    return true;
  }
  if (!permissions) {
    return true;
  }
  if (permissions.includes("*")) {
    return true;
  }
  if (Array.isArray(required)) {
    return required.some((c) => permissions.includes(c));
  }
  return permissions.includes(required);
}

export function buildResolvedAdminNav(
  definitions: AdminNavGroupDefinition[],
  getLabel: (key: string) => string,
  locale: string,
  permissions: string[] | null,
  featureFlags: Record<string, boolean>
): AdminNavGroupResolved[] {
  const out: AdminNavGroupResolved[] = [];
  for (const g of definitions) {
    const items: AdminNavItemResolved[] = [];
    for (const i of g.items) {
      if (i.status === "hidden") {
        continue;
      }
      if (!canAccessItem(permissions, i.permissions)) {
        continue;
      }
      if (i.featureFlag && isAdminFeatureExplicitlyOff(i.featureFlag, featureFlags)) {
        if (i.featureOffBehavior !== "disabled") {
          continue;
        }
      }

      const fullHref = i.href === "/" ? `/${locale}` : `/${locale}${i.href}`;
      const featureDisabled = Boolean(
        i.featureFlag && isAdminFeatureExplicitlyOff(i.featureFlag, featureFlags) && i.featureOffBehavior === "disabled"
      );
      const activeMatch = i.activeMatch ?? "prefix";

      items.push({
        activeMatch,
        featureDisabled,
        href: fullHref,
        icon: i.icon ? navIcon(i.icon) : undefined,
        id: i.id,
        label: getLabel(i.labelKey),
        status: i.status
      });
    }
    if (items.length === 0) {
      continue;
    }
    out.push({
      defaultExpanded: g.defaultExpanded,
      id: g.id,
      items,
      label: getLabel(g.labelKey),
      sectionCollapsible: g.sectionCollapsible
    });
  }
  return out;
}
