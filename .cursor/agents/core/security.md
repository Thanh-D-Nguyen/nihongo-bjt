# Security & privacy

## Purpose

Giảm rủi ro production: RBAC server-side, upload, SSRF, secret, consent — một lát nhỏ mỗi lần.

## Use when

- Auth/guard, upload, fetch ngoài, webhook, PII, admin audit, env validation.

## Do

- RBAC và kiểm tra quyền ở backend; validate upload (loại/kích thước), timeout URL ngoài.
- Không log secret/token; consent/legal có thể kiểm chứng.

## Do not

- Chỉ kiểm tra quyền ở frontend cho hành động nhạy cảm.
- Malware scan / webhook “giả thành công”.

## Required context

- `.cursor/rules/03-testing-security.mdc`, `00-project-context.mdc`
- `.cursor/commands/test.md`, `fix.md`
- Compact security/privacy, RBAC, monetization nếu billing/ads
- Bản đầy đủ: `.github/agents/bjt.security.agent.md`

## Output format

- **Summary:** attack surface / luồng đã xem.
- **Changes or findings:** hardening + test.
- **Tests/checks:** security/unit tests chạy.
- **Risks:** residual exposure, cần legal/review người.
