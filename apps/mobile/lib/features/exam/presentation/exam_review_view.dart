import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_providers.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

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
        _RemediationCard(breakdown: breakdown),
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

    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 64,
            height: 64,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: palette.accentSoft,
            ),
            child: Icon(
              Icons.insights_outlined,
              color: palette.accent,
              size: 30,
            ),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  breakdown.estimatedScore == null
                      ? l10n.examEstimatedScoreUnavailable
                      : l10n.examEstimatedScoreValue(
                          breakdown.estimatedScore!,
                        ),
                  style: text.titleLarge?.copyWith(
                    color: palette.ink,
                    fontWeight: FontWeight.w800,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.examReviewScore(correct, total),
                  style: text.bodyMedium?.copyWith(
                    color: palette.inkSecondary,
                    fontWeight: FontWeight.w600,
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
                const SizedBox(height: AppSpacing.s),
                Text(
                  l10n.examEstimatedScoreCaveat,
                  style: text.bodySmall?.copyWith(
                    color: palette.inkSecondary,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// One-tap remediation: turns the learner's wrong answers (prompt +
/// explanation) into a fresh private review deck. Hidden when there is nothing
/// actionable to save. Holds its own save lifecycle (idle / saving / saved /
/// error) so the rest of the review screen never rebuilds while it works.
class _RemediationCard extends ConsumerStatefulWidget {
  const _RemediationCard({required this.breakdown});

  final ExamBreakdown breakdown;

  @override
  ConsumerState<_RemediationCard> createState() => _RemediationCardState();
}

enum _RemediationStatus { idle, saving, saved, error }

class _RemediationCardState extends ConsumerState<_RemediationCard> {
  _RemediationStatus _status = _RemediationStatus.idle;
  ({String deckId, int count})? _saved;

  /// Wrong answers that carry a non-empty explanation — the only ones that can
  /// become a valid card (the card back is required server-side).
  List<DeckCardInput> _buildCards() {
    return <DeckCardInput>[
      for (final item in widget.breakdown.items)
        if (!item.isCorrect &&
            item.explanationVi != null &&
            item.explanationVi!.trim().isNotEmpty)
          DeckCardInput.fromRaw(
            frontText: _truncate(item.prompt, DeckCardLimits.frontMaxLength),
            backText: _truncate(
              item.explanationVi!,
              DeckCardLimits.backMaxLength,
            ),
            reading: '',
          ),
    ];
  }

  String _deckTitle(AppLocalizations l10n) {
    final raw = widget.breakdown.testTitleVi?.trim();
    final base = (raw == null || raw.isEmpty)
        ? l10n.examRemediationDeckTitleFallback
        : l10n.examRemediationDeckTitle(raw);
    return _truncate(base, DeckFormLimits.titleMaxLength);
  }

  static String _truncate(String value, int max) {
    final trimmed = value.trim();
    return trimmed.length <= max ? trimmed : trimmed.substring(0, max);
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    final cards = _buildCards();
    if (cards.isEmpty) return;
    setState(() => _status = _RemediationStatus.saving);
    try {
      final deckId = await ref
          .read(addMistakesToDeckProvider)
          .call(deckTitle: _deckTitle(l10n), cards: cards);
      if (!mounted) return;
      setState(() {
        _status = _RemediationStatus.saved;
        _saved = (deckId: deckId, count: cards.length);
      });
    } on Object {
      if (!mounted) return;
      setState(() => _status = _RemediationStatus.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cards = _buildCards();
    // Nothing actionable (e.g. a perfect score, or no explained mistakes).
    if (cards.isEmpty) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.m),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: palette.accentSoft,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Icon(
                    Icons.bookmark_add_outlined,
                    color: palette.accent,
                  ),
                ),
                const SizedBox(width: AppSpacing.m),
                Expanded(
                  child: Text(
                    l10n.examRemediationTitle,
                    style: text.titleMedium?.copyWith(
                      color: palette.ink,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.s),
            Text(
              l10n.examRemediationBody(cards.length),
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
            const SizedBox(height: AppSpacing.m),
            if (_status == _RemediationStatus.saved && _saved != null)
              _RemediationSaved(
                deckId: _saved!.deckId,
                count: _saved!.count,
              )
            else ...[
              if (_status == _RemediationStatus.error) ...[
                Text(
                  l10n.examRemediationError,
                  style: text.bodySmall?.copyWith(color: palette.danger),
                ),
                const SizedBox(height: AppSpacing.s),
              ],
              PrimaryButton(
                label: l10n.examRemediationCta,
                icon: Icons.add_rounded,
                isLoading: _status == _RemediationStatus.saving,
                onPressed: _save,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Success state: confirms the deck was created and offers a jump to it.
class _RemediationSaved extends StatelessWidget {
  const _RemediationSaved({required this.deckId, required this.count});

  final String deckId;
  final int count;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.check_circle_rounded, size: 20, color: palette.success),
            const SizedBox(width: AppSpacing.s),
            Expanded(
              child: Text(
                l10n.examRemediationSuccess(count),
                style: text.bodyMedium?.copyWith(
                  color: palette.success,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.s),
        SecondaryButton(
          label: l10n.examRemediationOpenDeck,
          icon: Icons.style_outlined,
          onPressed: () => context.goNamed(
            Routes.flashcardDeck,
            pathParameters: {'deckId': deckId},
          ),
        ),
      ],
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
          if (item.explanationVi != null && item.explanationVi!.isNotEmpty) ...[
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
