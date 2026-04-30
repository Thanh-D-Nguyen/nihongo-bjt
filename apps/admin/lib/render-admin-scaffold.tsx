import en from "../messages/en.json";
import ja from "../messages/ja.json";
import vi from "../messages/vi.json";
import { AdminModuleScaffold } from "../app/_components/admin-module-scaffold";
import { ADMIN_SCAFFOLD_SPEC, type AdminScaffoldId } from "./admin-scaffold-spec";
import { getShellNavLabel } from "./resolve-admin-nav";

const messages = { en, ja, vi };

type Locale = "en" | "ja" | "vi";

function scaffoldLabels(t: (typeof vi)["scaffold"]): {
  apiPrefixLabel: string;
  modulePurposeIntro: string;
  permLabel: string;
  statusScaffold: string;
} {
  return {
    apiPrefixLabel: t.apiPrefixLabel,
    modulePurposeIntro: t.modulePurposeIntro,
    permLabel: t.permLabel,
    statusScaffold: t.statusScaffold
  };
}

/**
 * Renders a canonical admin scaffold for a nav module id. Throws if the id is not in the spec registry.
 */
export function renderAdminScaffoldForId(moduleId: AdminScaffoldId, locale: string) {
  if (locale !== "ja" && locale !== "vi" && locale !== "en") {
    return renderAdminScaffoldForId(moduleId, "vi");
  }
  const l = locale as Locale;
  const t = messages[l];
  const spec = ADMIN_SCAFFOLD_SPEC[moduleId];
  const title = getShellNavLabel(
    { navGroups: t.shell.navGroups, navItems: t.shell.navItems },
    spec.labelKey
  );
  return (
    <AdminModuleScaffold
      apiPrefix={spec.api}
      labels={scaffoldLabels(t.scaffold)}
      permissionHint={spec.permissions}
      title={title}
    />
  );
}
