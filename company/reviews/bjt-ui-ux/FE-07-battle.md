# FE-07 Bot Battle — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/battle`
**Files**: `apps/web/app/[locale]/battle/page.tsx`, `apps/web/app/[locale]/battle/_components/battle-client.tsx` (317 lines)

## Product Context

- **Target user**: Authenticated learner seeking gamified BJT practice
- **Primary learner outcome**: Practice answering BJT questions under competitive pressure
- **Primary action**: Select bot difficulty → start match → answer questions
- **Secondary actions**: View results, share result (privacy-safe)
- **Non-goals**: PvP multiplayer (future), leaderboard display (separate)

## Data Contract

- **Backend**: Socket.IO WebSocket via `battle.gateway.ts`
- **Auth**: `useKeycloakAuth()` — userId from token
- **Bot levels**: J2, J3, J4
- **Real-time**: Socket events for question/answer/result

## Implementation Quality

- Auth-gated via `useKeycloakAuth()` ✅
- Socket.IO real-time connection ✅
- Bot selection with 3 difficulty levels ✅
- Score tracking (user vs bot) ✅
- Share result: state-based UI (no alert()) ✅
- Share privacy notice ✅
- `generateMetadata` with localized title ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Bot selection | 3 difficulty cards | ✅ |
| Connecting | Socket connection in progress | ✅ |
| Match active | Question + score display | ✅ |
| No questions | Empty match error | ✅ |
| Win/Lose/Draw | Result with CTA | ✅ |
| Share result | Privacy-safe share URL generation | ✅ |
| Share error | i18n error message (not alert) | ✅ |
| Connection error | Socket error state | ✅ |

## Localization

- **i18n namespace**: `battle`
- **VI/JA**: Both localized
- **Key fixes applied**: User-friendly subtitle, share error/success i18n

## Acceptance

- [x] Auth-gated
- [x] Real-time WebSocket
- [x] No alert() (replaced with state-based UI)
- [x] No console.log
- [x] Share privacy notice
- [x] i18n complete
