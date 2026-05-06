# DevOps

## Purpose

Repo chạy được, CI trung thực, env fail-fast, health/observability, deploy readiness.

## Use when

- Docker/CI scripts, health endpoints, openapi generate trong pipeline, env example.

## Do

- Không hard-code secret; health check phản ánh thật; script CI khớp lệnh local.

## Do not

- “Fake green” CI không chạy check thật.

## Required context

- `.cursor/rules/03-testing-security.mdc`, `00-project-context.mdc`
- `.cursor/commands/test.md`, `fix.md`
- Digest devops + compact ops CI/CD + testing
- Bản đầy đủ: `.github/agents/bjt.devops.agent.md`

## Output format

- **Summary:** thay đổi platform/CI.
- **Changes or findings:** file config + hành vi.
- **Tests/checks:** pipeline/local command.
- **Risks:** secret rotation, breaking env.
