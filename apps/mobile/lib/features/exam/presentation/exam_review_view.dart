import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';

/// Which subset of the breakdown to show.
enum _ReviewFilter { all, wrong, correct }

/// Post-session per-question review for a completed BJT exam, backed by the
/// real `/api/quiz/session/:id/results/breakdown` endpoint.
///
/// The backend returns the learner's chosen option key plus a correct/incorrect
/// verdict and the Vietnamese explanation — it deliberately does NOT expose the
/// correct option text. This screen therefore never renders a fabricated
/// "correct answer"; it shows only the honest verdict + explanation.
class ExamReviewView extends ConsumerStatefulWidget {
  const ExamReviewView({required this.sessionId, this.onBack, super.key});

  final String sessionId;

  /// Optional handler for the leading back affordance. When null the default
  /// app-bar back behaviour applies.
  final VoidCallback? onBack;

  @override
  ConsumerState<ExamReviewView> createState() => _ExamReviewViewState();
}

class _ExamReviewViewState extends ConsumerState<ExamReviewView> {
  _ReviewFilter _filter = _ReviewFilter.all;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final async = ref.watch(examBreakdownProvider(widget.sessionId));

    return AppScaffold(
      title: l10n.examReviewTitle,
      leading: widget.onBack == null
          ? null
          : IconButton(
              icon: const Icon(Icons.arrow_back_rounded),
              onPressed: widget.onBack,
              tooltip: MaterialLocalizations.of(context).backButtonTooltip,
            ),
      body: async.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: LoadingStateView(
            children: [
              SkeletonBox(height: 96, radius: AppRadius.lg),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(height: 120, radius: AppRadius.md),
              SizedBox(height: AppSpacing.s),
              SkeletonBox(height: 120, radius: AppRadius.md),
            ],
          ),
        ),
        error: (_, _) => ErrorStateView(
          title: l10n.examReviewErrorTitle,
          message: l10n.examReviewErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () =>
              ref.invalidate(examBreakdownProvider(widget.sessionId)),
        ),
        data: (breakdown) => _ReviewBody(
          breakdown: breakdown,
          filter: _filter,
          onFilter: (f) => setState(() => _filter = f),
        ),
      ),
    );
  }
}

class _ReviewBody extends StatelessWidget {
  const _ReviewBody({
    required this.breakdown,
    required this.filter,
    required this.onFilter,
  });

  final ExamBreakdown breakdown;
  final _ReviewFilter filter;
  final ValueChanged<_ReviewFilter> onFilter;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    // Keep original positions stable for the per-question labels.
    final indexed = <(int, ExamBreakdownItem)>[
      for (var i = 0; i < breakdown.items.length; i++)
        (i + 1, breakdown.items[i]),
    ];
    final visible = indexed.where((entry) {
      switch (filter) {
        case _ReviewFilter.all:
          return true;
        case _ReviewFilter.wrong:
          return !entry.$2.isCorrect;
        case _ReviewFilter.correct:
          return entry.$2.isCorrect;
      }
    }).toList();

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        _ScoreHeader(breakdown: breakdown),
        const SizedBox(height: AppSpacing.m),
        _FilterRow(
          filter: filter,
          onFilter: onFilter,
          total: breakdown.total,
          wrong: breakdown.total - breakdown.correctCount,
          correct: breakdown.correctCount,
        ),
        const SizedBox(height: AppSpacing.m),
        if (visible.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
            child: EmptyStateView(
              icon: Icons.filter_alt_outlined,
              title: l10n.examReviewEmptyFilter,
              message: '',
            ),
          )
        else
          for (final entry in visible) ...[
            _ReviewItemCard(position: entry.$1, item: entry.$2),
            const SizedBox(height: AppSpacing.s),
          ],
      ],
    );
  }
}

class _ScoreHeader extends StatelessWidget {
  const _ScoreHeader({required this.breakdown});

  final ExamBreakdown breakdown;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final correct = breakdown.correctCount;
    final total = breakdown.total;
    final percent =
        total <= 0 ? 0 : ((correct / total) * 100).round().clamp(0, 100);
    final strong = percent >= 70;

    return AppCard(
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: strong ? palette.successSoft : palette.accentSoft,
            ),
            child: Text(
              '$percent%',
              style: text.titleMedium?.copyWith(
                color: strong ? palette.success : palette.accent,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.examReviewScore(correct, total),
                  style: text.titleMedium?.copyWith(
                    color: palette.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (breakdown.estimatedBjtBand != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.examResultBand(breakdown.estimatedBjtBand!),
                    style: text.bodySmall?.copyWith(
                      color: palette.inkSecondary,
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

class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.filter,
    required this.onFilter,
    required this.total,
    required this.wrong,
    required this.correct,
  });

  final _ReviewFilter filter;
  final ValueChanged<_ReviewFilter> onFilter;
  final int total;
  final int wrong;
  final int correct;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Wrap(
      spacing: AppSpacing.s,
      runSpacing: AppSpacing.s,
      children: [
        _FilterChip(
          label: '${l10n.examReviewFilterAll} ($total)',
          selected: filter == _ReviewFilter.all,
          onTap: () => onFilter(_ReviewFilter.all),
        ),
        _FilterChip(
          label: '${l10n.examReviewFilterWrong} ($wrong)',
          selected: filter == _ReviewFilter.wrong,
          onTap: () => onFilter(_ReviewFilter.wrong),
        ),
        _FilterChip(
          label: '${l10n.examReviewFilterCorrect} ($correct)',
          selected: filter == _ReviewFilter.correct,
          onTap: () => onFilter(_ReviewFilter.correct),
        ),
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Material(
      color: selected ? palette.accent : palette.surfaceMuted,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minHeight: 40),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.m,
            vertical: AppSpacing.s,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: text.labelLarge?.copyWith(
              color: selected ? palette.canvas : palette.inkSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _ReviewItemCard extends StatelessWidget {
  const _ReviewItemCard({required this.position, required this.item});

  final int position;
  final ExamBreakdownItem item;

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
                l10n.examReviewQuestionLabel(position),
                style: text.labelMedium?.copyWith(color: palette.inkSecondary),
              ),
              const Spacer(),
              _VerdictTag(isCorrect: item.isCorrect),
            ],
          ),
          const SizedBox(height: AppSpacing.s),
          Text(
            item.prompt,
            style: AppTypography.japaneseBody.copyWith(
              color: palette.ink,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.s),
          Text(
            l10n.examReviewYourAnswer(item.selectedOption.toUpperCase()),
            style: text.bodyMedium?.copyWith(
              color: item.isCorrect ? palette.success : palette.danger,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (item.sectionCode != null || item.skillTag != null) ...[
            const SizedBox(height: AppSpacing.s),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                if (item.sectionCode != null)
                  _MetaChip(label: item.sectionCode!),
                if (item.skillTag != null) _MetaChip(label: item.skillTag!),
              ],
            ),
          ],
          if (item.explanationVi != null &&
              item.explanationVi!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            _ExplanationBox(text: item.explanationVi!),
          ],
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
            isCorrect ? l10n.examReviewCorrect : l10n.examReviewIncorrect,
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

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label});

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
      child: Text(
        label,
        style: text.labelSmall?.copyWith(
          color: palette.inkSecondary,
          fontWeight: FontWeight.w600,
        ),
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
          Text(
            l10n.examReviewExplanationTitle,
            style: textTheme.labelMedium?.copyWith(
              color: palette.inkSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            text,
            style: textTheme.bodyMedium?.copyWith(color: palette.ink),
          ),
        ],
      ),
    );
  }
}
