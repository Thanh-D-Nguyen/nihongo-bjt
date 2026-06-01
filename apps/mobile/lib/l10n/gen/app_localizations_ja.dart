// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Japanese (`ja`).
class AppLocalizationsJa extends AppLocalizations {
  AppLocalizationsJa([String locale = 'ja']) : super(locale);

  @override
  String get commonRetry => '再試行';

  @override
  String get homeSignOutTooltip => 'ログアウト';

  @override
  String get homeWelcome => 'ようこそ';

  @override
  String get homeReviewFlashcards => 'フラッシュカード復習';

  @override
  String get homeContinueTitle => '学習を続ける';

  @override
  String get homeContinueBody => 'デッキに戻って学習のリズムを保ちましょう。';

  @override
  String get homeReviewReadyTitle => '復習の準備';

  @override
  String homeReviewReadyCount(int count) {
    return '$count枚';
  }

  @override
  String get homeDeckSummaryTitle => 'デッキ';

  @override
  String homeDeckSummaryCount(int count) {
    return '$count個';
  }

  @override
  String get homeSyncStatusTitle => '同期';

  @override
  String homeSyncPending(int count) {
    return '$count件の復習が同期待ち';
  }

  @override
  String get homeSyncAllSynced => 'すべて同期済み';

  @override
  String get homeDashboardEmptyTitle => '学習コンテンツがありません';

  @override
  String get homeDashboardEmptyBody => 'デッキが利用可能になるとここに表示されます。';

  @override
  String get homeDashboardError => 'ダッシュボードを読み込めませんでした。';

  @override
  String get loginSignInTitle => 'ログインして続ける';

  @override
  String get loginSignInSubtitle => '安全なログインページに移動してアカウントを認証します。';

  @override
  String get loginSignInButton => 'ログイン';

  @override
  String get loginGenericError => 'エラーが発生しました。もう一度お試しください。';

  @override
  String get flashcardTitle => 'フラッシュカード';

  @override
  String deckCardCount(int count) {
    return '$count枚';
  }

  @override
  String get deckListEmpty => 'デッキがまだありません。';

  @override
  String get deckListError => 'デッキ一覧を読み込めませんでした。';

  @override
  String get reviewTitle => '復習';

  @override
  String get reviewReveal => '答えを表示';

  @override
  String get reviewComplete => '完了！';

  @override
  String reviewCompleteSummary(int count) {
    return '$count枚を復習しました。';
  }

  @override
  String get reviewRestart => 'もう一度';

  @override
  String get reviewBackToList => '一覧へ戻る';

  @override
  String get reviewEmpty => 'このデッキにはカードがありません。';

  @override
  String get reviewError => 'デッキを読み込めませんでした。';

  @override
  String get ratingAgain => 'もう一度';

  @override
  String get ratingHard => '難しい';

  @override
  String get ratingGood => '普通';

  @override
  String get ratingEasy => '簡単';

  @override
  String get ratingIntervalToday => '今日';

  @override
  String ratingIntervalDays(int days) {
    return '$days日';
  }
}
