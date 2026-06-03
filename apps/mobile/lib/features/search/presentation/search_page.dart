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
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';

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
  String _query = '';

  void _open(SearchHit hit) {
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
              hintText: l10n.searchHint,
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          Expanded(child: _SearchResults(query: _query, onOpen: _open)),
        ],
      ),
    );
  }
}

class _SearchResults extends ConsumerWidget {
  const _SearchResults({required this.query, required this.onOpen});

  final String query;
  final ValueChanged<SearchHit> onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);

    if (query.isEmpty) {
      return EmptyStateView(
        icon: Icons.search_rounded,
        title: l10n.searchIdleTitle,
        message: l10n.searchIdleBody,
      );
    }

    final results = ref.watch(contentSearchProvider(query));
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
        onRetry: () => ref.invalidate(contentSearchProvider(query)),
      ),
      data: (hits) {
        if (hits.isEmpty) {
          return EmptyStateView(
            icon: Icons.search_off_rounded,
            title: l10n.searchEmptyTitle,
            message: l10n.searchEmptyBody,
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(AppSpacing.m),
          itemCount: hits.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
          itemBuilder: (context, index) => _SearchHitTile(
            hit: hits[index],
            onTap: () => onOpen(hits[index]),
          ),
        );
      },
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
