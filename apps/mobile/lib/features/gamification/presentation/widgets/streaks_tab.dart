import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/gamification/domain/gamification_models.dart';
import 'package:nihongo_bjt/features/gamification/presentation/gamification_providers.dart';
import 'package:nihongo_bjt/features/gamification/presentation/widgets/rewards_states.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';

/// Streaks tab — one card per streak track, showing the current run, the
/// personal best, and remaining streak freezes. All figures are
/// server-authoritative.
class StreaksTab extends ConsumerWidget {
  const StreaksTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final streaks = ref.watch(streaksProvider);

    return streaks.when(
      loading: () => const RewardsLoading(),
      error: (error, _) => RewardsErrorView(
        error: error,
        onRetry: () => ref.invalidate(streaksProvider),
      ),
      data: (rows) {
        if (rows.isEmpty) {
          return EmptyStateView(
            icon: Icons.local_fire_department_outlined,
            title: l10n.rewardsStreaksEmptyTitle,
            message: l10n.rewardsStreaksEmptyBody,
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(streaksProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.m),
            itemCount: rows.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
            itemBuilder: (context, index) => _StreakCard(streak: rows[index]),
          ),
        );
      },
    );
  }
}

class _StreakCard extends StatelessWidget {
  const _StreakCard({required this.streak});

  final StreakData streak;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    final title = streak.name.isNotEmpty
        ? streak.name
        : l10n.rewardsStreakDefaultName;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: palette.accentSoft,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(
                  Icons.local_fire_department_rounded,
                  size: 24,
                  color: palette.accent,
                ),
              ),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: text.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: palette.ink,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.rewardsStreakCurrent(streak.currentStreak),
                      style: text.bodyMedium?.copyWith(
                        color: palette.inkSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.m),
          Row(
            children: [
              Expanded(
                child: _StreakStat(
                  label: l10n.rewardsStreakLongest,
                  value: l10n.rewardsStreakDays(streak.longestStreak),
                ),
              ),
              const SizedBox(width: AppSpacing.s),
              Expanded(
                child: _StreakStat(
                  label: l10n.rewardsStreakFreezes,
                  value: '${streak.freezesLeft}',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StreakStat extends StatelessWidget {
  const _StreakStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s),
      decoration: BoxDecoration(
        color: palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: text.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: palette.ink,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: text.bodySmall?.copyWith(color: palette.inkTertiary),
          ),
        ],
      ),
    );
  }
}
