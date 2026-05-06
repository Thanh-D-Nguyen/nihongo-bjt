import Link from "next/link";

/**
 * Shared 2-column auth wrapper — Quizlet-style.
 * Left: colorful hero panel with brand + tagline.
 * Right: auth form (login/register/forgot-password).
 */
export function AuthHeroLayout({
  children,
  locale
}: {
  children: React.ReactNode;
  locale: string;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left hero panel — hidden on mobile */}
      <aside className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-500 to-fuchsia-500 lg:flex lg:flex-col lg:justify-between">
        {/* Decorative shapes */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-pink-300/20 blur-3xl" />
          <div className="absolute left-1/3 top-1/2 h-64 w-64 -translate-y-1/2 rounded-3xl bg-yellow-300/15 blur-2xl" />
          {/* Floating kanji decorations */}
          <div className="absolute right-16 top-20 select-none text-[8rem] font-black leading-none text-white/[0.06]">
            学
          </div>
          <div className="absolute bottom-32 left-12 select-none text-[6rem] font-black leading-none text-white/[0.06]">
            日本語
          </div>
          <div className="absolute right-1/3 top-1/3 select-none text-[5rem] font-black leading-none text-white/[0.06]">
            BJT
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col justify-center px-12 py-16 xl:px-16">
          <h2 className="max-w-md text-4xl font-black leading-[1.15] text-white xl:text-5xl">
            Chinh phục BJT
            <br />
            <span className="text-yellow-200">cùng NihonGo.</span>
          </h2>
          <p className="mt-5 max-w-sm text-base font-medium leading-relaxed text-white/75">
            Học tiếng Nhật thực tế, luyện thi BJT, đấu trí cùng bạn bè — mọi lúc, mọi nơi.
          </p>
        </div>

        {/* Bottom brand */}
        <div className="relative z-10 px-12 pb-10 xl:px-16">
          <Link
            className="text-lg font-bold text-white/80 no-underline hover:text-white"
            href={`/${locale}`}
          >
            NihonGo BJT
          </Link>
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex flex-1 flex-col overflow-y-auto bg-surface">
        <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-6 py-12 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
