import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/feedback/app_haptics.dart';
import 'package:nihongo_bjt/core/theme/app_motion.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/review_mode.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/flashcards/domain/typed_answer_grading.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_sign_in_required_view.dart';
import 'package:nihongo_bjt/features/reading_assist/domain/reading_assist_policy.dart';
import 'package:nihongo_bjt/features/reading_assist/presentation/japanese_text.dart';
import 'package:nihongo_bjt/features/settings/presentation/settings_controller.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Reviews one deck: prompt → reveal answer → grade (Again/Hard/Good/Easy) →
/// next card → completion. All session state is in memory (Phase 2).
class FlashcardReviewPage extends ConsumerWidget {
  const FlashcardReviewPage({required this.deckId, super.key});

  final String deckId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final authGate = ref.watch(flashcardAuthGateProvider);
    if (authGate != FlashcardAuthGate.ready) {
      return AppScaffold(
        title: l10n.reviewTitle,
        body: authGate == FlashcardAuthGate.restoring
            ? const Padding(
                padding: EdgeInsets.all(AppSpacing.m),
                child: _ReviewLoading(),
              )
            : const FlashcardSignInRequiredView(),
      );
    }

    final session = ref.watch(reviewSessionProvider(deckId));
    final controller = ref.read(reviewSessionProvider(deckId).notifier);

    return AppScaffold(
      title: l10n.reviewTitle,
      body: session.when(
        skipLoadingOnRefresh: false,
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.m),
          child: _ReviewLoading(),
        ),
        error: (error, _) => isFlashcardSignInRequiredError(error)
            ? const FlashcardSignInRequiredView()
            : ErrorStateView(
                title: l10n.reviewErrorTitle,
                message: l10n.reviewError,
                retryLabel: l10n.commonRetry,
                icon: Icons.cloud_off_rounded,
                onRetry: () => ref.invalidate(reviewSessionProvider(deckId)),
              ),
        data: (state) {
          if (state.totalCount == 0) {
            return EmptyStateView(
              title: l10n.reviewEmptyTitle,
              message: l10n.reviewEmpty,
              icon: Icons.style_outlined,
            );
          }
          if (state.isComplete) {
            return _ReviewComplete(
              state: state,
              onRestart: controller.restart,
              // A cross-deck due session (empty id) returns to the Review tab;
              // a single-deck session returns to the deck list.
              onExit: () => context.goNamed(
                deckId.trim().isEmpty ? Routes.review : Routes.flashcards,
              ),
            );
          }
          return _ReviewActive(state: state, controller: controller);
        },
      ),
    );
  }
}

class _ReviewActive extends StatelessWidget {
  const _ReviewActive({required this.state, required this.controller});

  final ReviewSessionState state;
  final ReviewSessionController controller;

  @override
  Widget build(BuildContext context) {
    final card = state.currentCard!;
    final mode = reviewModeForIndex(state.currentIndex);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        children: [
          _ReviewProgress(
            reviewed: state.reviewedCount,
            total: state.totalCount,
          ),
          const SizedBox(height: AppSpacing.l),
          if (mode == ReviewCardMode.type)
            Expanded(
              child: _TypeModeCard(
                // Keyed by card so the input + grade reset on every new card.
                key: ValueKey('type-${card.id}'),
                card: card,
                onGraded: (rating) {
                  AppHaptics.selection();
                  controller.rate(rating);
                },
              ),
            )
          else ...[
            Expanded(
              // The whole card is a reveal target so the action stays usable
              // even when the dedicated button is crowded near the bottom edge.
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: state.answerRevealed
                    ? null
                    : () {
                        AppHaptics.selection();
                        controller.revealAnswer();
                      },
                child: _CardFace(card: card, revealed: state.answerRevealed),
              ),
            ),
            const SizedBox(height: AppSpacing.l),
            if (state.answerRevealed)
              _RatingBar(
                onRate: (rating) {
                  AppHaptics.selection();
                  controller.rate(rating);
                },
              )
            else
              Column(
                children: [
                  Text(
                    AppLocalizations.of(context).reviewRevealHint,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: context.palette.inkTertiary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s),
                  PrimaryButton(
                    label: AppLocalizations.of(context).reviewReveal,
                    icon: Icons.visibility_outlined,
                    onPressed: () {
                      AppHaptics.selection();
                      controller.revealAnswer();
                    },
                  ),
                ],
              ),
          ],
        ],
      ),
    );
  }
}

class _ReviewProgress extends StatelessWidget {
  const _ReviewProgress({required this.reviewed, required this.total});

