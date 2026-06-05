import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/career/domain/career_models.dart';
import 'package:nihongo_bjt/features/career/presentation/career_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Lists the published story arcs with their lock/progress state.
class CareerArcsPage extends ConsumerWidget {
  const CareerArcsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final arcs = ref.watch(careerArcsProvider);

    return AppScaffold(
      title: l10n.careerArcsTitle,
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(careerArcsProvider),
        child: arcs.when(
          loading: () => const SingleChildScrollView(
            physics: AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.all(AppSpacing.m),
            child: LoadingStateView(
              children: [
                SkeletonBox(height: 120, radius: AppRadius.lg),
                SizedBox(height: AppSpacing.m),
                SkeletonBox(height: 120, radius: AppRadius.lg),
              ],
            ),
          ),
          error: (_, _) => ErrorStateView(
            title: l10n.careerErrorTitle,
            message: l10n.careerErrorBody,
            retryLabel: l10n.commonRetry,
            onRetry: () => ref.invalidate(careerArcsProvider),
          ),
          data: (items) {
            if (items.isEmpty) {
              return EmptyStateView(
                title: l10n.careerArcsEmptyTitle,
                message: l10n.careerArcsEmptyBody,
                icon: Icons.map_outlined,
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.m,
                AppSpacing.m,
                AppSpacing.m,
                AppSpacing.xl,
              ),
              itemCount: items.length + 1,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.m),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return SectionHeader(
                    title: l10n.careerArcsTitle,
                    subtitle: l10n.careerArcsSubtitle,
                  );
                }
                return _ArcCard(arc: items[index - 1]);
              },
            );
          },
        ),
      ),
    );
  }
}

class _ArcCard extends StatelessWidget {
  const _ArcCard({required this.arc});

  final MissionArc arc;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final locked = arc.locked;

    return AppCard(
      onTap: locked
          ? null
          : () => unawaited(
              context.pushNamed(
                Routes.careerArc,
                pathParameters: {'slug': arc.slug},
              ),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.careerArcRankRequired(arc.rankCodeEntry).toUpperCase(),
            style: text.labelSmall?.copyWith(
              color: palette.inkTertiary,
              letterSpacing: 0.8,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: Text(
                  arc.titleJa,
                  style: AppTypography.japaneseReading.copyWith(
                    color: palette.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              _StatusPill(status: arc.status, locked: locked),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            arc.titleVi,
            style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
          ),
          if (arc.synopsisVi.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.s),
            Text(
              arc.synopsisVi,
              style: text.bodySmall?.copyWith(color: palette.inkSecondary),
            ),
          ],
          const SizedBox(height: AppSpacing.m),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: arc.progress,
              minHeight: 8,
              backgroundColor: palette.surfaceMuted,
              valueColor: AlwaysStoppedAnimation<Color>(palette.accent),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            locked
                ? l10n.careerArcLocked(arc.rankCodeEntry)
                : l10n.careerArcProgress(
                    arc.completedChapters,
                    arc.totalChapters,
                  ),
            style: text.bodySmall?.copyWith(color: palette.inkSecondary),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status, required this.locked});

  final String status;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final Color color;
    final String label;
    if (locked) {
      color = palette.inkTertiary;
      label = l10n.careerStatusLocked;
    } else if (status == 'completed') {
      color = palette.success;
      label = l10n.careerStatusCompleted;
    } else {
      color = palette.accent;
      label = l10n.careerStatusActive;
    }
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            locked ? Icons.lock_outline_rounded : Icons.bolt_rounded,
            size: 14,
            color: color,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: text.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
