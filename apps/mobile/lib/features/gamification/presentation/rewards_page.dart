import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/gamification/domain/gamification_models.dart';
import 'package:nihongo_bjt/features/gamification/presentation/widgets/achievements_tab.dart';
import 'package:nihongo_bjt/features/gamification/presentation/widgets/leaderboards_tab.dart';
import 'package:nihongo_bjt/features/gamification/presentation/widgets/streaks_tab.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';

/// The learner Rewards hub — server-authoritative streaks, achievement
/// progress, and competitive leaderboards from `/api/gamification/*`. One tab
/// per [RewardsTab]; every figure is real (no fabricated streaks or scores).
class RewardsPage extends ConsumerStatefulWidget {
  const RewardsPage({super.key});

  @override
  ConsumerState<RewardsPage> createState() => _RewardsPageState();
}

class _RewardsPageState extends ConsumerState<RewardsPage> {
  RewardsTab _tab = RewardsTab.streaks;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return AppScaffold(
      title: l10n.rewardsTitle,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.m,
              AppSpacing.s,
              AppSpacing.m,
              AppSpacing.s,
            ),
            child: _RewardsTabs(
              selected: _tab,
              onSelected: (tab) => setState(() => _tab = tab),
            ),
          ),
          Expanded(
            child: switch (_tab) {
              RewardsTab.streaks => const StreaksTab(),
              RewardsTab.achievements => const AchievementsTab(),
              RewardsTab.leaderboards => const LeaderboardsTab(),
            },
          ),
        ],
      ),
    );
  }
}

class _RewardsTabs extends StatelessWidget {
  const _RewardsTabs({required this.selected, required this.onSelected});

  final RewardsTab selected;
  final ValueChanged<RewardsTab> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Row(
      children: [
        for (final tab in RewardsTab.values) ...[
          Expanded(
            child: _RewardsTabButton(
              label: _tabLabel(l10n, tab),
              selected: tab == selected,
              onTap: () => onSelected(tab),
            ),
          ),
          if (tab != RewardsTab.values.last)
            const SizedBox(width: AppSpacing.s),
        ],
      ],
    );
  }
}

class _RewardsTabButton extends StatelessWidget {
  const _RewardsTabButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Material(
      color: selected ? palette.accent : palette.surfaceMuted,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: text.labelLarge?.copyWith(
              color: selected ? palette.canvas : palette.inkSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

String _tabLabel(AppLocalizations l10n, RewardsTab tab) => switch (tab) {
  RewardsTab.streaks => l10n.rewardsTabStreaks,
  RewardsTab.achievements => l10n.rewardsTabAchievements,
  RewardsTab.leaderboards => l10n.rewardsTabLeaderboards,
};
