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
  String get a11yProgressLabel => '進捗';

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
  String get homeSyncAction => '今すぐ同期';

  @override
  String get homeSyncInProgress => '同期中…';

  @override
  String homeSyncResultDone(int synced) {
    String _temp0 = intl.Intl.pluralLogic(
      synced,
      locale: localeName,
      other: '$synced件の復習を同期しました',
      zero: '同期が必要な復習はありません',
    );
    return '$_temp0';
  }

  @override
  String homeSyncResultPartial(int failed) {
    String _temp0 = intl.Intl.pluralLogic(
      failed,
      locale: localeName,
      other: '$failed件の復習が未同期です。後で再試行します。',
    );
    return '$_temp0';
  }

  @override
  String get homeSyncResultError => '同期できませんでした。接続を確認して再試行してください。';

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
  String get deckListEmptyTitle => 'デッキがありません';

  @override
  String get deckListEmpty => 'デッキがまだありません。';

  @override
  String get deckListErrorTitle => '読み込めません';

  @override
  String get deckListError => 'デッキ一覧を読み込めませんでした。';

  @override
  String get reviewTitle => '復習';

  @override
  String get reviewReveal => '答えを表示';

  @override
  String get reviewRevealHint => 'まず思い出してから、タップして答えを表示します。';

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
  String get reviewEmptyTitle => 'カードがありません';

  @override
  String get reviewEmpty => 'このデッキにはカードがありません。';

  @override
  String get reviewErrorTitle => '読み込めません';

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

  @override
  String get navHome => 'ホーム';

  @override
  String get navLearn => '学習';

  @override
  String get navReview => '復習';

  @override
  String get navProgress => '進捗';

  @override
  String get navSettings => '設定';

  @override
  String get learnTitle => '学習';

  @override
  String get learnPreviewBadge => 'サンプル';

  @override
  String get learnPreviewNotice => 'これはプレビュー用のサンプル学習コンテンツです。実際のレッスンは後で接続されます。';

  @override
  String get learnDailyLessonTitle => '今日のレッスン';

  @override
  String get learnDailyLessonCta => '今すぐ学習';

  @override
  String get learnCategoriesTitle => 'カテゴリー';

  @override
  String get learnLessonsTitle => 'レッスン';

  @override
  String learnLessonsInCategory(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count件',
      one: '$count件',
    );
    return '$_temp0';
  }

  @override
  String learnMinutes(int count) {
    return '$count分';
  }

  @override
  String learnQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count問',
      one: '$count問',
    );
    return '$_temp0';
  }

  @override
  String get learnEmptyTitle => 'レッスンがありません';

  @override
  String get learnEmptyBody => '利用可能になると、ここにレッスンが表示されます。';

  @override
  String get learnErrorTitle => 'レッスンを読み込めませんでした';

  @override
  String get learnErrorBody => '学習コンテンツの読み込み中にエラーが発生しました。もう一度お試しください。';

  @override
  String get levelFoundational => '基礎';

  @override
  String get levelPractical => '実践';

  @override
  String get levelAdvanced => '応用';

  @override
  String get lessonDetailNotFound => 'このレッスンが見つかりませんでした。';

  @override
  String get lessonDetailContentTitle => '内容';

  @override
  String lessonPracticeCta(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '練習する（$count問）',
      one: '練習する（$count問）',
    );
    return '$_temp0';
  }

  @override
  String get practiceTitle => '練習';

  @override
  String practiceProgress(int current, int total) {
    return '$current / $total問';
  }

  @override
  String get practiceNext => '次へ';

  @override
  String get practicePrevious => '戻る';

  @override
  String get practiceFinish => '完了';

  @override
  String get practiceCompleteTitle => '練習が完了しました';

  @override
  String practiceScore(int correct, int total) {
    return '$total問中$correct問正解しました。';
  }

  @override
  String get practiceRestart => 'もう一度';

  @override
  String get practiceBackToLesson => 'レッスンに戻る';

  @override
  String get practiceReviewTitle => '解答を見直す';

  @override
  String practiceResultQuestionLabel(int position) {
    return '問$position';
  }

  @override
  String get practiceResultCorrect => '正解';

  @override
  String get practiceResultIncorrect => '不正解';

  @override
  String get practiceCorrectAnswer => '正解';

  @override
  String get practiceYourAnswer => 'あなたの解答';

  @override
  String get practiceExplanationTitle => '解説';

  @override
  String get practiceEmptyTitle => '問題がありません';

  @override
  String get practiceEmptyBody => 'このレッスンには練習問題がまだありません。';

  @override
  String get practiceErrorTitle => '問題を読み込めませんでした';

  @override
  String get practiceErrorBody => '問題の読み込み中にエラーが発生しました。もう一度お試しください。';

  @override
  String get reviewTabTitle => '復習';

  @override
  String get reviewHubTitle => 'まとめて復習';

  @override
  String get reviewHubIntro => '学んだ内容を定着させましょう。下から復習方法を選びます。';

  @override
  String get reviewFlashcardsTitle => 'フラッシュカード';

  @override
  String reviewFlashcardsStat(int deckCount, int cardCount) {
    return '$deckCountデッキ・$cardCount枚';
  }

  @override
  String get reviewFlashcardsEmpty => 'デッキがまだありません。';

  @override
  String get reviewFlashcardsCta => 'カードを復習';

  @override
  String get reviewPracticeTitle => '練習';

  @override
  String reviewPracticeStat(int count) {
    return '練習問題のあるレッスン$count件';
  }

  @override
  String get reviewPracticeEmpty => '練習問題のあるレッスンがありません。';

  @override
  String get reviewPracticeCta => 'レッスンを選ぶ';

  @override
  String get reviewSectionError => '読み込めませんでした。もう一度お試しください。';

  @override
  String get progressTitle => '進捗';

  @override
  String get progressIntro => 'この端末での学習アクティビティ。';

  @override
  String get progressEmptyTitle => 'まだ学習記録がありません';

  @override
  String get progressEmptyBody => 'フラッシュカードのセッションを完了すると、実際の進捗の記録が始まります。';

  @override
  String get progressErrorTitle => '進捗を読み込めません';

  @override
  String get progressError => '端末の学習データの読み取り中にエラーが発生しました。';

  @override
  String get progressTodayLabel => '今日';

  @override
  String get progressStreakLabel => '連続学習日数';

  @override
  String progressStreakValue(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days日',
    );
    return '$_temp0';
  }

  @override
  String get progressWeekLabel => '過去7日間';

  @override
  String get progressTotalLabel => '総復習回数';

  @override
  String progressCardsValue(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count枚',
    );
    return '$_temp0';
  }

  @override
  String get progressActivityTitle => '7日間のアクティビティ';

  @override
  String get progressRatingTitle => '評価の内訳';

  @override
  String get offlineBannerMessage => 'オフラインです。一部の内容は最新ではない場合があります。';
}
