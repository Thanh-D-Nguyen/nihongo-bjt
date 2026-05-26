# Large Commit Apply Guide

Use this checklist when applying a large patch or commit that touches app code, API code, database schema, generated Prisma files, seeds, and lockfiles.

## 1. Inspect Before Editing

Run:

```bash
git status --short
git log --oneline --decorate -8
rg --files | rg '\.rej$|\.orig$'
git show --stat --oneline --find-renames HEAD
```

If the working tree is dirty, identify which changes are yours and which came from the patch. Do not revert unrelated local work.

## 2. Resolve Rejected Hunks First

For every `.rej` file:

1. Open the `.rej` file and the target file side by side.
2. Apply the rejected hunk manually against the current code shape.
3. Re-run a narrow syntax/type check for the touched file or package.
4. Delete the `.rej` file after the hunk is represented in source.

Never leave `.rej`, `.orig`, or `*.tsbuildinfo` files in a production commit unless there is an explicit reason.

## 3. Database Changes

When Prisma schema or migrations changed:

```bash
pnpm prisma:validate
pnpm prisma:generate
```

Then inspect:

```bash
git diff -- packages/database/prisma/schema.prisma packages/database/prisma/migrations packages/database/generated/client
```

Confirm the migration is forward-only and that generated client files match the schema.

## 4. Dependency And Lockfile Changes

If `package.json` changed, run install before verification:

```bash
pnpm install
```

Commit `pnpm-lock.yaml` only when dependency changes require it.

## 5. Verification Order

Use focused checks first:

```bash
pnpm --filter @nihongo-bjt/api typecheck
pnpm --filter @nihongo-bjt/web typecheck
pnpm --filter @nihongo-bjt/admin typecheck
pnpm test
```

For frontend-heavy commits, start the relevant app and verify the changed route in browser after typecheck passes.

## 6. Closeout

Before calling the apply done:

```bash
git status --short
rg --files | rg '\.rej$|\.orig$'
```

Write a short summary with:

- rejected hunks resolved
- database/migration files touched
- commands run and failures
- remaining risks or follow-ups
