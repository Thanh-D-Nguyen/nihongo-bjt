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
  String get homeHeroTitle => '今日の学習ダッシュボード';

  @override
  String get homeHeroBody => '復習、BJT、実用的な読み物でビジネス日本語のリズムを保ちましょう。';

  @override
  String get homePrimaryReviewCta => '今すぐ復習';

  @override
  String get homePrimaryLearnCta => '学習を始める';

  @override
  String get homeSecondaryExamCta => 'BJTへ';

  @override
  String get homeTodaySectionTitle => '今日';

  @override
  String get homeTodaySectionSubtitle => '迷わず進める、明確な一歩。';

  @override
  String get homeDailyLessonEyebrow => '今日のレッスン';

  @override
  String get homePreviewBadge => 'プレビュー教材';

  @override
  String homeLessonMinutes(int minutes) {
    return '$minutes分';
  }

  @override
  String homeLessonQuestions(int count) {
    return '$count問の練習';
  }

  @override
  String get homeOpenLessonCta => 'レッスンを開く';

  @override
  String get homeDailyLessonUnavailableTitle => '今日のレッスンを読み込めません';

  @override
  String get homeDailyLessonUnavailableBody => 'Learnから利用可能なレッスンを選べます。';

  @override
  String get homeReviewSectionTitle => '復習と進捗';

  @override
  String get homeReviewSectionSubtitle => '実際のデータソースがある数値だけを表示します。';

  @override
  String get homeFlashcardsUnavailableTitle => '復習カードを読み込めません';

  @override
  String get homeFlashcardsUnavailableBody => '接続を確認するか、ローカルAPIの起動後に再試行してください。';

  @override
  String get homeProgressDeviceNote => 'この端末の進捗';

  @override
  String get homeProgressEmptyMini => 'まだ実際の復習記録がありません。';

  @override
  String get homeProgressUnavailable => '進捗を読み取れません。学習は続けられます。';

  @override
  String get homeShortcutsCoreTitle => '主要入口';

  @override
  String get homeShortcutsLibraryTitle => '検索と保存';

  @override
  String get homeShortcutsContentTitle => '読む・場面練習';

  @override
  String get homeShortcutLearnBody => 'ビジネス日本語レッスン';

  @override
  String get homeShortcutExamBody => '時間制限付き模擬試験';

  @override
  String get homeShortcutReviewBody => 'カードと復習モード';

  @override
  String get homeShortcutProgressBody => '実際の学習ログ';

  @override
  String get homeShortcutDictionaryBody => '日越辞書';

  @override
  String get homeShortcutSearchBody => '全コンテンツ検索';

  @override
  String get homeShortcutKanjiBody => '読み・意味・例';

  @override
  String get homeShortcutGrammarBody => '文型と使い方';

  @override
  String get homeShortcutSavedBody => '保存した項目を復習';

  @override
  String get homeShortcutScenariosBody => '職場会話練習';

  @override
  String get homeShortcutNewsBody => '語彙付きNHK';

  @override
  String get homeShortcutMagazineBody => '短い記事とクイズ';

  @override
  String get homeShortcutCareerBody => 'BJT仕事ミッション';

  @override
  String get homeShortcutRewardsBody => '実データの連続日数とバッジ';

  @override
  String get homeShortcutSubscriptionBody => 'プランと権限';

  @override
  String get loginSignInTitle => 'ログインして続ける';

  @override
  String get loginSignInSubtitle => 'KotobaWorks のアカウントでログインしてください。';

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
      '続行すると、KotobaWorksの利用規約とプライバシーポリシーに同意したものとみなされます。';

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
  String get loginContinueWithGoogle => 'Google で続ける';

  @override
  String get loginNoAccountPrompt => 'アカウントをお持ちでないですか？';

  @override
  String get loginRegisterAction => '登録';

  @override
  String get loginRegisteredSuccess => 'アカウントを作成しました。ログインして始めましょう。';

  @override
  String get registerTitle => 'アカウント作成';

  @override
  String get registerSubtitle =>
      'KotobaWorks のアカウントを作成して、学習の進捗を保存し、すべての端末で同期しましょう。';

  @override
  String get registerDisplayNameLabel => '表示名';

  @override
  String get registerDisplayNameRequired => '表示名を入力してください。';

  @override
  String get registerEmailLabel => 'メール';

  @override
  String get registerEmailRequired => 'メールを入力してください。';

  @override
  String get registerEmailInvalid => 'メールアドレスが正しくありません。';

  @override
  String get registerPasswordLabel => 'パスワード';

  @override
  String get registerPasswordRequired => 'パスワードを入力してください。';

  @override
  String get registerPasswordTooShort => 'パスワードは8文字以上にしてください。';

  @override
  String get registerConfirmPasswordLabel => 'パスワード（確認）';

  @override
  String get registerConfirmPasswordRequired => '確認用パスワードを入力してください。';

  @override
  String get registerPasswordMismatch => 'パスワードが一致しません。';

  @override
  String get registerSubmitButton => 'アカウントを作成';

  @override
  String get registerHaveAccountPrompt => 'すでにアカウントをお持ちですか？';

  @override
  String get registerSignInAction => 'ログイン';

  @override
  String get registerTermsNotice =>
      'アカウントを作成すると、KotobaWorksの利用規約とプライバシーポリシーに同意したものとみなされます。';

  @override
  String get registerGenericError => 'アカウントを作成できませんでした。もう一度お試しください。';

  @override
  String get registerEmailTakenError => 'このメールはすでに登録されています。';

  @override
  String get registerInvalidEmailError => 'メールアドレスが正しくありません。';

  @override
  String get registerInvalidPasswordError => 'パスワードがセキュリティ要件を満たしていません。';

  @override
  String get registerInvalidDisplayNameError => '表示名が正しくありません。';

  @override
  String get registerUnavailableError =>
      'このサーバーでは新規登録が有効になっていません。管理者にお問い合わせください。';

  @override
  String get registerNetworkError => '登録サーバーに接続できません。';

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
  String get profileHeroEyebrow => 'KotobaWorksアカウント';

  @override
  String get profileSessionStatus => 'ログイン中のセッション';

  @override
  String get profileAccountSection => 'アカウント';

  @override
  String get profileAccountDetailsTitle => 'ログイン情報';

  @override
  String get profileDisplayName => '表示名';

  @override
  String get profileUsername => 'ユーザー名';

  @override
  String get profileEmail => 'メール';

  @override
  String get profileIdentityUnavailableTitle => 'プロフィール詳細を読み取れません';

  @override
  String get profileIdentityUnavailableBody =>
      'この画面には現在のログインセッションに含まれる実データだけを表示します。情報が空のままの場合は、もう一度ログインしてください。';

  @override
  String get profileIdentityPrivacy =>
      '現在のKeycloakセッションのプロフィールclaimだけを表示します。この画面にパスワードや生トークンは保存しません。';

  @override
  String get profileActionsSection => 'ショートカット';

  @override
  String get profileProgressAction => '学習進捗';

  @override
  String get profileProgressSubtitle => '統計と学習履歴を見る';

  @override
  String get profileSavedAction => '保存済み';

  @override
  String get profileSavedSubtitle => '単語・記事・ブックマークした内容';

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
  String get profileSigningOut => 'ログアウトしています…';

  @override
  String get profileSaveError => '変更を保存できませんでした。もう一度お試しください。';

  @override
  String get profileAboutSection => 'アプリについて';

  @override
  String get profileAppVersion => 'アプリのバージョン';

  @override
  String profileVersionValue(String version, String build) {
    return '$version（ビルド $build）';
  }

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
  String get offlineBannerMessage => 'オフラインです。一部の内容は最新ではない場合がありま す。';

  @override
  String get learnReferenceTitle => '辞書・参照';

  @override
  String get learnDictionaryLabel => '辞書';

  @override
  String get learnKanjiLabel => '漢字';

  @override
  String get learnGrammarLabel => '文法';

  @override
  String get contentExamplesTitle => '例文';

  @override
  String get dictionaryTitle => '辞書';

  @override
  String get dictionarySearchHint => '日本語の単語やベトナム語の意味を検索';

  @override
  String get dictionaryIdleTitle => '日越辞書を検索';

  @override
  String get dictionaryIdleBody => '漢字・かな・ベトナム語の意味を入力してください。';

  @override
  String get dictionaryEmptyTitle => '単語が見つかりません';

  @override
  String get dictionaryEmptyBody => '別のキーワードをお試しください。';

  @override
  String get dictionaryErrorTitle => '結果を読み込めませんでした';

  @override
  String get dictionaryErrorBody => '検索中にエラーが発生しました。もう一度お試しください。';

  @override
  String get dictionarySensesTitle => '意味';

  @override
  String get kanjiTitle => '漢字';

  @override
  String get kanjiSearchHint => '漢字・読み・レベルで検索';

  @override
  String get kanjiEmptyTitle => '該当する漢字がありません';

  @override
  String get kanjiEmptyBody => '別の文字やレベルをお試しください。';

  @override
  String get kanjiErrorTitle => '漢字を読み込めませんでした';

  @override
  String get kanjiErrorBody => 'データの読み込み中にエラーが発生しました。もう一度お試しください。';

  @override
  String get kanjiOnyomiLabel => '音読み';

  @override
  String get kanjiKunyomiLabel => '訓読み';

  @override
  String get kanjiMeaningLabel => '意味';

  @override
  String kanjiStrokesLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count画',
    );
    return '$_temp0';
  }

  @override
  String get kanjiStrokeOrderTitle => '書き順';

  @override
  String get kanjiComponentsTitle => '部首・構成';

  @override
  String get kanjiExamplesTitle => '例語';

  @override
  String get grammarTitle => '文法';

  @override
  String get grammarSearchHint => '文法パターンやレベルで検索';

  @override
  String get grammarEmptyTitle => '文法が見つかりません';

  @override
  String get grammarEmptyBody => '別のキーワードをお試しください。';

  @override
  String get grammarErrorTitle => '文法を読み込めませんでした';

  @override
  String get grammarErrorBody => 'データの読み込み中にエラーが発生しました。もう一度お試しください。';

  @override
  String get grammarExplanationLabel => '説明';

  @override
  String get grammarNoteLabel => 'ノート';

  @override
  String get scenariosTitle => 'ビジネスシナリオ';

  @override
  String get scenariosSubtitle => '実際の場面でビジネス会話を練習しましょう。';

  @override
  String get scenariosEmptyTitle => 'シナリオがありません';

  @override
  String get scenariosEmptyBody => 'また後で確認してください。';

  @override
  String get scenariosErrorTitle => 'シナリオを読み込めません';

  @override
  String get scenariosErrorBody => 'データの読み込み中にエラーが発生しました。もう一度お試しください。';

  @override
  String get scenariosAllCategories => 'すべて';

  @override
  String scenarioStepLabel(int current, int total) {
    return 'ステップ $current/$total';
  }

  @override
  String scenarioEstimatedMinutes(int minutes) {
    return '$minutes分';
  }

  @override
  String scenarioStepCount(int count) {
    return '$countステップ';
  }

  @override
  String get scenarioStartCta => '開始';

  @override
  String get scenarioContinueCta => '次へ';

  @override
  String get scenarioFinishCta => '完了';

  @override
  String get scenarioOptimalBadge => '最適な選択';

  @override
  String get scenarioSuboptimalBadge => '改善の余地あり';

  @override
  String scenarioPointsAwarded(int points) {
    return '+$points点';
  }

  @override
  String get scenarioResultTitle => 'シナリオ結果';

  @override
  String scenarioResultScore(int total, int max) {
    return '$total/$max点';
  }

  @override
  String get scenarioResultDone => '完了';

  @override
  String get scenarioRetryCta => 'もう一度';

  @override
  String get examTitle => 'BJT模擬試験';

  @override
  String get examSubtitle => '時間制限とスコア付きの模擬試験に挑戦しましょう。';

  @override
  String get examEmptyTitle => '試験がありません';

  @override
  String get examEmptyBody => 'また後で確認してください。';

  @override
  String get examErrorTitle => '試験を読み込めません';

  @override
  String get examErrorBody => 'データの読み込み中にエラーが発生しました。もう一度お試しください。';

  @override
  String examQuestionCount(int count) {
    return '$count問';
  }

  @override
  String get examStartCta => '試験を開始';

  @override
  String examProgressLabel(int current, int total) {
    return '問題 $current/$total';
  }

  @override
  String get examSubmitCta => '回答';

  @override
  String get examNextCta => '次の問題';

  @override
  String get examTimeUpTitle => '時間切れ';

  @override
  String get examTimeUpBody => '試験が終了しました。結果を確認してください。';

  @override
  String get examResultTitle => '試験結果';

  @override
  String examResultScore(int correct, int total) {
    return '$correct/$total問正解';
  }

  @override
  String examResultBand(String band) {
    return '推定BJTレベル：$band';
  }

  @override
  String get examResultDone => '完了';

  @override
  String get examUpgradeRequiredTitle => 'アップグレードが必要';

  @override
  String get examUpgradeRequiredBody => '現在のプランにはこの試験が含まれていません。';

  @override
  String get newsTitle => 'NHKニュース';

  @override
  String get newsSubtitle => '本物の日本語ニュースを語彙と字幕付きで読む。';

  @override
  String get newsFilterAll => 'すべて';

  @override
  String get newsFilterEasy => 'NHK Easy';

  @override
  String get newsFilterNormal => 'NHK';

  @override
  String get newsEmptyTitle => '記事がありません';

  @override
  String get newsEmptyBody => '後ほど新しいNHKニュースをご確認ください。';

  @override
  String get newsErrorTitle => 'ニュースを読み込めません';

  @override
  String get newsErrorBody => '通信状況を確認してもう一度お試しください。';

  @override
  String get newsVocabularyTitle => '語彙';

  @override
  String get newsVocabularyEmpty => 'この記事には語彙リストがありません。';

  @override
  String get newsBookmarkAdd => '保存';

  @override
  String get newsBookmarkRemove => '保存を解除';

  @override
  String get commonSignInRequired => 'この機能を使うにはログインしてください。';

  @override
  String get magazineTitle => 'マガジン';

  @override
  String get magazineSubtitle => '毎日の記事と単語・クイズ。';

  @override
  String get magazineFilterAll => 'すべて';

  @override
  String get magazineFilterVocab => '単語';

  @override
  String get magazineFilterWeather => '天気';

  @override
  String get magazineFilterHoroscope => '星占い';

  @override
  String get magazineFilterBjt => 'BJT';

  @override
  String get magazineEmptyTitle => '記事がありません';

  @override
  String get magazineEmptyBody => 'また後で新しい記事をチェックしてください。';

  @override
  String get magazineErrorTitle => 'マガジンを読み込めません';

  @override
  String get magazineErrorBody => 'エラーが発生しました。もう一度お試しください。';

  @override
  String get magazineVocabularyTitle => '単語';

  @override
  String get magazineQuizTitle => 'クイッククイズ';

  @override
  String magazineQuizProgress(int current, int total) {
    return '問題 $current/$total';
  }

  @override
  String get careerTitle => 'キャリア';

  @override
  String get careerSubtitle => 'BJTミッションでビジネススキルを上げよう。';

  @override
  String get careerRankEyebrow => '現在のランク';

  @override
  String careerXpProgress(int current, int total, String nextRank) {
    return '$nextRankまで $current/$total XP';
  }

  @override
  String get careerRankMax => '最高ランクに到達しました。';

  @override
  String careerStreakDays(int days) {
    return '$days日連続';
  }

  @override
  String get careerStreakSubtitle => '毎日チェックインして連続記録を維持しよう。';

  @override
  String get careerClockIn => '今日チェックイン';

  @override
  String get careerClockInDone => '今日のチェックインが完了しました。';

  @override
  String get careerSkillsTitle => 'スキル';

  @override
  String get careerSkillsEmpty => 'スキルデータがまだありません。';

  @override
  String get careerAxisKeigo => '敬語';

  @override
  String get careerAxisWritten => 'ビジネス文書';

  @override
  String get careerAxisMeeting => '会議';

  @override
  String get careerAxisCustomer => '顧客対応';

  @override
  String get careerAxisChart => '図表';

  @override
  String get careerAxisNuance => 'ニュアンス';

  @override
  String get careerRelationsTitle => '人間関係';

  @override
  String get careerArcsTitle => 'ミッションアーク';

  @override
  String get careerArcsSubtitle => 'アークを選んでビジネスの旅を始めよう。';

  @override
  String get careerArcsEmptyTitle => 'アークがありません';

  @override
  String get careerArcsEmptyBody => '最初のアークを解放したら戻ってきてください。';

  @override
  String careerArcLocked(String rank) {
    return 'ランク$rankで解放';
  }

  @override
  String careerArcProgress(int completed, int total) {
    return '$completed/$total章';
  }

  @override
  String get careerStatusLocked => 'ロック';

  @override
  String get careerStatusActive => '進行中';

  @override
  String get careerStatusCompleted => '完了';

  @override
  String get careerChaptersTitle => 'チャプター';

  @override
  String careerChapterMinutes(int minutes) {
    return '$minutes分';
  }

  @override
  String get careerChapterStart => '開始';

  @override
  String get careerChapterRole => 'あなたの役割';

  @override
  String get careerChapterComplete => 'チャプター完了';

  @override
  String get careerChapterCompleteTitle => 'チャプター完了！';

  @override
  String careerScenarioProgress(int current, int total) {
    return 'シーン $current/$total';
  }

  @override
  String get careerScenarioGoal => '目標';

  @override
  String get careerOutcomeGood => '良い選択';

  @override
  String get careerOutcomeRisk => 'リスクあり';

  @override
  String careerXpEarned(int xp) {
    return '+$xp XP';
  }

  @override
  String careerRankUp(String rank) {
    return 'ランクアップ：$rank';
  }

  @override
  String get careerBackToArcs => 'アークに戻る';

  @override
  String get careerContinue => '続ける';

  @override
  String get careerErrorTitle => '読み込みに失敗しました';

  @override
  String get careerErrorBody => 'エラーが発生しました。もう一度お試しください。';

  @override
  String get learnLibraryTitle => 'ライブラリ';

  @override
  String get searchTitle => '検索';

  @override
  String get searchSubtitle => '語彙・漢字・文法を調べる';

  @override
  String get searchHint => '語彙・漢字・文法を検索…';

  @override
  String get searchIdleTitle => '検索を始める';

  @override
  String get searchIdleBody => '日本語またはベトナム語の語を入力して、すべてのコンテンツを検索します。';

  @override
  String get searchEmptyTitle => '結果がありません';

  @override
  String get searchEmptyBody => '別のキーワードを試すか、スペルを確認してください。';

  @override
  String get searchErrorTitle => '検索できませんでした';

  @override
  String get searchErrorBody => 'エラーが発生しました。もう一度お試しください。';

  @override
  String get searchKindWord => '語彙';

  @override
  String get searchKindKanji => '漢字';

  @override
  String get searchKindGrammar => '文法';

  @override
  String get searchKindExample => '例文';

  @override
  String get searchKindOther => 'その他';

  @override
  String get savedTitle => '保存済み';

  @override
  String get savedSubtitle => '保存した語彙・漢字・文法';

  @override
  String get savedTabWords => '語彙';

  @override
  String get savedTabKanji => '漢字';

  @override
  String get savedTabGrammar => '文法';

  @override
  String get savedEmptyTitle => '保存した項目がありません';

  @override
  String get savedEmptyWords => '調べた語彙を保存して、後で復習しましょう。';

  @override
  String get savedEmptyKanji => '学んだ漢字を保存して、後で復習しましょう。';

  @override
  String get savedEmptyGrammar => '学んだ文法を保存して、後で復習しましょう。';

  @override
  String get savedSignInTitle => 'ログインが必要です';

  @override
  String get savedSignInBody => 'ログインすると保存した項目を表示・同期できます。';

  @override
  String get savedErrorTitle => '保存済みを読み込めませんでした';

  @override
  String get savedErrorBody => 'エラーが発生しました。もう一度お試しください。';

  @override
  String get rewardsTitle => '実績とごほうび';

  @override
  String get rewardsSubtitle => '連続記録、バッジ、ランキングをチェック。';

  @override
  String get rewardsTabStreaks => '連続記録';

  @override
  String get rewardsTabAchievements => 'バッジ';

  @override
  String get rewardsTabLeaderboards => 'ランキング';

  @override
  String get rewardsErrorTitle => 'ごほうびを読み込めませんでした';

  @override
  String get rewardsErrorBody => 'エラーが発生しました。もう一度お試しください。';

  @override
  String get rewardsSignInTitle => 'ログインしてごほうびを確認';

  @override
  String get rewardsSignInBody => 'ログインすると連続記録・バッジ・順位を記録できます。';

  @override
  String get rewardsStreaksEmptyTitle => '連続記録はまだありません';

  @override
  String get rewardsStreaksEmptyBody => '毎日学習して最初の連続記録を始めましょう。';

  @override
  String get rewardsStreakDefaultName => '連続学習日数';

  @override
  String rewardsStreakCurrent(int days) {
    return '現在の記録：$days日';
  }

  @override
  String get rewardsStreakLongest => '最長';

  @override
  String get rewardsStreakFreezes => 'フリーズ残数';

  @override
  String rewardsStreakDays(int days) {
    return '$days日';
  }

  @override
  String get rewardsAchievementsEmptyTitle => 'バッジはまだありません';

  @override
  String get rewardsAchievementsEmptyBody => '学習目標を達成してバッジを解放しましょう。';

  @override
  String rewardsAchievementTiers(int earned, int total) {
    return '$earned/$total';
  }

  @override
  String rewardsAchievementProgress(int current, int target) {
    return '$current/$target';
  }

  @override
  String get rewardsLeaderboardsEmptyTitle => 'ランキングはまだありません';

  @override
  String get rewardsLeaderboardsEmptyBody => '現在公開中のランキングはありません。';

  @override
  String get rewardsLeaderboardEmptyTitle => '順位はまだありません';

  @override
  String get rewardsLeaderboardEmptyBody => 'このランキングで最初の得点者になりましょう。';

  @override
  String get rewardsLeaderboardAnonymous => '匿名の学習者';

  @override
  String rewardsLeaderboardScore(int score) {
    return '$score点';
  }

  @override
  String get subscriptionTitle => 'サブスクリプション';

  @override
  String get subscriptionSubtitle => 'プランと特典を管理します';

  @override
  String get subscriptionErrorTitle => 'サブスクリプションを読み込めませんでした';

  @override
  String get subscriptionErrorBody => 'エラーが発生しました。もう一度お試しください。';

  @override
  String get subscriptionSignInTitle => 'ログインしてプランを表示';

  @override
  String get subscriptionSignInBody => 'ログインするとサブスクリプションを表示・管理できます。';

  @override
  String get subscriptionCurrentPlan => '現在のプラン';

  @override
  String get subscriptionStatusActive => '有効';

  @override
  String get subscriptionStatusTrialing => 'トライアル中';

  @override
  String get subscriptionStatusCanceled => 'キャンセル済み';

  @override
  String get subscriptionRenewsOn => '更新日';

  @override
  String get subscriptionCancelsOn => '終了日';

  @override
  String get subscriptionEntitlements => '特典';

  @override
  String get subscriptionQuotas => '利用上限';

  @override
  String get subscriptionUnlimited => '無制限';

  @override
  String subscriptionQuotaValue(String limit, String window) {
    return '$limit/$window';
  }

  @override
  String get subscriptionCancelButton => '更新をキャンセル';

  @override
  String get subscriptionCancelConfirmTitle => 'サブスクリプションをキャンセルしますか？';

  @override
  String get subscriptionCancelConfirmBody => '現在の請求期間の終わりまではプランをご利用いただけます。';

  @override
  String get subscriptionCancelConfirmAction => 'キャンセルを確定';

  @override
  String get subscriptionCancelDismiss => 'プランを継続';

  @override
  String get subscriptionCancelPending => 'プランは請求期間の終わりに終了します。';

  @override
  String get subscriptionCancelSuccess => 'キャンセルを受け付けました。';

  @override
  String get subscriptionCancelError => 'キャンセルできませんでした。もう一度お試しください。';

  @override
  String get subscriptionFreeNote => '現在は無料プランをご利用中です。';

  @override
  String get subscriptionUpgradeNote => 'KotobaWorksのウェブでアップグレードできます。';

  @override
  String get subscriptionPlansTitle => '利用可能なプラン';

  @override
  String get subscriptionPlansError => 'プランを読み込めませんでした。';

  @override
  String get subscriptionPlansEmptyBody => '現在利用できるプランはありません。';

  @override
  String get subscriptionPlanCurrent => '現在のプラン';

  @override
  String get subscriptionPlanFree => '無料';

  @override
  String subscriptionPlanPrice(String price) {
    return '$price円';
  }

  @override
  String get subscriptionPlanPerMonth => '/月';

  @override
  String get subscriptionPlanRecommended => 'おすすめ';
}
