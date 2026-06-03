import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/career/domain/career_models.dart';
import 'package:nihongo_bjt/features/career/presentation/career_providers.dart';
import 'package:nihongo_bjt/features/career/presentation/widgets/career_skill_bar.dart';
import 'package:nihongo_bjt/features/career/presentation/widgets/npc_avatar.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Career RPG home: shows the learner's rank, XP progress, skill axes, daily
/// streak (with a server-authoritative clock-in), NPC relationships, and an
/// entry point into the story arcs.
class CareerHubPage extends ConsumerStatefulWidget {
  const CareerHubPage({super.key});

  @override
  ConsumerState<CareerHubPage> createState() => _CareerHubPageState();
}

class _CareerHubPageState extends ConsumerState<CareerHubPage> {
  bool _clockInBusy = false;

  Future<void> _clockIn() async {
    if (_clockInBusy) return;
    setState(() => _clockInBusy = true);
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(careerRepositoryProvider).clockIn();
      ref.invalidate(careerMeProvider);
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.careerClockInDone)),
      );
    } on RepositoryException catch (error) {
      if (!mounted) return;
      final message = error.kind == RepositoryErrorKind.unauthorized
          ? l10n.commonSignInRequired
          : l10n.careerErrorBody;
      messenger.showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _clockInBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final snapshot = ref.watch(careerMeProvider);

    return AppScaffold(
      title: l10n.careerTitle,
      body: snapshot.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 140, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.m),
              SkeletonBox(height: 120, radius: AppRadius.lg),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.careerErrorTitle,
          message: l10n.careerErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(careerMeProvider),
        ),
        data: (snap) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(careerMeProvider),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.m,
              AppSpacing.m,
              AppSpacing.m,
              AppSpacing.xl,
            ),
            children: [
              _RankCard(snapshot: snap),
              const SizedBox(height: AppSpacing.m),
              _StreakCard(
                streakDays: snap.state.streakDays,
                busy: _clockInBusy,
                onClockIn: _clockIn,
              ),
              const SizedBox(height: AppSpacing.l),
              SectionHeader(title: l10n.careerSkillsTitle),
              const SizedBox(height: AppSpacing.s),
              _SkillsCard(skills: snap.state.skills),
              const SizedBox(height: AppSpacing.l),
              _ArcsEntryCard(
                onTap: () => unawaited(context.pushNamed(Routes.careerArcs)),
              ),
              if (snap.npcRelations.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.l),
                SectionHeader(title: l10n.careerRelationsTitle),
                const SizedBox(height: AppSpacing.s),
                _RelationsCard(
                  npcs: snap.npcs,
                  relations: snap.npcRelations,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RankCard extends StatelessWidget {
  const _RankCard({required this.snapshot});

  final CareerSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final state = snapshot.state;
    final rank = snapshot.rank;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.careerRankEyebrow,
            style: text.labelMedium?.copyWith(color: palette.inkTertiary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            rank.titleJa,
            style: AppTypography.japaneseDisplay.copyWith(color: palette.ink),
          ),
          Text(
            rank.titleVi,
            style: text.titleMedium?.copyWith(color: palette.inkSecondary),
          ),
          const SizedBox(height: AppSpacing.s),
          Row(
            children: [
              _Badge(label: 'BJT ${rank.bjtBandTarget}'),
              const SizedBox(width: AppSpacing.s),
              _Badge(label: state.jpWorkName),
            ],
          ),
          const SizedBox(height: AppSpacing.m),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: state.xpProgress,
              minHeight: 10,
              backgroundColor: palette.surfaceMuted,
              valueColor: AlwaysStoppedAnimation<Color>(palette.accent),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            snapshot.nextRank == null
                ? l10n.careerRankMax
                : l10n.careerXpProgress(
                    state.rankXp,
                    state.rankXpToNext,
                    snapshot.nextRank!.titleJa,
                  ),
            style: text.bodySmall?.copyWith(color: palette.inkSecondary),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Text(
        label,
        style: text.labelMedium?.copyWith(
          color: palette.accent,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _StreakCard extends StatelessWidget {
  const _StreakCard({
    required this.streakDays,
    required this.busy,
    required this.onClockIn,
  });

  final int streakDays;
  final bool busy;
  final Future<void> Function() onClockIn;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.local_fire_department_rounded,
                color: palette.warning,
                size: 28,
              ),
              const SizedBox(width: AppSpacing.s),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.careerStreakDays(streakDays),
                      style: text.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: palette.ink,
                      ),
                    ),
                    Text(
                      l10n.careerStreakSubtitle,
                      style: text.bodySmall?.copyWith(
                        color: palette.inkSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.m),
          PrimaryButton(
            label: l10n.careerClockIn,
            icon: Icons.how_to_reg_rounded,
            isLoading: busy,
            onPressed: () => unawaited(onClockIn()),
          ),
        ],
      ),
    );
  }
}

class _SkillsCard extends StatelessWidget {
  const _SkillsCard({required this.skills});

  final List<CareerSkill> skills;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    if (skills.isEmpty) {
      return AppCard(
        child: Text(
          l10n.careerSkillsEmpty,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: palette.inkSecondary),
        ),
      );
    }
    return AppCard(
      child: Column(
        children: [
          for (var i = 0; i < skills.length; i++) ...[
            CareerSkillBar(skill: skills[i]),
            if (i < skills.length - 1) const SizedBox(height: AppSpacing.s),
          ],
        ],
      ),
    );
  }
}

class _ArcsEntryCard extends StatelessWidget {
  const _ArcsEntryCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: palette.accentSoft,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(Icons.map_outlined, color: palette.accent),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.careerArcsTitle,
                  style: text.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: palette.ink,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.careerArcsSubtitle,
                  style: text.bodyMedium?.copyWith(
                    color: palette.inkSecondary,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: palette.inkTertiary),
        ],
      ),
    );
  }
}

class _RelationsCard extends StatelessWidget {
  const _RelationsCard({required this.npcs, required this.relations});

  final List<StoryNpc> npcs;
  final List<NpcRelation> relations;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        children: [
          for (var i = 0; i < relations.length; i++) ...[
            Builder(
              builder: (context) {
                final relation = relations[i];
                final npc = npcs.firstWhere(
                  (n) => n.slug == relation.npcSlug,
                  orElse: () => StoryNpc(
                    slug: relation.npcSlug,
                    nameJa: relation.npcSlug,
                    roleJa: '',
                    defaultRelation: 'uchi',
                    avatarInitial: relation.npcSlug.isEmpty
                        ? '?'
                        : relation.npcSlug[0],
                    avatarTint: '#1B2A4A',
                  ),
                );
                return Row(
                  children: [
                    NpcAvatar(
                      initial: npc.avatarInitial,
                      tintHex: npc.avatarTint,
                    ),
                    const SizedBox(width: AppSpacing.s),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            npc.nameJa,
                            style: text.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: palette.ink,
                            ),
                          ),
                          if (npc.roleJa.isNotEmpty)
                            Text(
                              npc.roleJa,
                              style: text.bodySmall?.copyWith(
                                color: palette.inkSecondary,
                              ),
                            ),
                        ],
                      ),
                    ),
                    _TrustPill(score: relation.trustScore),
                  ],
                );
              },
            ),
            if (i < relations.length - 1)
              const Divider(height: AppSpacing.l),
          ],
        ],
      ),
    );
  }
}

class _TrustPill extends StatelessWidget {
  const _TrustPill({required this.score});

  final int score;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final color = score >= 66
        ? palette.success
        : score >= 33
        ? palette.warning
        : palette.danger;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        '$score',
        style: text.labelMedium?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
