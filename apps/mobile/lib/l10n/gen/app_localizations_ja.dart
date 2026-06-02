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
  String get loginSignInSubtitle => 'Web版と同じように、メール/パスワードまたは安全なブラウザでログインできます。';

  @override
  String get loginSignInButton => 'ログイン';

  @override
  String get loginGenericError => 'エラーが発生しました。もう一度お試しください。';

  @override
  String get loginEmailLabel => 'メールまたはユーザー名';

  @override
  String get loginEmailHint => 'testuser またはメールアドレス';

  @override
  String get loginEmailRequired => 'メールまたはユーザー名を入力してください。';

  @override
  String get loginPasswordLabel => 'パスワード';

  @override
  String get loginPasswordRequired => 'パスワードを入力してください。';

  @override
  String get loginShowPassword => 'パスワードを表示';

  @override
  String get loginHidePassword => 'パスワードを非表示';

  @override
  String get loginForgotPassword => 'パスワードをお忘れですか？';

  @override
  String get loginDivider => 'または';

  @override
  String get loginBrowserButton => '安全なブラウザでログイン';

  @override
  String get loginCreateAccount => '新しいアカウントを作成';

  @override
  String get loginTermsNotice =>
      '続行すると、NihonGo BJTの利用規約とプライバシーポリシーに同意したものとみなされます。';

  @override
  String get loginGoogleButton => 'Google';

  @override
  String get loginFacebookButton => 'Facebook';

  @override
  String get loginAppleButton => 'Apple';

  @override
  String get loginLineButton => 'LINE';

  @override
  String get loginCancelledError => 'ログインがキャンセルされました。';

  @override
  String get loginWrongCredentialsError => 'メールまたはパスワードが正しくありません。';

  @override
  String get loginMethodNotAllowedError => 'モバイルクライアントでパスワードログインが有効になっていません。';

  @override
  String get loginInvalidScopeError => 'ログインスコープの設定が正しくありません。';

  @override
  String get loginClientMisconfiguredError => 'モバイルログインクライアントの設定に問題があります。';

  @override
  String get loginNetworkError => 'ログインサーバーに接続できません。';

  @override
  String get loginMissingTokenError => 'ログインサーバーのセッション応答に必要な情報がありません。';

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

  @override
  String get profileTitle => 'プロフィール';

  @override
  String get profileOpenTooltip => 'プロフィールと設定';

  @override
  String get profileLearnerFallback => '学習者';

  @override
  String get profileAccountSection => 'アカウント';

  @override
  String get profilePreferencesSection => '設定';

  @override
  String get profileLanguageTitle => 'アプリの言語';

  @override
  String get profileLanguageSystem => '端末に合わせる';

  @override
  String get profileLanguageVietnamese => 'ベトナム語';

  @override
  String get profileLanguageJapanese => '日本語';

  @override
  String get profileFuriganaTitle => 'ふりがなを表示';

  @override
  String get profileFuriganaSubtitle => '漢字の上にかなを表示します（復習中を除く）。';

  @override
  String get profileSignOut => 'ログアウト';

  @override
  String get profileSaveError => '変更を保存できませんでした。もう一度お試しください。';
}
