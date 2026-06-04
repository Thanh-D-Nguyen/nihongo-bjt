import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_search_field.dart';
import 'package:nihongo_bjt/features/content/presentation/widgets/content_tag.dart';
import 'package:nihongo_bjt/features/search/presentation/recent_search_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Global content search across words, kanji and grammar, backed by the public
/// Meilisearch-projected `/api/search` endpoint (via [contentSearchProvider]).
/// Tapping a result opens the matching detail screen. Handles idle / loading /
/// empty / error states.
class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final TextEditingController _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Records a useful query into local recent-search history.
  void _record(String query) {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;
    unawaited(ref.read(recentSearchControllerProvider).record(trimmed));
  }

  /// Runs [query] from a recent-search chip: fills the field and shows results.
  void _runQuery(String query) {
    _controller
      ..text = query
      ..selection = TextSelection.collapsed(offset: query.length);
    setState(() => _query = query);
  }

  void _open(SearchHit hit) {
    // Opening a result is a strong signal the query was useful — record it.
    _record(_query);
    switch (hit.kind) {
      case SearchHitKind.lexeme:
        unawaited(
          context.pushNamed(
            Routes.dictionaryWord,
            pathParameters: {'id': hit.id},
          ),
        );
      case SearchHitKind.kanji:
        unawaited(
          context.pushNamed(Routes.kanjiDetail, pathParameters: {'id': hit.id}),
        );
      case SearchHitKind.grammar:
        unawaited(
          context.pushNamed(
            Routes.grammarDetail,
            pathParameters: {'id': hit.id},
          ),
        );
      case SearchHitKind.example:
      case SearchHitKind.unknown:
        // No standalone detail screen for example/unknown hits.
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return AppScaffold(
      title: l10n.searchTitle,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.m,
              AppSpacing.s,
              AppSpacing.m,
              AppSpacing.s,
            ),
            child: ContentSearchField(
              controller: _controller,
              hintText: l10n.searchHint,
              onChanged: (value) => setState(() => _query = value),
              onSubmitted: _record,
            ),
          ),
          Expanded(
            child: _SearchResults(
              query: _query,
              onOpen: _open,
              onRecentTap: _runQuery,
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchResults extends ConsumerStatefulWidget {
  const _SearchResults({
    required this.query,
    required this.onOpen,
    required this.onRecentTap,
  });

  final String query;
  final ValueChanged<SearchHit> onOpen;
  final ValueChanged<String> onRecentTap;

  @override
  ConsumerState<_SearchResults> createState() => _SearchResultsState();
}

class _SearchResultsState extends ConsumerState<_SearchResults> {
  /// Active kind filter; null means "All". Reset whenever the query changes so
  /// a stale filter never hides a fresh result set.
  SearchHitKind? _filter;

  @override
  void didUpdateWidget(_SearchResults oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.query != widget.query) _filter = null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (widget.query.isEmpty) {
      // Idle: surface recent searches + the lookup tools (Dictionary / Kanji /
      // Grammar / Saved) so the Search tab doubles as the reference hub.
      return _SearchHub(onRecentTap: widget.onRecentTap);
    }

    final results = ref.watch(contentSearchProvider(widget.query));
    return results.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.m),
        child: LoadingStateView(
          children: [
            SkeletonBox(height: 72),
            SizedBox(height: AppSpacing.s),
            SkeletonBox(height: 72),
            SizedBox(height: AppSpacing.s),
            SkeletonBox(height: 72),
          ],
        ),
      ),
      error: (_, _) => ErrorStateView(
        title: l10n.searchErrorTitle,
        message: l10n.searchErrorBody,
        retryLabel: l10n.commonRetry,
        onRetry: () => ref.invalidate(contentSearchProvider(widget.query)),
      ),
      data: (hits) {
        if (hits.isEmpty) {
          return EmptyStateView(
            icon: Icons.search_off_rounded,
            title: l10n.searchEmptyTitle,
            message: l10n.searchEmptyBody,
          );
        }

        // Kinds present in this result set, in a stable display order. The
        // filter row only appears when results span more than one kind.
        final kinds = _orderedKinds(hits);
        final showFilter = kinds.length > 1;
        final visible = _filter == null
            ? hits
            : hits.where((h) => h.kind == _filter).toList(growable: false);

        final list = ListView.separated(
          padding: const EdgeInsets.all(AppSpacing.m),
          itemCount: visible.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
          itemBuilder: (context, index) => _SearchHitTile(
            hit: visible[index],
            onTap: () => widget.onOpen(visible[index]),
          ),
        );

        if (!showFilter) return list;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _KindFilterBar(
              kinds: kinds,
              selected: _filter,
              onSelected: (kind) => setState(() => _filter = kind),
            ),
            Expanded(child: list),
          ],
        );
      },
    );
  }
}

