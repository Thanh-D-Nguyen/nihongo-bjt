import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ja.dart';
import 'app_localizations_vi.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'gen/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ja'),
    Locale('vi'),
  ];

  /// Generic retry button shared by error states.
  ///
  /// In vi, this message translates to:
  /// **'Thử lại'**
  String get commonRetry;

  /// Decorative Japanese welcome greeting on the home hero card.
  ///
  /// In vi, this message translates to:
  /// **'ようこそ'**
  String get homeWelcome;

  /// Primary CTA on home that opens the flashcard deck list.
  ///
  /// In vi, this message translates to:
  /// **'Ôn Flashcard'**
  String get homeReviewFlashcards;

  /// Title of the continue-learning card on the home dashboard.
  ///
  /// In vi, this message translates to:
  /// **'Tiếp tục học'**
  String get homeContinueTitle;

  /// Body copy of the continue-learning card on the home dashboard.
  ///
  /// In vi, this message translates to:
  /// **'Quay lại bộ thẻ và giữ nhịp học mỗi ngày.'**
  String get homeContinueBody;

  /// Title of the review-ready metric tile on the home dashboard.
  ///
  /// In vi, this message translates to:
  /// **'Sẵn sàng ôn tập'**
  String get homeReviewReadyTitle;

  /// Total flashcards available to review across all decks.
  ///
  /// In vi, this message translates to:
  /// **'{count} thẻ'**
  String homeReviewReadyCount(int count);

  /// Title of the deck-count metric tile on the home dashboard.
  ///
  /// In vi, this message translates to:
  /// **'Bộ thẻ'**
  String get homeDeckSummaryTitle;

  /// Number of flashcard decks the learner has.
  ///
  /// In vi, this message translates to:
  /// **'{count} bộ'**
  String homeDeckSummaryCount(int count);

  /// Title of the offline review sync status card on home.
  ///
  /// In vi, this message translates to:
  /// **'Đồng bộ'**
  String get homeSyncStatusTitle;

  /// Number of offline review grades waiting to sync.
  ///
  /// In vi, this message translates to:
  /// **'{count} review chờ đồng bộ'**
  String homeSyncPending(int count);

  /// Sync status when the offline review queue is empty.
  ///
  /// In vi, this message translates to:
  /// **'Tất cả đã đồng bộ'**
  String get homeSyncAllSynced;

  /// Empty state title when no decks are available on home.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có nội dung học'**
  String get homeDashboardEmptyTitle;

  /// Empty state body when no decks are available on home.
  ///
  /// In vi, this message translates to:
  /// **'Bộ thẻ sẽ xuất hiện ở đây khi có sẵn.'**
  String get homeDashboardEmptyBody;

  /// Error state when the home dashboard fails to load.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được bảng học tập.'**
  String get homeDashboardError;

  /// Title on the login card.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập để tiếp tục'**
  String get loginSignInTitle;

  /// Subtitle explaining the redirect-based sign-in flow.
  ///
  /// In vi, this message translates to:
  /// **'Dùng email/mật khẩu NihonGo BJT hoặc đăng nhập qua trình duyệt bảo mật như phiên bản web.'**
  String get loginSignInSubtitle;

  /// Sign-in button label on the login card.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập'**
  String get loginSignInButton;

  /// Fallback error shown when sign-in fails for an unknown reason.
  ///
  /// In vi, this message translates to:
  /// **'Đã xảy ra lỗi. Vui lòng thử lại.'**
  String get loginGenericError;

  /// No description provided for @loginEmailLabel.
  ///
  /// In vi, this message translates to:
  /// **'Email hoặc tên đăng nhập'**
  String get loginEmailLabel;

  /// No description provided for @loginEmailHint.
  ///
  /// In vi, this message translates to:
  /// **'testuser hoặc email của bạn'**
  String get loginEmailHint;

  /// No description provided for @loginEmailRequired.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập email hoặc tên đăng nhập.'**
  String get loginEmailRequired;

  /// No description provided for @loginPasswordLabel.
  ///
  /// In vi, this message translates to:
  /// **'Mật khẩu'**
  String get loginPasswordLabel;

  /// No description provided for @loginPasswordRequired.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập mật khẩu.'**
  String get loginPasswordRequired;

  /// No description provided for @loginShowPassword.
  ///
  /// In vi, this message translates to:
  /// **'Hiện mật khẩu'**
  String get loginShowPassword;

  /// No description provided for @loginHidePassword.
  ///
  /// In vi, this message translates to:
  /// **'Ẩn mật khẩu'**
  String get loginHidePassword;

  /// No description provided for @loginForgotPassword.
  ///
  /// In vi, this message translates to:
  /// **'Quên mật khẩu?'**
  String get loginForgotPassword;

  /// No description provided for @loginDivider.
  ///
  /// In vi, this message translates to:
  /// **'hoặc'**
  String get loginDivider;

  /// No description provided for @loginBrowserButton.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập bằng trình duyệt bảo mật'**
  String get loginBrowserButton;

  /// No description provided for @loginCreateAccount.
  ///
  /// In vi, this message translates to:
  /// **'Tạo tài khoản mới'**
  String get loginCreateAccount;

  /// No description provided for @loginTermsNotice.
  ///
  /// In vi, this message translates to:
  /// **'Bằng cách tiếp tục, bạn đồng ý với điều khoản sử dụng và chính sách quyền riêng tư của NihonGo BJT.'**
  String get loginTermsNotice;

  /// No description provided for @loginGoogleButton.
  ///
  /// In vi, this message translates to:
  /// **'Google'**
  String get loginGoogleButton;

  /// No description provided for @loginFacebookButton.
  ///
  /// In vi, this message translates to:
  /// **'Facebook'**
  String get loginFacebookButton;

  /// No description provided for @loginAppleButton.
  ///
  /// In vi, this message translates to:
  /// **'Apple'**
  String get loginAppleButton;

  /// No description provided for @loginLineButton.
  ///
  /// In vi, this message translates to:
  /// **'LINE'**
  String get loginLineButton;

  /// No description provided for @loginCancelledError.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập đã bị huỷ.'**
  String get loginCancelledError;

  /// No description provided for @loginWrongCredentialsError.
  ///
  /// In vi, this message translates to:
  /// **'Email hoặc mật khẩu không đúng.'**
  String get loginWrongCredentialsError;

  /// No description provided for @loginMethodNotAllowedError.
  ///
  /// In vi, this message translates to:
  /// **'Client mobile chưa bật đăng nhập bằng mật khẩu.'**
  String get loginMethodNotAllowedError;

  /// No description provided for @loginInvalidScopeError.
  ///
  /// In vi, this message translates to:
  /// **'Cấu hình phạm vi đăng nhập chưa đúng.'**
  String get loginInvalidScopeError;

  /// No description provided for @loginClientMisconfiguredError.
  ///
  /// In vi, this message translates to:
  /// **'Client đăng nhập mobile đang cấu hình sai.'**
  String get loginClientMisconfiguredError;

  /// No description provided for @loginNetworkError.
  ///
  /// In vi, this message translates to:
  /// **'Không kết nối được máy chủ đăng nhập.'**
  String get loginNetworkError;

  /// No description provided for @loginMissingTokenError.
  ///
  /// In vi, this message translates to:
  /// **'Máy chủ đăng nhập trả về thiếu dữ liệu phiên.'**
  String get loginMissingTokenError;

  /// App bar title of the flashcard deck list.
  ///
  /// In vi, this message translates to:
  /// **'Flashcard'**
  String get flashcardTitle;

  /// Number of cards in a deck.
  ///
  /// In vi, this message translates to:
  /// **'{count} thẻ'**
  String deckCardCount(int count);

  /// Empty state when no decks exist.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có bộ thẻ nào.'**
  String get deckListEmpty;

  /// Error state when the deck list fails to load.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được danh sách bộ thẻ.'**
  String get deckListError;

  /// App bar title of the flashcard review screen.
  ///
  /// In vi, this message translates to:
  /// **'Ôn tập'**
  String get reviewTitle;

  /// Button that reveals the answer side of a card.
  ///
  /// In vi, this message translates to:
  /// **'Hiện đáp án'**
  String get reviewReveal;

  /// Heading shown when a review session is finished.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn thành!'**
  String get reviewComplete;

  /// Summary of how many cards were reviewed.
  ///
  /// In vi, this message translates to:
  /// **'Bạn đã ôn {count} thẻ.'**
  String reviewCompleteSummary(int count);

  /// Button to restart the review session.
  ///
  /// In vi, this message translates to:
  /// **'Ôn lại'**
  String get reviewRestart;

  /// Button to return to the deck list from the completion screen.
  ///
  /// In vi, this message translates to:
  /// **'Về danh sách'**
  String get reviewBackToList;

  /// Empty state when the selected deck has no cards.
  ///
  /// In vi, this message translates to:
  /// **'Bộ thẻ này chưa có thẻ nào.'**
  String get reviewEmpty;

  /// Error state when the deck fails to load for review.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được bộ thẻ.'**
  String get reviewError;

  /// SRS grade button: schedule the card again immediately.
  ///
  /// In vi, this message translates to:
  /// **'Lại'**
  String get ratingAgain;

  /// SRS grade button: the card was hard.
  ///
  /// In vi, this message translates to:
  /// **'Khó'**
  String get ratingHard;

  /// SRS grade button: the card was recalled well.
  ///
  /// In vi, this message translates to:
  /// **'Tốt'**
  String get ratingGood;

  /// SRS grade button: the card was easy.
  ///
  /// In vi, this message translates to:
  /// **'Dễ'**
  String get ratingEasy;

  /// Interval label when the next review is the same day.
  ///
  /// In vi, this message translates to:
  /// **'Hôm nay'**
  String get ratingIntervalToday;

  /// Interval label in days until the next review.
  ///
  /// In vi, this message translates to:
  /// **'{days} ngày'**
  String ratingIntervalDays(int days);

  /// App bar title for the profile & settings screen.
  ///
  /// In vi, this message translates to:
  /// **'Hồ sơ'**
  String get profileTitle;

  /// Tooltip for the home app-bar action that opens the profile screen.
  ///
  /// In vi, this message translates to:
  /// **'Hồ sơ & cài đặt'**
  String get profileOpenTooltip;

  /// Display name shown when no name claim is available from the session.
  ///
  /// In vi, this message translates to:
  /// **'Người học'**
  String get profileLearnerFallback;

  /// Section header for account/session information.
  ///
  /// In vi, this message translates to:
  /// **'Tài khoản'**
  String get profileAccountSection;

  /// Section header for learner preferences.
  ///
  /// In vi, this message translates to:
  /// **'Tùy chỉnh'**
  String get profilePreferencesSection;

  /// Label for the app-language selector.
  ///
  /// In vi, this message translates to:
  /// **'Ngôn ngữ ứng dụng'**
  String get profileLanguageTitle;

  /// Language option that follows the device locale.
  ///
  /// In vi, this message translates to:
  /// **'Theo thiết bị'**
  String get profileLanguageSystem;

  /// Language option: Vietnamese.
  ///
  /// In vi, this message translates to:
  /// **'Tiếng Việt'**
  String get profileLanguageVietnamese;

  /// Language option: Japanese.
  ///
  /// In vi, this message translates to:
  /// **'Tiếng Nhật'**
  String get profileLanguageJapanese;

  /// Toggle label for showing reading help (furigana).
  ///
  /// In vi, this message translates to:
  /// **'Hiển thị furigana'**
  String get profileFuriganaTitle;

  /// Explains what the furigana toggle does and that exam/review suppresses it.
  ///
  /// In vi, this message translates to:
  /// **'Hiện cách đọc kana phía trên kanji (trừ khi đang ôn tập).'**
  String get profileFuriganaSubtitle;

  /// Button that ends the session and returns to login.
  ///
  /// In vi, this message translates to:
  /// **'Đăng xuất'**
  String get profileSignOut;

  /// Snackbar shown when persisting a preference fails.
  ///
  /// In vi, this message translates to:
  /// **'Không lưu được thay đổi. Vui lòng thử lại.'**
  String get profileSaveError;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ja', 'vi'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ja':
      return AppLocalizationsJa();
    case 'vi':
      return AppLocalizationsVi();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
