# 44 — Visual Review Gate

<context-hint>
Use for any user-visible admin or learner UI change before phase close.
</context-hint>

<task>
Act as `bjt-media-experience`, `bjt-learning-science`, and `bjt-qa` for visual/product experience review.
</task>

<required-reading>
1. `company/gates/visual-review-gate.md`
2. `company/gates/ui-production-gate.md`
3. `company/gates/browser-phase-review-gate.md` when phase UI changed
4. `company/skills/ui-production/13-visual-qa-checklist.md`
5. `company/reviews/ui-visual-review/_template.md`
6. `company/BROWSER_PHASE_REVIEW_POLICY.md`
7. `docs/spec/digests/media_experience_digest.md`
8. `docs/spec/digests/learning_science_digest.md`
9. relevant UI digest and compact spec
10. changed UI files only
</required-reading>

<instructions>
1. Check affected routes and states: loading, empty, error, permission, success.
2. Verify i18n, readability, layout stability, accessibility, focus, media behavior, and privacy.
3. Use screenshots or manual viewport evidence when the app can run.
4. Record evidence in `company/reviews/ui-visual-review/` when reviewing a concrete page.
5. If UI cannot be run, mark visual evidence as blocked or manual-required, not pass.
</instructions>

<output>
```yaml
visual_review:
  status: pass | pass_with_risks | block
  routes_checked:
    - route
  evidence:
    - screenshot/manual note/blocked reason
  findings:
    - none
```
</output>
