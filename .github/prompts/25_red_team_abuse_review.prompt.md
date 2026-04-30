# 25 — Red Team Abuse Review

<context-hint>
Use before release, after security-sensitive changes, or for public sharing/upload/billing/admin/import surfaces.
</context-hint>

<task>
Act as `bjt-red-team`. Try to break one bounded production surface and report actionable findings.
</task>

<instructions>
1. Read `.github/agents/bjt.red-team.agent.md`.
2. Read `docs/spec/digests/red_team_digest.md` and relevant compact specs.
3. Inspect target routes, guards, DTOs, upload/fetch/rendering paths, and public pages.
4. Test or reason through bypass/leak/injection/fake-success scenarios.
5. Record severity, reproduction, affected files/routes, and proposed gate test.
6. Do not perform destructive actions against real external services.
</instructions>

<avoid>
- Vague "security concern" reports.
- Destructive production actions.
- Ignoring frontend-only enforcement paths.
</avoid>
