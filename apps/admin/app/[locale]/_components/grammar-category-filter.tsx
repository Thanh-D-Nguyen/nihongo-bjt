"use client";

import {
  GRAMMAR_CATEGORY_GROUP_SPECS,
  mapGrammarCategoryToGroupId
} from "@nihongo-bjt/shared/grammar-category-taxonomy";
import { type ReactNode, useMemo } from "react";

import { cn } from "@nihongo-bjt/ui";

const btnBase =
  "w-full text-left rounded-lg border border-ink/12 bg-white px-2.5 py-1.5 text-xs text-ink shadow-sm transition hover:border-accent/30 hover:bg-accent/5";

function AdminFilterField({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold leading-snug text-ink/80">{label}</span>
      {children}
    </div>
  );
}

export type GrammarFilterLabels = {
  all: string;
  categoryFilterTitle: string;
  clearSelection: string;
  emptySubs: string;
  filterByGroup: string;
  subLabel: string;
  subheading: string;
};

type Props = {
  extra: Record<string, string>;
  groupLabels: Record<string, string>;
  labels: GrammarFilterLabels;
  onChange: (next: { category: string; categoryGroup: string }) => void;
  rawCategoryCounts: Record<string, number> | undefined;
};

function subsForGroup(groupId: string, raw: Record<string, number> | undefined) {
  const fromSpec = new Set(
    GRAMMAR_CATEGORY_GROUP_SPECS.find((g) => g.id === groupId)?.exact.map((e) => String(e)) ?? []
  );
  if (raw) {
    for (const k of Object.keys(raw)) {
      if (k === "—") {
        continue;
      }
      if (mapGrammarCategoryToGroupId(k) === groupId) {
        fromSpec.add(k);
      }
    }
  }
  return [...fromSpec].sort((a, b) => a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" }));
}

const EXTRA_GROUP_IDS = ["uncategorized", "other"] as const;

export function GrammarCategoryFilter({ extra, groupLabels, labels, onChange, rawCategoryCounts }: Props) {
  const activeCategory = extra.category?.trim() ?? "";
  const activeGroup = extra.categoryGroup?.trim() ?? "";

  const rows = useMemo(() => {
    const a = GRAMMAR_CATEGORY_GROUP_SPECS.map((g) => g.id);
    return [...a, ...EXTRA_GROUP_IDS] as const;
  }, []);

  return (
    <AdminFilterField className="sm:col-span-2 lg:col-span-2" label={labels.categoryFilterTitle}>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-ink/10 bg-white/90 p-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 pb-2">
          <button
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium",
              !activeCategory && !activeGroup ? "bg-accent text-white" : "bg-ink/5 text-ink hover:bg-ink/10"
            )}
            onClick={() => onChange({ category: "", categoryGroup: "" })}
            type="button"
          >
            {labels.all}
          </button>
          <button
            className="rounded-md bg-ink/5 px-2.5 py-1 text-xs text-ink hover:bg-ink/10"
            onClick={() => onChange({ category: "", categoryGroup: "" })}
            type="button"
          >
            {labels.clearSelection}
          </button>
        </div>
        <p className="text-[11px] text-ink/70">{labels.subheading}</p>
        <div className="space-y-1.5">
          {rows.map((gid) => {
            const gLabel = groupLabels[gid] ?? gid;
            const subs = subsForGroup(gid, rawCategoryCounts);
            const groupActive = activeGroup === gid && !activeCategory;
            const canFilterWholeGroup = gid !== "other";
            if (gid === "other") {
              return (
                <details className="rounded-lg border border-ink/8" key={gid}>
                  <summary className="cursor-pointer list-none px-2 py-1.5 text-sm font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                    {gLabel}
                  </summary>
                  <div className="border-t border-ink/8 px-2 pb-2 pt-1">
                    <p className="mb-1.5 text-[10px] text-ink/55">{labels.subLabel}</p>
                    {subs.length === 0 ? (
                      <p className="text-[11px] text-ink/55">{labels.emptySubs}</p>
                    ) : (
                      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {subs.map((sub) => {
                          const isSub = activeCategory === sub && !activeGroup;
                          return (
                            <li key={sub}>
                              <button
                                className={cn(
                                  btnBase,
                                  isSub ? "border-accent bg-accent/10 ring-1 ring-accent/25" : ""
                                )}
                                onClick={() => onChange({ category: sub, categoryGroup: "" })}
                                type="button"
                              >
                                <span className="line-clamp-2 break-words">{sub}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </details>
              );
            }
            return (
              <details
                className="group rounded-lg border border-ink/8 bg-ink/[0.02] open:border-accent/20"
                key={gid}
              >
                <summary className="cursor-pointer list-none px-2 py-1.5 text-sm font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1">{gLabel}</span>
                    {canFilterWholeGroup && (subs.length > 0 || gid === "uncategorized") ? (
                      <button
                        className={cn(
                          "shrink-0 rounded border px-2 py-0.5 text-[11px]",
                          groupActive
                            ? "border-accent bg-accent/15 text-ink"
                            : "border-ink/15 bg-white text-ink/80 hover:border-accent/30"
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onChange({ category: "", categoryGroup: gid });
                        }}
                        type="button"
                      >
                        {labels.filterByGroup}
                      </button>
                    ) : null}
                  </div>
                </summary>
                <div className="border-t border-ink/8 px-2 pb-2 pt-1">
                  <p className="mb-1.5 text-[10px] font-medium text-ink/60">{labels.subLabel}</p>
                  {subs.length === 0 ? (
                    <p className="text-[11px] text-ink/55">{labels.emptySubs}</p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {subs.map((sub) => {
                        const isSub = activeCategory === sub && !activeGroup;
                        return (
                          <li key={sub}>
                            <button
                              className={cn(
                                btnBase,
                                isSub ? "border-accent bg-accent/10 ring-1 ring-accent/25" : ""
                              )}
                              onClick={() => onChange({ category: sub, categoryGroup: "" })}
                              type="button"
                            >
                              <span className="line-clamp-2 break-words">{sub}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </AdminFilterField>
  );
}
