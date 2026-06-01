import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/core/auth/auth_redirect.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_session.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_status.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/auth/presentation/login_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_list_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_review_page.dart';
import 'package:nihongo_bjt/features/home/presentation/home_page.dart';

/// Application route names. Centralized so navigation call sites never use
/// raw path strings.
abstract final class Routes {
  static const String login = 'login';
  static const String home = 'home';
  static const String flashcards = 'flashcards';
  static const String flashcardReview = 'flashcard-review';
}

/// Provides the app [GoRouter].
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefreshNotifier(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final status =
          ref.read(authControllerProvider).value?.status ?? AuthStatus.unknown;
      return authRedirect(status: status, location: state.matchedLocation);
    },
    routes: [
      GoRoute(
        path: loginLocation,
        name: Routes.login,
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/',
        name: Routes.home,
        builder: (context, state) => const HomePage(),
        routes: [
          GoRoute(
            path: 'flashcards',
            name: Routes.flashcards,
            builder: (context, state) => const FlashcardDeckListPage(),
            routes: [
              GoRoute(
                path: ':deckId/review',
                name: Routes.flashcardReview,
                builder: (context, state) => FlashcardReviewPage(
                  deckId: state.pathParameters['deckId']!,
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

/// Bridges the Riverpod auth state to a [Listenable] so GoRouter re-evaluates
/// its redirect whenever the authentication status changes.
class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    _subscription = ref.listen<AsyncValue<AuthSession>>(
      authControllerProvider,
      (previous, next) {
        if (previous?.value?.status != next.value?.status) {
          notifyListeners();
        }
      },
    );
  }

  late final ProviderSubscription<AsyncValue<AuthSession>> _subscription;

  @override
  void dispose() {
    _subscription.close();
    super.dispose();
  }
}