/// Distinct hit kinds present in [hits], ordered Word → Kanji → Grammar →
/// Example → Other so the filter bar stays stable across queries.
List<SearchHitKind> _orderedKinds(List<SearchHit> hits) {
  const order = [
    SearchHitKind.lexeme,
    SearchHitKind.kanji,
    SearchHitKind.grammar,
    SearchHitKind.example,
    SearchHitKind.unknown,
  ];
  final present = hits.map((h) => h.kind).toSet();
  return order.where(present.contains).toList(growable: false);
}

/// Horizontally scrollable segmented filter for the result kinds. Leads with an
/// "All" chip; each chip is a 44dp-tall touch target.
class _KindFilterBar extends StatelessWidget {
  const _KindFilterBar({
    required this.kinds,
    required this.selected,
    required this.onSelected,
  });

  final List<SearchHitKind> kinds;
  final SearchHitKind? selected;
  final ValueChanged<SearchHitKind?> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return SizedBox(
      height: 52,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.m,
          vertical: AppSpacing.xs,
        ),
        children: [
          _KindFilterChip(
            label: l10n.searchFilterAll,
            isSelected: selected == null,
            onTap: () => onSelected(null),
          ),
          for (final kind in kinds) ...[
            const SizedBox(width: AppSpacing.s),
            _KindFilterChip(
              label: _kindLabel(l10n, kind),
              isSelected: selected == kind,
              onTap: () => onSelected(kind),
            ),
          ],
        ],
      ),
    );
  }
}

class _KindFilterChip extends StatelessWidget {
  const _KindFilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final theme = Theme.of(context);
    final text = theme.textTheme;

    return Align(
      widthFactor: 1,
      child: Material(
        color: isSelected ? palette.accent : palette.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          child: Container(
            constraints: const BoxConstraints(minHeight: 40, minWidth: 44),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(
                color: isSelected ? palette.accent : palette.border,
              ),
            ),
            child: Text(
              label,
              style: text.labelLarge?.copyWith(
                color: isSelected
                    ? theme.colorScheme.onPrimary
                    : palette.inkSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SearchHitTile extends StatelessWidget {
  const _SearchHitTile({required this.hit, required this.onTap});

  final SearchHit hit;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _KindBadge(kind: hit.kind),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        hit.title,
                        style: AppTypography.japaneseBody.copyWith(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: palette.ink,
                        ),
                      ),
                    ),
                    if (hit.jlptLevel != null &&
                        hit.jlptLevel!.isNotEmpty) ...[
                      const SizedBox(width: AppSpacing.s),
                      ContentTag(label: hit.jlptLevel!),
                    ],
                  ],
                ),
                if (hit.reading != null && hit.reading!.isNotEmpty)
                  Text(
                    hit.reading!,
                    style: AppTypography.japaneseReading.copyWith(
                      color: palette.inkTertiary,
                    ),
                  ),
                Text(
                  _kindLabel(l10n, hit.kind),
                  style: text.labelSmall?.copyWith(
                    color: palette.inkTertiary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (hit.description != null &&
                    hit.description!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    hit.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodyMedium?.copyWith(
                      color: palette.inkSecondary,
                    ),
                  ),
                ],
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

String _kindLabel(AppLocalizations l10n, SearchHitKind kind) => switch (kind) {
  SearchHitKind.lexeme => l10n.searchKindWord,
  SearchHitKind.kanji => l10n.searchKindKanji,
  SearchHitKind.grammar => l10n.searchKindGrammar,
  SearchHitKind.example => l10n.searchKindExample,
  SearchHitKind.unknown => l10n.searchKindOther,
};

IconData _kindIcon(SearchHitKind kind) => switch (kind) {
  SearchHitKind.lexeme => Icons.menu_book_rounded,
  SearchHitKind.kanji => Icons.translate_rounded,
  SearchHitKind.grammar => Icons.auto_stories_rounded,
  SearchHitKind.example => Icons.format_quote_rounded,
  SearchHitKind.unknown => Icons.help_outline_rounded,
};

class _KindBadge extends StatelessWidget {
  const _KindBadge({required this.kind});

  final SearchHitKind kind;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: palette.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Icon(_kindIcon(kind), color: palette.accent, size: 22),
    );
  }
}

/// Idle state for the Search tab: a lookup-tools hub linking to the
/// Dictionary, Kanji, Grammar and Saved browse screens. Each tool is a
/// subroute of `/search`, so opening one keeps the Search tab active.
class _SearchHub extends ConsumerWidget {
  const _SearchHub({required this.onRecentTap});

