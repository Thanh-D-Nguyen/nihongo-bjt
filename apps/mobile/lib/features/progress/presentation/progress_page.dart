import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_review_page.dart'
    show ratingColor, ratingLabel;
import 'package:nihongo_bjt/features/progress/domain/coaching_snapshot.dart';
import 'package:nihongo_bjt/features/progress/domain/study_summary.dart';
import 'package:nihongo_bjt/features/progress/presentation/progress_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Progress tab — honest, device-local study analytics.
///
/// Every figure comes from real recorded review events; there are no fabricated
/// streaks or inflated metrics. Before any review is recorded the screen shows
/// an encouraging empty state rather than zeroes dressed up as progress.
class ProgressPage extends ConsumerWidget {
  const ProgressPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final summary = ref.watch(studySummaryProvider);
    return AppScaffold(
      title: l10n.progressTitle,
      body: summary.when(
        loading: () => const _ProgressLoading(),
        error: (_, _) => ErrorStateView(
          title: l10n.progressErrorTitle,
          message: l10n.progressError,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(studySummaryProvider),
        ),
        data: (data) => data.isEmpty
            ? EmptyStateView(
                icon: Icons.insights_outlined,
                title: l10n.progressEmptyTitle,
                message: l10n.progressEmptyBody,
              )
            : _ProgressView(summary: data),
      ),
    );
  }
}

class _ProgressView extends StatelessWidget {
  const _ProgressView({required this.summary});

  final StudySummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.l),
      children: [
        SectionHeader(title: l10n.progressTitle, subtitle: l10n.progressIntro),
        const SizedBox(height: AppSpacing.m),
        const _CoachingCard(),
        _StatGrid(summary: summary),
        const SizedBox(height: AppSpacing.l),
        _ActivityChart(summary: summary),
        if (summary.ratingTotals.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.l),
          _RatingBreakdown(summary: summary),
        ],
      ],
    );
  }
}

