import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_colors.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/features/reading_assist/domain/reading_assist_policy.dart';
import 'package:nihongo_bjt/features/reading_assist/presentation/japanese_text.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Reviews one deck: prompt → reveal answer → grade (Again/Hard/Good/Easy) →
/// next card → completion. All session state is in memory (Phase 2).
class FlashcardReviewPage extends ConsumerWidget {
  const FlashcardReviewPage({required this.deckId, super.key});

  final String deckId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(reviewSessionProvider(deckId));
    final controller = ref.read(reviewSessionProvider(deckId).notifier);

    return Scaffold(
      appBar: AppBar(title: Text(AppLocalizations.of(context).reviewTitle)),
      body: SafeArea(
        top: false,
        child: session.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) => _ReviewError(
            onRetry: () => ref.invalidate(reviewSessionProvider(deckId)),
          ),
          data: (state) {
            if (state.totalCount == 0) {
              return const _ReviewEmpty();
            }
            if (state.isComplete) {
              return _ReviewComplete(
                state: state,
                onRestart: controller.restart,
                onExit: () => context.goNamed(Routes.flashcards),
              );
            }
            return _ReviewActive(state: state, controller: controller);
          },
        ),
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
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        children: [
          _ReviewProgress(
            reviewed: state.reviewedCount,
            total: state.totalCount,
          ),
          const SizedBox(height: AppSpacing.l),
          Expanded(
            child: _CardFace(card: card, revealed: state.answerRevealed),
          ),
          const SizedBox(height: AppSpacing.l),
          if (state.answerRevealed)
            _RatingBar(onRate: controller.rate)
          else
            SizedBox(
              height: 52,
              width: double.infinity,
              child: FilledButton(
                onPressed: controller.revealAnswer,
                child: Text(AppLocalizations.of(context).reviewReveal),
              ),
            ),
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
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: LinearProgressIndicator(
            value: total == 0 ? 0 : reviewed / total,
            minHeight: 8,
            backgroundColor: AppColors.surfaceHover,
            color: AppColors.navy,
          ),
        ),
        const SizedBox(height: AppSpacing.s),
        Text('$reviewed / $total', style: text.labelSmall),
      ],
    );
  }
}

class _CardFace extends StatelessWidget {
  const _CardFace({required this.card, required this.revealed});

  final Flashcard card;
  final bool revealed;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
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
                    ? const ReadingAssistPolicy()
                    : const ReadingAssistPolicy.exam(),
                style: AppTypography.japaneseDisplay,
              ),
              if (revealed) ...[
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.l),
                  child: Divider(height: 1),
                ),
                Text(
                  card.back,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ],
            ],
          ),
        ),
      ),
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
    final color = ratingColor(rating);
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

class _ReviewComplete extends StatelessWidget {
  const _ReviewComplete({
    required this.state,
    required this.onRestart,
    required this.onExit,
  });

  final ReviewSessionState state;
  final VoidCallback onRestart;
  final VoidCallback onExit;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.l),
          const Icon(Icons.check_circle, size: 56, color: AppColors.success),
          const SizedBox(height: AppSpacing.m),
          Text(
            l10n.reviewComplete,
            textAlign: TextAlign.center,
            style: text.headlineSmall,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.reviewCompleteSummary(state.totalCount),
            textAlign: TextAlign.center,
            style: text.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.l),
          _RatingSummary(ratings: state.ratings),
          const Spacer(),
          SizedBox(
            height: 52,
            child: FilledButton(
              onPressed: onRestart,
              child: Text(l10n.reviewRestart),
            ),
          ),
          const SizedBox(height: AppSpacing.s),
          SizedBox(
            height: 52,
            child: OutlinedButton(
              onPressed: onExit,
              child: Text(l10n.reviewBackToList),
            ),
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
    final color = ratingColor(rating);
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
          style: const TextStyle(fontSize: 12, color: AppColors.inkSecondary),
        ),
      ],
    );
  }
}

class _ReviewEmpty extends StatelessWidget {
  const _ReviewEmpty();

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Text(
          AppLocalizations.of(context).reviewEmpty,
          textAlign: TextAlign.center,
          style: text.bodyMedium,
        ),
      ),
    );
  }
}

class _ReviewError extends StatelessWidget {
  const _ReviewError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              l10n.reviewError,
              textAlign: TextAlign.center,
              style: text.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.m),
            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: onRetry,
                child: Text(l10n.commonRetry),
              ),
            ),
          ],
        ),
      ),
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
Color ratingColor(SrsRating rating) => switch (rating) {
  SrsRating.again => AppColors.danger,
  SrsRating.hard => AppColors.warning,
  SrsRating.good => AppColors.blue,
  SrsRating.easy => AppColors.success,
};
