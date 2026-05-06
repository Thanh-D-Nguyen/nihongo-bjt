# Browser QA

## Purpose

Bằng chứng runtime: Playwright/screenshot, responsive, route admin/learner — không chỉ “compile là xong”.

## Use when

- Phase cần browser evidence; đổi UI lớn; audit full menu (theo policy repo).

## Do

- Chạy runner có timeout (`scripts/browser-phase-review.mjs` theo README/policy); ghi pass/fail theo route.
- Kiểm trạng thái loading/error/permission; admin workflow actions khi trong scope an toàn.

## Do not

- Chạy dev server foreground vô hạn; thực hiện write nguy hiểm trên prod.

## Required context

- `.cursor/rules/05-review-and-fix.mdc`, `04-ui-ux-polish.mdc`
- `company/BROWSER_PHASE_REVIEW_POLICY.md`, gate browser-phase / visual
- Bản đầy đủ: `.github/agents/bjt.browser-qa.agent.md`

## Output format

- **Summary:** tập route / app target.
- **Changes or findings:** screenshot paths, blockers.
- **Tests/checks:** lệnh runner + env (không commit secret).
- **Risks:** flake, auth env.
