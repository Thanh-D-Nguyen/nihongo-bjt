# Page Composition Skill

## When to Use

Use for full pages, route shells, dashboards, workflow pages, and major section layouts.

## Required Checks

- Header has title, subtitle, primary action, and context controls when useful.
- Breadcrumbs exist for nested admin flows when applicable.
- Summary/KPI/status area appears only when backed by real data.
- Main content is clear: table, form, chart, workflow, or detail view.
- Side context/action panel is used only when it improves workflow.
- Footer/debug information is dev-only.

## Anti-Patterns

- Full page with only a table and no context.
- Full page with only one button.
- Too many unrelated cards.
- Raw route/debug labels in production UI.
- Marketing layout inside operational admin pages.

## Output Checklist

- page sections listed
- primary action named
- state placement named
- responsive behavior noted

