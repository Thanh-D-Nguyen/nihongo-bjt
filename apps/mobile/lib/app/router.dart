import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/shell/app_shell.dart';
import 'package:nihongo_bjt/core/auth/auth_redirect.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_session.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_status.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/auth/presentation/login_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_list_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_review_page.dart';
import 'package:nihongo_bjt/features/home/presentation/home_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/lesson_detail_page.dart';
import 'package:nihongo_bjt/features/practice/presentation/practice_page.dart';
import 'package:nihongo_bjt/features/progress/presentation/progress_page.dart';
import 'package:nihongo_bjt/features/review/presentation/review_hub_page.dart';
import 'package:nihongo_bjt/features/settings/presentation/profile_page.dart';

/// Application route names. Centralized so navigation call sites never use
/// raw path strings.
abstract final class Routes {
  static const String login = 'login';
  static const String home = 'home';
  static const String learn = 'learn';
  static const String lesson = 'lesson';
  static const String practice = 'practice';
  static const String review = 'review';
  static const String progress = 'progress';
  static const String settings = 'settings';
  static const String profile = 'profile';
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
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          // Branch 0 — Home (keeps nested profile + flashcard subroutes).
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/',
                name: Routes.home,
                builder: (context, state) => const HomePage(),
                routes: [
                  GoRoute(
                    path: 'profile',
                    name: Routes.profile,
                    builder: (context, state) => const ProfilePage(),
                  ),
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
          ),
          // Branch 1 — Learn.
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/learn',
                name: Routes.learn,
                builder: (context, state) => const LearnPage(),
                routes: [
                  GoRoute(
                    path: 'lesson/:id',
                    name: Routes.lesson,
                    builder: (context, state) => LessonDetailPage(
                      lessonId: state.pathParameters['id']!,
                    ),
                    routes: [
                      GoRoute(
                        path: 'practice',
                        name: Routes.practice,
                        builder: (context, state) => PracticePage(
                          lessonId: state.pathParameters['id']!,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          // Branch 2 — Review hub.
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/review',
                name: Routes.review,
                builder: (context, state) => const ReviewHubPage(),
              ),
            ],
          ),
          // Branch 3 — Progress.
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/progress',
                name: Routes.progress,
                builder: (context, state) => const ProgressPage(),
              ),
            ],
          ),
          // Branch 4 — Settings (reuses the existing profile screen).
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings',
                name: Routes.settings,
                builder: (context, state) => const ProfilePage(),
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
