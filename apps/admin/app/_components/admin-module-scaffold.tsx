import type { ReactNode } from "react";

import { AdminPageHeader } from "@nihongo-bjt/ui";

type Labels = {
  apiPrefixLabel: string;
  modulePurposeIntro: string;
  permLabel: string;
  statusScaffold: string;
};

/**
 * Real “not yet implemented” surface — no production KPIs or fake tables.
 * Title comes from the same i18n key as the sidebar label.
 */
export function AdminModuleScaffold({
  apiPrefix,
  children,
  permissionHint,
  title,
  labels
}: {
  apiPrefix: string;
  children?: ReactNode;
  /** OR-list of required permission codes (same as nav) */
  permissionHint: string;
  title: string;
  labels: Labels;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <AdminPageHeader description={labels.modulePurposeIntro} title={title} />
      <div className="admin-card space-y-4 p-5">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-amber-800">{labels.statusScaffold}</span>
        </p>
        <dl className="grid gap-3 text-sm text-slate-800">
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">{labels.permLabel}</dt>
            <dd className="mt-1 font-mono text-xs text-slate-700">{permissionHint}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">{labels.apiPrefixLabel}</dt>
            <dd className="mt-1 font-mono text-xs leading-relaxed text-slate-700">{apiPrefix}</dd>
          </div>
        </dl>
        {children ? <div className="border-t border-slate-200 pt-4 text-sm text-slate-600">{children}</div> : null}
      </div>
    </div>
  );
}
