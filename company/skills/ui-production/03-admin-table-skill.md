# Admin Table Skill

## When to Use

Use for admin lists, queues, registries, moderation views, audit logs, operations pages, and management tables.

## Required Checks

- Search exists when list can grow.
- Filters and sort exist where useful.
- Pagination or virtual loading exists for large lists.
- Row action menu is permission-aware.
- Bulk actions exist only when safe and useful.
- Status badges are human-readable.
- Empty, loading, error, degraded states exist.
- Dangerous actions require confirmation and audit reason where required.

## Anti-Patterns

- Raw IDs as primary labels.
- Internal event keys shown as user labels.
- Destructive action without confirm.
- Showing actions the user cannot perform.
- Unbounded table without pagination/loading plan.

## Output Checklist

- columns and labels reviewed
- actions and permissions reviewed
- pagination/filter/search decision recorded
- destructive action handling recorded

