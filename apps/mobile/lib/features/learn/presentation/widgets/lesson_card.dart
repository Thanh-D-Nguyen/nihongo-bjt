import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/presentation/widgets/lesson_visuals.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// List item for a single [Lesson]: Japanese title, Vietnamese summary, and a
/// compact meta row (level + reading time). Tappable to open the lesson.
class LessonCard extends StatelessWidget {
  const LessonCard({required this.lesson, required this.onTap, super.key});

  final Lesson lesson;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: palette.accentSoft,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(
              lessonCategoryIcon(lesson.categoryId),
              size: 22,
              color: palette.accent,
            ),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  lesson.titleJa,
                  style: AppTypography.japaneseBody.copyWith(
                    fontSize: 18,
                    height: 1.4,
                    color: palette.ink,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  lesson.summaryVi,
                  style: text.bodySmall?.copyWith(color: palette.inkSecondary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.s),
                _MetaRow(lesson: lesson, l10n: l10n),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Icon(Icons.chevron_right_rounded, color: palette.inkTertiary),
        ],
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.lesson, required this.l10n});

  final Lesson lesson;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final metaStyle = text.labelSmall?.copyWith(color: palette.inkTertiary);

    return Row(
      children: [
        Flexible(
          child: Text(
            lessonLevelLabel(l10n, lesson.level),
            style: metaStyle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: AppSpacing.s),
        Icon(Icons.circle, size: 4, color: palette.inkTertiary),
        const SizedBox(width: AppSpacing.s),
        Icon(Icons.schedule_outlined, size: 14, color: palette.inkTertiary),
        const SizedBox(width: AppSpacing.xs),
        Text(l10n.learnMinutes(lesson.estimatedMinutes), style: metaStyle),
      ],
    );
  }
}
