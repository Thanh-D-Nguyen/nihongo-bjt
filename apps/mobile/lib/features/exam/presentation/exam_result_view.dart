import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Scored result summary shown after a BJT exam session ends. Pure
/// presentation — the caller owns navigation.
class ExamResultView extends StatelessWidget {
  const ExamResultView({
    required this.session,
    required this.onDone,
    this.onReview,
    super.key,
  });

  final ExamSession session;
  final VoidCallback onDone;

  /// Optional handler to open the per-question review. When null the review CTA
  /// is hidden (e.g. when no completed-session breakdown is available).
  final VoidCallback? onReview;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final total = session.totalQuestions;
    final correct = session.correctCount;
    final percent = total <= 0
        ? 0
        : ((correct / total) * 100).round().clamp(0, 100);
    final strong = percent >= 70;
    final accent = strong ? palette.success : palette.accent;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Column(
          children: [
            const Spacer(),
            Container(
              width: 140,
              height: 140,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: strong ? palette.successSoft : palette.accentSoft,
              ),
              child: Text(
                '$percent%',
                style: text.displaySmall?.copyWith(
                  color: accent,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.l),
            Text(
              l10n.examResultScore(correct, total),
              style: text.titleLarge?.copyWith(
                color: palette.ink,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (session.estimatedBjtBand != null) ...[
              const SizedBox(height: AppSpacing.s),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.m,
                  vertical: AppSpacing.s,
                ),
                decoration: BoxDecoration(
                  color: palette.surfaceMuted,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  l10n.examResultBand(session.estimatedBjtBand!),
                  style: text.labelLarge?.copyWith(
                    color: palette.ink,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
            const Spacer(),
            if (onReview != null) ...[
              SecondaryButton(
                label: l10n.examReviewCta,
                icon: Icons.fact_check_outlined,
                onPressed: onReview,
              ),
              const SizedBox(height: AppSpacing.s),
            ],
            PrimaryButton(label: l10n.examResultDone, onPressed: onDone),
          ],
        ),
      ),
    );
  }
}
