# Progressive Context Digest Protocol

To reduce token usage, every major agent must update a short digest instead of forcing later agents to read huge docs.

Digest path:

`company/PROJECT_STATE.md`

Maximum digest size:

- 20 bullets for project state
- 20 bullets for remaining gaps
- 10 bullets for current sprint
- 10 bullets for known risks

Later agents should read this first, then only read source files relevant to their task.
