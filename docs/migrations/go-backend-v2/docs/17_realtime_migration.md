# 17 — Realtime Migration (Socket.IO → WebSocket)

## Scope

All Socket.IO realtime functionality currently embedded in NestJS must be migrated before NestJS retirement (M15).

### Known gateways

| Gateway | Source | Events |
|---------|--------|--------|
| BattleGateway | `apps/api/src/battle/battle.gateway.ts` | `battle:lobby_join`, `battle:lobby_message`, `battle:challenge_user`, `battle:answer`, `battle:challenge_bot`, `battle:accept_challenge`, `battle:decline_challenge`, `battle:pvp_answer`, `battle:pvp_forfeit` (12+ events) |
| PresenceGateway | `apps/api/src/presence/presence.gateway.ts` | `presence:heartbeat`, `presence:query` |

### Known frontend consumers

Socket.IO client (`socket.io-client ^4.8.3`) is used in at least:
- `apps/web/app/[locale]/battle/_components/battle-countdown-overlay.tsx`
- `apps/web/app/[locale]/battle/_components/battle-runtime-provider.tsx`
- `apps/web/app/[locale]/battle/_components/game-types/listening-round.tsx`
- `apps/web/app/[locale]/flashcards/_components/review-session.tsx`
- `apps/web/app/[locale]/quiz/_components/bjt-audio-player.tsx`
- `apps/web/app/[locale]/levels/[level]/lessons/[slug]/_components/lesson-detail-client.tsx`
- `apps/web/app/[locale]/scenarios/[scenarioId]/_components/scenario-play-client.tsx`

## Architecture selection gate

Do NOT prematurely commit to a specific Go WebSocket library during P0.1.

M0/M12 must inventory:
- exact event names and payload contracts
- acknowledgement semantics (which events expect acks)
- room/lobby management (join, leave, broadcast scope)
- reconnection behavior and state recovery
- heartbeat intervals and timeout semantics
- connection authentication (how Keycloak tokens are validated on connect)
- message ordering assumptions
- concurrency model (per-connection goroutines, shared state)
- error handling and disconnect cleanup

Then choose between:
- native WebSocket protocol migration (custom framing over `gorilla/websocket` or `nhooyr.io/websocket`)
- an actively maintained Go Socket.IO-compatible library
- another bidirectional realtime solution

Do NOT use SSE for Battle. Battle is bidirectional realtime requiring low-latency client→server messages.

## Migration wave: M12

M12 occurs after background jobs (M10) and remaining integrations (M11) are proven. NestJS may temporarily remain as a realtime-only slice until M12 completes.

Steps:
1. Complete M0 realtime inventory with full event/payload/auth/room details.
2. Select Go WebSocket approach based on inventory evidence.
3. Implement connection authentication (replace Keycloak token validation with Go session/token validation).
4. Implement each gateway's event handlers with contract-equivalent behavior.
5. Implement room/lobby management.
6. Implement heartbeat and presence tracking.
7. Update frontend consumers to use new protocol/library.
8. Test reconnection, state recovery, and concurrent connections.
9. Run parallel execution against NestJS during stability window.
10. Disable NestJS gateways only after Go realtime proven stable.

## Authentication

Current Socket.IO gateways presumably validate Keycloak tokens on connection. Go WebSocket replacement must:
- authenticate before accepting messages
- support the same session/token mechanism as HTTP APIs
- reject unauthenticated connections
- handle token refresh/expiry during active connections
- apply same authorization rules as HTTP endpoints

See `docs/03_auth_replacement_spec.md`.

## Observability

Every connection and message must log (sampled where volume requires):
- connection ID
- user ID (when authenticated)
- event name
- direction (in/out)
- timestamp
- duration (for request-response patterns)
- error detail on failure

Expose counters for:
- active connections
- messages per second by event type
- authentication failures
- connection drops
- room membership changes

## Rollback

During transition, both NestJS and Go realtime may coexist. Frontend should be able to switch between endpoints via configuration. Ensure no duplicate event delivery during cutover.