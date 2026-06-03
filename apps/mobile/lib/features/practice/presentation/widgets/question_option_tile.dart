import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_motion.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/practice/domain/question.dart';

/// Selectable answer tile for the practice player.
///
/// Presentation-only: it renders the option's Japanese text (with optional
/// reading and Vietnamese gloss) and a selection affordance. Correctness is not
/// revealed here (that belongs to the Explanation/Result screen).
class QuestionOptionTile extends StatelessWidget {
  const QuestionOptionTile({
    required this.option,
    required this.index,
    required this.selected,
    required this.onTap,
    super.key,
  });

  final QuestionOption option;
  final int index;
  final bool selected;
  final VoidCallback onTap;

  /// A, B, C, D label for the option position.
  String get _positionLabel => String.fromCharCode(65 + index);

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final borderColor = selected ? palette.accent : palette.border;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);

    return Semantics(
      button: true,
      selected: selected,
      child: AnimatedContainer(
        duration: reduceMotion ? Duration.zero : AppMotion.fast,
        curve: AppMotion.standard,
        decoration: BoxDecoration(
          color: selected ? palette.accentSoft : palette.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(
            color: borderColor,
            width: selected ? 2 : 1,
          ),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.m),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _PositionBadge(label: _positionLabel, selected: selected),
                  const SizedBox(width: AppSpacing.m),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (option.reading != null &&
                            option.reading!.isNotEmpty) ...[
                          Text(
                            option.reading!,
                            style: AppTypography.japaneseReading.copyWith(
                              color: palette.inkTertiary,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                        ],
                        Text(
                          option.textJa,
                          style: AppTypography.japaneseBody.copyWith(
                            fontSize: 18,
                            color: palette.ink,
                          ),
                        ),
                        if (option.glossVi != null &&
                            option.glossVi!.isNotEmpty) ...[
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            option.glossVi!,
                            style: text.bodySmall?.copyWith(
                              color: palette.inkSecondary,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (selected) ...[
                    const SizedBox(width: AppSpacing.s),
                    Icon(
                      Icons.check_circle_rounded,
                      color: palette.accent,
                      size: 22,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PositionBadge extends StatelessWidget {
  const _PositionBadge({required this.label, required this.selected});

  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: selected ? palette.accent : palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Text(
        label,
        style: text.labelMedium?.copyWith(
          color: selected ? palette.surface : palette.inkSecondary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
