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

/// Portable emoji per achievement slug, mirroring the web surface so the same
/// badge appears everywhere without an external image dependency.
const Map<String, String> _achievementIcon = {
  'vocab-master': '📚',
  'kanji-scholar': '漢',
  'grammar-sage': '📝',
  'streak-champion': '🔥',
  'battle-warrior': '⚔️',
  'quiz-ace': '🎯',
  'review-diligent': '🔄',
  'daily-explorer': '🌅',
};

/// Achievements tab — every achievement with the learner's tier progress
/// overlaid. Earned achievements are highlighted; in-progress ones show a
/// progress bar toward the next tier.
class AchievementsTab extends ConsumerWidget {
  const AchievementsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final achievements = ref.watch(achievementsProvider);

    return achievements.when(
      loading: () => const RewardsLoading(),
      error: (error, _) => RewardsErrorView(
        error: error,
        onRetry: () => ref.invalidate(achievementsProvider),
      ),
      data: (rows) {
        if (rows.isEmpty) {
          return EmptyStateView(
            icon: Icons.emoji_events_outlined,
            title: l10n.rewardsAchievementsEmptyTitle,
            message: l10n.rewardsAchievementsEmptyBody,
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(achievementsProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.m),
            itemCount: rows.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
            itemBuilder: (context, index) =>
                _AchievementCard(achievement: rows[index]),
          ),
        );
      },
    );
  }
}

class _AchievementCard extends StatelessWidget {
  const _AchievementCard({required this.achievement});

  final AchievementDef achievement;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    final active = achievement.activeTier;
    final emoji =
        _achievementIcon[achievement.slug] ??
        (achievement.isFullyEarned ? '⭐' : '☆');

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: achievement.isStarted
                      ? palette.accentSoft
                      : palette.surfaceMuted,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Text(emoji, style: const TextStyle(fontSize: 24)),
              ),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      achievement.name,
                      style: text.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: palette.ink,
                      ),
                    ),
                    if (active != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        '${l10n.rewardsAchievementTierLabel(active.tier)}'
                        ' • '
                        '${l10n.rewardsAchievementCategoryLabel(
                          achievement.category,
                        )}',
                        style: text.bodySmall?.copyWith(
                          color: palette.inkTertiary,
                        ),
                      ),
                    ],
                    if (achievement.description.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        achievement.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: text.bodyMedium?.copyWith(
                          color: palette.inkSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.s),
              _TierBadge(
                label: l10n.rewardsAchievementTiers(
                  achievement.earnedCount,
                  achievement.tiers.length,
                ),
                complete: achievement.isFullyEarned,
              ),
            ],
          ),
          if (active != null && !achievement.isFullyEarned) ...[
            const SizedBox(height: AppSpacing.m),
            _TierProgress(tier: active),
          ],
        ],
      ),
    );
  }
}

class _TierBadge extends StatelessWidget {
  const _TierBadge({required this.label, required this.complete});

  final String label;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: complete ? palette.accent : palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label,
        style: text.labelMedium?.copyWith(
          color: complete ? palette.canvas : palette.inkSecondary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _TierProgress extends StatelessWidget {
  const _TierProgress({required this.tier});

  final AchievementTier tier;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.pill),
          child: LinearProgressIndicator(
            value: tier.progressFraction,
            minHeight: 8,
            backgroundColor: palette.surfaceMuted,
            valueColor: AlwaysStoppedAnimation<Color>(palette.accent),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          l10n.rewardsAchievementProgress(
            tier.currentProgress,
            tier.threshold,
          ),
          style: text.bodySmall?.copyWith(color: palette.inkTertiary),
        ),
      ],
    );
  }
}
