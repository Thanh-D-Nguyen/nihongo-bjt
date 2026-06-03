import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/api_client_provider.dart';
import 'package:nihongo_bjt/core/content/data/content_repository.dart';
import 'package:nihongo_bjt/core/content/domain/content_models.dart';

/// Riverpod wiring for the canonical content features (Dictionary, Kanji,
/// Grammar, Search). Repositories are stateless and depend on the shared
/// [apiClientProvider]; screens watch the family providers below.

/// Single shared [ContentRepository] for all content features.
final contentRepositoryProvider = Provider<ContentRepository>(
  (ref) => ContentRepository(ref.watch(apiClientProvider)),
);

// Family providers expose a verbose generated type; the explicit generic
// arguments already document intent.
// ignore_for_file: specify_nonobvious_property_types

// --- Dictionary -------------------------------------------------------------

/// Dictionary search results for the current query. Empty query → empty list
/// (no network call). Auto-disposes so stale searches don't linger.
final dictionarySearchProvider = FutureProvider.autoDispose
    .family<List<Lexeme>, String>((ref, query) {
      ref.keepAlive();
      return ref.watch(contentRepositoryProvider).searchDictionary(query);
    });

/// Full dictionary word detail by id.
final dictionaryWordProvider = FutureProvider.autoDispose
    .family<Lexeme, String>((ref, id) {
      return ref.watch(contentRepositoryProvider).dictionaryWord(id);
    });

// --- Kanji ------------------------------------------------------------------

/// Kanji list filtered by an optional query (character/reading/level).
final kanjiListProvider = FutureProvider.autoDispose
    .family<List<KanjiEntry>, String?>((ref, query) {
      ref.keepAlive();
      return ref.watch(contentRepositoryProvider).listKanji(query: query);
    });

/// Full kanji detail by id.
final kanjiDetailProvider = FutureProvider.autoDispose
    .family<KanjiEntry, String>((ref, id) {
      return ref.watch(contentRepositoryProvider).kanji(id);
    });

// --- Grammar ----------------------------------------------------------------

/// Grammar list filtered by an optional query (pattern/level).
final grammarListProvider = FutureProvider.autoDispose
    .family<List<GrammarEntry>, String?>((ref, query) {
      ref.keepAlive();
      return ref.watch(contentRepositoryProvider).listGrammar(query: query);
    });

/// Full grammar point detail by id.
final grammarDetailProvider = FutureProvider.autoDispose
    .family<GrammarEntry, String>((ref, id) {
      return ref.watch(contentRepositoryProvider).grammar(id);
    });

// --- Global search ----------------------------------------------------------

/// Meilisearch-backed global content search results for the current query.
final contentSearchProvider = FutureProvider.autoDispose
    .family<List<SearchHit>, String>((ref, query) {
      ref.keepAlive();
      return ref.watch(contentRepositoryProvider).search(query);
    });
