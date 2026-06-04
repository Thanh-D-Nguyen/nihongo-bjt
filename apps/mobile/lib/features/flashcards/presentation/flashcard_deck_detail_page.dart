import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_detail.dart';
import 'package:nihongo_bjt/features/flashcards/domain/flashcard_deck.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Detail view of a single deck: metadata header, study CTA and the ordered
/// list of its cards. Cards and metadata come from `GET /api/decks/:id` — never
/// fabricated.
class FlashcardDeckDetailPage extends ConsumerWidget {
  const FlashcardDeckDetailPage({required this.deckId, super.key});

  final String deckId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final detail = ref.watch(deckDetailProvider(deckId));

    return AppScaffold(
      title: l10n.flashcardDeckDetailTitle,
      actions: detail.hasValue
          ? [
              IconButton(
                tooltip: l10n.deckDetailEditAction,
                icon: const Icon(Icons.edit_outlined),
                onPressed: () => context.pushNamed(
                  Routes.flashcardEdit,
                  pathParameters: {'deckId': deckId},
                ),
              ),
              IconButton(
                tooltip: l10n.deckDetailArchiveAction,
                icon: const Icon(Icons.archive_outlined),
                onPressed: () => _confirmArchive(context, ref, l10n),
              ),
            ]
          : null,
      body: detail.when(
        loading: () => const _DeckDetailSkeleton(),
        error: (_, _) => ErrorStateView(
          title: l10n.deckDetailErrorTitle,
          message: l10n.deckDetailError,
          retryLabel: l10n.commonRetry,
          icon: Icons.cloud_off_rounded,
          onRetry: () => ref.invalidate(deckDetailProvider(deckId)),
        ),
        data: (deck) => _DeckDetailView(deck: deck),
      ),
    );
  }

  Future<void> _confirmArchive(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l10n,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.deckArchiveConfirmTitle),
        content: Text(l10n.deckArchiveConfirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.deckArchiveConfirmCta),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    final ok = await ref
        .read(deckMutationControllerProvider.notifier)
        .archive(deckId);
    if (!context.mounted) return;
    if (ok) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.deckArchiveSuccess)));
      router.pop();
    } else {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.deckFormErrorGeneric)),
      );
    }
  }
}

/// How the deck-detail card list is ordered.
enum _CardSort { position, alphabetical }

class _DeckDetailView extends StatefulWidget {
  const _DeckDetailView({required this.deck});

  final DeckDetail deck;

  @override
  State<_DeckDetailView> createState() => _DeckDetailViewState();
}

class _DeckDetailViewState extends State<_DeckDetailView> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';
  _CardSort _sort = _CardSort.position;

  DeckDetail get deck => widget.deck;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  /// Cards paired with their original index so edits target the right card
  /// even after filtering or re-sorting.
  List<(int, DeckCard)> get _visibleCards {
    final indexed = <(int, DeckCard)>[
      for (var i = 0; i < deck.cards.length; i++) (i, deck.cards[i]),
    ];
    final query = _query.trim().toLowerCase();
    final filtered = query.isEmpty
        ? indexed
        : indexed.where((entry) => _matches(entry.$2, query)).toList();
    if (_sort == _CardSort.alphabetical) {
      filtered.sort(
        (a, b) => a.$2.frontText.toLowerCase().compareTo(
              b.$2.frontText.toLowerCase(),
            ),
      );
    } else {
      filtered.sort((a, b) => a.$2.position.compareTo(b.$2.position));
    }
    return filtered;
  }

  bool _matches(DeckCard card, String query) {
    return card.frontText.toLowerCase().contains(query) ||
        card.backText.toLowerCase().contains(query) ||
        card.reading.toLowerCase().contains(query);
  }

  void _openCreateCard() {
    unawaited(
      context.pushNamed(
        Routes.flashcardCardCreate,
        pathParameters: {'deckId': deck.id},
      ),
    );
  }

  void _openEditCard(int index) {
    unawaited(
      context.pushNamed(
        Routes.flashcardCardEdit,
        pathParameters: {'deckId': deck.id, 'cardIndex': '$index'},
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final hasCards = deck.cards.isNotEmpty;
    final visible = _visibleCards;
    final hasQuery = _query.trim().isNotEmpty;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.xl,
      ),
      children: [
        _DeckHeaderCard(deck: deck),
        const SizedBox(height: AppSpacing.m),
        PrimaryButton(
          label: l10n.deckDetailStudyCta,
          icon: Icons.play_arrow_rounded,
          onPressed: hasCards
              ? () => context.pushNamed(
                    Routes.flashcardReview,
                    pathParameters: {'deckId': deck.id},
                  )
              : null,
        ),
        const SizedBox(height: AppSpacing.l),
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.deckDetailCardsHeader,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(color: palette.ink),
              ),
            ),
            TextButton.icon(
              onPressed: _openCreateCard,
              icon: const Icon(Icons.add_rounded, size: 20),
              label: Text(l10n.cardAddAction),
              style: TextButton.styleFrom(
                foregroundColor: palette.accent,
                minimumSize: const Size(48, 44),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.s),
        if (!hasCards)
          _DeckCardsEmpty(
            message: l10n.deckDetailEmpty,
            actionLabel: l10n.cardAddAction,
            onAction: _openCreateCard,
          )
        else ...[
          _CardSearchBar(
            controller: _searchController,
            hint: l10n.cardSearchHint,
            onChanged: (value) => setState(() => _query = value),
          ),
          const SizedBox(height: AppSpacing.s),
          _CardSortToggle(
            sort: _sort,
            positionLabel: l10n.cardSortPosition,
            alphabeticalLabel: l10n.cardSortAlphabetical,
            onChanged: (value) => setState(() => _sort = value),
          ),
          const SizedBox(height: AppSpacing.m),
          if (visible.isEmpty)
            EmptyStateView(
              title: l10n.cardSearchEmptyTitle,
              message: l10n.cardSearchEmptyMessage,
              icon: Icons.search_off_rounded,
            )
          else
            for (final entry in visible) ...[
              _DeckCardTile(
                card: entry.$2,
                onTap: () => _openEditCard(entry.$1),
              ),
              const SizedBox(height: AppSpacing.s),
            ],
          if (hasQuery && visible.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.cardSearchResultCount(visible.length),
              style: Theme.of(context)
                  .textTheme
                  .labelSmall
                  ?.copyWith(color: palette.inkTertiary),
            ),
          ],
        ],
      ],
    );
  }
}

