import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';

/// Renders one example sentence: the Japanese line (taller line-height per the
/// design system), an optional kana reading, and the Vietnamese translation.
/// Used across dictionary, kanji and grammar detail screens.
class ExampleSentenceView extends StatelessWidget {
  const ExampleSentenceView({required this.example, super.key});

  final ContentExample example;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

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
          if (example.reading != null && example.reading!.isNotEmpty) ...[
            Text(
              example.reading!,
              style: AppTypography.japaneseReading.copyWith(
                color: palette.inkTertiary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
          Text(
            example.japaneseText,
            style: AppTypography.japaneseBody.copyWith(color: palette.ink),
          ),
          if (example.translationVi != null &&
              example.translationVi!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.s),
            Text(
              example.translationVi!,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
          ],
        ],
      ),
    );
  }
}
