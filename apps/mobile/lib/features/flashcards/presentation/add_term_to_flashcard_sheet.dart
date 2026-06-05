import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Opens the deck picker and adds [term] (with [reading] / [meaning]) to the
/// chosen deck. Returns `true` when a card was added, `false` when the learner
/// dismissed the sheet without adding. Repository failures are surfaced inside
/// the sheet (the learner can retry another deck), so this never throws.
Future<bool> showAddTermToFlashcardSheet(
  BuildContext context, {
  required String term,
  required String meaning,
  String? reading,
}) async {
  final added = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: false,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (_) => _AddTermToFlashcardSheet(
      term: term,
      meaning: meaning,
      reading: reading,
    ),
  );
  return added ?? false;
}

class _AddTermToFlashcardSheet extends ConsumerStatefulWidget {
  const _AddTermToFlashcardSheet({
    required this.term,
    required this.meaning,
    this.reading,
  });

  final String term;
  final String meaning;
  final String? reading;

  @override
  ConsumerState<_AddTermToFlashcardSheet> createState() =>
      _AddTermToFlashcardSheetState();
}

class _AddTermToFlashcardSheetState
    extends ConsumerState<_AddTermToFlashcardSheet> {
  String? _addingDeckId;
  String? _errorDeckId;

  Future<void> _add(String deckId) async {
    if (_addingDeckId != null) {
      return;
    }
    setState(() {
      _addingDeckId = deckId;
      _errorDeckId = null;
    });
    try {
      await ref.read(addTermToDeckProvider)(
        deckId: deckId,
        term: widget.term,
        meaning: widget.meaning,
        reading: widget.reading,
      );
      ref
        ..invalidate(deckListProvider)
        ..invalidate(deckDetailProvider(deckId));
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(true);
    } on Object {
      if (!mounted) {
        return;
      }
      setState(() {
        _addingDeckId = null;
        _errorDeckId = deckId;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    final decks = ref.watch(deckListProvider);
    final maxHeight = MediaQuery.sizeOf(context).height * 0.7;

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.s),
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: palette.inkSecondary.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.l,
                AppSpacing.m,
                AppSpacing.l,
                AppSpacing.xs,
              ),
              child: Text(
                l10n.addFlashcardTitle,
                style: text.titleMedium?.copyWith(color: palette.ink),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.l),
              child: Text(
                l10n.addFlashcardChooseDeck,
                style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
              ),
            ),
            const SizedBox(height: AppSpacing.s),
            Flexible(
              child: decks.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(AppSpacing.l),
                  child: LoadingStateView(
                    children: [
                      SkeletonBox(height: 64),
                      SizedBox(height: AppSpacing.s),
                      SkeletonBox(height: 64),
                    ],
                  ),
                ),
                error: (_, _) => Padding(
                  padding: const EdgeInsets.all(AppSpacing.l),
                  child: ErrorStateView(
                    title: l10n.addFlashcardLoadError,
                    message: l10n.commonRetry,
                    retryLabel: l10n.commonRetry,
                    onRetry: () => ref.invalidate(deckListProvider),
                  ),
                ),
                data: (items) => items.isEmpty
                    ? _EmptyDecks(
                        onCreate: () {
                          Navigator.of(context).pop(false);
                          unawaited(context.pushNamed(Routes.flashcards));
                        },
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.l,
                          AppSpacing.s,
                          AppSpacing.l,
                          AppSpacing.l,
                        ),
                        shrinkWrap: true,
                        itemCount: items.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.s),
                        itemBuilder: (context, index) {
                          final deck = items[index];
                          return _DeckTile(
                            deck: deck,
                            isAdding: _addingDeckId == deck.id,
                            hasError: _errorDeckId == deck.id,
                            disabled:
                                _addingDeckId != null &&
                                _addingDeckId != deck.id,
                            onTap: () => _add(deck.id),
                          );
                        },
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DeckTile extends StatelessWidget {
  const _DeckTile({
    required this.deck,
    required this.isAdding,
    required this.hasError,
    required this.disabled,
    required this.onTap,
  });

  final FlashcardDeck deck;
  final bool isAdding;
  final bool hasError;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);

    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: Material(
        color: palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          onTap: (disabled || isAdding) ? null : onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        deck.title,
                        style: text.titleSmall?.copyWith(color: palette.ink),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        l10n.deckCardCount(deck.cardCount),
                        style: text.bodySmall?.copyWith(
                          color: palette.inkSecondary,
                        ),
                      ),
                      if (hasError) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          l10n.readingDetailAddError,
                          style: text.bodySmall?.copyWith(
                            color: palette.danger,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.s),
                if (isAdding)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  )
                else
                  Icon(Icons.add_rounded, color: palette.accent),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyDecks extends StatelessWidget {
  const _EmptyDecks({required this.onCreate});

  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.l),
      child: EmptyStateView(
        icon: Icons.style_outlined,
        title: l10n.addFlashcardEmptyTitle,
        message: l10n.addFlashcardEmptyBody,
        action: PrimaryButton(
          label: l10n.addFlashcardCreateDeck,
          icon: Icons.add_rounded,
          expand: false,
          onPressed: onCreate,
        ),
      ),
    );
  }
}
