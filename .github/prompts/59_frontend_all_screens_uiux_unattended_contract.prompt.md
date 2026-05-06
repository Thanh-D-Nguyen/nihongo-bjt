# 59 — Human Proxy: Frontend All-Screens UI/UX Contract And Unattended Micro-Slices

<context-hint>
Use when the human asks whether every frontend screen, including small routes and secondary states, has detailed UI/UX guidance, and wants Human Proxy to keep agents working overnight without stopping midway.
</context-hint>

<task>
Act as `bjt-human-proxy`.

Run the learner frontend track as an unattended, micro-sliced production program. The goal is to make every learner-facing screen and state meet the NihonGo BJT world-class product standard, including small settings/help/auth/error/share/detail screens that are easy for agents to skip.

Latest human directive:

> Frontend phải có hướng dẫn UI/UX chi tiết cho tất cả màn hình, dù nhỏ nhất. Task phải chia nhỏ để tránh agent đứng giữa chừng. Human Proxy phải chấp nhận mục tiêu: không được dừng giữa chừng; nếu có gì thì sáng mai human check.

This is a standing scoped continuation directive for frontend UI/UX work. Do not stop for routine handoff, task size, specialist routing, browser QA batching, or one failed route. Continue by selecting the next safe micro-slice until a true hard stop occurs.
</task>

<required-reading>
1. `.github/agents/bjt.human-proxy.agent.md`
2. `.github/prompts/47_human_proxy_production_loop.prompt.md`
3. `.github/prompts/52_learner_frontend_production_loop.prompt.md`
4. `.github/prompts/58_human_proxy_full_menu_world_class_bjt_audit.prompt.md`
5. `DESIGN.md`
6. `docs/design/bjt-ui-ux-production-standard.md` when present
7. `company/FRONTEND_PRODUCTION_ORCHESTRATION.md`
8. `company/FRONTEND_ROUTE_PRIORITY.md`
9. `company/learner-ui-screen-contract.md`
10. `company/gates/world-class-learner-experience-gate.md`
11. `company/gates/bjt-ui-pro-max-craft-gate.md`
12. `company/gates/learner-page-production-gate.md`
13. `company/gates/agent-quality-gate.md`
14. `company/skills/bjt-ui-ux/09-bjt-ui-pro-max-craft-skill.md`
15. `company/agent-activity-trace.md`
16. `company/AGENT_ACTIVITY_BOARD.md`
17. `company/reviews/bjt-ui-ux/`
18. `docs/spec/compact/06_learner_ui_modules.md`
19. `docs/spec/compact/10_testing_acceptance.md`
20. `docs/spec/compact/11_learning_effectiveness_experience.md`
21. Read and follow all active Cursor rules in `.cursor/rules/*.mdc`.
</required-reading>

<current-documentation-assessment>
Existing frontend guidance is strong but incomplete:

- `DESIGN.md` defines the product design language and core surfaces.
- `company/FRONTEND_PRODUCTION_ORCHESTRATION.md` defines the slice workflow, required gates, specialist routing, auth-state evidence, CTA requirements, and anti-patterns.
- `company/FRONTEND_ROUTE_PRIORITY.md` defines major route priority, but it groups several small routes together and does not enumerate every small page/state.
- `company/learner-ui-screen-contract.md` is detailed enough for a screen, but each route still needs a filled contract/review artifact.
- `company/gates/world-class-learner-experience-gate.md` is strict enough for visual QA, but it must be applied to every route and state, not only the homepage.
- Existing review files cover FE-00 and FE-01, plus an older comprehensive review. They do not fully cover every current learner route and small supporting route.

Therefore Human Proxy must create or update route-specific screen contracts/review artifacts before marking a route done.
</current-documentation-assessment>

<frontend-screen-inventory>
Every item below needs a screen contract or review artifact under `company/reviews/bjt-ui-ux/`, even if the implementation is small.

Core authenticated learner app:

