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
import 'package:nihongo_bjt/features/learn/presentation/widgets/lesson_visuals.dart';
import 'package:nihongo_bjt/features/learn/presentation/widgets/preview_badge.dart';
import 'package:nihongo_bjt/features/reading_assist/presentation/japanese_text.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Readable detail view for a single lesson: header (title, summary, meta) plus
/// the lesson's sections (Japanese passage + Vietnamese translation). All
/// states handled; preview content is honestly badged.
class LessonDetailPage extends ConsumerWidget {
  const LessonDetailPage({required this.lessonId, super.key});

  final String lessonId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final lesson = ref.watch(lessonProvider(lessonId));

    return AppScaffold(
      title: l10n.learnTitle,
      leading: const BackButton(),
      body: lesson.when(
        loading: () => const SingleChildScrollView(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 120, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.m),
              SkeletonBox(height: 140, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(height: 140, radius: AppRadius.lg),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.learnErrorTitle,
          message: l10n.learnErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(lessonProvider(lessonId)),
        ),
        data: (value) {
          if (value == null) {
            return EmptyStateView(
              icon: Icons.search_off_outlined,
              title: l10n.lessonDetailNotFound,
              message: l10n.learnEmptyBody,
            );
          }
          return _LessonBody(lesson: value);
        },
      ),
    );
  }
}

class _LessonBody extends StatelessWidget {
  const _LessonBody({required this.lesson});

  final Lesson lesson;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        _LessonHeader(lesson: lesson),
        if (lesson.hasQuestions) ...[
          const SizedBox(height: AppSpacing.m),
          PrimaryButton(
            label: l10n.lessonPracticeCta(lesson.questionCount),
            icon: Icons.quiz_outlined,
            onPressed: () => unawaited(
              context.pushNamed(
                Routes.practice,
                pathParameters: {'id': lesson.id},
              ),
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.l),
        Text(
          l10n.lessonDetailContentTitle,
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(color: context.palette.ink),
        ),
        const SizedBox(height: AppSpacing.s),
        for (var i = 0; i < lesson.sections.length; i++) ...[
          _SectionCard(index: i + 1, section: lesson.sections[i]),
          const SizedBox(height: AppSpacing.s),
        ],
      ],
    );
  }
}

class _LessonHeader extends StatelessWidget {
  const _LessonHeader({required this.lesson});

  final Lesson lesson;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.s,
            runSpacing: AppSpacing.s,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _HeaderChip(
                icon: Icons.signal_cellular_alt_rounded,
                label: lessonLevelLabel(l10n, lesson.level),
              ),
              _HeaderChip(
                icon: Icons.schedule_outlined,
                label: l10n.learnMinutes(lesson.estimatedMinutes),
              ),
              if (lesson.isPreview) PreviewBadge(label: l10n.learnPreviewBadge),
            ],
          ),
          const SizedBox(height: AppSpacing.m),
          Text(
            lesson.titleJa,
            style: AppTypography.japaneseDisplay.copyWith(
              fontSize: 32,
              color: palette.ink,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            lesson.titleReading,
            style: AppTypography.japaneseReading.copyWith(
              color: palette.inkSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.m),
          Text(
            lesson.summaryVi,
            style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
          ),
        ],
      ),
    );
  }
}

class _HeaderChip extends StatelessWidget {
  const _HeaderChip({required this.icon, required this.label});

  final IconData icon;
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
        color: palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: palette.inkSecondary),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: text.labelSmall?.copyWith(color: palette.inkSecondary),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.index, required this.section});

  final int index;
  final LessonSection section;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: palette.accentSoft,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Text(
                  '$index',
                  style: text.labelSmall?.copyWith(
                    color: palette.accent,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.s),
              Expanded(
                child: Text(
                  section.headingVi,
                  style: text.titleMedium?.copyWith(color: palette.ink),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.m),
          Align(
            alignment: Alignment.centerLeft,
            child: JapaneseText(
              section.bodyJa,
              reading: section.bodyReading,
              textAlign: TextAlign.start,
              style: AppTypography.japaneseBody.copyWith(color: palette.ink),
            ),
          ),
          const SizedBox(height: AppSpacing.s),
          Container(
            padding: const EdgeInsets.all(AppSpacing.s),
            decoration: BoxDecoration(
              color: palette.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Text(
              section.translationVi,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
