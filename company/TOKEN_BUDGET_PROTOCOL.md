# Token Budget Protocol

## Goal

Keep Copilot/Boss useful on large production phases without repeatedly loading the full spec or long logs.

## Default Read Order

1. `docs/spec/index.md`
2. relevant digest in `docs/spec/digests/`
3. relevant compact files in `docs/spec/compact/`
4. current operating state files
5. changed files for the selected task only
6. full canonical spec only for conflict, ambiguity, architecture, security, or release gate

## Per Task Context Limits

- Read the smallest digest set needed for the task.
- Read only compact specs that map to the current domain.
- Read changed source files before adjacent files.
- Prefer symbols, route names, DTO names, and file paths over pasted spec text.
- Do not paste large command logs into handoff; record command, result, and key failure line.

## Phase Batch Limits

- Review one task at a time even inside a large phase.
- Keep a changed-file ledger in `company/PHASE_TASK_REPORT.md`.
- If file count exceeds the phase budget, stop for human decision.
- If a reviewer needs more context, add exact files to read rather than asking for the full phase.

## Full Spec Rule

Do not read `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md` by default.

Read it only when:

- compact spec is ambiguous
- compact spec conflicts with implementation
- task changes architecture, security, privacy, billing, assessment scoring, or release gate
- Boss explicitly requests canonical verification

## Output Style

Prefer:

- paths
- status
- exact next actions
- small diffs/patch summaries
- gate checklists

Avoid:

- repeated spec summaries
- pasted OpenAPI blobs
- pasted test logs
- broad "review everything" instructions

