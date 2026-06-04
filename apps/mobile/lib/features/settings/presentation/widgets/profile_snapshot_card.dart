import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/progress/domain/study_summary.dart';
import 'package:nihongo_bjt/features/progress/presentation/progress_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// Learning snapshot card sourced from the device-local [studySummaryProvider]
/// (streak / reviewed today / last 7 days / all-time). Honest by construction:
/// while data resolves it shows a skeleton, on error or no activity it shows an
/// encouraging empty state — never fabricated metrics.
class ProfileSnapshotCard extends ConsumerWidget {
  const ProfileSnapshotCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final summary = ref.watch(studySummaryProvider);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.profileSnapshotTitle,
            style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.m),
          summary.when(
            data: (data) =>
                data.isEmpty ? const _SnapshotEmpty() : _SnapshotStats(data),
            loading: () => const _SnapshotSkeleton(),
            error: (_, _) => const _SnapshotEmpty(),
          ),
        ],
      ),
    );
  }
}

class _SnapshotStats extends StatelessWidget {
  const _SnapshotStats(this.summary);

  final StudySummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final tiles = [
      _StatTile(
        icon: Icons.local_fire_department_rounded,
        value: summary.currentStreakDays.toString(),
        label: l10n.profileSnapshotStreak,
        accent: palette.warning,
      ),
      _StatTile(
        icon: Icons.today_rounded,
        value: summary.reviewedToday.toString(),
        label: l10n.profileSnapshotToday,
        accent: palette.accent,
      ),
      _StatTile(
        icon: Icons.calendar_view_week_rounded,
        value: summary.last7DayTotal.toString(),
        label: l10n.profileSnapshotWeek,
        accent: palette.info,
      ),
      _StatTile(
        icon: Icons.bar_chart_rounded,
        value: summary.totalReviews.toString(),
        label: l10n.profileSnapshotTotal,
        accent: palette.success,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final twoCols = constraints.maxWidth < 420;
        final perRow = twoCols ? 2 : 4;
        const gap = AppSpacing.s;
        final tileWidth =
            (constraints.maxWidth - gap * (perRow - 1)) / perRow;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final tile in tiles)
              SizedBox(width: tileWidth, child: tile),
          ],
        );
      },
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.value,
    required this.label,
    required this.accent,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s,
          vertical: AppSpacing.m,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: accent),
            const SizedBox(height: AppSpacing.s),
            Text(
              value,
              style: text.headlineSmall?.copyWith(
                color: palette.ink,
                fontWeight: FontWeight.w800,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: text.bodySmall?.copyWith(color: palette.inkSecondary),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _SnapshotEmpty extends StatelessWidget {
  const _SnapshotEmpty();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.auto_graph_rounded,
              size: 22,
              color: palette.inkTertiary,
            ),
            const SizedBox(width: AppSpacing.s),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.profileSnapshotEmptyTitle,
                    style: text.titleSmall?.copyWith(
                      color: palette.ink,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.profileSnapshotEmptyBody,
                    style: text.bodySmall?.copyWith(
                      color: palette.inkSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SnapshotSkeleton extends StatelessWidget {
  const _SnapshotSkeleton();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return LayoutBuilder(
      builder: (context, constraints) {
        final twoCols = constraints.maxWidth < 420;
        final perRow = twoCols ? 2 : 4;
        const gap = AppSpacing.s;
        final tileWidth =
            (constraints.maxWidth - gap * (perRow - 1)) / perRow;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (var i = 0; i < 4; i++)
              SizedBox(
                width: tileWidth,
                height: 92,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: palette.surfaceMuted,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
