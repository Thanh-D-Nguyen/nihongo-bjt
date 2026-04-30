import type { ReactNode } from "react";

export type AdminNavItemStatus = "implemented" | "scaffold" | "hidden";

/** Static definition (app layer); not i18n-resolved. */
export type AdminNavItemDefinition = {
  /**
   * When the feature flag is **explicitly** false in the flag map, show a disabled row instead of hiding.
   * If omitted, a disabled feature flag **hides** the item.
   */
  featureOffBehavior?: "hide" | "disabled";
  featureFlag?: string;
  href: string;
  icon?: string;
  id: string;
  labelKey: string;
  /**
   * `exact` = active only on exact path; `prefix` = also active for nested child routes.
   * Use `exact` for hub routes that have deeper siblings in the same section (e.g. `/iam` vs `/iam/roles`).
   */
  activeMatch?: "exact" | "prefix";
  /** One of these permissions required (OR). Omitted = visible to all authenticated admins when permissions unknown. */
  permissions?: string | string[];
  status: AdminNavItemStatus;
};

export type AdminNavGroupDefinition = {
  defaultExpanded?: boolean;
  id: string;
  items: AdminNavItemDefinition[];
  labelKey: string;
  sectionCollapsible: boolean;
};

export type AdminNavItemResolved = {
  activeMatch: "exact" | "prefix";
  featureDisabled?: boolean;
  href: string;
  icon?: ReactNode;
  id: string;
  label: string;
  status: AdminNavItemStatus;
};

export type AdminNavGroupResolved = {
  defaultExpanded?: boolean;
  id: string;
  items: AdminNavItemResolved[];
  label: string;
  sectionCollapsible: boolean;
};
