import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/debug_review_sync_action.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';

/// Lists the decks the learner can review. Entry point of the Flashcard slice.
class FlashcardDeckListPage extends ConsumerWidget {
  const FlashcardDeckListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final decks = ref.watch(deckListProvider);

    return AppScaffold(
      title: l10n.flashcardTitle,
      actions: const [DebugReviewSyncAction()],
      body: decks.when(
        loading: () => const _DeckListSkeleton(),
        error: (_, _) => ErrorStateView(
          title: l10n.deckListErrorTitle,
          message: l10n.deckListError,
          retryLabel: l10n.commonRetry,
          icon: Icons.cloud_off_rounded,
          onRetry: () => ref.invalidate(deckListProvider),
        ),
        data: (items) => _DeckListView(decks: items),
      ),
    );
  }
}

class _DeckListView extends StatelessWidget {
  const _DeckListView({required this.decks});

  final List<FlashcardDeck> decks;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (decks.isEmpty) {
      return EmptyStateView(
        title: l10n.deckListEmptyTitle,
        message: l10n.deckListEmpty,
        icon: Icons.style_outlined,
      );
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
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      onTap: () => context.pushNamed(
        Routes.flashcardReview,
        pathParameters: {'deckId': deck.id},
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: palette.accentSoft,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(
              Icons.style_outlined,
              size: 22,
              color: palette.accent,
            ),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  deck.title,
                  style: text.titleMedium?.copyWith(color: palette.ink),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  deck.description,
                  style: text.bodySmall?.copyWith(
                    color: palette.inkSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.s),
                Text(
                  l10n.deckCardCount(deck.cardCount),
                  style: text.labelSmall?.copyWith(
                    color: palette.inkTertiary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Icon(Icons.chevron_right_rounded, color: palette.inkTertiary),
        ],
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
      itemCount: 4,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
      itemBuilder: (_, _) => const AppCard(
        child: LoadingStateView(
          children: [
            Row(
              children: [
                SkeletonBox(height: 44, width: 44, radius: AppRadius.md),
                SizedBox(width: AppSpacing.m),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonBox(width: 120),
                      SizedBox(height: AppSpacing.s),
                      SkeletonBox(height: 12, width: 180),
                      SizedBox(height: AppSpacing.s),
                      SkeletonBox(height: 12, width: 60),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
