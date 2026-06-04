import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/app/app.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/dictionary/presentation/dictionary_page.dart';
import 'package:nihongo_bjt/features/home/presentation/home_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_page.dart';
import 'package:nihongo_bjt/features/review/presentation/review_hub_page.dart';
import 'package:nihongo_bjt/features/search/presentation/recent_search_providers.dart';
import 'package:nihongo_bjt/features/search/presentation/search_page.dart';
import 'package:nihongo_bjt/features/settings/presentation/profile_page.dart';
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

/// Pumps the app at a compact phone size (≈390 dp) so the shell renders the
/// bottom [NavigationBar] (not the ≥600 dp tablet [NavigationRail]).
Future<void> _pumpApp(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authTokenStoreProvider.overrideWithValue(_AuthenticatedTokenStore()),
        // Avoid the Drift recent-search stream so teardown leaves no pending
        // zero-duration timer; this navigation test does not touch history.
        recentSearchesProvider.overrideWith(
          (ref) => Stream.value(const <String>[]),
        ),
      ],
      child: const KotobaWorksApp(),
    ),
  );
  await tester.pumpAndSettle();
}

/// Pumps the app at a tablet width (≈1024 dp) so the shell renders the
/// [NavigationRail] instead of the bottom [NavigationBar].
Future<void> _pumpTablet(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1024, 1366);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authTokenStoreProvider.overrideWithValue(_AuthenticatedTokenStore()),
        recentSearchesProvider.overrideWith(
          (ref) => Stream.value(const <String>[]),
        ),
      ],
      child: const KotobaWorksApp(),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    // The Me hub (ProfilePage) reads platform package info; provide mock values
    // so the method channel is never hit in widget tests.
    PackageInfo.setMockInitialValues(
      appName: 'KotobaWorks',
      packageName: 'com.nihongo.bjt',
      version: '1.0.0',
      buildNumber: '1',
      buildSignature: '',
    );
  });

  testWidgets('shell shows the five primary destinations on Home', (
    tester,
  ) async {
    await _pumpApp(tester);

    expect(find.byType(HomePage), findsOneWidget);
    final navBar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(navBar.destinations.length, 5);
  });

  testWidgets('switching tabs swaps the active branch screen', (tester) async {
    await _pumpApp(tester);

    // Learn tab — Vietnamese default label.
    await tester.tap(find.text('Học'));
    await tester.pumpAndSettle();
    expect(find.byType(LearnPage), findsOneWidget);

    // Review tab.
    await tester.tap(find.text('Ôn tập'));
    await tester.pumpAndSettle();
    expect(find.byType(ReviewHubPage), findsOneWidget);

    // Search tab (lookup hub).
    await tester.tap(find.text('Tra cứu'));
    await tester.pumpAndSettle();
    expect(find.byType(SearchPage), findsOneWidget);

    // Me tab (account hub renders the profile/settings screen).
    await tester.tap(find.text('Cá nhân'));
    await tester.pumpAndSettle();
    expect(find.byType(ProfilePage), findsOneWidget);

    // Back Home.
    await tester.tap(find.text('Trang chủ'));
    await tester.pumpAndSettle();
    expect(find.byType(HomePage), findsOneWidget);
  });

  testWidgets('Search tab is a lookup hub that opens Dictionary in-branch', (
    tester,
  ) async {
    await _pumpApp(tester);

    await tester.tap(find.text('Tra cứu'));
    await tester.pumpAndSettle();
    expect(find.byType(SearchPage), findsOneWidget);

    // Idle Search shows the lookup tools (Dictionary / Kanji / Grammar / Saved).
    final dictionaryCard = find.text('Từ điển');
    expect(dictionaryCard, findsWidgets);

    await tester.tap(dictionaryCard.first);
    await tester.pumpAndSettle();

    // Dictionary opened, and the Search tab stays selected (index 3) because
    // /search/dictionary is owned by the Search branch.
    expect(find.byType(DictionaryPage), findsOneWidget);
    final navBar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(navBar.selectedIndex, 3);
  });

  testWidgets('shell uses a NavigationRail at tablet width (≥600 dp)', (
    tester,
  ) async {
    await _pumpTablet(tester);

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.byType(HomePage), findsOneWidget);

    final rail = tester.widget<NavigationRail>(find.byType(NavigationRail));
    expect(rail.destinations.length, 5);
  });
}
