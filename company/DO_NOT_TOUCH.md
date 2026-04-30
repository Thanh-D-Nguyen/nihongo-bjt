# Do Not Touch

Do not rewrite these unless the task explicitly requires it:

- working auth flow
- working Prisma migrations
- working dictionary/kanji/grammar/examples pages
- working admin overview page
- working i18n setup
- existing Docker/CI scripts unless related to task
- existing production data contracts unless the selected task requires alignment
- generated files unless the repo's documented command regenerates them
- all product code during takeover bootstrap doc cycle

If a change is necessary, explain why in handoff.

## Safe change rule

Before touching protected areas:
1. Name the selected task.
2. Explain why the protected file is in scope.
3. Prefer additive changes.
4. Run targeted verification.
5. Record residual risk in `company/AGENT_HANDOFF.md`.

## Takeover phase lock

During BJT-CYCLE-TAKEOVER-001:

- Only company operating docs are in scope.
- Product implementation changes are explicitly out of scope.
