import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/app/app.dart';

void main() {
  testWidgets('home → deck list → review → completion', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: KotobaWorksApp()));
    await tester.pumpAndSettle();

    // Home CTA opens the deck list.
    await tester.tap(find.text('Ôn Flashcard'));
    await tester.pumpAndSettle();
    expect(find.text('ビジネス基礎'), findsOneWidget);

    // Open the 4-card business-basics deck.
    await tester.tap(find.text('ビジネス基礎'));
    await tester.pumpAndSettle();

    // Active recall: before reveal the reading help and answer stay hidden.
    expect(find.text('報告'), findsOneWidget);
    expect(find.text('ほうこく'), findsNothing);
    expect(find.text('báo cáo'), findsNothing);

    // Reveal then grade every card.
    for (var i = 0; i < 4; i++) {
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
