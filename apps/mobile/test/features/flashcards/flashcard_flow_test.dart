import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/app/app.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';

/// Reports a valid session so the app flow does not touch platform secure
/// storage during widget tests.
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
  testWidgets('home → deck list → review → completion', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authTokenStoreProvider.overrideWithValue(_AuthenticatedTokenStore()),
        ],
        child: const KotobaWorksApp(),
      ),
    );
    await tester.pumpAndSettle();

    // Home CTA opens the deck list.
    await tester.tap(find.text('Ôn Flashcard'));
    await tester.pumpAndSettle();
    expect(find.text('ビジネス基礎'), findsOneWidget);

    // Open the 4-card business-basics deck → deck detail.
    await tester.tap(find.text('ビジネス基礎'));
    await tester.pumpAndSettle();

    // Start the review session from the deck detail.
    await tester.tap(find.text('Học bộ thẻ'));
    await tester.pumpAndSettle();

    // Active recall: before reveal the reading help and answer stay hidden.
    expect(find.text('報告'), findsOneWidget);
    expect(find.text('ほうこく'), findsNothing);
    expect(find.text('báo cáo'), findsNothing);

    // Grade every card. Odd-indexed cards use the typing mode; even-indexed
    // cards use the flip (reveal then self-grade) mode.
    const typedReadings = <int, String>{1: 'とりひきさき', 3: 'みつもり'};
    for (var i = 0; i < 4; i++) {
      if (i.isOdd) {
        await tester.enterText(find.byType(TextField), typedReadings[i]!);
        await tester.tap(find.text('Kiểm tra'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Tiếp tục'));
        await tester.pumpAndSettle();
        continue;
      }
      await tester.tap(find.text('Hiện đáp án'));
      await tester.pumpAndSettle();
      if (i == 0) {
        // First card: reading help and answer appear after reveal.
        expect(find.text('ほうこく'), findsOneWidget);
        expect(find.text('báo cáo'), findsOneWidget);
      }
      await tester.tap(find.text('Tốt'));
      await tester.pumpAndSettle();
    }

    expect(find.text('Hoàn thành!'), findsOneWidget);
  });
}
