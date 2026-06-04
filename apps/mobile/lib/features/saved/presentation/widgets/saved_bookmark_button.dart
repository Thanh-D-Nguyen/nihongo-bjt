import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';
import 'package:nihongo_bjt/features/saved/presentation/saved_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// App-bar bookmark toggle for a content detail page (word / kanji / grammar).
///
/// The displayed state is derived from the learner's saved library
/// ([isSavedProvider]); tapping optimistically flips the icon, calls
/// `/api/bookmarks/*`, and rolls back on failure. A signed-out learner gets a
/// sign-in prompt instead of a silent no-op. No saved state is ever fabricated.
class SavedBookmarkButton extends ConsumerStatefulWidget {
  const SavedBookmarkButton({
    required this.kind,
    required this.targetId,
    super.key,
  });

  final BookmarkKind kind;
  final String targetId;

  @override
  ConsumerState<SavedBookmarkButton> createState() =>
      _SavedBookmarkButtonState();
}

class _SavedBookmarkButtonState extends ConsumerState<SavedBookmarkButton> {
  /// Optimistic override of the derived state while a toggle is in flight or
  /// settled locally; `null` means "trust the derived library state".
  bool? _override;
  bool _busy = false;

  Future<void> _toggle(bool current) async {
    if (_busy) return;
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _busy = true;
      _override = !current;
    });
    try {
      final result = await ref
          .read(savedRepositoryProvider)
          .toggle(widget.kind, widget.targetId);
      if (!mounted) return;
      setState(() => _override = result);
      ref.invalidate(savedListProvider(widget.kind));
    } on RepositoryException catch (error) {
      if (!mounted) return;
      setState(() => _override = current);
      final message = error.kind == RepositoryErrorKind.unauthorized
          ? l10n.savedBookmarkSignIn
          : l10n.savedBookmarkError;
      messenger.showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final derived = ref.watch(
      isSavedProvider((kind: widget.kind, targetId: widget.targetId)),
    );
    final current = _override ?? derived;

    return IconButton(
      tooltip: current ? l10n.savedBookmarkRemove : l10n.savedBookmarkAdd,
      onPressed: _busy ? null : () => _toggle(current),
      icon: Icon(current ? Icons.bookmark : Icons.bookmark_border),
    );
  }
}