  final ValueChanged<String> onRecentTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final recent = ref.watch(recentSearchesProvider).asData?.value ?? const [];

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        if (recent.isNotEmpty) ...[
          _RecentSearches(queries: recent, onTap: onRecentTap),
          const SizedBox(height: AppSpacing.l),
        ],
        SectionHeader(title: l10n.searchToolsTitle),
        const SizedBox(height: AppSpacing.s),
        _SearchToolCard(
          icon: Icons.menu_book_rounded,
          label: l10n.learnDictionaryLabel,
          subtitle: l10n.searchToolDictionarySubtitle,
          onTap: () => unawaited(context.pushNamed(Routes.dictionary)),
        ),
        const SizedBox(height: AppSpacing.s),
        _SearchToolCard(
          icon: Icons.translate_rounded,
          label: l10n.learnKanjiLabel,
          subtitle: l10n.searchToolKanjiSubtitle,
          onTap: () => unawaited(context.pushNamed(Routes.kanji)),
        ),
        const SizedBox(height: AppSpacing.s),
        _SearchToolCard(
          icon: Icons.auto_stories_rounded,
          label: l10n.learnGrammarLabel,
          subtitle: l10n.searchToolGrammarSubtitle,
          onTap: () => unawaited(context.pushNamed(Routes.grammar)),
        ),
        const SizedBox(height: AppSpacing.s),
        _SearchToolCard(
          icon: Icons.bookmark_rounded,
          label: l10n.savedTitle,
          subtitle: l10n.savedSubtitle,
          onTap: () => unawaited(context.pushNamed(Routes.saved)),
        ),
        if (recent.isEmpty) ...[
          const SizedBox(height: AppSpacing.l),
          EmptyStateView(
            icon: Icons.search_rounded,
            title: l10n.searchIdleTitle,
            message: l10n.searchIdleBody,
          ),
        ],
      ],
    );
  }
}

/// Recent search chips: tap to re-run a query, or remove individually / clear
/// all. Backed by the on-device [recentSearchesProvider] (no fake data — hidden
/// entirely when empty).
class _RecentSearches extends ConsumerWidget {
  const _RecentSearches({required this.queries, required this.onTap});

  final List<String> queries;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final controller = ref.read(recentSearchControllerProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: SectionHeader(title: l10n.searchRecentTitle)),
            TextButton(
              onPressed: () => unawaited(controller.clear()),
              style: TextButton.styleFrom(
                minimumSize: const Size(44, 44),
                foregroundColor: palette.inkSecondary,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(l10n.searchRecentClear),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.s,
          runSpacing: AppSpacing.s,
          children: [
            for (final query in queries)
              InputChip(
                label: Text(query),
                onPressed: () => onTap(query),
                onDeleted: () => unawaited(controller.remove(query)),
                deleteIconColor: palette.inkTertiary,
                deleteButtonTooltipMessage: l10n.searchRecentRemoveTooltip,
                backgroundColor: palette.surfaceMuted,
                side: BorderSide(color: palette.border),
                labelStyle: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: palette.ink),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _SearchToolCard extends StatelessWidget {
  const _SearchToolCard({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: palette.accentSoft,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(icon, color: palette.accent, size: 24),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: text.titleMedium?.copyWith(
                    color: palette.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: text.bodySmall?.copyWith(color: palette.inkSecondary),
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
