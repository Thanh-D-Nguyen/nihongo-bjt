# UI Performance Skill

## When to Use

Use for data-heavy pages, dashboards, tables, search, media, learner study flows, quizzes, and pages with many components.

## Required Checks

- Avoid unnecessary client rendering.
- Paginate or window large lists.
- Debounce search/filter inputs where needed.
- Avoid duplicate API calls.
- Optimize images/media and use dimensions.
- Keep critical learner actions responsive.
- Do not block UI on non-critical analytics.

## Anti-Patterns

- Fetching unbounded lists.
- Recomputing large derived data on every render.
- Layout shift from images or charts.
- Loading all media at once.
- Client-only data joins that should be backend/provider work.

## Output Checklist

- data size assumption named
- loading/render strategy noted
- image/media handling noted
- performance risks owned

