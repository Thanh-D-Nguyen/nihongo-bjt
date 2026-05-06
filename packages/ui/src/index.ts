export {
  AdminChartCard,
  AdminEmptyState,
  AdminFilterBar,
  AdminInsightCard,
  AdminKpiCard,
  AdminMetricTrend,
  AdminPageHeader,
  AdminSearchInput,
  AdminSection,
  AdminSelect,
  AdminStatusBadge,
  AdminTaskCard
} from "./admin-console";
export {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCellActions,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh
} from "./admin-data-table";
export { ActionCard } from "./action-card";
export {
  AdminShell,
  isAdminNavItemActive,
  type AdminNavLabels,
  type AdminShellChromeLabels
} from "./admin-shell";
export type {
  AdminNavGroupDefinition,
  AdminNavGroupResolved,
  AdminNavItemDefinition,
  AdminNavItemResolved,
  AdminNavItemStatus
} from "./admin-nav-types";
export { AppShell } from "./app-shell";
export { Badge, type BadgeTone } from "./badge";
export { Button, ButtonLink, buttonClassName, type ButtonSize, type ButtonVariant } from "./button";
export { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
/** Alias for design-system docs (same as `Card`). */
export { Card as BaseCard } from "./card";
export { cn } from "./cn";
export { Dialog } from "./dialog";
export { EmptyState } from "./empty-state";
export { ErrorState } from "./error-state";
export { Input } from "./input";
export { LearningFeedback, type LearningFeedbackTone } from "./learning-feedback";
export { LoadingSkeleton } from "./loading-skeleton";
export { PageHeader } from "./page-header";
export { ProgressBar } from "./progress-bar";
export { ProgressCard } from "./progress-card";
export { ReadingAssistPopoverPanel } from "./reading-assist-popover";
export { SectionHeader, type SectionHeaderProps } from "./section-header";
export { Sheet } from "./sheet";
export { SkillChip } from "./skill-chip";
export { StatCard } from "./stat-card";
export { StatusBadge, type StatusBadgeVariant } from "./status-badge";
export { TabButton, TabsList } from "./tabs";
export { TodayPlanCard } from "./today-plan-card";

export const uiTokens = {
  color: {
    ink: "#17211f",
    muted: "#66736f",
    paper: "#f8f4ec",
    surface: "#fffdf8",
    sakura: "#d9898f",
    matcha: "#557c55"
  },
  radius: {
    card: "24px",
    button: "999px"
  },
  shadow: {
    soft: "0 24px 80px rgba(23, 33, 31, 0.10)"
  }
} as const;

export type UiTokens = typeof uiTokens;
