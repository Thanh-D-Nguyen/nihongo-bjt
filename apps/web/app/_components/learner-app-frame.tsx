"use client";

import { AppShell, Badge, cn } from "@nihongo-bjt/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ComponentType,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  type SVGProps,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { useKeycloakAuth } from "../../components/auth/keycloak-auth-provider";
import { AnnouncementStrip } from "./announcement-strip";
import { BrandFull } from "./brand-logo";
import { CompanionBot, type CompanionBotLabels } from "./companion-bot";
import {
  IconAccount,
  IconAchievement,
  IconAnalytics,
  IconBattle,
  IconDocument,
  IconExercise,
  IconExplore,
  IconHelp,
  IconDictionary,
  IconGrammar,
  IconHome,
  IconKanji,
  IconLevels,
  IconLogout,
  IconMessage,
  IconQuiz,
  IconReview,
  IconSearch,
  IconSettings,
  IconShield
} from "./app-icons";
import {
  SearchDropdown,
  type DropdownKeyHandler,
  type SearchDropdownLabels
} from "./search-dropdown";

export type LearnerNavLabels = {
  account: string;
  achievements: string;
  analytics: string;
  ariaMain: string;
  battle: string;
  brand: string;
  cardgen: string;
  dailyStandup: string;
  dictionary: string;
  exercises: string;
  explore: string;
  footerCopyright: string;
  footerFeedback: string;
  footerLegal: string;
  footerHelp: string;
  footerLearning: string;
  footerPrivacy: string;
  footerProductSummary: string;
  footerSupport: string;
  footerTerms: string;
  grammarNav: string;
  home: string;
  kanjiNav: string;
  levelsNav: string;
  quiz: string;
  review: string;
  saved: string;
  search: string;
  searchPlaceholder: string;
  sessionChecking: string;
  settings: string;
  signOut: string;
  signIn: string;
  userFallback: string;
};

type NavItem = {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  label: string;
  mobile?: boolean;
};

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

