import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/api/api_client_provider.dart';
import 'package:nihongo_bjt/features/magazine/data/magazine_repository.dart';
import 'package:nihongo_bjt/features/magazine/domain/magazine_models.dart';

/// Riverpod wiring for the magazine feature. The repository depends on the
/// shared auth-aware [apiClientProvider]; listing/detail are public while the
/// mark-read endpoint uses the attached bearer token.

/// Single shared [MagazineRepository].
final magazineRepositoryProvider = Provider<MagazineRepository>(
  (ref) => MagazineRepository(ref.watch(apiClientProvider)),
);

// The family providers expose verbose generated types; the explicit generic
// arguments already document intent.
// ignore_for_file: specify_nonobvious_property_types

/// Published magazine articles filtered by widget kind (`vocab`, `weather`,
/// `horoscope`, `bjt_phrase`, or null for every kind).
final magazineListProvider = FutureProvider.autoDispose
    .family<List<MagazineArticle>, String?>((ref, widgetKind) {
      ref.keepAlive();
      return ref.watch(magazineRepositoryProvider).list(widgetKind: widgetKind);
    });

/// Full detail for a single magazine article by slug.
final magazineDetailProvider = FutureProvider.autoDispose
    .family<MagazineArticle, String>((ref, slug) {
      ref.keepAlive();
      return ref.watch(magazineRepositoryProvider).article(slug);
    });
