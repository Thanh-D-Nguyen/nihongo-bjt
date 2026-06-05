import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/content/presentation/content_providers.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_typography.dart';
import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';
import 'package:nihongo_bjt/features/saved/presentation/saved_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';

/// The learner's saved library — bookmarked words, kanji and grammar from
/// `/api/bookmarks/*`. One tab per [BookmarkKind]. Each row resolves its
/// display title from the canonical content detail endpoints and opens the
/// matching detail screen. Handles loading / empty / error / sign-in states.
class SavedPage extends ConsumerStatefulWidget {
  const SavedPage({super.key});

  @override
  ConsumerState<SavedPage> createState() => _SavedPageState();
}

class _SavedPageState extends ConsumerState<SavedPage> {
  BookmarkKind _kind = BookmarkKind.word;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return AppScaffold(
      title: l10n.savedTitle,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.m,
              AppSpacing.s,
              AppSpacing.m,
              AppSpacing.s,
            ),
            child: _KindTabs(
              selected: _kind,
              onSelected: (kind) => setState(() => _kind = kind),
            ),
          ),
          Expanded(child: _SavedList(kind: _kind)),
        ],
      ),
    );
  }
}

class _KindTabs extends StatelessWidget {
  const _KindTabs({required this.selected, required this.onSelected});

  final BookmarkKind selected;
  final ValueChanged<BookmarkKind> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Row(
      children: [
        for (final kind in BookmarkKind.values) ...[
          Expanded(
            child: _KindTab(
              label: _kindTabLabel(l10n, kind),
              selected: kind == selected,
              onTap: () => onSelected(kind),
            ),
          ),
          if (kind != BookmarkKind.values.last)
            const SizedBox(width: AppSpacing.s),
        ],
      ],
    );
  }
}

class _KindTab extends StatelessWidget {
  const _KindTab({
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
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s),
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

String _kindTabLabel(AppLocalizations l10n, BookmarkKind kind) =>
    switch (kind) {
      BookmarkKind.word => l10n.savedTabWords,
      BookmarkKind.kanji => l10n.savedTabKanji,
      BookmarkKind.grammar => l10n.savedTabGrammar,
    };

class _SavedList extends ConsumerWidget {
  const _SavedList({required this.kind});

  final BookmarkKind kind;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final items = ref.watch(savedListProvider(kind));

    return items.when(
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
      error: (error, _) {
        if (error is RepositoryException &&
            error.kind == RepositoryErrorKind.unauthorized) {
          return EmptyStateView(
            icon: Icons.lock_outline_rounded,
            title: l10n.savedSignInTitle,
            message: l10n.savedSignInBody,
          );
        }
        return ErrorStateView(
          title: l10n.savedErrorTitle,
          message: l10n.savedErrorBody,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(savedListProvider(kind)),
        );
      },
      data: (rows) {
        if (rows.isEmpty) {
          return EmptyStateView(
            icon: Icons.bookmark_border_rounded,
            title: l10n.savedEmptyTitle,
            message: _emptyBody(l10n, kind),
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(savedListProvider(kind)),
          child: ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.m),
            itemCount: rows.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
            itemBuilder: (context, index) =>
                _SavedItemTile(kind: kind, item: rows[index]),
          ),
        );
      },
    );
  }
}

String _emptyBody(AppLocalizations l10n, BookmarkKind kind) => switch (kind) {
  BookmarkKind.word => l10n.savedEmptyWords,
  BookmarkKind.kanji => l10n.savedEmptyKanji,
  BookmarkKind.grammar => l10n.savedEmptyGrammar,
};

/// A single saved row. Resolves its display title/subtitle from the canonical
/// content detail provider for [kind], then opens that detail on tap. Exposes a
/// remove action that un-bookmarks the target server-side (with Undo).
class _SavedItemTile extends ConsumerStatefulWidget {
  const _SavedItemTile({required this.kind, required this.item});

  final BookmarkKind kind;
  final BookmarkItem item;

  @override
  ConsumerState<_SavedItemTile> createState() => _SavedItemTileState();
}

