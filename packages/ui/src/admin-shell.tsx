"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import type { AdminNavGroupResolved, AdminNavItemResolved } from "./admin-nav-types.js";
import { cn } from "./cn";

export type AdminNavLabels = {
  analytics: string;
  ads: string;
  audit: string;
  bjt: string;
  brand: string;
  content: string;
  daily: string;
  decks: string;
  dictionary: string;
  grammar: string;
  growth: string;
  iam: string;
  import: string;
  kanji: string;
  media: string;
  menuClose: string;
  menuOpen: string;
  monetization: string;
  operationConsole: string;
  overview: string;
  rbacActive: string;
  readingAssist: string;
  secondarySection: string;
  settings: string;
  signOut: string;
  workspace: string;
  users: string;
};

export type AdminShellChromeLabels = {
  brand: string;
  menuClose: string;
  menuOpen: string;
  operationConsole: string;
  rbacActive: string;
  signOut: string;
  workspace: string;
  searchPlaceholder?: string;
  searchClear?: string;
  searchNoResults?: string;
};

function normalizePath(p: string) {
  if (p.length > 1 && p.endsWith("/")) {
    return p.slice(0, -1);
  }
  return p;
}

/**
 * If `activeMatch` is `prefix` (default), the item is also active for deeper paths under the same segment.
 * Use `exact` to avoid a parent (e.g. `/iam`) staying active on child routes (e.g. `/iam/roles`).
 */
export function isAdminNavItemActive(
  itemHref: string,
  baseWithLocale: string,
  normalizedPathWithinLocale: string,
  activeMatch: "exact" | "prefix" = "prefix"
) {
  const path = itemHref.slice(baseWithLocale.length) || "/";
  const a = normalizePath(path.startsWith("/") ? path : `/${path}`);
  const b = normalizePath(normalizedPathWithinLocale);
  if (a === b) {
    return true;
  }
  if (activeMatch === "exact") {
    return false;
  }
  if (a !== "/" && a !== "" && b.startsWith(`${a}/`)) {
    return true;
  }
  return false;
}

