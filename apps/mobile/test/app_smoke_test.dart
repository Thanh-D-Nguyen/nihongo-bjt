import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/app/app.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/home/presentation/home_page.dart';

/// Token store that reports a valid session so the smoke test lands on Home
/// (avoids touching platform secure storage in a unit-test environment).
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

void main() {
  testWidgets('app boots and renders the Home dashboard', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authTokenStoreProvider.overrideWithValue(_AuthenticatedTokenStore()),
        ],
        child: const KotobaWorksApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.byType(HomePage), findsOneWidget);
    expect(find.text('Bảng học hôm nay'), findsOneWidget);
  });
}
