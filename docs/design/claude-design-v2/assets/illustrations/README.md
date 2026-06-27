# Illustrations & imagery

This design direction is *Quiet Mastery* — editorial restraint, no decorative noise. It intentionally
ships **no bespoke illustrations or 3D/parallax**. Imagery is limited and purposeful; drop production
assets here when they exist.

## What actually appears in the design
- **Brand mark** — "語" in a `#059669` rounded square + wordmark "KotobaWorks · BJT". Replace with the final logo lockup; keep the green accent reserved for the mark.
- **Achievement postcard** (`frames/18-mobile-share.png`) — generated server-side from safe metadata only (milestone, deck/lesson counts). Template art may live here, but it must never embed scores, history, or estimated band.
- **Avatars** — initial-in-navy-circle fallback; user photo when available.
- **Daily-life context tiles** (Learn) — small category markers; use simple iconography, not stock photos.

## Rules
- No AI-gradient heroes, neon, glassmorphism, claymorphism, or childish mascots.
- No decorative hero imagery inside authenticated workflows.
- Reward art (sakura/gold) is sparse and reserved for genuine achievement moments.
- If a screen needs a real image (e.g. a product/screenshot slot), use a labelled placeholder until the asset is supplied — never ship lorem-style filler.

## Slots to fill (when assets are ready)
| Slot | Where | Notes |
|---|---|---|
| Logo lockup | global shell, auth | SVG, navy + green mark |
| Postcard templates | share | safe-metadata only |
| Context tile art | Learn / daily-life | simple, restrained |
