import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/app/app.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/auth/presentation/login_page.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_deck_list_page.dart';
import 'package:nihongo_bjt/features/settings/presentation/profile_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Reports a valid session so the shell lands on Home (no platform storage).
class _AuthenticatedTokenStore implements AuthTokenStore {
  @override
  Future<AuthTokens?> read() async => AuthTokens(
    accessToken: 'access',
    refreshToken: 'refresh',
    idToken: 'id',
    accessTokenExpiresAt: DateTime.now().toUtc().add(const Duration(hours: 1)),
  );

  @override
  Future<void> write(AuthTokens tokens) async {}

  @override
  Future<void> clear() async {}
}

/// Local auth repository so sign-out never touches the real OIDC plugin.
class _FakeAuthRepository implements AuthRepository {
  @override
  Future<AuthTokens> signIn({
    String? idpHint,
    AuthBrowserFlow flow = AuthBrowserFlow.signIn,
  }) async => throw UnimplementedError();

  @override
  Future<AuthTokens> signInWithPassword({
    required String username,
    required String password,
  }) async => throw UnimplementedError();

  @override
  Future<AuthTokens> refresh(String refreshToken) async =>
      throw UnimplementedError();

  @override
  Future<void> signOut({String? idToken}) async {
    // Mimic a real remote logout round-trip so the transient signing-out
    // state is rendered for at least one frame before the redirect.
    await Future<void>.delayed(const Duration(milliseconds: 50));
  }
}

Future<void> _pumpApp(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authTokenStoreProvider.overrideWithValue(_AuthenticatedTokenStore()),
        authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
      ],
      child: const NihonGoApp(),
    ),
  );
  await tester.pumpAndSettle();
}

int _selectedTab(WidgetTester tester) =>
    tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex;

void main() {
  setUp(() {
    // The Profile screen reads the platform package info; provide deterministic
    // mock values so the method channel is never hit in widget tests.
    PackageInfo.setMockInitialValues(
      appName: 'NihonGo BJT',
      packageName: 'com.nihongo.bjt',
      version: '1.0.0',
      buildNumber: '1',
      buildSignature: '',
    );
  });

  testWidgets('Review → Flashcards keeps the Review tab selected', (
    tester,
  ) async {
    await _pumpApp(tester);

    // Open the Review tab (index 2).
    await tester.tap(find.text('Ôn tập'));
    await tester.pumpAndSettle();
    expect(_selectedTab(tester), 2);

    // Launch the flashcard deck list from the Review hub.
    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    await tester.tap(find.text(l10n.reviewFlashcardsCta));
    await tester.pumpAndSettle();

    // The deck list is shown and the Review tab remains active — never Home.
    expect(find.byType(FlashcardDeckListPage), findsOneWidget);
    expect(_selectedTab(tester), 2);
  });

  testWidgets('Home → Flashcards does not highlight Home unexpectedly', (
    tester,
  ) async {
    await _pumpApp(tester);

    // Home CTA opens the flashcard deck list.
    await tester.tap(find.text('Ôn Flashcard'));
    await tester.pumpAndSettle();

    expect(find.byType(FlashcardDeckListPage), findsOneWidget);
    // Flashcards now belong to the Review branch, so Home (index 0) is not the
    // active tab while browsing decks.
    expect(_selectedTab(tester), isNot(0));
  });

  testWidgets('sign-out shows a signing-out state then lands on Login', (
    tester,
  ) async {
    await _pumpApp(tester);

    // Open Settings (index 4) and sign out.
    await tester.tap(find.text('Cài đặt'));
    await tester.pumpAndSettle();
    expect(find.byType(ProfilePage), findsOneWidget);

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    // The About section makes the page scrollable on small screens; ensure the
    // sign-out button is on-screen before tapping it.
    await tester.ensureVisible(find.text(l10n.profileSignOut));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.profileSignOut));
    // One frame: the auth state is synchronously set to loading, so the
    // explicit signing-out view appears (no confusing profile fallback).
    await tester.pump();
    expect(find.text(l10n.profileSigningOut), findsOneWidget);

    // Let the remote logout resolve, then the auth guard redirects to Login.
    // LoginPage now shrinks its wordmark to fit narrow widths, so the redirect
    // must complete cleanly with no layout overflow exception.
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.takeException(), isNull);
    }
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(ProfilePage), findsNothing);
  });
}