- `FE-00`: app shell, navigation, auth-aware frame, mobile More sheet, footer/trust surface
- `FE-01`: `/[locale]` Today Focus / Daily Hub dashboard
- `FE-02`: `/[locale]/quiz` BJT practice entry
- `FE-03`: quiz active session state inside `/[locale]/quiz` or future `/quiz/[sessionId]`
- `FE-04`: quiz result/coaching state inside `/[locale]/quiz` or future `/quiz/[sessionId]/results`
- `FE-05`: reusable reading assist layer across Japanese text components
- `FE-06`: `/[locale]/flashcards` flashcards/SRS/review/remediation
- `FE-07`: `/[locale]/battle` bot battle, matchmaking, result, error/abandon states
- `FE-08`: share/postcard flow and `/[locale]/share/[token]`
- `FE-09`: `/[locale]/search` dictionary/grammar/kanji/reference lookup
- `FE-10`: `/[locale]/analytics` learner progress and weak-skill analytics
- `FE-11`: `/[locale]/settings`
- `FE-12`: `/[locale]/settings/accounts`
- `FE-13`: `/[locale]/settings/notifications`
- `FE-14`: `/[locale]/settings/privacy`
- `FE-15`: `/[locale]/settings/reading`
- `FE-16`: `/[locale]/daily/[id]` Daily Hub detail/deep link

Auth and public support routes:

- `FE-17`: `/[locale]/login`
- `FE-18`: `/[locale]/register`
- `FE-19`: `/[locale]/onboarding`
- `FE-20`: `/[locale]/help` or replacement help/support route if currently missing
- `FE-21`: `/[locale]/privacy` learner-facing privacy route if currently missing
- `FE-22`: `/[locale]/terms` learner-facing terms route if currently missing
- `FE-23`: `/[locale]/feedback` or support/contact route if currently missing
- `FE-24`: not-found/error/session-expired/auth-error states

Cross-cutting states for every applicable route:

- guest desktop
- guest mobile 375px
- authenticated desktop using runtime local learner login
- authenticated mobile 375px using runtime local learner login
- auth loading/session checking
- auth error/session expired
- loading
- empty
- error
- degraded provider/API
- offline/network failure
- permission denied or feature disabled
- Vietnamese and Japanese locale rendering
</frontend-screen-inventory>

<micro-slice-policy>
Human Proxy must split work so a single agent cannot get stuck halfway through a giant frontend task.

Default slice size:

- one route, one state family, or one shared component layer;
- maximum one backend/API dependency cluster;
- maximum one visual system refactor scope;
- maximum one screenshot/evidence batch.

Examples of valid micro-slices:

- `FE-17-login-visual-language`: redesign learner login only, with guest desktop/mobile and auth-error states.
- `FE-11-settings-hub`: settings hub route only, including links and empty/error states.
- `FE-15-reading-settings`: reading preferences route only, including saved/degraded states.
- `FE-06-flashcard-review-cta`: flashcard primary review CTA and post-failure remediation only.
- `FE-08-share-public-token`: public share token page privacy-safe layout only.
- `FE-24-auth-error-state`: session expired/auth error recovery state across auth shell.

Invalid slices:

- "redesign all frontend"
- "fix learner UI"
- "complete frontend QA" without route batch
- "make everything world-class" without route, state, and evidence boundaries
</micro-slice-policy>

<unattended-no-stop-contract>
For this directive, Human Proxy must behave as if scoped unattended continuation is active for frontend UI/UX work.

Do not stop for:

- route requires `bjt-learner-ui`, `bjt-visual-experience`, `bjt-learning-science`, `bjt-qa`, or other specialist
- the next route needs a screen contract
- a browser route times out
- one route has missing backend support
- one route fails visual gate
- screenshots are missing for a route
- current slice finishes and another frontend route remains
- the work is large or spans many routes
- agent handoff would normally be needed
- "awaiting human review" for routine non-release frontend slices

Required behavior instead:

1. Pick the next smallest safe micro-slice.
2. Execute or inline the specialist pass.
3. If implementation is blocked by backend/API/schema gap, route and implement the smallest backend support or record a precise blocker, then continue to the next independent frontend slice.
4. If browser QA hangs, reduce the batch to one route and continue; record `blocked_environment` only for that route, not the whole overnight run.
5. If a route fails a visual gate, create a blocker and either fix it immediately or run the matching rescue prompt. Do not advance past the current route as `verified`, but continue productive work on independent routes when the current blocker is isolated.
6. If typecheck/test fails, attempt up to two targeted fixes for the same concrete failure. If still failing, record the exact command/error/owner and move to a safe independent documentation/contract/browser-evidence slice.
7. Continue until a true hard stop occurs.
</unattended-no-stop-contract>

