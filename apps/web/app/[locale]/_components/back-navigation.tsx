import Link from "next/link";

export type BackNavigationProps = {
  href: string;
  label: string;
};

export function BackNavigation({ href, label }: BackNavigationProps) {
  return (
    <nav className="mb-6">
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        href={href}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </Link>
    </nav>
  );
}
