import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_colors.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/debug_review_sync_action.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// Lists the decks the learner can review. Entry point of the Flashcard slice.
class FlashcardDeckListPage extends ConsumerWidget {
  const FlashcardDeckListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final decks = ref.watch(deckListProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context).flashcardTitle),
        actions: const [DebugReviewSyncAction()],
      ),
      body: SafeArea(
        top: false,
        child: decks.when(
          loading: () => const _DeckListSkeleton(),
          error: (_, _) => _DeckListError(
            onRetry: () => ref.invalidate(deckListProvider),
          ),
          data: (items) => _DeckListView(decks: items),
        ),
      ),
    );
  }
}

class _DeckListView extends StatelessWidget {
  const _DeckListView({required this.decks});

  final List<FlashcardDeck> decks;

  @override
  Widget build(BuildContext context) {
    if (decks.isEmpty) {
      return const _DeckListEmpty();
    }
    return ListView.separated(
      padding: const EdgeInsets.all(AppSpacing.m),
      itemCount: decks.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
      itemBuilder: (context, index) => _DeckTile(deck: decks[index]),
    );
  }
}

class _DeckTile extends StatelessWidget {
  const _DeckTile({required this.deck});

  final FlashcardDeck deck;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;

    return InkWell(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      onTap: () => context.goNamed(
        Routes.flashcardReview,
        pathParameters: {'deckId': deck.id},
      ),
      child: AppCard(
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(deck.title, style: text.titleMedium),
                  const SizedBox(height: AppSpacing.xs),
                  Text(deck.description, style: text.bodySmall),
                  const SizedBox(height: AppSpacing.s),
                  Text(
                    l10n.deckCardCount(deck.cardCount),
                    style: text.labelSmall,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.inkTertiary),
          ],
        ),
      ),
    );
  }
}

class _DeckListSkeleton extends StatelessWidget {
  const _DeckListSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(AppSpacing.m),
      itemCount: 3,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
      itemBuilder: (_, _) => const AppCard(
        child: SizedBox(
          height: 64,
          child: Center(
            child: SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
      ),
    );
  }
}

class _DeckListEmpty extends StatelessWidget {
  const _DeckListEmpty();

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Text(
          AppLocalizations.of(context).deckListEmpty,
          textAlign: TextAlign.center,
          style: text.bodyMedium,
        ),
      ),
    );
  }
}

class _DeckListError extends StatelessWidget {
  const _DeckListError({required this.onRetry});

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
              l10n.deckListError,
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