<true-hard-stops>
Stop only for:

- destructive migration or data deletion
- security/privacy/legal/billing risk that requires real human acceptance
- external provider/secret/payment decision
- Release Director `no_ship`
- final public launch/go-live approval
- unrecoverable local environment failure that prevents any further source, contract, or browser-evidence work
</true-hard-stops>

<screen-contract-requirements>
For each `FE-*` item, create or update a review artifact under `company/reviews/bjt-ui-ux/` with:

- route and file paths
- target user and learner outcome
- primary action and secondary actions
- real data/API contract or explicit provider abstraction
- fake-data policy
- BJT/exam/reading-assist rules
- i18n namespaces and VI/JA copy notes
- media/image/audio/motion policy
- all relevant states
- desktop, mobile 375, tablet, 1024, 1440 layout notes when practical
- CTA state matrix: default, hover, focus-visible, active, loading, disabled
- footer/trust/support surface
- guest and authenticated evidence where applicable
- specialist review evidence
- acceptance gates and current pass/block status
- verification commands/browser routes/screenshots
- remaining blocker owner and next action
</screen-contract-requirements>

<world-class-uiux-rules-for-small-screens>
Small screens are not exempt from product quality.

- Login/register/onboarding must not be generic centered forms. They need brand/product signal, clear auth recovery, localized copy, session-error states, mobile quality, and trust links.
- Settings pages must feel like learner control surfaces, not placeholder preference lists.
- Privacy/account routes must make data export/delete/security choices understandable without dark patterns.
- Reading settings must explain furigana/meaning behavior and BJT timed-mode restrictions.
- Help/feedback routes must exist or footer links must be corrected; broken footer links block production readiness.
- Daily detail and share token routes need image/media provenance, privacy-safe metadata, and useful next action.
- Error/not-found/session-expired states need recovery paths and must match the design language.
- Any route with Japanese text must plan reading assist and Japanese readability.
- Any route with images must use real media/provenance/alt/fallback rules.
- Any route with analytics/progress must use real events/rollups or honest empty/degraded state.
</world-class-uiux-rules-for-small-screens>

<execution-order>
Recommended overnight execution order:

1. Create `FE-ALL-screen-inventory-and-status.md` from this prompt, marking each route `missing_contract`, `needs_browser_evidence`, `blocked_backend`, `blocked_visual`, `verified`, or `not_applicable`.
2. Stabilize browser QA in one-route or small route batches.
3. Close auth/public foundation:
   - `FE-17` login
   - `FE-18` register
   - `FE-19` onboarding
   - `FE-20..FE-24` footer/support/legal/error routes
4. Close shell/home:
   - `FE-00`
   - `FE-01`
   - `FE-16`
5. Close core learning:
   - `FE-02..FE-06`
6. Close battle/share/search/analytics/settings:
   - `FE-07..FE-15`
7. Run full learner browser route evidence in small batches.
8. Run release-director frontend sign-off only after all route evidence exists.
</execution-order>

<output>
Use this YAML shape:

```yaml
frontend_all_screens_uiux:
  status: continuing | blocked | stopped_for_approval
  unattended_frontend_directive: active
  selected_micro_slice:
  why_this_slice:
  screen_inventory_status:
    total:
    missing_contract:
    needs_browser_evidence:
    blocked_backend:
    blocked_visual:
    verified:
  agent_activity:
    active_now:
      - agent:
        responsibility:
        execution_mode: subagent | inline | planned | skipped
        status:
    completed:
      - agent:
        output_summary:
  files_changed:
    - path
  evidence:
    review_artifacts:
      - path
    screenshots:
      - path
    browser_routes:
      - route:
        result:
  verification:
    commands:
      - command:
        result:
  hard_stop_trigger:
    - none
  next_safe_micro_slice:
```
</output>
