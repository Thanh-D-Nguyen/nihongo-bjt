import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Loads [AppLocalizations] for a given [locale] via the real delegates.
Future<AppLocalizations> _load(WidgetTester tester, Locale locale) async {
  late AppLocalizations l10n;
  await tester.pumpWidget(
    MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (context) {
          l10n = AppLocalizations.of(context);
          return const SizedBox();
        },
      ),
    ),
  );
  return l10n;
}

void main() {
  testWidgets('Vietnamese (default locale) renders migrated keys', (
    tester,
  ) async {
    final l10n = await _load(tester, const Locale('vi'));

    expect(l10n.homeReviewFlashcards, 'Ôn Flashcard');
    expect(l10n.loginSignInButton, 'Đăng nhập');
    expect(l10n.flashcardTitle, 'Flashcard');
    expect(l10n.reviewReveal, 'Hiện đáp án');
    expect(l10n.reviewComplete, 'Hoàn thành!');
    expect(l10n.ratingGood, 'Tốt');
    expect(l10n.commonRetry, 'Thử lại');
    expect(l10n.deckCardCount(4), '4 thẻ');
    expect(l10n.reviewCompleteSummary(4), 'Bạn đã ôn 4 thẻ.');
    expect(l10n.ratingIntervalDays(3), '3 ngày');
  });

  testWidgets('Japanese locale renders translated keys', (tester) async {
    final l10n = await _load(tester, const Locale('ja'));

    expect(l10n.homeReviewFlashcards, 'フラッシュカード復習');
    expect(l10n.reviewReveal, '答えを表示');
    expect(l10n.ratingGood, '普通');
    expect(l10n.deckCardCount(4), '4枚');
    expect(l10n.reviewCompleteSummary(4), '4枚を復習しました。');
  });
}