class _SavedItemTileState extends ConsumerState<_SavedItemTile> {
  bool _busy = false;

  void _open() {
    final route = switch (widget.kind) {
      BookmarkKind.word => Routes.dictionaryWord,
      BookmarkKind.kanji => Routes.kanjiDetail,
      BookmarkKind.grammar => Routes.grammarDetail,
    };
    unawaited(
      context.pushNamed(route, pathParameters: {'id': widget.item.targetId}),
    );
  }

  Future<void> _remove() async {
    if (_busy) return;
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    // The container outlives this row, which is disposed once the list
    // refetches — Undo must keep working after that.
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() => _busy = true);
    try {
      await container
          .read(savedRepositoryProvider)
          .toggle(widget.kind, widget.item.targetId);
      container.invalidate(savedListProvider(widget.kind));
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(l10n.savedRemovedToast),
            action: SnackBarAction(
              label: l10n.commonUndo,
              onPressed: () => _undo(container),
            ),
          ),
        );
    } on RepositoryException catch (error) {
      final message = error.kind == RepositoryErrorKind.unauthorized
          ? l10n.savedBookmarkSignIn
          : l10n.savedBookmarkError;
      messenger.showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _undo(ProviderContainer container) async {
    try {
      await container
          .read(savedRepositoryProvider)
          .toggle(widget.kind, widget.item.targetId);
      container.invalidate(savedListProvider(widget.kind));
    } on RepositoryException {
      // The bookmark could not be restored; the list already reflects reality.
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);
    final (title, subtitle) = _resolve(ref);

    return AppCard(
      onTap: _open,
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _KindIcon(kind: widget.kind),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title == null)
                  const SkeletonBox(height: 20, width: 120)
                else
                  Text(
                    title,
                    style: AppTypography.japaneseBody.copyWith(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: palette.ink,
                    ),
                  ),
                if (subtitle != null && subtitle.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodyMedium?.copyWith(
                      color: palette.inkSecondary,
                    ),
                  ),
                ],
                if (widget.item.createdAt != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.savedSavedOn(widget.item.createdAt!.toLocal()),
                    style: text.labelSmall?.copyWith(
                      color: palette.inkTertiary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          IconButton(
            tooltip: l10n.savedRemoveTooltip,
            onPressed: _busy ? null : _remove,
            icon: Icon(
              Icons.bookmark_remove_outlined,
              color: palette.inkTertiary,
            ),
          ),
        ],
      ),
    );
  }

  /// Resolves `(title, subtitle)` from the content detail provider. A `null`
  /// title means "still resolving" (renders a shimmer); on failure the row
  /// falls back to the target id so it never shows a blank line.
  (String?, String?) _resolve(WidgetRef ref) {
    switch (widget.kind) {
      case BookmarkKind.word:
        final word = ref.watch(dictionaryWordProvider(widget.item.targetId));
        return word.when(
          loading: () => (null, null),
          error: (_, _) => (widget.item.targetId, null),
          data: (w) => (w.headword, w.reading ?? w.primaryGloss),
        );
      case BookmarkKind.kanji:
        final kanji = ref.watch(kanjiDetailProvider(widget.item.targetId));
        return kanji.when(
          loading: () => (null, null),
          error: (_, _) => (widget.item.targetId, null),
          data: (k) => (k.character, k.meaningVi),
        );
      case BookmarkKind.grammar:
        final grammar = ref.watch(
          grammarDetailProvider(widget.item.targetId),
        );
        return grammar.when(
          loading: () => (null, null),
          error: (_, _) => (widget.item.targetId, null),
          data: (g) => (g.pattern, g.meaningVi),
        );
    }
  }
}

class _KindIcon extends StatelessWidget {
  const _KindIcon({required this.kind});

  final BookmarkKind kind;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final icon = switch (kind) {
      BookmarkKind.word => Icons.menu_book_rounded,
      BookmarkKind.kanji => Icons.translate_rounded,
      BookmarkKind.grammar => Icons.auto_stories_rounded,
    };
    return Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: palette.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Icon(icon, color: palette.accent, size: 22),
    );
  }
}