export function LearnerAppFrame({
  children,
  companionLabels,
  locale,
  nav,
  searchLabels
}: {
  children: ReactNode;
  companionLabels: CompanionBotLabels;
  locale: string;
  nav: LearnerNavLabels;
  searchLabels: SearchDropdownLabels;
}) {
  const router = useRouter();
  const pathname = normalizePath(usePathname() ?? "");
  const base = `/${locale}`;
  const {
    accessToken,
    displayName,
    email,
    kcAccessCookiePresent,
    loading: authLoading,
    logout,
    sessionFailedWithCookie
  } = useKeycloakAuth();
  const [mounted, setMounted] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [exploreMenuOpen, setExploreMenuOpen] = useState(false);
  const searchKeyHandlerRef = useRef<DropdownKeyHandler | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const exploreMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!userMenuOpen && !exploreMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (userMenuOpen && !userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (exploreMenuOpen && !exploreMenuRef.current?.contains(event.target as Node)) {
        setExploreMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        setExploreMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [userMenuOpen, exploreMenuOpen]);

  const hideChrome = pathname === `${base}/login` || pathname === `${base}/register`;

  /* ── Primary nav: 4 core learning items ── */
  const primaryNavItems = useMemo(() => [
    { href: base, icon: IconHome, label: nav.home },
    { href: `${base}/flashcards`, icon: IconReview, label: nav.review },
    { href: `${base}/quiz`, icon: IconQuiz, label: nav.quiz },
    { href: `${base}/battle`, icon: IconBattle, label: nav.battle },
  ] satisfies NavItem[], [base, nav]);

  /* ── "Explore" dropdown: secondary learning features ── */
  const exploreNavItems = useMemo(() => [
    { href: `${base}/exercises`, icon: IconExercise, label: nav.exercises },
    { href: `${base}/dictionary`, icon: IconDictionary, label: nav.dictionary },
    { href: `${base}/kanji`, icon: IconKanji, label: nav.kanjiNav },
    { href: `${base}/grammar`, icon: IconGrammar, label: nav.grammarNav },
    { href: `${base}/levels`, icon: IconLevels, label: nav.levelsNav },
  ] satisfies NavItem[], [base, nav]);

  /* ── User menu items (achievements, analytics are moved here) ── */
  const navItems = useMemo(() => [
    ...primaryNavItems,
    ...exploreNavItems,
    { href: `${base}/achievements`, icon: IconAchievement, label: nav.achievements },
    { href: `${base}/analytics`, icon: IconAnalytics, label: nav.analytics },
  ] satisfies NavItem[], [base, nav, primaryNavItems, exploreNavItems]);

  const footerLinks = useMemo(
    () => [
      {
        items: [
          { href: base, icon: IconHome, label: nav.home },
          { href: `${base}/flashcards`, icon: IconReview, label: nav.review },
          { href: `${base}/quiz`, icon: IconQuiz, label: nav.quiz },
          { href: `${base}/analytics`, icon: IconAnalytics, label: nav.analytics }
        ],
        title: nav.footerLearning
      },
      {
        items: [
          { href: `${base}/help`, icon: IconHelp, label: nav.footerHelp },
          { href: `${base}/feedback`, icon: IconMessage, label: nav.footerFeedback }
        ],
        title: nav.footerSupport
      },
      {
        items: [
          { href: `${base}/privacy`, icon: IconShield, label: nav.footerPrivacy },
          { href: `${base}/terms`, icon: IconDocument, label: nav.footerTerms }
        ],
        title: nav.footerLegal
      }
    ],
    [base, nav]
  );

  const linkActive = (href: string) => {
    if (href === base) {
      return pathname === base;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (hideChrome) {
    return <>{children}</>;
  }

  const userLabel = displayName || email || nav.userFallback;
  const userInitial = userLabel.trim().charAt(0).toUpperCase() || "N";
  const mobileNavItems = [
    { href: base, icon: IconHome, label: nav.home },
    { href: `${base}/flashcards`, icon: IconReview, label: nav.review },
    { href: `${base}/explore`, icon: IconExplore, label: nav.explore },
    { href: `${base}/quiz`, icon: IconQuiz, label: nav.quiz },
    { href: `${base}/battle`, icon: IconBattle, label: nav.battle },
  ];

  function submitGlobalSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const q = globalSearchQuery.trim();
    setGlobalSearchOpen(false);
    router.push(q ? `${base}/search?q=${encodeURIComponent(q)}` : `${base}/search`);
  }

  function handleLogout(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setUserMenuOpen(false);
    void logout();
  }

  return (
    <AppShell>
      <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-ink/8 bg-paper/95 px-4 backdrop-blur-2xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4">
          {/* Brand */}
          <Link
            aria-label={nav.brand}
            className="group inline-flex min-w-0 shrink-0 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            href={base}
          >
            <BrandFull className="transition-transform duration-150 group-hover:-translate-y-0.5" />
          </Link>

          {/* Primary nav — only 4 core items on desktop */}
          <nav aria-label={nav.ariaMain} className="hidden shrink-0 items-center gap-1 lg:flex">
            {primaryNavItems.map((item) => {
              const active = linkActive(item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors",
                    active
                      ? "bg-ink text-surface shadow-sm"
                      : "text-muted hover:bg-ink/5 hover:text-ink"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <item.icon aria-hidden="true" className="shrink-0" size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Explore dropdown — secondary items */}
            <div className="relative" ref={exploreMenuRef}>
              <button
                aria-expanded={exploreMenuOpen}
                aria-haspopup="menu"
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors",
                  exploreMenuOpen || exploreNavItems.some((item) => linkActive(item.href))
                    ? "bg-ink/5 text-ink"
                    : "text-muted hover:bg-ink/5 hover:text-ink"
                )}
                type="button"
                onClick={() => setExploreMenuOpen((v) => !v)}
              >
                <svg aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
                <span>{nav.explore}</span>
                <svg aria-hidden className={cn("size-3 shrink-0 transition-transform duration-150", exploreMenuOpen && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {exploreMenuOpen ? (
                <div className="absolute left-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-[0_18px_48px_rgba(23,33,31,0.12)]">
                  <div className="p-1.5">
                    <Link
                      className={cn(
                        "flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-bold transition-colors",
                        linkActive(`${base}/explore`)
                          ? "bg-accent/8 text-accent"
                          : "text-ink hover:bg-paper"
                      )}
                      href={`${base}/explore`}
                      onClick={() => setExploreMenuOpen(false)}
                    >
                      <IconExplore aria-hidden size={18} />
                      <span>{nav.explore}</span>
                    </Link>
                    <div className="my-1 border-t border-ink/6" />
                    {exploreNavItems.map((item) => {
                      const active = linkActive(item.href);
                      return (
                        <Link
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors",
                            active
                              ? "bg-accent/8 text-accent"
                              : "text-muted hover:bg-paper hover:text-ink"
                          )}
                          href={item.href}
                          key={item.href}
                          onClick={() => setExploreMenuOpen(false)}
                        >
                          <item.icon aria-hidden size={18} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </nav>

          {/* Search — fills remaining space */}
          <form
            className="relative hidden min-w-48 flex-1 md:block"
            role="search"
            onSubmit={submitGlobalSearch}
          >
            <label className="sr-only" htmlFor="learner-global-search">
              {nav.search}
            </label>
            <div className="flex h-10 min-w-0 items-center rounded-xl border border-ink/8 bg-surface/80 text-sm text-muted shadow-sm transition focus-within:border-accent/35 focus-within:ring-2 focus-within:ring-accent/15">
              <button
                aria-label={nav.search}
                className="inline-flex h-full w-10 shrink-0 items-center justify-center rounded-l-xl text-muted transition hover:text-ink"
                type="submit"
              >
                <IconSearch aria-hidden size={17} />
              </button>
              <input
                aria-autocomplete="list"
                aria-expanded={globalSearchOpen}
                autoComplete="off"
                className="learner-topbar-search min-w-0 flex-1 bg-transparent pr-3 text-sm text-ink outline-none placeholder:text-muted/70"
                id="learner-global-search"
                placeholder={nav.searchPlaceholder}
                type="search"
                value={globalSearchQuery}
                onChange={(event) => {
                  setGlobalSearchQuery(event.target.value);
                  setGlobalSearchOpen(true);
                }}
                onFocus={() => setGlobalSearchOpen(true)}
                onKeyDown={(event) => {
                  if (searchKeyHandlerRef.current?.(event)) return;
                  if (event.key === "Escape") setGlobalSearchOpen(false);
                }}
              />
            </div>
            <SearchDropdown
              labels={searchLabels}
              locale={locale}
              open={globalSearchOpen}
              query={globalSearchQuery}
              onClose={() => setGlobalSearchOpen(false)}
              onKeyHandlerReady={(handler) => {
                searchKeyHandlerRef.current = handler;
              }}
              onSelect={setGlobalSearchQuery}
            />
          </form>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Mobile search icon */}
            <Link
              aria-label={nav.search}
              className="inline-flex size-10 items-center justify-center rounded-xl border border-ink/8 bg-surface text-muted shadow-sm transition hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40 md:hidden"
              href={`${base}/search`}
            >
              <IconSearch aria-hidden size={18} />
            </Link>

            {mounted && authLoading && kcAccessCookiePresent ? (
              <Badge className="hidden sm:inline-flex" role="status">
                {nav.sessionChecking}
              </Badge>
            ) : null}

            {mounted && accessToken ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  className="inline-flex size-10 items-center justify-center rounded-full border border-ink/10 bg-gradient-to-br from-accent/10 to-accent/5 text-sm font-bold text-ink shadow-sm transition hover:border-accent/25 hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent/40"
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                >
                  {userInitial}
                </button>
                {userMenuOpen ? (
                  <div
                    className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-[0_18px_48px_rgba(23,33,31,0.14)]"
                    role="menu"
                  >
                    <div className="border-b border-ink/8 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-ink">{userLabel}</p>
                      {email && email !== userLabel ? (
                        <p className="truncate text-xs text-muted">{email}</p>
                      ) : null}
                    </div>
                    <div className="p-1.5">
                      {/* Learning shortcuts */}
                      <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted/60">Learning</p>
                      <Link
                        className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-paper hover:text-ink"
                        href={`${base}/achievements`}
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <IconAchievement aria-hidden size={16} />
                        {nav.achievements}
                      </Link>
                      <Link
                        className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-paper hover:text-ink"
                        href={`${base}/analytics`}
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <IconAnalytics aria-hidden size={16} />
                        {nav.analytics}
                      </Link>
                      <Link
                        className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-paper hover:text-ink"
                        href={`${base}/daily-standup`}
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <IconExercise aria-hidden size={16} />
                        {nav.dailyStandup}
                      </Link>

                      {/* Account section */}
                      <div className="my-1.5 border-t border-ink/8" />
                      <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted/60">Account</p>
                      <Link
                        className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-paper hover:text-ink"
                        href={`${base}/account`}
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <IconAccount aria-hidden size={16} />
                        {nav.account}
                      </Link>
                      <Link
                        className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-paper hover:text-ink"
                        href={`${base}/settings`}
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <IconSettings aria-hidden size={16} />
                        {nav.settings}
                      </Link>
                      <button
                        className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-sakura hover:bg-sakura/8"
                        role="menuitem"
                        type="button"
                        onClick={handleLogout}
                      >
                        <IconLogout aria-hidden size={16} />
                        {nav.signOut}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {mounted &&
            !authLoading &&
            !accessToken &&
            (!kcAccessCookiePresent || sessionFailedWithCookie) ? (
              <Link
                className="inline-flex min-h-10 items-center rounded-full bg-ink px-5 text-sm font-bold text-surface shadow-sm transition hover:bg-ink/90"
                href={`${base}/login`}
              >
                {nav.signIn}
              </Link>
            ) : null}
          </div>
        </div>
        <AnnouncementStrip />
      </header>
      <div className="flex-1">{children}</div>
      <nav
        aria-label={nav.ariaMain}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/8 bg-paper/95 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_28px_rgba(23,33,31,0.06)] backdrop-blur-2xl lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {mobileNavItems.map((item) => {
            const active = linkActive(item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-colors",
                  active ? "bg-ink text-surface" : "text-muted hover:bg-surface hover:text-ink"
                )}
                href={item.href}
                key={item.href}
              >
                <item.icon aria-hidden size={20} />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <footer className="mt-14 border-t border-ink/10 py-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,2fr)]">
          <div className="max-w-sm space-y-3">
            <Link
              className="inline-flex w-fit rounded-xl focus-visible:ring-2 focus-visible:ring-accent/40"
              href={base}
            >
              <BrandFull className="opacity-95" />
            </Link>
            <p className="text-sm leading-relaxed text-muted">{nav.footerProductSummary}</p>
          </div>
          <nav
            aria-label={nav.ariaMain}
            className="grid gap-5 text-sm sm:grid-cols-3"
          >
            {footerLinks.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted/75">
                  {group.title}
                </p>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => (
                    <Link
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg text-muted transition hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
                      href={item.href}
                      key={item.href}
                    >
                      <item.icon aria-hidden className="shrink-0" size={16} />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-ink/8 pt-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{nav.footerCopyright}</p>
          <p>{nav.brand}</p>
        </div>
      </footer>
      <CompanionBot base={base} labels={companionLabels} locale={locale} />
    </AppShell>
  );
}
