import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/magazine/domain/magazine_models.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// A single interactive mini-quiz question. Reveals correctness only after the
/// learner picks an option, then surfaces the explanation. Reports the outcome
/// once via [onAnswered] so the parent can tally the score.
class MagazineQuizCard extends StatefulWidget {
  const MagazineQuizCard({
    required this.quiz,
    required this.index,
    required this.total,
    required this.onAnswered,
    super.key,
  });

  final MagazineQuiz quiz;
  final int index;
  final int total;
  final ValueChanged<bool> onAnswered;

  @override
  State<MagazineQuizCard> createState() => _MagazineQuizCardState();
}

class _MagazineQuizCardState extends State<MagazineQuizCard> {
  int? _selected;

  void _choose(int index) {
    if (_selected != null) return;
    setState(() => _selected = index);
    widget.onAnswered(widget.quiz.options[index].isCorrect);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final answered = _selected != null;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.magazineQuizProgress(widget.index + 1, widget.total),
            style: text.labelMedium?.copyWith(color: palette.inkTertiary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            widget.quiz.questionJp,
            style: AppTypography.japaneseBody.copyWith(color: palette.ink),
          ),
          if (widget.quiz.questionVi != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              widget.quiz.questionVi!,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
          ],
          const SizedBox(height: AppSpacing.s),
          for (var i = 0; i < widget.quiz.options.length; i++) ...[
            _OptionTile(
              option: widget.quiz.options[i],
              answered: answered,
              selected: _selected == i,
              onTap: () => _choose(i),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
          if (answered && widget.quiz.explanationVi != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.s),
              decoration: BoxDecoration(
                color: palette.accentSoft,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Text(
                widget.quiz.explanationVi!,
                style: text.bodySmall?.copyWith(color: palette.ink),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.option,
    required this.answered,
    required this.selected,
    required this.onTap,
  });

  final MagazineQuizOption option;
  final bool answered;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    var border = palette.border;
    var background = palette.surface;
    IconData? icon;
    Color? iconColor;

    if (answered) {
      if (option.isCorrect) {
        border = palette.success;
        background = palette.successSoft;
        icon = Icons.check_circle;
        iconColor = palette.success;
      } else if (selected) {
        border = palette.danger;
        background = palette.dangerSoft;
        icon = Icons.cancel;
        iconColor = palette.danger;
      }
    }

    return Material(
      color: background,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.md),
        onTap: answered ? null : onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.m,
            vertical: AppSpacing.s,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: border),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  option.label,
                  style: AppTypography.japaneseReading.copyWith(
                    color: palette.ink,
                  ),
                ),
              ),
              if (icon != null) ...[
                const SizedBox(width: AppSpacing.s),
                Icon(icon, color: iconColor, size: 20),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
