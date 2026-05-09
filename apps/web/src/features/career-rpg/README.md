# Career RPG — visual vertical slice

UI-first prototype of the BJT Career RPG / Workplace Simulator concept. No
backend dependency: every screen runs on typed mock data so designers and
stakeholders can click through the full loop today.

## Routes

All routes are locale-prefixed (`vi` and `ja` are wired):

| Route | Purpose |
| --- | --- |
| `/[locale]/daily-standup` | Home / clock-in screen |
| `/[locale]/career` | Career sheet (rank + skill radar + NPC relations) |
| `/[locale]/story/arcs` | Mission arc browser |
| `/[locale]/story/arcs/[slug]` | Arc detail (synopsis + chapter list + NPCs) |
| `/[locale]/story/chapters/[id]` | Chapter player (briefing → scenario → answer → NPC reaction → complete) |
| `/[locale]/review-inbox-preview` | Review Inbox preview (context memo cards) |

Try the full loop: visit `/vi/daily-standup` → click `出勤する` → answer the
question → see the NPC reaction → continue to the chapter complete screen
→ open the Review Inbox to see the new memos that dropped.

## File map

```
apps/web/src/features/career-rpg/
├── README.md                       this file
├── types.ts                        type contracts (mirror future Prisma models)
├── mock-data.ts                    typed mock state (ranks, NPCs, arcs, chapters, inbox)
├── helpers.ts                      pure utilities (rank/skill/radar math)
├── i18n.ts                         CareerRpgLabels contract
├── store.tsx                       <CareerRpgProvider> + useCareerRpg() (localStorage cache)
└── components/
    ├── career-rank-card.tsx
    ├── career-skill-radar.tsx
    ├── npc-relation-card.tsx       (also exports <NpcAvatar>)
    ├── mission-arc-card.tsx
    ├── chapter-briefing-panel.tsx
    ├── workplace-scenario-card.tsx (renders email / meeting / chat layouts)
    ├── bjt-style-question-card.tsx
    ├── npc-reaction-overlay.tsx
    ├── chapter-complete-screen.tsx
    ├── context-memo-card.tsx
    ├── review-inbox-preview.tsx
    └── daily-standup-page.tsx
```

Routes are thin: server `page.tsx` reads `vi.json` / `ja.json`, picks
`careerRpg` labels, wraps the client tree in `<CareerRpgProvider>` and
delegates to one client component.

## State model

`<CareerRpgProvider>` holds the only piece of mutable state in the slice:

```ts
{
  career: UserCareerState,       // skills, rank, XP
  npcRelations: NpcRelation[],   // trust scores
  inbox: ContextMemo[]           // review inbox
}
```

It is hydrated from `localStorage` (`career-rpg.snapshot.v1`) on mount and
written back on every mutation. The only mutation hook is
`applyChapterResult(result)` — the chapter player calls it after the user
clears the NPC reaction overlay so XP / skill / trust / inbox all update at
once.

To reset, run in DevTools:

```js
localStorage.removeItem("career-rpg.snapshot.v1");
location.reload();
```

## i18n

Strings live in `apps/web/messages/{vi,ja}.json` under the top-level
`careerRpg` key. The `CareerRpgLabels` type in `i18n.ts` documents the full
shape. To add `en`, append a `careerRpg` block to `en.json` matching that
shape and update the `messages` object in each route page to include `en`.

## Replacing mock data with real APIs

Type shapes in `types.ts` already mirror the planned Prisma models from the
v2 architecture spec:

| Mock | Replace with |
| --- | --- |
| `mockCareerState` | `GET /api/career/me` → `UserCareerState` |
| `mockCareerRanks` | `GET /api/career/ranks` |
| `mockStoryNpcs` | `GET /api/story/npcs` |
| `mockNpcRelations` | `GET /api/story/npcs/:slug/relation` (per slug) |
| `mockMissionArcs` | `GET /api/story/arcs` |
| `mockMissionChapters` | `GET /api/story/chapters/:id` (per chapter) |
| `mockInbox` | `GET /api/context-cards/inbox` |
| `mockChapterResults` | server response from `POST /api/story/chapters/:id/attempts/current/complete` |

Suggested migration order:

1. Wrap each `find*` / `mock*` import in a hook (`useCareerState`, `useArc(slug)`, …).
   Hooks read mock data today; swap to `learnerApiFetch` calls later.
2. Move `<CareerRpgProvider>` mutations behind real mutation endpoints.
   Keep optimistic update logic — the reducer already does the right thing.
3. Drop `localStorage` cache once API exists; rely on server state via
   React Query / SWR if introduced.

## Next backend integration tasks

In rough order of dependency:

1. Add `career`, `story`, `risk`, `expression` schemas + Prisma models per the
   v2 architecture spec (`career_rank`, `user_career_state`, `career_skill_stat`,
   `mission_arc`, `mission_chapter`, `chapter_attempt`, `story_npc`,
   `npc_relation`, `business_expression`, `nuance_pattern`, `workplace_scene`,
   `context_card`).
2. Implement `CareerModule` (clock-in, get-me, ranks).
3. Implement `StoryModule` (arcs, chapters, attempt lifecycle, NPC relations).
4. Implement minimal `RiskOutcomeRecord` write on chapter complete.
5. Implement `ExpressionModule` + inbox endpoint backed by normalized
   `BusinessExpression` / `WorkplaceScene` / `NuancePattern` / `ContextCard`.
6. Replace mock imports per the table above.
7. Add seed data for the same 3 arcs / 8 NPCs used in this slice so the
   first wired-up call still renders this exact UI.

## Constraints honoured by this slice

- No production backend touched. All data static + client-only.
- Existing routes untouched (`/`, `/daily`, `/exercises`, etc. unchanged).
- Code lives under `apps/web/src/features/career-rpg/` — easy to delete or
  iterate without polluting the live app tree.
- Strings go through `careerRpg` i18n keys; no hard-coded VN/JP literals
  in components.
- `pnpm typecheck` and `pnpm build` pass with the new code.

## Known prototype caveats

- Only one chapter has a real scenario (`ch_client_email_02`). Other
  chapters render an empty scenario list — the briefing → start → empty
  flow is intentional and documents which chapters need content authored
  next.
- "Daily today task" is computed by `mockMissionArcs.find(active).chapterIds`.
  Replace with real recommended-mission API later.
- `RoleplaySession` and Boss Mission UIs are out of scope for this slice
  per the request — they will follow Phase 4 of the v2 plan.
