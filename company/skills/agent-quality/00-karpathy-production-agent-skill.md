# Karpathy Production Agent Skill

## Source

Curated for NihonGo BJT from `forrestchang/andrej-karpathy-skills`:

- https://github.com/forrestchang/andrej-karpathy-skills

Use this as an agent behavior layer, not as a product requirement source.

## Purpose

Reduce the most expensive coding-agent failures:

- silent wrong assumptions;
- over-built abstractions;
- broad unrelated diffs;
- "looks done" output without measurable verification.

## Required Behavior

### 1. Think Before Coding

Before changing files, state the working assumption and the success criteria for the current task.

Ask only when the ambiguity materially changes product behavior, data safety, security, billing, privacy, or release approval. In unattended/admin loops, make the conservative production-safe assumption and record it when the policy allows continuation.

Surface tradeoffs instead of hiding them. If a requested approach would create fake production readiness, scattered auth checks, or high-risk churn, route to the simpler production path and explain the reason in the handoff.

### 2. Simplicity First

Implement the smallest production-grade vertical slice that satisfies the current objective.

Do not add speculative extension points, one-use abstractions, broad rewrites, or future-phase plumbing unless the current slice needs them to compile and pass its gates.

If an implementation becomes large because of avoidable indirection, reduce it before handoff.

### 3. Surgical Changes

Every changed line must trace to the current assignment.

Preserve the repo's existing style and local helpers. Do not reformat, rename, or refactor adjacent code only because it looks imperfect. Mention unrelated debt in the report instead of editing it.

Remove only the unused imports, variables, routes, or docs that your own changes made obsolete.

### 4. Goal-Driven Execution

Convert each task into verifiable goals before implementation.

Good acceptance criteria name:

- data source or provider contract;
- RBAC/auth boundary;
- audit behavior for admin writes;
- i18n/user-facing copy;
- state coverage;
- test or review command;
- expected docs/inventory update.

Weak criteria such as "make it work", "finish admin", or "improve UI" must be decomposed before execution.

## BJT Admin Adaptation

For admin production loops:

- one slice at a time;
- backend/API before UI when the contract is missing;
- no fake arrays, fake KPIs, fake charts, or UI-only enforcement;
- direct URL behavior must match nav/feature-flag state;
- writes require backend RBAC and audit evidence;
- the admin inventory must reflect reality after each slice.

Hidden/default-off routes are not automatically done. Under the current full-admin directive, they are either production-ready or blocked with evidence.

## Stop Versus Continue

Continue automatically under unattended policy when:

- the next task is dependency-safe;
- no destructive data/security/billing/privacy decision is required;
- tests are passing or within retry budget;
- the next owner/reviewer can be run or inlined.

Stop for the human when:

- release/go-live approval is requested;
- a destructive migration or data deletion decision is needed;
- provider secrets or external account choices are needed;
- Release Director returns `no_ship`;
- a P0/P1 risk needs explicit business acceptance.

## Handoff Proof

Every owner/reviewer pass must report:

- assumptions made;
- files changed;
- commands run and result;
- acceptance criteria status;
- remaining risks or explicit `none`;
- the next safe action.
