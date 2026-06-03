import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/app/app.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/home/presentation/home_page.dart';
import 'package:nihongo_bjt/features/learn/presentation/learn_page.dart';
import 'package:nihongo_bjt/features/progress/presentation/progress_page.dart';
import 'package:nihongo_bjt/features/review/presentation/review_hub_page.dart';

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

Future<void> _pumpApp(WidgetTester tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authTokenStoreProvider.overrideWithValue(_AuthenticatedTokenStore()),
      ],
      child: const KotobaWorksApp(),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
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

    // Progress tab.
    await tester.tap(find.text('Tiến độ'));
    await tester.pumpAndSettle();
    expect(find.byType(ProgressPage), findsOneWidget);

    // Back Home.
    await tester.tap(find.text('Trang chủ'));
    await tester.pumpAndSettle();
    expect(find.byType(HomePage), findsOneWidget);
  });
}
