/* Shimmer skeleton matching the magazine bento grid layout */

function SkeletonCard({ isHero = false }: { isHero?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-border/30 bg-card p-5 ${
        isHero ? "row-span-2 sm:col-span-2" : ""
      }`}
    >
      {/* Top badge area */}
      <div className="flex items-center justify-between">
        <div className="size-8 rounded-lg bg-muted" />
        <div className="h-5 w-12 rounded-full bg-muted" />
      </div>
      {/* Title shimmer */}
      <div className="mt-4 space-y-2">
        <div className="h-5 w-4/5 rounded bg-muted" />
        {isHero && <div className="h-5 w-3/5 rounded bg-muted" />}
        <div className="h-4 w-2/3 rounded bg-muted" />
      </div>
      {/* Summary shimmer */}
      {isHero && (
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-4/5 rounded bg-muted" />
        </div>
      )}
      {/* Tags shimmer */}
      <div className="mt-5 flex gap-2">
        <div className="h-6 w-14 rounded-md bg-muted" />
        <div className="h-6 w-16 rounded-md bg-muted" />
        <div className="h-6 w-12 rounded-md bg-muted" />
      </div>
      {/* Date */}
      <div className="mt-auto pt-4">
        <div className="h-3 w-20 rounded bg-muted" />
      </div>
    </div>
  );
}

export function MagazineGridSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      {/* Bento grid skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard isHero />
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