  final int reviewed;
  final int total;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: LinearProgressIndicator(
            value: total == 0 ? 0 : reviewed / total,
            minHeight: 8,
            semanticsLabel: AppLocalizations.of(context).a11yProgressLabel,
            backgroundColor: palette.surfaceHover,
            color: palette.accent,
          ),
        ),
        const SizedBox(height: AppSpacing.s),
        Text(
          '$reviewed / $total',
          style: text.labelSmall?.copyWith(color: palette.inkSecondary),
        ),
      ],
    );
  }
}

class _CardFace extends ConsumerWidget {
  const _CardFace({required this.card, required this.revealed});

  final Flashcard card;
  final bool revealed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Reading help honours the learner's furigana preference, but only once
    // the answer is revealed; before reveal it is always suppressed for active
    // recall regardless of the toggle.
    final furiganaEnabled = ref.watch(furiganaEnabledProvider);
    final palette = context.palette;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: palette.border),
      ),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.l),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Reading help (furigana) is suppressed until the answer is
              // revealed — active recall: the learner recalls the reading
              // first, then it is shown together with the answer.
              JapaneseText(
                card.front,
                reading: card.reading,
                policy: revealed
                    ? ReadingAssistPolicy(userEnabled: furiganaEnabled)
                    : const ReadingAssistPolicy.exam(),
                style: AppTypography.japaneseDisplay,
              ),
              AnimatedSwitcher(
                duration: reduceMotion ? Duration.zero : AppMotion.base,
                switchInCurve: AppMotion.standard,
                transitionBuilder: (child, animation) => FadeTransition(
                  opacity: animation,
                  child: SizeTransition(
                    sizeFactor: animation,
                    child: child,
                  ),
                ),
                child: revealed
                    ? Column(
                        key: const ValueKey('answer'),
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Padding(
                            padding: const EdgeInsets.symmetric(
                              vertical: AppSpacing.l,
                            ),
                            child: Divider(height: 1, color: palette.border),
                          ),
                          Text(
                            card.back,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(color: palette.ink),
                          ),
                        ],
                      )
                    : const SizedBox.shrink(key: ValueKey('hidden')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TypeModeCard extends ConsumerStatefulWidget {
  const _TypeModeCard({required this.card, required this.onGraded, super.key});

  final Flashcard card;
  final void Function(SrsRating rating) onGraded;

  @override
  ConsumerState<_TypeModeCard> createState() => _TypeModeCardState();
}

class _TypeModeCardState extends ConsumerState<_TypeModeCard> {
  final TextEditingController _controller = TextEditingController();
  TypedGrade? _grade;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (_grade != null) return;
    AppHaptics.selection();
    setState(() {
      _grade = gradeTypedAnswer(
        input: _controller.text,
        back: widget.card.back,
        reading: widget.card.reading,
      );
    });
  }

  ({Color background, Color foreground, String label}) _feedback(
    AppPalette palette,
    AppLocalizations l10n,
  ) {
    switch (_grade!) {
      case TypedGrade.correct:
        return (
          background: palette.successSoft,
          foreground: palette.success,
          label: l10n.reviewTypeCorrect,
        );
      case TypedGrade.almost:
        return (
          background: palette.accentSoft,
          foreground: palette.accent,
          label: l10n.reviewTypeAlmost,
        );
      case TypedGrade.wrong:
        return (
          background: palette.dangerSoft,
          foreground: palette.danger,
          label: l10n.reviewTypeWrong,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final furiganaEnabled = ref.watch(furiganaEnabledProvider);
    final graded = _grade != null;
    return Column(
      children: [
        Expanded(
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: palette.surface,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: palette.border),
            ),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.l),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Reading is suppressed until the answer is graded so the
                    // learner recalls it from memory first (active recall).
                    JapaneseText(
                      widget.card.front,
                      reading: widget.card.reading,
                      policy: graded
                          ? ReadingAssistPolicy(userEnabled: furiganaEnabled)
                          : const ReadingAssistPolicy.exam(),
                      style: AppTypography.japaneseDisplay,
                    ),
                    if (graded) ...[
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: AppSpacing.l),
                        child: Divider(height: 1),
                      ),
                      Text(
                        widget.card.back,
                        textAlign: TextAlign.center,
                        style: text.titleLarge?.copyWith(color: palette.ink),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.l),
        if (!graded) ...[
          Text(
            l10n.reviewTypePrompt,
            textAlign: TextAlign.center,
            style: text.bodySmall?.copyWith(color: palette.inkTertiary),
          ),
          const SizedBox(height: AppSpacing.s),
          TextField(
            controller: _controller,
            autofocus: true,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            decoration: InputDecoration(
              hintText: l10n.reviewTypePlaceholder,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: AppSpacing.s),
          PrimaryButton(
            label: l10n.reviewTypeSubmit,
            icon: Icons.check_rounded,
            onPressed: _submit,
          ),
        ] else ...[
          Builder(
            builder: (context) {
              final feedback = _feedback(palette, l10n);
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  vertical: AppSpacing.s,
                  horizontal: AppSpacing.m,
                ),
                decoration: BoxDecoration(
                  color: feedback.background,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Text(
                  feedback.label,
                  textAlign: TextAlign.center,
                  style: text.titleSmall?.copyWith(
                    color: feedback.foreground,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: AppSpacing.s),
          PrimaryButton(
            label: l10n.reviewTypeContinue,
            icon: Icons.arrow_forward_rounded,
            onPressed: () => widget.onGraded(typedGradeToRating(_grade!)),
          ),
        ],
      ],
    );
  }
}

class _RatingBar extends StatelessWidget {
  const _RatingBar({required this.onRate});

  final void Function(SrsRating rating) onRate;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final rating in SrsRating.values) ...[
          if (rating != SrsRating.values.first)
            const SizedBox(width: AppSpacing.s),
          Expanded(
            child: _RatingButton(
              rating: rating,
              onPressed: () => onRate(rating),
            ),
          ),
        ],
      ],
    );
  }
}