function NavItemRow({ active, item }: { active: boolean; item: AdminNavItemResolved }) {
  const href = item.href;
  if (item.featureDisabled) {
    return (
      <div
        className={cn(
          "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-slate-500 opacity-60",
          "cursor-not-allowed"
        )}
        title={item.label}
      >
        {item.icon ? (
          <span
            aria-hidden="true"
            className="flex size-4 shrink-0 items-center justify-center text-slate-500"
          >
            {item.icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
      </div>
    );
  }
  return (
    <a
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-accent/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800",
        active
          ? "bg-white text-slate-950 shadow-sm"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      )}
      href={href}
    >
      {item.icon ? (
        <span
          aria-hidden="true"
          className="flex size-4 shrink-0 items-center justify-center text-slate-300"
        >
          {item.icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-left">
        {item.label}
        {item.status === "scaffold" ? (
          <span className="ml-1 text-[0.7rem] font-normal text-slate-500" title="scaffold">
            ·
          </span>
        ) : null}
      </span>
    </a>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {label}
    </h3>
  );
}

export function AdminShell({
  children,
  chrome,
  locale,
  navGroups,
  normalizedPath
}: {
  children: ReactNode;
  chrome: AdminShellChromeLabels;
  locale: string;
  navGroups: AdminNavGroupResolved[];
  /** Path within locale, e.g. `/` or `/dictionary`. */
  normalizedPath: string;
}) {
  const [open, setOpen] = useState(false);
  const base = `/${locale}`;
  const norm = normalizedPath === "" ? "/" : normalizedPath;

  // Find which group contains the active item
  const activeGroupId = (() => {
    for (const g of navGroups) {
      for (const item of g.items) {
        if (isAdminNavItemActive(item.href, base, norm, item.activeMatch)) {
          return g.id;
        }
      }
    }
    return null;
  })();

  // SSR-safe deterministic default; localStorage is hydrated after mount to avoid SSR/CSR mismatch.
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const s = new Set<string>();
    s.add("overview");
    if (activeGroupId) s.add(activeGroupId);
    return s;
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("admin-nav-expanded");
      if (!stored) return;
      const parsed = JSON.parse(stored) as string[];
      const s = new Set(parsed);
      if (activeGroupId) s.add(activeGroupId);
      setExpandedSections(s);
    } catch {
      /* ignore */
    }
    // activeGroupId only changes on route change; safe to depend on it
  }, [activeGroupId]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const n = new Set(prev);
      if (n.has(sectionId)) {
        n.delete(sectionId);
      } else {
        n.add(sectionId);
      }
      // Persist to localStorage
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("admin-nav-expanded", JSON.stringify([...n]));
        } catch {
          /* ignore */
        }
      }
      return n;
    });
  };

  const expandAll = () => {
    const all = new Set(navGroups.map((g) => g.id));
    setExpandedSections(all);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("admin-nav-expanded", JSON.stringify([...all]));
      } catch {
        /* ignore */
      }
    }
  };

  const collapseAll = () => {
    const s = new Set<string>();
    s.add("overview");
    if (activeGroupId) s.add(activeGroupId);
    setExpandedSections(s);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("admin-nav-expanded", JSON.stringify([...s]));
      } catch {
        /* ignore */
      }
    }
  };

  // Sidebar quick filter: case-insensitive substring match across item labels and group labels.
  // When the query is non-empty, all groups with matches are force-expanded and non-matching items are hidden.
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filtering = trimmedQuery.length > 0;

  const filteredGroups = navGroups
    .map((group) => {
      if (!filtering) return { group, items: group.items.filter((i) => i.status !== "hidden") };
      const groupLabelMatches = group.label.toLowerCase().includes(trimmedQuery);
      const items = group.items.filter((i) => {
        if (i.status === "hidden") return false;
        if (groupLabelMatches) return true;
        return i.label.toLowerCase().includes(trimmedQuery);
      });
      return { group, items };
    })
    .filter((entry) => entry.items.length > 0);

  const totalMatches = filtering
    ? filteredGroups.reduce((acc, entry) => acc + entry.items.length, 0)
    : 0;

  return (
    <div className="flex min-h-screen bg-[#f4f6f8] text-ink">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 bg-[#111827] text-white shadow-[12px_0_40px_rgba(15,23,42,0.18)] transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white">
            NB
          </span>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{chrome.brand}</span>
            <span className="block text-xs font-medium text-slate-400">
              {chrome.operationConsole}
            </span>
          </div>
        </div>
        <nav
          aria-label="Admin"
          className="flex max-h-[calc(100vh-4rem)] flex-col gap-0.5 overflow-y-auto p-3 lg:max-h-none scrollbar-thin"
        >
          <div className="mb-1 flex items-center justify-end gap-1 px-1">
            <button
              className="rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 hover:bg-white/10 hover:text-slate-300"
              onClick={expandAll}
              title="Mở tất cả nhóm"
              type="button"
            >
              <span aria-hidden="true">▼</span>
              <span className="ml-1">Mở rộng</span>
            </button>
            <button
              className="rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 hover:bg-white/10 hover:text-slate-300"
              onClick={collapseAll}
              title="Thu gọn tất cả nhóm"
              type="button"
            >
              <span aria-hidden="true">▶</span>
              <span className="ml-1">Thu gọn</span>
            </button>
          </div>
          <div className="relative mb-2 px-1">
            <input
              aria-label={chrome.searchPlaceholder ?? "Tìm trong menu"}
              autoComplete="off"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 pr-7 text-[12px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-accent/60 focus:bg-white/10 focus:ring-2 focus:ring-accent/40"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={chrome.searchPlaceholder ?? "Tìm trong menu"}
              type="search"
              value={searchQuery}
            />
            {searchQuery ? (
              <button
                aria-label={chrome.searchClear ?? "Xoá tìm kiếm"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-[12px] text-slate-400 hover:bg-white/10 hover:text-white"
                onClick={() => setSearchQuery("")}
                type="button"
              >
                ×
              </button>
            ) : null}
          </div>
          {filtering && totalMatches === 0 ? (
            <p className="px-3 py-2 text-[11px] text-slate-500">
              {chrome.searchNoResults ?? "Không có mục phù hợp."}
            </p>
          ) : null}
          {filteredGroups.map(({ group: section, items: shown }) => {
            const isCollapsible = section.sectionCollapsible && section.id !== "overview";
            const isExpanded = filtering
              ? true
              : isCollapsible
                ? expandedSections.has(section.id)
                : true;
            return (
              <div key={section.id}>
                {isCollapsible ? (
                  <button
                    className="group flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition-colors outline-none hover:bg-white/5 hover:text-slate-300 focus-visible:ring-2 focus-visible:ring-accent/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
                    onClick={() => toggleSection(section.id)}
                    type="button"
                  >
                    <span className="truncate pr-1">{section.label}</span>
                    <svg
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                        isExpanded ? "rotate-90" : "rotate-0"
                      )}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 5l7 7-7 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  </button>
                ) : (
                  <SectionHeader label={section.label} />
                )}
                {(!isCollapsible || isExpanded) && (
                  <div className={cn("flex flex-col gap-0.5", isCollapsible ? "mt-0.5 pl-1" : "")}>
                    {shown.map((item) => {
                      const active = isAdminNavItemActive(item.href, base, norm, item.activeMatch);
                      return <NavItemRow active={active} item={item} key={item.id} />;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      {open ? (
        <button
          aria-label={chrome.menuClose}
          className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden"
          onClick={() => setOpen(false)}
          type="button"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md lg:hidden">
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-ink shadow-sm"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {open ? chrome.menuClose : chrome.menuOpen}
          </button>
          <span className="truncate text-sm font-semibold">{chrome.brand}</span>
        </header>
        <header className="hidden h-16 items-center justify-between border-b border-slate-200 bg-white/88 px-8 backdrop-blur-md lg:flex">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-slate-500">{chrome.workspace}</p>
            <p className="text-sm font-medium text-slate-900">{chrome.brand}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {chrome.rbacActive}
            </span>
            <a
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              href="/auth/logout"
            >
              {chrome.signOut}
            </a>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
