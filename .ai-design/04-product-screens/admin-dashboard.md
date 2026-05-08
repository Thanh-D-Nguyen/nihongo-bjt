# Screen — Admin Dashboard (Production Spec)

## Goal
SaaS-grade admin overview. Dense, informative, zero fake charts. Every metric backed by real data.

## Layout — Desktop (≥ 1280px)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR (240px, fixed)  │  MAIN CONTENT                                 │
│ ┌─────────────────────┐ │                                               │
│ │ 🏢 NihonGo BJT      │ │  ┌─ HEADER ────────────────────────────────┐  │
│ │                     │ │  │ Dashboard        [Today ▼] [🔔 3] [👤]  │  │
│ │ 📊 Dashboard   ◀   │ │  └──────────────────────────────────────────┘  │
│ │ 👥 Users           │ │                                               │
│ │ 📚 Content         │ │  ┌─ KPI CARDS (4-column grid) ──────────────┐  │
│ │ 📝 Assessments     │ │  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │  │
│ │ 🎮 Battles         │ │  │ │Active│ │Daily │ │Revenue│ │Content│   │  │
│ │ 💰 Monetization    │ │  │ │Users │ │Study │ │ MRR  │ │ Items│    │  │
│ │ ⚙️ Settings        │ │  │ │12,450│ │ 89%  │ │$24.5k│ │15,200│    │  │
│ │ 📈 Analytics       │ │  │ │+12%↑ │ │ -2%↓ │ │+8% ↑ │ │+150 │    │  │
│ │                     │ │  │ └──────┘ └──────┘ └──────┘ └──────┘    │  │
│ │ ─────────────────── │ │  └──────────────────────────────────────────┘  │
│ │ 🔍 Quick search    │ │                                               │
│ └─────────────────────┘ │  ┌─ CHARTS (2-column) ─────────────────────┐  │
│                         │  │ ┌───────────────┐ ┌───────────────────┐ │  │
│                         │  │ │ User Growth   │ │ Learning Activity │ │  │
│                         │  │ │ (line chart)  │ │ (bar chart)       │ │  │
│                         │  │ │               │ │                   │ │  │
│                         │  │ └───────────────┘ └───────────────────┘ │  │
│                         │  └──────────────────────────────────────────┘  │
│                         │                                               │
│                         │  ┌─ RECENT ACTIVITY ────────────────────────┐  │
│                         │  │ • Admin X edited Assessment Y   2 min ago│  │
│                         │  │ • User report flagged           5 min ago│  │
│                         │  │ • Content import completed     12 min ago│  │
│                         │  │ [View all activity →]                    │  │
│                         │  └──────────────────────────────────────────┘  │
│                         │                                               │
│                         │  ┌─ SYSTEM HEALTH ─────────────────────────┐  │
│                         │  │ API: ● OK | DB: ● OK | Redis: ● OK     │  │
│                         │  │ Search: ● OK | Queue: 3 pending         │  │
│                         │  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Visual Specifications

### Sidebar
- Width: 240px (expanded), 64px (collapsed)
- Background: `--color-admin-sidebar` (#1E293B)
- Text: `--color-admin-sidebar-text` (#E2E8F0)
- Active item: `--color-admin-sidebar-active` bg with `--radius-sm`, white text
- Hover: rgba(255,255,255,0.05) bg
- Icon size: 20px, consistent stroke weight
- Collapse transition: `--duration-moderate` `--ease-default`
- Logo area: 56px height, centered

### KPI Cards
- Background: `--color-bg-surface`
- Border: `1px solid --color-border-default`
- Radius: `--radius-lg`
- Padding: 20px
- Shadow: `--shadow-card`
- Metric value: `text-h2`, weight 700, `--color-text-primary`
- Metric label: `text-body-sm`, `--color-text-secondary`
- Trend indicator: `text-caption`, green (↑ positive) or red (↓ negative) with arrow icon
- Hover: `--shadow-card-hover`, slight translateY(-1px)
- Grid: 4 columns on xl, 2 columns on lg, 1 on mobile

### Charts
- Background: `--color-bg-surface`
- Border: `1px solid --color-border-default`
- Radius: `--radius-lg`
- Padding: 24px
- Title: `text-h4`, 16px margin-bottom
- Chart colors: brand-blue (primary), brand-navy (secondary), success/warning for thresholds
- Axis labels: `text-caption`, `--color-text-tertiary`
- Grid lines: `--color-border-default`, 1px, dashed
- Tooltip: `--shadow-dropdown`, `--radius-sm`, 12px padding
- Empty state: "No data for this period" with date range suggestion
- **NEVER fake data** — show real analytics or clear empty state

### Activity Feed
- Item height: 44px
- Avatar: `--avatar-xs` (24px)
- Action text: `text-body-sm`
- Timestamp: `text-caption`, `--color-text-tertiary`
- Divider: `1px solid --color-border-default`
- Max visible: 5 items + "View all" link

### System Health
- Status dot: 8px circle
- OK: `--color-success`
- Warning: `--color-warning`
- Error: `--color-error`, pulse animation
- Background: `--color-bg-sunken`
- Radius: `--radius-md`

## Permission-Aware Behavior

| Role | Visible Modules |
|------|----------------|
| Super Admin | Everything |
| Content Admin | Content, Assessments, basic Analytics |
| Moderator | Users (view), Reports, Battles (moderate) |
| Analytics Viewer | Dashboard KPIs, Analytics (read-only) |

Hidden modules show no trace — no disabled items, no "upgrade" prompts.

## Rules
1. All metrics must be real (backed by database queries/analytics events).
2. Charts show loading skeleton, then real data — never placeholder fake lines.
3. Sidebar active state clearly indicates current page.
4. KPI cards show comparison to previous period (day/week/month configurable).
5. Dashboard loads progressively — KPIs first, then charts, then activity feed.
6. Admin actions are audit-logged — every click that changes data.