class _CardSearchBar extends StatelessWidget {
  const _CardSearchBar({
    required this.controller,
    required this.hint,
    required this.onChanged,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: Icon(Icons.search_rounded, color: palette.inkTertiary),
        filled: true,
        fillColor: palette.surfaceMuted,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          vertical: AppSpacing.s,
          horizontal: AppSpacing.s,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: palette.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: palette.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: palette.accent, width: 2),
        ),
      ),
    );
  }
}

class _CardSortToggle extends StatelessWidget {
  const _CardSortToggle({
    required this.sort,
    required this.positionLabel,
    required this.alphabeticalLabel,
    required this.onChanged,
  });

  final _CardSort sort;
  final String positionLabel;
  final String alphabeticalLabel;
  final ValueChanged<_CardSort> onChanged;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<_CardSort>(
      showSelectedIcon: false,
      segments: [
        ButtonSegment(
          value: _CardSort.position,
          icon: const Icon(Icons.format_list_numbered_rounded, size: 18),
          label: Text(positionLabel),
        ),
        ButtonSegment(
          value: _CardSort.alphabetical,
          icon: const Icon(Icons.sort_by_alpha_rounded, size: 18),
          label: Text(alphabeticalLabel),
        ),
      ],
      selected: {sort},
      onSelectionChanged: (selection) => onChanged(selection.first),
    );
  }
}

class _DeckHeaderCard extends StatelessWidget {
  const _DeckHeaderCard({required this.deck});

  final DeckDetail deck;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final description = deck.displayDescription;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: palette.accentSoft,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(
                  Icons.style_outlined,
                  size: 24,
                  color: palette.accent,
                ),
              ),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Text(
                  deck.displayTitle,
                  style: text.titleLarge?.copyWith(
                    color: palette.ink,
                    height: 1.4,
                  ),
                ),
              ),
              if (deck.visibility == DeckVisibility.public) ...[
                const SizedBox(width: AppSpacing.s),
                _DeckPublicBadge(label: l10n.deckVisibilityPublic),
              ],
            ],
          ),
          if (description.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.m),
            Text(
              description,
              style: text.bodyMedium?.copyWith(
                color: palette.inkSecondary,
                height: 1.5,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.m),
          Row(
            children: [
              Icon(
                Icons.layers_outlined,
                size: 18,
                color: palette.inkTertiary,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                l10n.deckCardCount(deck.cardCount),
                style: text.labelLarge?.copyWith(color: palette.inkTertiary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DeckCardTile extends StatelessWidget {
  const _DeckCardTile({required this.card, this.onTap});

  final DeckCard card;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final hasReading = card.reading.isNotEmpty;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: AppCard(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: palette.surfaceMuted,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Text(
                  '${card.position + 1}',
                  style:
                      text.labelMedium?.copyWith(color: palette.inkSecondary),
                ),
              ),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (hasReading)
                      Text(
                        card.reading,
                        style: text.labelSmall?.copyWith(
                          color: palette.inkTertiary,
                          height: 1.5,
                        ),
                      ),
                    Text(
                      card.frontText,
                      // Japanese front text — generous line height.
                      style: text.titleMedium?.copyWith(
                        color: palette.ink,
                        height: 1.8,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      card.backText,
                      style: text.bodyMedium?.copyWith(
                        color: palette.inkSecondary,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
              if (onTap != null) ...[
                const SizedBox(width: AppSpacing.s),
                Icon(
                  Icons.chevron_right_rounded,
                  color: palette.inkTertiary,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _DeckCardsEmpty extends StatelessWidget {
  const _DeckCardsEmpty({
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return EmptyStateView(
      title: l10n.deckDetailEmptyTitle,
      message: message,
      icon: Icons.style_outlined,
      action: (actionLabel != null && onAction != null)
          ? PrimaryButton(
              label: actionLabel!,
              icon: Icons.add_rounded,
              expand: false,
              onPressed: onAction,
            )
          : null,
    );
  }
}

class _DeckPublicBadge extends StatelessWidget {
  const _DeckPublicBadge({required this.label});

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
        color: palette.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.public_rounded, size: 14, color: palette.accent),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: text.labelSmall?.copyWith(
              color: palette.accent,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Shimmer-free, structure-matching skeleton for the deck detail load state.
class _DeckDetailSkeleton extends StatelessWidget {
  const _DeckDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    Widget bar(double width, double height) => Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: palette.skeleton,
            borderRadius: BorderRadius.circular(AppRadius.sm),
          ),
        );

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              bar(180, 22),
              const SizedBox(height: AppSpacing.m),
              bar(double.infinity, 14),
              const SizedBox(height: AppSpacing.s),
              bar(120, 14),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.m),
        bar(double.infinity, 48),
        const SizedBox(height: AppSpacing.l),
        for (var i = 0; i < 4; i++) ...[
          AppCard(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                bar(140, 18),
                const SizedBox(height: AppSpacing.s),
                bar(200, 14),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.s),
        ],
      ],
    );
  }
}
