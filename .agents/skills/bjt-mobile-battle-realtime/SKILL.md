---
name: bjt-mobile-battle-realtime
description: Build, audit, or polish the realtime Battle feature in the Nihongo BJT Flutter mobile app \u2014 Socket.IO matchmaking/session, live question rounds, opponent state, scoring, reconnect/disconnect handling, and results \u2014 as a focused full-screen flow. Use when implementing realtime competitive battle or any Socket.IO-driven live session on mobile.
---

# BJT Mobile Battle (Realtime) Skill

Use this skill when implementing, auditing, or polishing the realtime Battle
feature. Follow the `bjt-mobile-foundation-quality-gate` baseline. Battle is a
focused full-screen flow outside the tab shell (no bottom-nav conflict). Results
sharing defers to `bjt-mobile-sharing-referral-postcard`.

## Goal

Deliver a reliable, fair realtime battle: match, play timed rounds against a
live opponent, score honestly, and handle network reality (latency, drops,
reconnect) without corrupting session state.

## Core principle

Realtime state is **server-authoritative**. The client renders server events and
sends intents; it never decides the winner or fabricates opponent state.

## Hard rules

- Use Socket.IO via the real battle contract; reuse the web event protocol.
- Server is the source of truth for matchmaking, round state, scoring, results.
- Handle disconnect/reconnect explicitly: show connection state, attempt
  reconnect, recover or end the session cleanly — never freeze or fake progress.
- No fake opponents, fake ranking, fake scores, or simulated wins.
- Respect exam-integrity reading rules during battle questions.
- Clean teardown: leave the socket room and dispose listeners on exit; no leaks.
- Premium/quota gating defers to `bjt-mobile-monetization-paywall`.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests with a fake socket/repository.

## Required audit before coding

Inspect:
- web battle Socket.IO events, payloads, matchmaking, scoring, reconnect logic,
  REST endpoints, models
- mobile networking/socket setup, router (focused-route pattern), reading-assist,
  entitlement provider, l10n, tokens, tests
- whether a mobile Socket.IO client/dependency exists; justify adding one if not

Create/update:
- `docs/mobile/BATTLE_WEB_PARITY_AUDIT.md`
- `docs/mobile/BATTLE_REALTIME_CONTRACT.md` (events, payloads, reconnect)
- `docs/mobile/BATTLE_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Battle entry / matchmaking with clear waiting + cancel.
2. Live round screen: question, opponent presence/progress, timer, answer submit.
3. Connection-state UI (connecting/reconnecting/lost) with recovery.
4. Result screen: real scores/outcome, rematch, share entry.
5. All states including disconnect/abandon.

## Required tests (fake socket/repository)

- matchmaking waiting → matched
- round renders server question; answer submit emits intent once
- scoreboard reflects server events only
- disconnect shows reconnect UI; reconnect recovers or ends cleanly
- abandon/leave tears down socket and routes out
- no bottom-nav in battle flow
- dark mode, 360 dp, long VI/JA text

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Document runtime verification (live socket) as blocked-with-proof
if backend is unreachable. Report files changed and commands + results.
