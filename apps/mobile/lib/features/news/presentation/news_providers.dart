import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/api_client_provider.dart';
import 'package:nihongo_bjt/features/news/data/news_repository.dart';
import 'package:nihongo_bjt/features/news/domain/news_models.dart';

/// Riverpod wiring for the NHK news feature. The repository depends on the
/// shared auth-aware [apiClientProvider]; listing/detail are public while
/// bookmark + reading endpoints use the attached bearer token.

/// Single shared [NewsRepository].
final newsRepositoryProvider = Provider<NewsRepository>(
  (ref) => NewsRepository(ref.watch(apiClientProvider)),
);

// The family providers expose verbose generated types; the explicit generic
// arguments already document intent.
// ignore_for_file: specify_nonobvious_property_types

/// Recent NHK articles filtered by source type (`easy`, `normal`, or null for
/// the admin default).
final newsListProvider = FutureProvider.autoDispose
    .family<List<NewsArticleSummary>, String?>((ref, type) {
      ref.keepAlive();
      return ref.watch(newsRepositoryProvider).listArticles(type: type);
    });

/// Full detail for a single NHK article.
final newsDetailProvider = FutureProvider.autoDispose
    .family<NewsArticleDetail, String>((ref, id) {
      ref.keepAlive();
      return ref.watch(newsRepositoryProvider).article(id);
    });
