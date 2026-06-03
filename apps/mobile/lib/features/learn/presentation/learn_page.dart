import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_providers.dart';
import 'package:nihongo_bjt/features/learn/presentation/widgets/lesson_card.dart';
import 'package:nihongo_bjt/features/learn/presentation/widgets/lesson_visuals.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Learn hub — a daily-lesson entry, lesson categories and the full lesson
/// list, sourced from the (clearly-labeled preview) [lessonsProvider].
///
/// Handles loading / empty / error states. No fabricated progress; preview
/// content is honestly badged.
class LearnPage extends ConsumerWidget {
  const LearnPage({super.key});

  void _openLesson(BuildContext context, String id) {
    unawaited(context.pushNamed(Routes.lesson, pathParameters: {'id': id}));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final lessons = ref.watch(lessonsProvider);

    return AppScaffold(
      title: l10n.learnTitle,
      body: lessons.when(
        loading: () => const SingleChildScrollView(
          padding: EdgeInsets.all(AppSpacing.m),
          child: _LearnSkeleton(),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.learnErrorTitle,
          message: l10n.learnErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(lessonsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyStateView(
              icon: Icons.school_outlined,
              title: l10n.learnEmptyTitle,
              message: l10n.learnEmptyBody,
            );
          }
          return _LearnContent(
            lessons: items,
            onOpenLesson: (id) => _openLesson(context, id),
          );
        },
      ),
    );
  }
}

class _LearnContent extends ConsumerWidget {
  const _LearnContent({required this.lessons, required this.onOpenLesson});

  final List<Lesson> lessons;
  final ValueChanged<String> onOpenLesson;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final categories =
        ref.watch(lessonCategoriesProvider).asData?.value ?? const [];
    final showsPreview = lessons.any((lesson) => lesson.isPreview);

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        if (showsPreview) ...[
          _PreviewNotice(l10n: l10n),
          const SizedBox(height: AppSpacing.m),
        ],
        _DailyLessonCard(onOpenLesson: onOpenLesson),
        if (categories.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.l),
          SectionHeader(title: l10n.learnCategoriesTitle),
          const SizedBox(height: AppSpacing.s),
          _CategoryList(categories: categories, lessons: lessons),
        ],
        const SizedBox(height: AppSpacing.l),
        SectionHeader(title: l10n.learnLessonsTitle),
        const SizedBox(height: AppSpacing.s),
        for (final lesson in lessons) ...[
          LessonCard(lesson: lesson, onTap: () => onOpenLesson(lesson.id)),
          const SizedBox(height: AppSpacing.s),
        ],
      ],
    );
  }
}

class _PreviewNotice extends StatelessWidget {
  const _PreviewNotice({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.warningSoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: palette.warning.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, size: 18, color: palette.warning),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Text(
              l10n.learnPreviewNotice,
              style: text.bodySmall?.copyWith(color: palette.ink),
            ),
          ),
        ],
      ),
    );
  }
}

/// Today's recommended lesson, picked deterministically by day.
class _DailyLessonCard extends ConsumerWidget {
  const _DailyLessonCard({required this.onOpenLesson});

  final ValueChanged<String> onOpenLesson;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final lesson = ref.watch(dailyLessonProvider).asData?.value;
    if (lesson == null) return const SizedBox.shrink();

    return AppCard(
      onTap: () => onOpenLesson(lesson.id),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.today_outlined, size: 18, color: palette.accent),
              const SizedBox(width: AppSpacing.s),
              Text(
                l10n.learnDailyLessonTitle,
                style: text.labelMedium?.copyWith(color: palette.accent),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s),
          Text(
            lesson.titleJa,
            style: AppTypography.japaneseBody.copyWith(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              height: 1.4,
              color: palette.ink,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            lesson.summaryVi,
            style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
          ),
          const SizedBox(height: AppSpacing.m),
          Row(
            children: [
              Flexible(
                child: _MetaChip(
                  icon: Icons.signal_cellular_alt_rounded,
                  label: lessonLevelLabel(l10n, lesson.level),
                ),
              ),
              const SizedBox(width: AppSpacing.s),
              Flexible(
                child: _MetaChip(
                  icon: Icons.schedule_outlined,
                  label: l10n.learnMinutes(lesson.estimatedMinutes),
                ),
              ),
              const Spacer(),
              Icon(Icons.arrow_forward_rounded, color: palette.accent),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: palette.inkTertiary),
        const SizedBox(width: AppSpacing.xs),
        Flexible(
          child: Text(
            label,
            style: text.labelSmall?.copyWith(color: palette.inkSecondary),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _CategoryList extends StatelessWidget {
  const _CategoryList({required this.categories, required this.lessons});

  final List<LessonCategory> categories;
  final List<Lesson> lessons;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Column(
      children: [
        for (final category in categories) ...[
          AppCard(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: palette.surfaceMuted,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Icon(
                    lessonCategoryIcon(category.id),
                    size: 20,
                    color: palette.inkSecondary,
                  ),
                ),
                const SizedBox(width: AppSpacing.m),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        category.titleVi,
                        style: text.titleMedium?.copyWith(color: palette.ink),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        category.descriptionVi,
                        style: text.bodySmall
                            ?.copyWith(color: palette.inkSecondary),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.s),
                Text(
                  l10n.learnLessonsInCategory(
                    lessons.where((l) => l.categoryId == category.id).length,
                  ),
                  style: text.labelSmall?.copyWith(color: palette.inkTertiary),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.s),
        ],
      ],
    );
  }
}

/// Content-shaped skeleton for the Learn hub while lessons load.
class _LearnSkeleton extends StatelessWidget {
  const _LearnSkeleton();

  @override
  Widget build(BuildContext context) {
    return const LoadingStateView(
      children: [
        SkeletonBox(height: 140, radius: AppRadius.lg),
        SizedBox(height: AppSpacing.l),
        SkeletonBox(height: 72, radius: AppRadius.lg),
        SizedBox(height: AppSpacing.s),
        SkeletonBox(height: 72, radius: AppRadius.lg),
        SizedBox(height: AppSpacing.l),
        SkeletonBox(height: 88, radius: AppRadius.lg),
        SizedBox(height: AppSpacing.s),
        SkeletonBox(height: 88, radius: AppRadius.lg),
      ],
    );
  }
}
