import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/api_client_provider.dart';
import 'package:nihongo_bjt/features/saved/data/saved_repository.dart';
import 'package:nihongo_bjt/features/saved/domain/saved_models.dart';

/// Riverpod wiring for the learner's saved library (`/api/bookmarks/*`).

// The family provider exposes a verbose generated type; the explicit generic
// arguments already document intent.
// ignore_for_file: specify_nonobvious_property_types

/// Single shared [SavedRepository] depending on the auth-aware API client.
final savedRepositoryProvider = Provider<SavedRepository>(
  (ref) => SavedRepository(ref.watch(apiClientProvider)),
);

/// The learner's bookmarks for a given [BookmarkKind] tab. Auto-disposes so
/// stale tabs don't linger; kept alive briefly across rebuilds.
final savedListProvider = FutureProvider.autoDispose
    .family<List<BookmarkItem>, BookmarkKind>((ref, kind) {
      ref.keepAlive();
      return ref.watch(savedRepositoryProvider).list(kind);
    });

/// Identity of a single bookmarkable target, used as the [isSavedProvider] key.
typedef SavedTarget = ({BookmarkKind kind, String targetId});

/// Whether [SavedTarget] is currently in the learner's saved library, derived
/// from [savedListProvider]. Returns `false` while loading or when the list
/// cannot be read (e.g. signed-out) — never fabricates a saved state.
final isSavedProvider = Provider.autoDispose.family<bool, SavedTarget>((
  ref,
  target,
) {
  final list = ref.watch(savedListProvider(target.kind));
  return list.maybeWhen(
    data: (items) => items.any((item) => item.targetId == target.targetId),
    orElse: () => false,
  );
});