/// Supplementary "next step" card mirroring the web analytics coaching block.
///
/// Watches [coachingSnapshotProvider] and renders a single recommended action
/// plus an encouraging nudge, both derived from real server analytics. While
/// loading, on error, or when there is no usable signal it renders nothing —
/// the device-local metrics below remain the honest source of truth.
class _CoachingCard extends ConsumerWidget {
  const _CoachingCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshot = ref.watch(coachingSnapshotProvider).value;
    if (snapshot == null) return const SizedBox.shrink();

    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    final isFlashcards = snapshot.primaryAction == CoachingAction.flashcards;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.l),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCard(
            padding: const EdgeInsets.all(AppSpacing.l),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.progressCoachingTitle,
                  style: text.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: palette.ink,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  _hintLabel(l10n, snapshot),
                  style: text.bodyMedium?.copyWith(
                    color: palette.inkSecondary,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: AppSpacing.m),
                PrimaryButton(
                  label: isFlashcards
                      ? l10n.progressCoachingCtaFlashcards
                      : l10n.progressCoachingCtaQuiz,
                  icon: isFlashcards
                      ? Icons.style_outlined
                      : Icons.fact_check_outlined,
                  onPressed: () => _open(context, snapshot.primaryAction),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.s),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.m),
            decoration: BoxDecoration(
              color: palette.successSoft,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.progressCoachingNudgeTitle.toUpperCase(),
                  style: text.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    color: palette.success,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  _nudgeLabel(l10n, snapshot),
                  style: text.bodyMedium?.copyWith(
                    color: palette.ink,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
          if (snapshot.insight.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.s),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.m),
              decoration: BoxDecoration(
                color: palette.accentSoft,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.progressCoachingInsightTitle.toUpperCase(),
                    style: text.labelSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                      color: palette.accent,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    snapshot.insight,
                    style: text.bodyMedium?.copyWith(
                      color: palette.ink,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _hintLabel(AppLocalizations l10n, CoachingSnapshot s) {
    return switch (s.primaryHint) {
      CoachingHint.flashcardsDue => l10n.progressCoachingHintFlashcardsDue(
        s.dueFlashcards,
      ),
      CoachingHint.quizSkills => l10n.progressCoachingHintQuizSkills,
      CoachingHint.quizAccuracy => l10n.progressCoachingHintQuizAccuracy,
      CoachingHint.maintain => l10n.progressCoachingHintMaintain,
    };
  }

  String _nudgeLabel(AppLocalizations l10n, CoachingSnapshot s) {
    return switch (s.nudge) {
      CoachingNudge.due => l10n.progressCoachingNudgeDue(s.dueFlashcards),
      CoachingNudge.weak => l10n.progressCoachingNudgeWeak,
      CoachingNudge.streak => l10n.progressCoachingNudgeStreak(s.streakDays),
      CoachingNudge.calm => l10n.progressCoachingNudgeCalm,
    };
  }

  void _open(BuildContext context, CoachingAction action) {
    switch (action) {
      case CoachingAction.flashcards:
        unawaited(context.pushNamed(Routes.flashcardDueReview));
      case CoachingAction.quiz:
        context.goNamed(Routes.exam);
    }
  }
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.summary});

  final StudySummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _StatTile(
                icon: Icons.today_outlined,
                label: l10n.progressTodayLabel,
                value: l10n.progressCardsValue(summary.reviewedToday),
                highlighted: true,
              ),
            ),
            const SizedBox(width: AppSpacing.m),
            Expanded(
              child: _StatTile(
                icon: Icons.local_fire_department_outlined,
                label: l10n.progressStreakLabel,
                value: l10n.progressStreakValue(summary.currentStreakDays),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.m),
        Row(
          children: [
            Expanded(
              child: _StatTile(
                icon: Icons.calendar_view_week_outlined,
                label: l10n.progressWeekLabel,
                value: l10n.progressCardsValue(summary.last7DayTotal),
              ),
            ),
            const SizedBox(width: AppSpacing.m),
            Expanded(
              child: _StatTile(
                icon: Icons.history_outlined,
                label: l10n.progressTotalLabel,
                value: l10n.progressCardsValue(summary.totalReviews),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.label,
    required this.value,
    this.highlighted = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final theme = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: highlighted ? palette.accentSoft : palette.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(
              icon,
              size: 22,
              color: highlighted ? palette.accent : palette.inkSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.m),
          Text(
            value,
            style: theme.textTheme.headlineSmall?.copyWith(color: palette.ink),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: palette.inkSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActivityChart extends StatelessWidget {
  const _ActivityChart({required this.summary});

  final StudySummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final theme = Theme.of(context);
    final peak = summary.peakDayCount;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.progressActivityTitle,
            style: theme.textTheme.titleMedium?.copyWith(color: palette.ink),
          ),
          const SizedBox(height: AppSpacing.l),
          SizedBox(
            height: 120,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final day in summary.dailyCounts)
                  Expanded(
                    child: _ActivityBar(
                      count: day.count,
                      peak: peak,
                      dayLabel: '${day.date.day}',
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActivityBar extends StatelessWidget {
  const _ActivityBar({
    required this.count,
    required this.peak,
    required this.dayLabel,
  });

  final int count;
  final int peak;
  final String dayLabel;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final theme = Theme.of(context);
    // Bar area leaves room for the count + day labels inside the 120px chart.
    const maxBarHeight = 72.0;
    final fraction = peak == 0 ? 0.0 : count / peak;
    final height = count == 0 ? 4.0 : 8 + fraction * (maxBarHeight - 8);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Text(
            count == 0 ? '' : '$count',
            style: theme.textTheme.labelSmall?.copyWith(
              color: palette.inkSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Container(
            height: height,
            decoration: BoxDecoration(
              color: count == 0 ? palette.border : palette.accent,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            dayLabel,
            style: theme.textTheme.labelSmall?.copyWith(
              color: palette.inkTertiary,
            ),
          ),
        ],
      ),
    );
  }
}

class _RatingBreakdown extends StatelessWidget {
  const _RatingBreakdown({required this.summary});

  final StudySummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final theme = Theme.of(context);
    final totals = summary.ratingTotals;
    final maxValue = totals.values.fold(0, (max, v) => v > max ? v : max);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.progressRatingTitle,
            style: theme.textTheme.titleMedium?.copyWith(color: palette.ink),
          ),
          const SizedBox(height: AppSpacing.m),
          for (final rating in SrsRating.values)
            if ((totals[rating] ?? 0) > 0)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.s),
                child: _RatingRow(
                  rating: rating,
                  count: totals[rating] ?? 0,
                  maxValue: maxValue,
                ),
              ),
        ],
      ),
    );
  }
}

class _RatingRow extends StatelessWidget {
  const _RatingRow({
    required this.rating,
    required this.count,
    required this.maxValue,
  });

  final SrsRating rating;
  final int count;
  final int maxValue;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final theme = Theme.of(context);
    final color = ratingColor(palette, rating);
    final fraction = maxValue == 0 ? 0.0 : count / maxValue;
    return Row(
      children: [
        SizedBox(
          width: 56,
          child: Text(
            ratingLabel(l10n, rating),
            style: theme.textTheme.bodySmall?.copyWith(color: palette.ink),
          ),
        ),
        const SizedBox(width: AppSpacing.s),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 10,
              semanticsLabel: ratingLabel(l10n, rating),
              backgroundColor: palette.surfaceMuted,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.s),
        SizedBox(
          width: 28,
          child: Text(
            '$count',
            textAlign: TextAlign.end,
            style: theme.textTheme.labelMedium?.copyWith(
              color: palette.inkSecondary,
            ),
          ),
        ),
      ],
    );
  }
}

class _ProgressLoading extends StatelessWidget {
  const _ProgressLoading();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(AppSpacing.l),
      child: LoadingStateView(),
    );
  }
}
