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
export { AdminToastContainer, useAdminToast, type ToastVariant, type ToastMessage } from "./admin-toast";
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
export { ContextualHelpButton, type HelpContent, type HelpStep } from "./contextual-help";
export { Dialog } from "./dialog";
export { EmptyState } from "./empty-state";
export { ErrorState } from "./error-state";
export { FormField, FormInput, FormTextarea, FormSelect, FormError, FormSuccess } from "./form-field";
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
    ink: "#111827",
    muted: "#4B5563",
    paper: "#F8FAFC",
    surface: "#FFFFFF",
    sakura: "#DC2626",
    matcha: "#059669",
    navy: "#1B2A4A",
    blue: "#3B82F6",
    border: "#E2E8F0"
  },
  radius: {
    card: "14px",
    button: "10px",
    pill: "9999px"
  },
  shadow: {
    soft: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
    card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
    cardHover: "0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -1px rgba(15, 23, 42, 0.04)",
    dropdown: "0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)"
  }
} as const;

export type UiTokens = typeof uiTokens;