class _RatingButton extends StatelessWidget {
  const _RatingButton({required this.rating, required this.onPressed});

  final SrsRating rating;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final color = ratingColor(context.palette, rating);
    final days = srsIntervalDays(rating);
    return SizedBox(
      height: 64,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: color,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              ratingLabel(l10n, rating),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              days == 0
                  ? l10n.ratingIntervalToday
                  : l10n.ratingIntervalDays(days),
              style: const TextStyle(fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewComplete extends StatefulWidget {
  const _ReviewComplete({
    required this.state,
    required this.onRestart,
    required this.onExit,
  });

  final ReviewSessionState state;
  final VoidCallback onRestart;
  final VoidCallback onExit;

  @override
  State<_ReviewComplete> createState() => _ReviewCompleteState();
}

class _ReviewCompleteState extends State<_ReviewComplete> {
  @override
  void initState() {
    super.initState();
    // Finishing a review set earns a slightly weightier confirmation than a
    // routine tap — fired once on entry, gated by the global haptics switch.
    AppHaptics.medium();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.l),
          Icon(Icons.check_circle, size: 56, color: palette.success),
          const SizedBox(height: AppSpacing.m),
          Text(
            l10n.reviewComplete,
            textAlign: TextAlign.center,
            style: text.headlineSmall?.copyWith(color: palette.ink),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.reviewCompleteSummary(state.totalCount),
            textAlign: TextAlign.center,
            style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
          ),
          const SizedBox(height: AppSpacing.l),
          _RatingSummary(ratings: state.ratings),
          const Spacer(),
          PrimaryButton(
            label: l10n.reviewRestart,
            icon: Icons.refresh_rounded,
            onPressed: widget.onRestart,
          ),
          const SizedBox(height: AppSpacing.s),
          SecondaryButton(
            label: l10n.reviewBackToList,
            onPressed: widget.onExit,
          ),
        ],
      ),
    );
  }
}

class _RatingSummary extends StatelessWidget {
  const _RatingSummary({required this.ratings});

  final Map<String, SrsRating> ratings;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        for (final rating in SrsRating.values)
          _RatingTally(
            rating: rating,
            count: ratings.values.where((r) => r == rating).length,
          ),
      ],
    );
  }
}

class _RatingTally extends StatelessWidget {
  const _RatingTally({required this.rating, required this.count});

  final SrsRating rating;
  final int count;

  @override
  Widget build(BuildContext context) {
    final color = ratingColor(context.palette, rating);
    return Column(
      children: [
        Text(
          '$count',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          ratingLabel(AppLocalizations.of(context), rating),
          style: TextStyle(
            fontSize: 12,
            color: context.palette.inkSecondary,
          ),
        ),
      ],
    );
  }
}

class _ReviewLoading extends StatelessWidget {
  const _ReviewLoading();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SkeletonBox(height: 8, radius: AppRadius.md),
        SizedBox(height: AppSpacing.l),
        Expanded(child: SkeletonBox(radius: AppRadius.lg)),
        SizedBox(height: AppSpacing.l),
        SkeletonBox(height: 52, radius: AppRadius.md),
      ],
    );
  }
}

/// Localized label for each SRS grade button.
String ratingLabel(AppLocalizations l10n, SrsRating rating) => switch (rating) {
  SrsRating.again => l10n.ratingAgain,
  SrsRating.hard => l10n.ratingHard,
  SrsRating.good => l10n.ratingGood,
  SrsRating.easy => l10n.ratingEasy,
};

/// Status color for each SRS grade (`DESIGN.md` semantic palette).
Color ratingColor(AppPalette palette, SrsRating rating) => switch (rating) {
  SrsRating.again => palette.danger,
  SrsRating.hard => palette.warning,
  SrsRating.good => palette.accent,
  SrsRating.easy => palette.success,
};
