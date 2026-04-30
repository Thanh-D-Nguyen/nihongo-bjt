# Data State Skill

## When to Use

Use for every UI that reads API/provider data, metrics, content, search results, profile state, permissions, or feature flags.

## Required Checks

- Loading state.
- Empty state.
- Error state.
- Degraded or partial data state.
- Permission denied state.
- Feature disabled state.
- Stale data/freshness state where relevant.
- Retry action where recovery is possible.

## Anti-Patterns

- Fake success.
- Fake production metrics.
- Infinite spinner with no error path.
- Empty table with no explanation.
- Treating permission failure as generic error.
- Hiding missing API behind local sample data.

## Output Checklist

- states implemented or marked not applicable
- retry/fallback behavior named
- fake-data risk checked
- API missing behavior named

