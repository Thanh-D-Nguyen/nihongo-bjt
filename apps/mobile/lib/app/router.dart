import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/shell/app_shell.dart';
import 'package:nihongo_bjt/core/auth/auth_redirect.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_session.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_status.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/auth/presentation/login_page.dart';
import 'package:nihongo_bjt/features/auth/presentation/register_page.dart';
import 'package:nihongo_bjt/features/billing/presentation/subscription_page.dart';
import 'package:nihongo_bjt/features/career/presentation/career_arc_detail_page.dart';
import 'package:nihongo_bjt/features/career/presentation/career_arcs_page.dart';
import 'package:nihongo_bjt/features/career/presentation/career_chapter_page.dart';
import 'package:nihongo_bjt/features/career/presentation/career_hub_page.dart';
import 'package:nihongo_bjt/features/dictionary/presentation/dictionary_page.dart';
import 'package:nihongo_bjt/features/dictionary/presentation/dictionary_word_page.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_browser_page.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_player_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_card_bulk_add_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_card_form_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_detail_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_form_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_list_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_review_page.dart';
import 'package:nihongo_bjt/features/gamification/presentation/rewards_page.dart';
import 'package:nihongo_bjt/features/grammar/presentation/grammar_browser_page.dart';
import 'package:nihongo_bjt/features/grammar/presentation/grammar_detail_page.dart';
import 'package:nihongo_bjt/features/home/presentation/home_page.dart';
import 'package:nihongo_bjt/features/kanji/presentation/kanji_browser_page.dart';
import 'package:nihongo_bjt/features/kanji/presentation/kanji_detail_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/lesson_detail_page.dart';
import 'package:nihongo_bjt/features/magazine/presentation/magazine_detail_page.dart';
import 'package:nihongo_bjt/features/magazine/presentation/magazine_list_page.dart';
import 'package:nihongo_bjt/features/news/presentation/news_detail_page.dart';
import 'package:nihongo_bjt/features/news/presentation/news_list_page.dart';
import 'package:nihongo_bjt/features/practice/presentation/practice_page.dart';
import 'package:nihongo_bjt/features/progress/presentation/progress_page.dart';
import 'package:nihongo_bjt/features/review/presentation/review_hub_page.dart';
import 'package:nihongo_bjt/features/saved/presentation/saved_page.dart';
import 'package:nihongo_bjt/features/scenarios/presentation/scenario_browser_page.dart';
import 'package:nihongo_bjt/features/scenarios/presentation/scenario_player_page.dart';
import 'package:nihongo_bjt/features/search/presentation/search_page.dart';
import 'package:nihongo_bjt/features/settings/presentation/profile_page.dart';

/// Application route names. Centralized so navigation call sites never use
/// raw path strings.
abstract final class Routes {
  static const String login = 'login';
  static const String register = 'register';
  static const String home = 'home';
  static const String learn = 'learn';
  static const String lesson = 'lesson';
  static const String practice = 'practice';
  static const String review = 'review';
  static const String me = 'me';
  static const String progress = 'progress';
  static const String settings = 'settings';
  static const String profile = 'profile';
  static const String flashcards = 'flashcards';
  static const String flashcardDeck = 'flashcard-deck';
  static const String flashcardCreate = 'flashcard-create';
  static const String flashcardEdit = 'flashcard-edit';
  static const String flashcardCardCreate = 'flashcard-card-create';
  static const String flashcardCardEdit = 'flashcard-card-edit';
  static const String flashcardReview = 'flashcard-review';
  static const String flashcardDueReview = 'flashcard-due-review';
  static const String dictionary = 'dictionary';
  static const String dictionaryWord = 'dictionary-word';
  static const String kanji = 'kanji';
  static const String kanjiDetail = 'kanji-detail';
  static const String grammar = 'grammar';
  static const String grammarDetail = 'grammar-detail';
  static const String scenarios = 'scenarios';
  static const String scenarioPlayer = 'scenario-player';
  static const String exam = 'exam';
  static const String examPlayer = 'exam-player';
  static const String news = 'news';
  static const String newsArticle = 'news-article';
  static const String magazine = 'magazine';
  static const String magazineArticle = 'magazine-article';
  static const String career = 'career';
  static const String careerArcs = 'career-arcs';
  static const String careerArc = 'career-arc';
  static const String careerChapter = 'career-chapter';
  static const String search = 'search';
  static const String saved = 'saved';
  static const String rewards = 'rewards';
  static const String subscription = 'subscription';
}

