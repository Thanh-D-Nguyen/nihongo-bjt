import type { ReactNode } from "react";

const icons = {
  academic: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 14l9-5-9-5-9 5 9 5Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
      <path d="M12 14l6.16-3.422a12.083 12.083 0 0 1 .665 6.479A11.952 11.952 0 0 0 12 20.055a11.952 11.952 0 0 0-6.824-2.998 12.078 12.078 0 0 1 .665-6.479L12 14Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  ),
  bolt: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M3.75 13.5 14.25 2.25 12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  ),
  book: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 6.042A8.967 8.967 0 0 0 6.75 4.5 8.967 8.967 0 0 0 3.75 6.042m0 0A8.967 8.967 0 0 0 3.75 14.25a8.967 8.967 0 0 0 4.5 1.542m0 0A8.967 8.967 0 0 0 12 18.75a8.967 8.967 0 0 0 4.5-1.542M6.75 6.042v12.21" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  ),
  chart: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0 1 3 17.625v-4.5ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125v-8.25ZM16.5 4.125c0-.621.504-1.125 1.125-1.125H21c.621 0 1.125.504 1.125 1.125v12.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  ),
  cog: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  ),
  home: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="m2.25 12 8.955-7.5h2.19L22.5 12M4.5 9.75V20.25A.75.75 0 0 0 5.25 21h3.75v-4.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21H18.75a.75.75 0 0 0 .75-.75V9.75" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  ),
  megaphone: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M10.34 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l.82-.3c.5-.184 1.05.1 1.2.6l.28.98a1.1 1.1 0 0 1-.65 1.35l-.82.3c-.355.13-.6.4-.6.7v.6c0 .3.245.57.6.7l.82.3c.5.18.8.7.65 1.35l-.28.98c-.15.5-.7.78-1.2.6l-.82-.3c-.355-.13-.75-.07-1.075.12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} />
    </svg>
  ),
  money: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 6v12m-3-2.25h4.5a1.5 1.5 0 0 0 0-3h-3a1.5 1.5 0 0 1 0-3H15M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  ),
  queue: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  ),
  scale: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3v18M3 12h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  ),
  search: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="m21 21-5.2-5.2M18 10.5a7.5 7.5 0 1 0-2.1 4.2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  ),
  shield: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M9 12.75 11.25 15 15 9.75M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} />
    </svg>
  ),
  user: (
    <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M4.5 19.128a9.38 9.38 0 0 0 2.625-.372m0 0a9.38 9.38 0 0 0-2.625-2.372m2.625 2.372a9.37 9.37 0 0 0 2.625-2.372m-2.625 2.372a9.37 9.37 0 0 1-2.625-2.372" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
    </svg>
  )
} as const;

export type NavIconName = keyof typeof icons;

export function navIcon(name: NavIconName | string | undefined): ReactNode {
  if (name && name in icons) {
    return icons[name as NavIconName];
  }
  return icons.cog;
}
