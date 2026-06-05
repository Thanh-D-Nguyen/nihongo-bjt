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

/// Leaderboards tab — a chip selector of enabled boards with the ranked list
/// for the active board below. Top three ranks get medals; the learner's own
/// row is highlighted by the backend via display ordering.
class LeaderboardsTab extends ConsumerStatefulWidget {
  const LeaderboardsTab({super.key});

  @override
  ConsumerState<LeaderboardsTab> createState() => _LeaderboardsTabState();
}

class _LeaderboardsTabState extends ConsumerState<LeaderboardsTab> {
  String? _selectedId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final boards = ref.watch(leaderboardsProvider);

    return boards.when(
      loading: () => const RewardsLoading(),
      error: (error, _) => RewardsErrorView(
        error: error,
        onRetry: () => ref.invalidate(leaderboardsProvider),
      ),
      data: (rows) {
        if (rows.isEmpty) {
          return EmptyStateView(
            icon: Icons.leaderboard_outlined,
            title: l10n.rewardsLeaderboardsEmptyTitle,
            message: l10n.rewardsLeaderboardsEmptyBody,
          );
        }
        final selected = _selectedId ?? rows.first.id;
        return Column(
          children: [
            _BoardSelector(
              boards: rows,
              selectedId: selected,
              onSelected: (id) => setState(() => _selectedId = id),
            ),
            Expanded(child: _BoardRankings(leaderboardId: selected)),
          ],
        );
      },
    );
  }
}

class _BoardSelector extends StatelessWidget {
  const _BoardSelector({
    required this.boards,
    required this.selectedId,
    required this.onSelected,
  });

  final List<LeaderboardConfig> boards;
  final String selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
        itemCount: boards.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.s),
        itemBuilder: (context, index) {
          final board = boards[index];
          return _BoardChip(
            label: board.name,
            selected: board.id == selectedId,
            onTap: () => onSelected(board.id),
          );
        },
      ),
    );
  }
}

class _BoardChip extends StatelessWidget {
  const _BoardChip({
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
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
          child: Text(
            label,
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

class _BoardRankings extends ConsumerWidget {
  const _BoardRankings({required this.leaderboardId});

  final String leaderboardId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final view = ref.watch(leaderboardProvider(leaderboardId));

    return view.when(
      loading: () => const RewardsLoading(),
      error: (error, _) => RewardsErrorView(
        error: error,
        onRetry: () => ref.invalidate(leaderboardProvider(leaderboardId)),
      ),
      data: (board) {
        if (board.entries.isEmpty) {
          return EmptyStateView(
            icon: Icons.leaderboard_outlined,
            title: l10n.rewardsLeaderboardEmptyTitle,
            message: l10n.rewardsLeaderboardEmptyBody,
          );
        }
        return RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(leaderboardProvider(leaderboardId)),
          child: ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.m),
            itemCount: board.entries.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
            itemBuilder: (context, index) =>
                _RankRow(entry: board.entries[index]),
          ),
        );
      },
    );
  }
}

const Map<int, String> _rankMedal = {1: '🥇', 2: '🥈', 3: '🥉'};

class _RankRow extends StatelessWidget {
  const _RankRow({required this.entry});

  final LeaderboardEntry entry;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    final medal = _rankMedal[entry.rank];
    final displayName = entry.displayName?.trim();
    final hasName = displayName != null && displayName.isNotEmpty;
    final shortId = entry.userId.length > 6
        ? entry.userId.substring(0, 6)
        : entry.userId;
    final name = hasName
        ? displayName
        : (shortId.isNotEmpty
              ? l10n.rewardsLeaderboardUserFallback(shortId)
              : l10n.rewardsLeaderboardAnonymous);
    final initialSource = hasName ? displayName : shortId;
    final initial = initialSource.trim().isNotEmpty
        ? initialSource.trim().characters.first.toUpperCase()
        : '?';

    return AppCard(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.m,
        vertical: AppSpacing.s,
      ),
      child: Row(
        children: [
          SizedBox(
            width: 40,
            child: medal != null
                ? Text(medal, style: const TextStyle(fontSize: 22))
                : Text(
                    '${entry.rank}',
                    textAlign: TextAlign.center,
                    style: text.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: palette.inkSecondary,
                    ),
                  ),
          ),
          const SizedBox(width: AppSpacing.s),
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: palette.accentSoft,
              shape: BoxShape.circle,
            ),
            child: Text(
              initial,
              style: text.labelLarge?.copyWith(
                fontWeight: FontWeight.w700,
                color: palette.accent,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: text.bodyLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: palette.ink,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Text(
            l10n.rewardsLeaderboardScore(entry.score),
            style: text.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: palette.accent,
            ),
          ),
        ],
      ),
    );
  }
}