/// Provides the app [GoRouter].
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefreshNotifier(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      // Back-compat: remap legacy paths to their new branch owners so old deep
      // links / saved routes keep working after the shell restructure.
      final legacy = _legacyPathRedirect(state.matchedLocation);
      if (legacy != null) return legacy;
      final status =
          ref.read(authControllerProvider).value?.status ?? AuthStatus.unknown;
      return authRedirect(status: status, location: state.matchedLocation);
    },
    routes: [
      GoRoute(
        path: loginLocation,
        name: Routes.login,
        builder: (context, state) => LoginPage(
          justRegistered: state.uri.queryParameters['registered'] == '1',
        ),
      ),
      GoRoute(
        path: registerLocation,
        name: Routes.register,
        builder: (context, state) => const RegisterPage(),
      ),
      // Practice is a full-screen focus flow: it lives outside the shell so the
      // bottom navigation never competes with the question/CTA area
      // (ANDROID-QA-P2-001). Back returns to the originating lesson.
      GoRoute(
        path: '/practice/:id',
        name: Routes.practice,
        builder: (context, state) => PracticePage(
          lessonId: state.pathParameters['id']!,
        ),
      ),
      // Flashcard review (the SRS card screen) is also a full-screen focus flow
      // so the bottom navigation does not distract during recall and never
      // mislabels the active tab (ANDROID-QA-P2-002). Back returns to the deck
      // list under the Review branch.
      GoRoute(
        path: '/flashcards/:deckId/review',
        name: Routes.flashcardReview,
        builder: (context, state) => FlashcardReviewPage(
          deckId: state.pathParameters['deckId']!,
        ),
      ),
      // Cross-deck "due now" SRS session: an empty deck id maps to the
      // learner's global due queue (`/reviews/due` with no deckId). Like the
      // per-deck review it is a full-screen focus flow; back returns to the
      // Review tab.
      GoRoute(
        path: '/review/due',
        name: Routes.flashcardDueReview,
        builder: (context, state) => const FlashcardReviewPage(deckId: ''),
      ),
      // Scenario player is a full-screen focus flow: it lives outside the shell
      // so the choices/CTA never compete with the bottom navigation. Back
      // returns to the scenario browser under the Learn branch.
      GoRoute(
        path: '/scenarios/:id',
        name: Routes.scenarioPlayer,
        builder: (context, state) => ScenarioPlayerPage(
          scenarioId: state.pathParameters['id']!,
        ),
      ),
      // BJT exam player is a full-screen scored, timed focus flow: it lives
      // outside the shell so the timer/question/CTA never compete with the
      // bottom navigation. Back returns to the exam browser under Learn.
      // Career chapter player is a full-screen focus flow (briefing →
      // scenario questions → server-scored completion) so the choices/CTA
      // never compete with the bottom navigation. Back returns to the arc
      // detail under the Learn branch.
      GoRoute(
        path: '/career/chapters/:id',
        name: Routes.careerChapter,
        builder: (context, state) => CareerChapterPage(
          chapterId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/exam/:id',
        name: Routes.examPlayer,
        builder: (context, state) => ExamPlayerPage(
          testId: state.pathParameters['id']!,
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          // Branch 0 — Home (dashboard hub). Profile/billing moved to the Me
          // branch so the Home stack stays focused on the dashboard.
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/',
                name: Routes.home,
                builder: (context, state) => const HomePage(),
              ),
            ],
          ),
          // Branch 1 — Learn (structured learning + editorial content). Lookup
          // tools (dictionary/kanji/grammar/saved) now live under the Search
          // branch so they highlight the Search tab.
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
                  ),
                  GoRoute(
                    path: 'scenarios',
                    name: Routes.scenarios,
                    builder: (context, state) => const ScenarioBrowserPage(),
                  ),
                  GoRoute(
                    path: 'exam',
                    name: Routes.exam,
                    builder: (context, state) => const ExamBrowserPage(),
                  ),
                  GoRoute(
                    path: 'news',
                    name: Routes.news,
                    builder: (context, state) => const NewsListPage(),
                    routes: [
                      GoRoute(
                        path: ':id',
                        name: Routes.newsArticle,
                        builder: (context, state) => NewsDetailPage(
                          articleId: state.pathParameters['id']!,
                        ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'magazine',
                    name: Routes.magazine,
                    builder: (context, state) => const MagazineListPage(),
                    routes: [
                      GoRoute(
                        path: ':slug',
                        name: Routes.magazineArticle,
                        builder: (context, state) => MagazineDetailPage(
                          slug: state.pathParameters['slug']!,
                        ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'career',
                    name: Routes.career,
                    builder: (context, state) => const CareerHubPage(),
                    routes: [
                      GoRoute(
                        path: 'arcs',
                        name: Routes.careerArcs,
                        builder: (context, state) => const CareerArcsPage(),
                        routes: [
                          GoRoute(
                            path: ':slug',
                            name: Routes.careerArc,
                            builder: (context, state) => CareerArcDetailPage(
                              slug: state.pathParameters['slug']!,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'rewards',
                    name: Routes.rewards,
                    builder: (context, state) => const RewardsPage(),
                  ),
                ],
              ),
            ],
          ),
          // Branch 2 — Review hub (owns the flashcard deck list so launching
          // flashcards keeps the Review tab selected — ANDROID-QA-P2-002).
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/review',
                name: Routes.review,
                builder: (context, state) => const ReviewHubPage(),
                routes: [
                  GoRoute(
                    path: 'flashcards',
                    name: Routes.flashcards,
                    builder: (context, state) => const FlashcardDeckListPage(),
                    routes: [
                      GoRoute(
                        path: 'new',
                        name: Routes.flashcardCreate,
                        builder: (context, state) =>
                            const FlashcardDeckFormPage(),
                      ),
                      GoRoute(
                        path: ':deckId',
                        name: Routes.flashcardDeck,
                        builder: (context, state) => FlashcardDeckDetailPage(
                          deckId: state.pathParameters['deckId']!,
                        ),
                        routes: [
                          GoRoute(
                            path: 'edit',
                            name: Routes.flashcardEdit,
                            builder: (context, state) => FlashcardDeckFormPage(
                              deckId: state.pathParameters['deckId'],
                            ),
                          ),
                          GoRoute(
                            path: 'cards/new',
                            name: Routes.flashcardCardCreate,
                            builder: (context, state) =>
                                FlashcardCardBulkAddPage(
                                  deckId: state.pathParameters['deckId']!,
                                ),
                          ),
                          GoRoute(
                            path: 'cards/:cardIndex/edit',
                            name: Routes.flashcardCardEdit,
                            builder: (context, state) => FlashcardCardFormPage(
                              deckId: state.pathParameters['deckId']!,
                              cardIndex: int.tryParse(
                                state.pathParameters['cardIndex'] ?? '',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          // Branch 3 — Search (lookup hub): global search + dictionary, kanji,
          // grammar and saved items. These routes highlight the Search tab.
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/search',
                name: Routes.search,
                builder: (context, state) => const SearchPage(),
                routes: [
                  GoRoute(
                    path: 'dictionary',
                    name: Routes.dictionary,
                    builder: (context, state) => const DictionaryPage(),
                    routes: [
                      GoRoute(
                        path: ':id',
                        name: Routes.dictionaryWord,
                        builder: (context, state) => DictionaryWordPage(
                          wordId: state.pathParameters['id']!,
                        ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'kanji',
                    name: Routes.kanji,
                    builder: (context, state) => const KanjiBrowserPage(),
                    routes: [
                      GoRoute(
                        path: ':id',
                        name: Routes.kanjiDetail,
                        builder: (context, state) => KanjiDetailPage(
                          kanjiId: state.pathParameters['id']!,
                        ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'grammar',
                    name: Routes.grammar,
                    builder: (context, state) => const GrammarBrowserPage(),
                    routes: [
                      GoRoute(
                        path: ':id',
                        name: Routes.grammarDetail,
                        builder: (context, state) => GrammarDetailPage(
                          grammarId: state.pathParameters['id']!,
                        ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'saved',
                    name: Routes.saved,
                    builder: (context, state) => const SavedPage(),
                  ),
                ],
              ),
            ],
          ),
          // Branch 4 — Me (account hub): profile, progress detail, billing,
          // settings and sign-out all live here so these routes highlight the
          // Me tab. The hub screen is the profile/settings page.
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/me',
                name: Routes.me,
                builder: (context, state) => const ProfilePage(),
                routes: [
                  GoRoute(
                    path: 'progress',
                    name: Routes.progress,
                    builder: (context, state) => const ProgressPage(),
                  ),
                  GoRoute(
                    path: 'subscription',
                    name: Routes.subscription,
                    builder: (context, state) => const SubscriptionPage(),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

/// Remaps legacy paths to their new branch owners after the app-shell
/// restructure (Home / Learn / Review / Search / Me). Prefix-based so nested
/// detail paths and ids are preserved. Returns the new location, or `null` when
/// the location is already current.
String? _legacyPathRedirect(String location) {
  const prefixMap = <String, String>{
    '/learn/dictionary': '/search/dictionary',
    '/learn/kanji': '/search/kanji',
    '/learn/grammar': '/search/grammar',
    '/learn/saved': '/search/saved',
    '/learn/search': '/search',
    '/progress': '/me/progress',
    '/settings': '/me',
    '/profile/subscription': '/me/subscription',
    '/profile': '/me',
  };
  for (final entry in prefixMap.entries) {
    if (location == entry.key) return entry.value;
    if (location.startsWith('${entry.key}/')) {
      return entry.value + location.substring(entry.key.length);
    }
  }
  return null;
}

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
