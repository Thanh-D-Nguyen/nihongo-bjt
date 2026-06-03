import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_motion.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// Card that surfaces a single learning metric with a labelled progress bar.
///
/// Driven entirely by real params ([label], [valueLabel], [progress] in
/// `0..1`). The bar animates to its value and respects reduced-motion. No fake
/// or hardcoded data inside.
class LearningProgressCard extends StatelessWidget {
  const LearningProgressCard({
    required this.label,
    required this.valueLabel,
    required this.progress,
    this.icon,
    this.onTap,
    super.key,
  });

  final String label;

  /// Human-readable value, e.g. `"12 / 20"` or `"60%"`.
  final String valueLabel;

  /// Completion ratio in the range `0..1`.
  final double progress;

  final IconData? icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final clamped = progress.clamp(0.0, 1.0);
    final reduceMotion = MediaQuery.disableAnimationsOf(context);

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: palette.accent),
                const SizedBox(width: AppSpacing.s),
              ],
              Expanded(
                child: Text(
                  label,
                  style: text.labelLarge?.copyWith(color: palette.inkSecondary),
                ),
              ),
              Text(
                valueLabel,
                style: text.titleSmall?.copyWith(color: palette.ink),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: TweenAnimationBuilder<double>(
              tween: Tween<double>(begin: 0, end: clamped),
              duration: reduceMotion ? Duration.zero : AppMotion.slow,
              curve: AppMotion.standard,
              builder: (context, value, _) {
                return LinearProgressIndicator(
                  value: value,
                  minHeight: 8,
                  semanticsLabel: label,
                  backgroundColor: palette.surfaceMuted,
                  valueColor: AlwaysStoppedAnimation<Color>(palette.accent),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
