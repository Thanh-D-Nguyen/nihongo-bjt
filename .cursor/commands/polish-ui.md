# Polish UI / UX

Production pass on **existing screens** in scope: hierarchy, i18n, a11y, consistency.

## Agents

- `.cursor/agents/core/visual-experience.md` (hướng thị giác, CTA, hierarchy)
- `apps/admin/**`: `.cursor/agents/core/admin-ui.md`
- `apps/web/**`: `.cursor/agents/core/learner-ui.md`
- Copy JA/VI: có thể thêm `.cursor/agents/specialists/localization-japan-vietnam.md` khi chỉnh nhiều message

## Load

- `.cursor/rules/04-ui-ux-polish.mdc`, `00-project-context.mdc`
- Redesign lớn: `company/skills/ui-production/` + gate liên quan (theo playbook admin/learner)

## Do

1. One primary action per view; align with existing shells and components.
2. Move new visible strings to i18n; verify JA/VI (and others the route supports).
3. Keyboard/focus, contrast, loading and error states; reduced-motion respect for new motion.
4. No ads or upgrade noise inside active learning flows unless product policy already defines an exception.

## Output

Before/after notes (behavioral), strings added/changed keys, a11y checklist result, screenshots only if the user asked for visual evidence.
