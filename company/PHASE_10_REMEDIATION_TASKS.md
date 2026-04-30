# PHASE-10 Remediation Tasks

Generated: 2026-04-30

## Summary

**Critical Blockers**: 4 (must fix before launch)
**High-Priority Recommendations**: 4 (should fix)
**Total Effort**: 24–31 hours
**Timeline**: 3–4 days parallel execution
**Gate Decision**: BLOCK — Do not ship until P0 tasks complete

---

## P0 Critical Blockers (14–18 hours)

### PH10-T04-P0-1: Flashcard Remediation + Comeback Persistence
- **Owner**: bjt-learner-ui (primary) + bjt-backend
- **Effort**: 6–8 hours
- **Gate**: Blocks launch (learning science violation: no feedback after failure)
- **Scope**:
  - Add skill tag + explanation after 'again' rating
  - Verify comeback mode persistence in schema
  - Fix type casting in repository layer
  - Add integration test

### PH10-T04-P0-2: Battle Share UI + Feature Flag Disable
- **Owner**: bjt-learner-ui (primary) + bjt-backend
- **Effort**: 8–10 hours
- **Gate**: Blocks launch (user control + feature incomplete)
- **Scope**:
  - Implement share button on battle outcome
  - Generate postcard with battle result
  - Privacy preview before share
  - Disable feature flag in .env.production

---

## P1 High-Priority (10–13 hours)

### PH10-T04-P1-1: Daily Hub Skeleton + Remediation Link
- **Owner**: bjt-learner-ui
- **Effort**: 3–4 hours

### PH10-T04-P1-2: Quiz Mode Badge + Caveat Copy
- **Owner**: bjt-learner-ui
- **Effort**: 3–4 hours

### PH10-T04-P1-3: Reading Assist + Progress Weak Skills
- **Owner**: bjt-learner-ui + bjt-backend
- **Effort**: 4–5 hours

---

## Execution Gates

**Before P0 Start**:
- Task breakdown approved ✓
- Owner assignments confirmed
- Effort estimates validated

**After P0 Complete**:
- All tests pass (100%)
- Typecheck pass
- Browser QA verified
- Feature flag audit complete
- Decision: Continue to P1?

**After P1 Complete**:
- All tests pass
- Mobile 375px verified
- Re-run learner-page-production-gate
- Decision: Approve PHASE-10?

---

## Risk Summary

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Schema mismatch (comebackMode) | high | Verify schema immediately |
| Postcard generation timeout | medium | Test with real data |
| Mobile layout regressions | medium | Test 375px for all P1 tasks |
| Feature flag state mismatch | low | Verify disable in .env.production |

