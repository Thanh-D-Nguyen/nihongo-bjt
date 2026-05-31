# GCP homepage mobile responsive runbook

## Purpose

This note records the production mobile-first pass for the authenticated learner homepage.

## Root causes

- The homepage used `overflow-x-hidden` as a broad safety net. Oversized children were clipped instead of being made responsive.
- Daily Radar rails used viewport-relative card widths without an explicit mobile maximum or mandatory snapping.
- Several optional widgets assumed desktop-like horizontal space: login-bonus skeletons, Loto number pills, heatmap metadata, seasonal event rows, and For You footer actions.
- Hero and quick-action cards used desktop padding on the `375px` base viewport.
- The shared learner topbar guest actions exceeded the available width by a few pixels at `375px`.

## Responsive behavior after the fix

- Homepage layout owners use `min-w-0`; the root uses `overflow-x-clip` only as a last containment boundary.
- Hero padding is reduced on mobile and its three CTAs are full-width below the `sm` breakpoint.
- Quick actions retain the bento layout with smaller mobile padding and icon sizing.
- Homepage tabs provide `48px` touch targets and mandatory horizontal snapping.
- Daily Radar cards are bounded by `min(18rem, calc(100vw - 3rem))`, with mandatory snap rails and a visible next-card peek.
- Login-bonus rewards snap horizontally; its loading state no longer overflows.
- Loto Lab shows four balls plus a compact remainder indicator on mobile.
- Heatmap metadata wraps naturally.
- Seasonal event rows truncate safely and stack challenge metadata on narrow screens.
- For You utility actions use comfortable touch targets and wrap safely.
- The shared learner topbar uses tighter mobile gaps and a compact sign-in button while retaining desktop spacing from `sm` upward.

## Files

- `apps/web/app/[locale]/_components/homepage/homepage-client.tsx`
- `apps/web/app/[locale]/_components/homepage/hero-section.tsx`
- `apps/web/app/[locale]/_components/homepage/quick-actions-strip.tsx`
- `apps/web/app/[locale]/_components/homepage/homepage-sections-tabs.tsx`
- `apps/web/app/[locale]/_components/homepage/login-bonus-widget.tsx`
- `apps/web/app/[locale]/_components/homepage/loto-teaser-widget.tsx`
- `apps/web/app/[locale]/_components/homepage/learning-heatmap.tsx`
- `apps/web/app/[locale]/_components/homepage/seasonal-event-banner.tsx`
- `apps/web/app/[locale]/_components/homepage/for-you-feed-widget.tsx`
- `apps/web/src/features/daily-radar/daily-radar-section.tsx`
- `apps/web/app/_components/learner-app-frame.tsx`

## Local verification

```bash
pnpm --filter @nihongo-bjt/web typecheck
pnpm exec eslint \
  'apps/web/app/_components/learner-app-frame.tsx' \
  'apps/web/app/[locale]/_components/homepage/homepage-client.tsx' \
  'apps/web/app/[locale]/_components/homepage/hero-section.tsx' \
  'apps/web/app/[locale]/_components/homepage/quick-actions-strip.tsx' \
  'apps/web/app/[locale]/_components/homepage/homepage-sections-tabs.tsx' \
  'apps/web/app/[locale]/_components/homepage/login-bonus-widget.tsx' \
  'apps/web/app/[locale]/_components/homepage/loto-teaser-widget.tsx' \
  'apps/web/app/[locale]/_components/homepage/learning-heatmap.tsx' \
  'apps/web/app/[locale]/_components/homepage/seasonal-event-banner.tsx' \
  'apps/web/app/[locale]/_components/homepage/for-you-feed-widget.tsx' \
  'apps/web/src/features/daily-radar/daily-radar-section.tsx'
git diff --check
pnpm --filter @nihongo-bjt/web build
```

## Production publish

Use `deploy/gcp/deploy-release.sh` for a normal release. If publishing only this scoped fix manually, sync the files above, then run:

```bash
ssh deploy@34.87.55.1 '
  set -euo pipefail
  cd /home/deploy/nihongo-bjt
  rm -f apps/web/.env.local
  rm -rf apps/web/.next
  pnpm --filter @nihongo-bjt/web build
  pm2 restart nihongo-web --update-env
  pm2 save
'
```

`apps/web/.env.local` must never participate in a production build.
