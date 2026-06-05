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
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.pushNamed(Routes.flashcardCreate),
        icon: const Icon(Icons.add_rounded),
        label: Text(l10n.deckCreateCta),
      ),
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

/// How the deck list is filtered by visibility.
enum _DeckFilter { all, private, public }

/// How the deck list is ordered.
enum _DeckSort { recent, title, cards }

class _DeckListView extends StatefulWidget {
  const _DeckListView({required this.decks});

  final List<FlashcardDeck> decks;

  @override
  State<_DeckListView> createState() => _DeckListViewState();
}

class _DeckListViewState extends State<_DeckListView> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';
  _DeckFilter _filter = _DeckFilter.all;
  _DeckSort _sort = _DeckSort.recent;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<FlashcardDeck> get _visibleDecks {
    final query = _query.trim().toLowerCase();
    final filtered = widget.decks.where((deck) {
      final matchesQuery =
          query.isEmpty ||
          deck.title.toLowerCase().contains(query) ||
          deck.description.toLowerCase().contains(query);
      final matchesFilter = switch (_filter) {
        _DeckFilter.all => true,
        _DeckFilter.private => deck.visibility == DeckVisibility.private,
        _DeckFilter.public => deck.visibility == DeckVisibility.public,
      };
      return matchesQuery && matchesFilter;
    }).toList();

    // `recent` preserves the server's createdAt-desc ordering.
    switch (_sort) {
      case _DeckSort.recent:
        break;
      case _DeckSort.title:
        filtered.sort(
          (a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()),
        );
      case _DeckSort.cards:
        filtered.sort((a, b) => b.cardCount.compareTo(a.cardCount));
    }
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    // A completely empty library uses the dedicated empty state.
    if (widget.decks.isEmpty) {
      return EmptyStateView(
        title: l10n.deckListEmptyTitle,
        message: l10n.deckListEmpty,
        icon: Icons.style_outlined,
        action: PrimaryButton(
          label: l10n.deckListCreateFirst,
          icon: Icons.add_rounded,
          expand: false,
          onPressed: () => context.pushNamed(Routes.flashcardCreate),
        ),
      );
    }

    final visible = _visibleDecks;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.m,
            AppSpacing.m,
            AppSpacing.m,
            AppSpacing.s,
          ),
          child: _DeckSearchField(
            controller: _searchController,
            onChanged: (value) => setState(() => _query = value),
            onClear: () {
              _searchController.clear();
              setState(() => _query = '');
            },
          ),
        ),
        _DeckToolbar(
          filter: _filter,
          sort: _sort,
          onFilterChanged: (filter) => setState(() => _filter = filter),
          onSortChanged: (sort) => setState(() => _sort = sort),
        ),
        Expanded(
          child: visible.isEmpty
              ? EmptyStateView(
                  title: l10n.deckSearchEmptyTitle,
                  message: l10n.deckSearchEmpty,
                  icon: Icons.search_off_rounded,
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.m,
                    AppSpacing.s,
                    AppSpacing.m,
                    AppSpacing.m,
                  ),
                  itemCount: visible.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.s),
                  itemBuilder: (context, index) =>
                      _DeckTile(deck: visible[index]),
                ),
        ),
      ],
    );
  }
}

class _DeckSearchField extends StatelessWidget {
  const _DeckSearchField({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;

    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      style: TextStyle(color: palette.ink),
      decoration: InputDecoration(
        isDense: true,
        hintText: l10n.deckSearchHint,
        prefixIcon: Icon(Icons.search_rounded, color: palette.inkTertiary),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                icon: const Icon(Icons.close_rounded),
                color: palette.inkTertiary,
                tooltip: l10n.deckSearchClear,
                onPressed: onClear,
              ),
        filled: true,
        fillColor: palette.surfaceMuted,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.m,
          vertical: AppSpacing.s,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: palette.accent, width: 1.5),
        ),
      ),
    );
  }
}

class _DeckToolbar extends StatelessWidget {
  const _DeckToolbar({
    required this.filter,
    required this.sort,
    required this.onFilterChanged,
    required this.onSortChanged,
  });

  final _DeckFilter filter;
  final _DeckSort sort;
  final ValueChanged<_DeckFilter> onFilterChanged;
  final ValueChanged<_DeckSort> onSortChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
      child: Row(
        children: [
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _FilterChip(
                    label: l10n.deckFilterAll,
                    selected: filter == _DeckFilter.all,
                    onTap: () => onFilterChanged(_DeckFilter.all),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  _FilterChip(
                    key: const ValueKey('deck-filter-private'),
                    label: l10n.deckFilterPrivate,
                    selected: filter == _DeckFilter.private,
                    onTap: () => onFilterChanged(_DeckFilter.private),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  _FilterChip(
                    key: const ValueKey('deck-filter-public'),
                    label: l10n.deckFilterPublic,
                    selected: filter == _DeckFilter.public,
                    onTap: () => onFilterChanged(_DeckFilter.public),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          PopupMenuButton<_DeckSort>(
            tooltip: l10n.deckSortLabel,
            icon: Icon(Icons.sort_rounded, color: palette.ink),
            initialValue: sort,
            onSelected: onSortChanged,
            itemBuilder: (context) => [
              PopupMenuItem(
                value: _DeckSort.recent,
                child: Text(l10n.deckSortRecent),
              ),
              PopupMenuItem(
                value: _DeckSort.title,
                child: Text(l10n.deckSortTitle),
              ),
              PopupMenuItem(
                value: _DeckSort.cards,
                child: Text(l10n.deckSortCards),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    super.key,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minHeight: 36),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.m,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: selected ? scheme.primary : palette.surfaceMuted,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(
              color: selected ? scheme.primary : palette.border,
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: text.labelLarge?.copyWith(
              color: selected ? scheme.onPrimary : palette.inkSecondary,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
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
        Routes.flashcardDeck,
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
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        deck.title,
                        style: text.titleMedium?.copyWith(color: palette.ink),
                      ),
                    ),
                    if (deck.visibility == DeckVisibility.public) ...[
                      const SizedBox(width: AppSpacing.s),
                      _DeckPublicBadge(label: l10n.deckVisibilityPublic),
                    ],
                  ],
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
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: palette.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.public_rounded, size: 12, color: palette.accent),
          const SizedBox(width: 4),
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
