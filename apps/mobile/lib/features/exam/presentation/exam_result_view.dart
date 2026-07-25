import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Server-scored result summary shown after a BJT simulation ends. The overall
/// 0–800 estimate comes from the API. Section rows use only real correct/total
/// outcomes from the completed-session breakdown.
class ExamResultView extends StatelessWidget {
  const ExamResultView({
    required this.session,
    required this.onDone,
    this.breakdown,
    this.breakdownLoading = false,
    this.breakdownFailed = false,
    this.onRetryBreakdown,
    this.onReview,
    super.key,
  });

  final ExamSession session;
  final ExamBreakdown? breakdown;
  final bool breakdownLoading;
  final bool breakdownFailed;
  final VoidCallback? onRetryBreakdown;
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
    final estimatedScore = session.estimatedScore;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.m),
        children: [
          AppCard(
            child: Column(
              children: [
                Container(
                  width: 72,
                  height: 72,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: palette.accentSoft,
                  ),
                  child: Icon(
                    Icons.insights_outlined,
                    size: 36,
                    color: palette.accent,
                  ),
                ),
                const SizedBox(height: AppSpacing.m),
                Text(
                  l10n.examEstimatedScoreLabel,
                  textAlign: TextAlign.center,
                  style: text.labelLarge?.copyWith(
                    color: palette.inkSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  estimatedScore == null
                      ? l10n.examEstimatedScoreUnavailable
                      : l10n.examEstimatedScoreValue(estimatedScore),
                  key: const ValueKey('exam-estimated-score'),
                  textAlign: TextAlign.center,
                  style: text.displaySmall?.copyWith(
                    color: palette.ink,
                    fontWeight: FontWeight.w800,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: AppSpacing.s),
                Text(
                  l10n.examResultScore(correct, total),
                  textAlign: TextAlign.center,
                  style: text.titleMedium?.copyWith(
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
                const SizedBox(height: AppSpacing.m),
                Text(
                  l10n.examEstimatedScoreCaveat,
                  textAlign: TextAlign.center,
                  style: text.bodySmall?.copyWith(
                    color: palette.inkSecondary,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.m),
          Text(
            l10n.examSectionBreakdownTitle,
            style: text.titleMedium?.copyWith(
              color: palette.ink,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.s),
          if (breakdownLoading)
            const LoadingStateView(
              children: [
                SkeletonBox(height: 72, radius: AppRadius.md),
                SizedBox(height: AppSpacing.s),
                SkeletonBox(height: 72, radius: AppRadius.md),
                SizedBox(height: AppSpacing.s),
                SkeletonBox(height: 72, radius: AppRadius.md),
              ],
            )
          else if (breakdownFailed)
            _SectionBreakdownUnavailable(onRetry: onRetryBreakdown)
          else if (breakdown == null || breakdown!.partPerformance.isEmpty)
            const _SectionBreakdownUnavailable()
          else
            for (final section in breakdown!.partPerformance) ...[
              _SectionPerformanceRow(section: section),
              const SizedBox(height: AppSpacing.s),
            ],
          const SizedBox(height: AppSpacing.m),
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
    );
  }
}

class _SectionBreakdownUnavailable extends StatelessWidget {
  const _SectionBreakdownUnavailable({this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.examSectionBreakdownUnavailable,
            style: text.bodyMedium?.copyWith(
              color: palette.inkSecondary,
              height: 1.5,
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: AppSpacing.s),
            SecondaryButton(
              label: l10n.commonRetry,
              icon: Icons.refresh_rounded,
              onPressed: onRetry,
            ),
          ],
        ],
      ),
    );
  }
}

class _SectionPerformanceRow extends StatelessWidget {
  const _SectionPerformanceRow({required this.section});

  final ExamSectionPerformance section;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _sectionName(l10n, section.code),
                  style: text.titleSmall?.copyWith(
                    color: palette.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.s),
              Text(
                l10n.examSectionCorrectCount(
                  section.correct,
                  section.total,
                ),
                style: text.labelLarge?.copyWith(
                  color: palette.inkSecondary,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: section.weightedAccuracy.clamp(0, 1),
              minHeight: 8,
              backgroundColor: palette.surfaceMuted,
              valueColor: AlwaysStoppedAnimation(palette.accent),
            ),
          ),
        ],
      ),
    );
  }

  String _sectionName(AppLocalizations l10n, String code) {
    final normalized = code
        .trim()
        .toUpperCase()
        .replaceAll('-', '_')
        .replaceAll(' ', '_');
    if (normalized.startsWith('LR') ||
        normalized.startsWith('II_') ||
        normalized == 'II' ||
        normalized.contains('LISTENING_READING') ||
        normalized.contains('CHO_DOKKAI')) {
      return l10n.examSectionListeningReading;
    }
    if (normalized.startsWith('RC') ||
        normalized.startsWith('III_') ||
        normalized == 'III' ||
        normalized == 'READING' ||
        normalized.contains('DOKKAI')) {
      return l10n.examSectionReading;
    }
    if (normalized.startsWith('LC') ||
        normalized.startsWith('I_') ||
        normalized == 'I' ||
        normalized == 'LISTENING' ||
        normalized.contains('CHOKAI')) {
      return l10n.examSectionListening;
    }
    return code;
  }
}
