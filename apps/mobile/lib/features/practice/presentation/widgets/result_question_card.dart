import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/practice/domain/question.dart';
import 'package:nihongo_bjt/features/reading_assist/presentation/japanese_text.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// Read-only per-question result with answer reveal and explanation.
///
/// Shows the prompt, every option marked as the correct answer and/or the
/// learner's selection, and the Vietnamese explanation. All states derive from
/// the real [selectedIndex]; nothing is fabricated.
class ResultQuestionCard extends StatelessWidget {
  const ResultQuestionCard({
    required this.position,
    required this.question,
    required this.selectedIndex,
    super.key,
  });

  /// 1-based position of this question in the set.
  final int position;
  final Question question;
  final int? selectedIndex;

  bool get _isCorrect =>
      selectedIndex != null && question.isCorrect(selectedIndex!);

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
              Text(
                l10n.practiceResultQuestionLabel(position),
                style: text.labelMedium?.copyWith(color: palette.inkSecondary),
              ),
              const Spacer(),
              _VerdictTag(isCorrect: _isCorrect),
            ],
          ),
          const SizedBox(height: AppSpacing.s),
          if (question.promptContextVi != null &&
              question.promptContextVi!.isNotEmpty) ...[
            Text(
              question.promptContextVi!,
              style: text.bodySmall?.copyWith(color: palette.inkSecondary),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
          Align(
            alignment: Alignment.centerLeft,
            child: JapaneseText(
              question.promptJa,
              reading: question.promptReading,
              textAlign: TextAlign.start,
              style: AppTypography.japaneseBody.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: palette.ink,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.m),
          for (var i = 0; i < question.options.length; i++) ...[
            _ResultOptionRow(
              option: question.options[i],
              index: i,
              isCorrect: i == question.correctIndex,
              isSelected: i == selectedIndex,
            ),
            if (i < question.options.length - 1)
              const SizedBox(height: AppSpacing.s),
          ],
          const SizedBox(height: AppSpacing.m),
          _ExplanationBox(text: question.explanationVi),
        ],
      ),
    );
  }
}

class _VerdictTag extends StatelessWidget {
  const _VerdictTag({required this.isCorrect});

  final bool isCorrect;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final bg = isCorrect ? palette.successSoft : palette.dangerSoft;
    final fg = isCorrect ? palette.success : palette.danger;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isCorrect ? Icons.check_rounded : Icons.close_rounded,
            size: 16,
            color: fg,
          ),
          const SizedBox(width: AppSpacing.xs),
          Text(
            isCorrect
                ? l10n.practiceResultCorrect
                : l10n.practiceResultIncorrect,
            style: text.labelSmall?.copyWith(
              color: fg,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultOptionRow extends StatelessWidget {
  const _ResultOptionRow({
    required this.option,
    required this.index,
    required this.isCorrect,
    required this.isSelected,
  });

  final QuestionOption option;
  final int index;
  final bool isCorrect;
  final bool isSelected;

  String get _positionLabel => String.fromCharCode(65 + index);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    final Color bg;
    final Color border;
    if (isCorrect) {
      bg = palette.successSoft;
      border = palette.success;
    } else if (isSelected) {
      bg = palette.dangerSoft;
      border = palette.danger;
    } else {
      bg = palette.surface;
      border = palette.border;
    }

    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: border),
      ),
      padding: const EdgeInsets.all(AppSpacing.s),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: palette.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Text(
              _positionLabel,
              style: text.labelSmall?.copyWith(
                color: palette.inkSecondary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  option.textJa,
                  style: AppTypography.japaneseBody.copyWith(
                    fontSize: 16,
                    color: palette.ink,
                  ),
                ),
                if (option.glossVi != null && option.glossVi!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    option.glossVi!,
                    style: text.bodySmall?.copyWith(
                      color: palette.inkSecondary,
                    ),
                  ),
                ],
                if (isCorrect || isSelected) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    isCorrect
                        ? l10n.practiceCorrectAnswer
                        : l10n.practiceYourAnswer,
                    style: text.labelSmall?.copyWith(
                      color: isCorrect ? palette.success : palette.danger,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ExplanationBox extends StatelessWidget {
  const _ExplanationBox({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.lightbulb_outline_rounded,
                size: 18,
                color: palette.accent,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                l10n.practiceExplanationTitle,
                style: textTheme.labelMedium?.copyWith(
                  color: palette.ink,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            text,
            style: textTheme.bodyMedium?.copyWith(color: palette.inkSecondary),
          ),
        ],
      ),
    );
  }
}
