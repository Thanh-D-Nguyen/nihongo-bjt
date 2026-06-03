import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/career/domain/story_models.dart';
import 'package:nihongo_bjt/features/career/presentation/career_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Story arc detail: synopsis plus the ordered chapter list.
class CareerArcDetailPage extends ConsumerWidget {
  const CareerArcDetailPage({required this.slug, super.key});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final detail = ref.watch(careerArcDetailProvider(slug));

    return AppScaffold(
      title: l10n.careerArcsTitle,
      body: detail.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 28, width: 220),
              SizedBox(height: AppSpacing.m),
              SkeletonBox(height: 90, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(height: 90, radius: AppRadius.lg),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.careerErrorTitle,
          message: l10n.careerErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(careerArcDetailProvider(slug)),
        ),
        data: (data) => ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.m,
            AppSpacing.m,
            AppSpacing.m,
            AppSpacing.xl,
          ),
          children: [
            Text(
              data.arc.titleJa,
              style: AppTypography.japaneseDisplay.copyWith(
                color: context.palette.ink,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              data.arc.titleVi,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: context.palette.inkSecondary,
              ),
            ),
            if (data.arc.synopsisVi.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.m),
              Text(
                data.arc.synopsisVi,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: context.palette.inkSecondary,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.l),
            SectionHeader(title: l10n.careerChaptersTitle),
            const SizedBox(height: AppSpacing.s),
            for (final chapter in data.chapters) ...[
              _ChapterCard(chapter: chapter),
              const SizedBox(height: AppSpacing.s),
            ],
          ],
        ),
      ),
    );
  }
}

class _ChapterCard extends StatelessWidget {
  const _ChapterCard({required this.chapter});

  final MissionChapter chapter;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      onTap: () => unawaited(
        context.pushNamed(
          Routes.careerChapter,
          pathParameters: {'id': chapter.id},
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: chapter.isBoss ? palette.warningSoft : palette.accentSoft,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(
              chapter.isBoss
                  ? Icons.military_tech_rounded
                  : Icons.menu_book_rounded,
              color: chapter.isBoss ? palette.warning : palette.accent,
            ),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  chapter.titleJa,
                  style: AppTypography.japaneseReading.copyWith(
                    color: palette.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  chapter.titleVi,
                  style: text.bodySmall?.copyWith(color: palette.inkSecondary),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.careerChapterMinutes(chapter.estimatedMinutes),
                  style: text.labelSmall?.copyWith(color: palette.inkTertiary),
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
