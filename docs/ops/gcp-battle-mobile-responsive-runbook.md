# GCP battle mobile responsive runbook

## Purpose

This note records the production fix for the learner battle lobby and match screens on mobile.

## Root cause

The main `Start battle with bot` action existed only inside the roster column. On screens below the `lg` breakpoint, that column becomes a hidden drawer. A learner had to discover the online-count button, open the drawer, scroll through the roster, and only then reach the primary action.

## Responsive behavior after the fix

- The battle lobby shows a mobile-only quick-start card immediately below the available battle configs.
- The card shows the selected bot, an explicit roster button, and the `Start battle with bot` action.
- The full roster remains available as a drawer for switching bots or challenging online learners.
- The drawer stops above the learner bottom navigation, including the safe-area inset.
- Primary mobile controls use a minimum `48px` touch target.
- Available battle cards use a viewport-bounded width to avoid horizontal page overflow.
- The match screen uses tighter mobile padding, a two-column stat layout, and a full-width lobby return action on small screens.

## Files

- `apps/web/app/[locale]/battle/_components/battle-lobby-client.tsx`
- `apps/web/app/[locale]/battle/_components/battle-configs-panel.tsx`
- `apps/web/app/[locale]/battle/_components/battle-match-client.tsx`

## Local verification

```bash
pnpm --filter @nihongo-bjt/web typecheck
pnpm exec eslint \
  'apps/web/app/[locale]/battle/_components/battle-lobby-client.tsx' \
  'apps/web/app/[locale]/battle/_components/battle-configs-panel.tsx' \
  'apps/web/app/[locale]/battle/_components/battle-match-client.tsx'
git diff --check
pnpm --filter @nihongo-bjt/web build
```

## Production publish

Run from the repository root:

```bash
scp \
  'apps/web/app/[locale]/battle/_components/battle-lobby-client.tsx' \
  'apps/web/app/[locale]/battle/_components/battle-configs-panel.tsx' \
  'apps/web/app/[locale]/battle/_components/battle-match-client.tsx' \
  deploy@34.87.55.1:/tmp/

ssh deploy@34.87.55.1 '
  set -euo pipefail
  cd /home/deploy/nihongo-bjt
  cp /tmp/battle-lobby-client.tsx apps/web/app/\[locale\]/battle/_components/
  cp /tmp/battle-configs-panel.tsx apps/web/app/\[locale\]/battle/_components/
  cp /tmp/battle-match-client.tsx apps/web/app/\[locale\]/battle/_components/
  rm -f apps/web/.env.local
  rm -rf apps/web/.next
  pnpm --filter @nihongo-bjt/web build
  pm2 restart nihongo-web --update-env
  pm2 save
'
```

`apps/web/.env.local` must not exist during a production build. Next.js prioritizes app-local environment overrides and a developer override can point the browser build to `localhost`.
