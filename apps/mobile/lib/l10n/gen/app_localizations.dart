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

  /// Generic undo action shown in snackbars after a destructive action.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn tác'**
  String get commonUndo;

  /// Screen-reader label for progress bars (the percentage is announced automatically).
  ///
  /// In vi, this message translates to:
  /// **'Tiến độ'**
  String get a11yProgressLabel;

  /// Decorative Japanese welcome greeting on the home hero card.
  ///
  /// In vi, this message translates to:
  /// **'ようこそ'**
  String get homeWelcome;

  /// Home hero greeting shown in the morning (05:00–10:59), derived from the device clock.
  ///
  /// In vi, this message translates to:
  /// **'Chào buổi sáng'**
  String get homeGreetingMorning;

  /// Home hero greeting shown in the afternoon (11:00–16:59).
  ///
  /// In vi, this message translates to:
  /// **'Chào buổi chiều'**
  String get homeGreetingAfternoon;

  /// Home hero greeting shown in the evening (17:00–21:59).
  ///
  /// In vi, this message translates to:
  /// **'Chào buổi tối'**
  String get homeGreetingEvening;

  /// Home hero greeting shown late at night (22:00–04:59).
  ///
  /// In vi, this message translates to:
  /// **'Chào buổi đêm'**
  String get homeGreetingNight;

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

  /// Button that manually drains the offline review queue.
  ///
  /// In vi, this message translates to:
  /// **'Đồng bộ ngay'**
  String get homeSyncAction;

  /// Sync button label while the queue is being drained.
  ///
  /// In vi, this message translates to:
  /// **'Đang đồng bộ…'**
  String get homeSyncInProgress;

  /// Snackbar shown after a fully successful sync.
  ///
  /// In vi, this message translates to:
  /// **'{synced, plural, =0{Không có review nào cần đồng bộ} =1{Đã đồng bộ 1 review} other{Đã đồng bộ {synced} review}}'**
  String homeSyncResultDone(int synced);

  /// Snackbar shown when some reviews could not be synced.
  ///
  /// In vi, this message translates to:
  /// **'{failed, plural, =1{Còn 1 review chưa đồng bộ. Sẽ thử lại sau.} other{Còn {failed} review chưa đồng bộ. Sẽ thử lại sau.}}'**
  String homeSyncResultPartial(int failed);

  /// Snackbar shown when the sync attempt fails entirely (e.g. offline).
  ///
  /// In vi, this message translates to:
  /// **'Không đồng bộ được. Kiểm tra kết nối và thử lại.'**
  String get homeSyncResultError;

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

  /// No description provided for @homeHeroTitle.
  ///
  /// In vi, this message translates to:
  /// **'Bảng học hôm nay'**
  String get homeHeroTitle;

  /// No description provided for @homeHeroBody.
  ///
  /// In vi, this message translates to:
  /// **'Giữ nhịp học tiếng Nhật công sở với ôn tập, BJT và nội dung đọc thật.'**
  String get homeHeroBody;

  /// No description provided for @homePrimaryReviewCta.
  ///
  /// In vi, this message translates to:
  /// **'Ôn tập ngay'**
  String get homePrimaryReviewCta;

  /// No description provided for @homePrimaryLearnCta.
  ///
  /// In vi, this message translates to:
  /// **'Bắt đầu học'**
  String get homePrimaryLearnCta;

  /// No description provided for @homeSecondaryExamCta.
  ///
  /// In vi, this message translates to:
  /// **'Vào BJT'**
  String get homeSecondaryExamCta;

  /// No description provided for @homeTodaySectionTitle.
  ///
  /// In vi, this message translates to:
  /// **'Hôm nay'**
  String get homeTodaySectionTitle;

  /// No description provided for @homeTodaySectionSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'Một bước học rõ ràng, không cần đoán.'**
  String get homeTodaySectionSubtitle;

  /// No description provided for @homeDailyLessonEyebrow.
  ///
  /// In vi, this message translates to:
  /// **'Bài học hôm nay'**
  String get homeDailyLessonEyebrow;

  /// No description provided for @homePreviewBadge.
  ///
  /// In vi, this message translates to:
  /// **'Nội dung preview'**
  String get homePreviewBadge;

  /// No description provided for @homeLessonMinutes.
  ///
  /// In vi, this message translates to:
  /// **'{minutes} phút'**
  String homeLessonMinutes(int minutes);

  /// No description provided for @homeLessonQuestions.
  ///
  /// In vi, this message translates to:
  /// **'{count} câu luyện tập'**
  String homeLessonQuestions(int count);

  /// No description provided for @homeOpenLessonCta.
  ///
  /// In vi, this message translates to:
  /// **'Mở bài học'**
  String get homeOpenLessonCta;

  /// No description provided for @homeDailyLessonUnavailableTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chưa tải được bài học hôm nay'**
  String get homeDailyLessonUnavailableTitle;

  /// No description provided for @homeDailyLessonUnavailableBody.
  ///
  /// In vi, this message translates to:
  /// **'Bạn vẫn có thể mở Learn để chọn bài học hiện có.'**
  String get homeDailyLessonUnavailableBody;

  /// No description provided for @homeReviewSectionTitle.
  ///
  /// In vi, this message translates to:
  /// **'Ôn tập & tiến độ'**
  String get homeReviewSectionTitle;

  /// No description provided for @homeReviewSectionSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'Chỉ hiển thị số liệu app đang có nguồn thật.'**
  String get homeReviewSectionSubtitle;

  /// No description provided for @homeFlashcardsUnavailableTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được thẻ ôn tập'**
  String get homeFlashcardsUnavailableTitle;

  /// No description provided for @homeFlashcardsUnavailableBody.
  ///
  /// In vi, this message translates to:
  /// **'Kiểm tra kết nối hoặc thử lại khi API cục bộ đã chạy.'**
  String get homeFlashcardsUnavailableBody;

  /// No description provided for @homeProgressDeviceNote.
  ///
  /// In vi, this message translates to:
  /// **'Tiến độ trên thiết bị này'**
  String get homeProgressDeviceNote;

  /// No description provided for @homeProgressEmptyMini.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có lượt ôn thật nào được ghi nhận.'**
  String get homeProgressEmptyMini;

  /// No description provided for @homeProgressUnavailable.
  ///
  /// In vi, this message translates to:
  /// **'Chưa đọc được tiến độ. Bạn vẫn có thể học và thử lại sau.'**
  String get homeProgressUnavailable;

  /// No description provided for @homeShortcutsCoreTitle.
  ///
  /// In vi, this message translates to:
  /// **'Lối vào chính'**
  String get homeShortcutsCoreTitle;

  /// No description provided for @homeShortcutsLibraryTitle.
  ///
  /// In vi, this message translates to:
  /// **'Tra cứu & lưu lại'**
  String get homeShortcutsLibraryTitle;

  /// No description provided for @homeShortcutsContentTitle.
  ///
  /// In vi, this message translates to:
  /// **'Đọc & luyện tình huống'**
  String get homeShortcutsContentTitle;

  /// No description provided for @homeShortcutLearnBody.
  ///
  /// In vi, this message translates to:
  /// **'Bài học tiếng Nhật công sở'**
  String get homeShortcutLearnBody;

  /// No description provided for @homeShortcutExamBody.
  ///
  /// In vi, this message translates to:
  /// **'Đề mô phỏng có tính giờ'**
  String get homeShortcutExamBody;

  /// No description provided for @homeShortcutReviewBody.
  ///
  /// In vi, this message translates to:
  /// **'Thẻ và chế độ ôn tập'**
  String get homeShortcutReviewBody;

  /// No description provided for @homeShortcutProgressBody.
  ///
  /// In vi, this message translates to:
  /// **'Nhật ký học thật'**
  String get homeShortcutProgressBody;

  /// No description provided for @homeShortcutDictionaryBody.
  ///
  /// In vi, this message translates to:
  /// **'Tra Nhật - Việt'**
  String get homeShortcutDictionaryBody;

  /// No description provided for @homeShortcutSearchBody.
  ///
  /// In vi, this message translates to:
  /// **'Tìm trên toàn bộ nội dung'**
  String get homeShortcutSearchBody;

  /// No description provided for @homeShortcutKanjiBody.
  ///
  /// In vi, this message translates to:
  /// **'Đọc, nghĩa, ví dụ'**
  String get homeShortcutKanjiBody;

  /// No description provided for @homeShortcutGrammarBody.
  ///
  /// In vi, this message translates to:
  /// **'Mẫu câu và cách dùng'**
  String get homeShortcutGrammarBody;

  /// No description provided for @homeShortcutSavedBody.
  ///
  /// In vi, this message translates to:
  /// **'Mục đã lưu để ôn lại'**
  String get homeShortcutSavedBody;

  /// No description provided for @homeShortcutScenariosBody.
  ///
  /// In vi, this message translates to:
  /// **'Hội thoại công sở'**
  String get homeShortcutScenariosBody;

  /// No description provided for @homeShortcutNewsBody.
  ///
  /// In vi, this message translates to:
  /// **'NHK với từ vựng'**
  String get homeShortcutNewsBody;

  /// No description provided for @homeShortcutMagazineBody.
  ///
  /// In vi, this message translates to:
  /// **'Bài đọc và quiz ngắn'**
  String get homeShortcutMagazineBody;

  /// No description provided for @homeShortcutCareerBody.
  ///
  /// In vi, this message translates to:
  /// **'Nhiệm vụ BJT công việc'**
  String get homeShortcutCareerBody;

  /// No description provided for @homeShortcutRewardsBody.
  ///
  /// In vi, this message translates to:
  /// **'Chuỗi ngày và huy hiệu thật'**
  String get homeShortcutRewardsBody;

  /// No description provided for @homeShortcutSubscriptionBody.
  ///
  /// In vi, this message translates to:
  /// **'Gói và quyền lợi'**
  String get homeShortcutSubscriptionBody;

  /// Title on the login card.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập để tiếp tục'**
  String get loginSignInTitle;

  /// Subtitle explaining the account sign-in flow.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập bằng tài khoản KotobaWorks của bạn.'**
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
  /// **'Bằng cách tiếp tục, bạn đồng ý với điều khoản sử dụng và chính sách quyền riêng tư của KotobaWorks.'**
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

  /// Federated Google sign-in button label.
  ///
  /// In vi, this message translates to:
  /// **'Tiếp tục với Google'**
  String get loginContinueWithGoogle;

  /// Prompt before the register link on the login screen.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có tài khoản?'**
  String get loginNoAccountPrompt;

  /// Register link label on the login screen.
  ///
  /// In vi, this message translates to:
  /// **'Đăng ký'**
  String get loginRegisterAction;

  /// Success banner shown on login after a successful registration.
  ///
  /// In vi, this message translates to:
  /// **'Tạo tài khoản thành công. Hãy đăng nhập để bắt đầu.'**
  String get loginRegisteredSuccess;

  /// Title on the register screen.
  ///
  /// In vi, this message translates to:
  /// **'Tạo tài khoản'**
  String get registerTitle;

  /// Subtitle on the register screen.
  ///
  /// In vi, this message translates to:
  /// **'Tạo tài khoản KotobaWorks để lưu tiến độ và đồng bộ trên mọi thiết bị.'**
  String get registerSubtitle;

  /// No description provided for @registerDisplayNameLabel.
  ///
  /// In vi, this message translates to:
  /// **'Tên hiển thị'**
  String get registerDisplayNameLabel;

  /// No description provided for @registerDisplayNameRequired.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập tên hiển thị.'**
  String get registerDisplayNameRequired;

  /// No description provided for @registerEmailLabel.
  ///
  /// In vi, this message translates to:
  /// **'Email'**
  String get registerEmailLabel;

  /// No description provided for @registerEmailRequired.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập email.'**
  String get registerEmailRequired;

  /// No description provided for @registerEmailInvalid.
  ///
  /// In vi, this message translates to:
  /// **'Email không hợp lệ.'**
  String get registerEmailInvalid;

  /// No description provided for @registerPasswordLabel.
  ///
  /// In vi, this message translates to:
  /// **'Mật khẩu'**
  String get registerPasswordLabel;

  /// No description provided for @registerPasswordRequired.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập mật khẩu.'**
  String get registerPasswordRequired;

  /// No description provided for @registerPasswordTooShort.
  ///
  /// In vi, this message translates to:
  /// **'Mật khẩu cần ít nhất 8 ký tự.'**
  String get registerPasswordTooShort;

  /// No description provided for @registerConfirmPasswordLabel.
  ///
  /// In vi, this message translates to:
  /// **'Nhập lại mật khẩu'**
  String get registerConfirmPasswordLabel;

  /// No description provided for @registerConfirmPasswordRequired.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập lại mật khẩu.'**
  String get registerConfirmPasswordRequired;

  /// No description provided for @registerPasswordMismatch.
  ///
  /// In vi, this message translates to:
  /// **'Mật khẩu nhập lại không khớp.'**
  String get registerPasswordMismatch;

  /// No description provided for @registerSubmitButton.
  ///
  /// In vi, this message translates to:
  /// **'Tạo tài khoản'**
  String get registerSubmitButton;

  /// No description provided for @registerHaveAccountPrompt.
  ///
  /// In vi, this message translates to:
  /// **'Đã có tài khoản?'**
  String get registerHaveAccountPrompt;

  /// No description provided for @registerSignInAction.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập'**
  String get registerSignInAction;

  /// No description provided for @registerTermsNotice.
  ///
  /// In vi, this message translates to:
  /// **'Bằng cách tạo tài khoản, bạn đồng ý với điều khoản sử dụng và chính sách quyền riêng tư của KotobaWorks.'**
  String get registerTermsNotice;

  /// No description provided for @registerGenericError.
  ///
  /// In vi, this message translates to:
  /// **'Không tạo được tài khoản. Vui lòng thử lại.'**
  String get registerGenericError;

  /// No description provided for @registerEmailTakenError.
  ///
  /// In vi, this message translates to:
  /// **'Email này đã được đăng ký.'**
  String get registerEmailTakenError;

  /// No description provided for @registerInvalidEmailError.
  ///
  /// In vi, this message translates to:
  /// **'Email không hợp lệ.'**
  String get registerInvalidEmailError;

  /// No description provided for @registerInvalidPasswordError.
  ///
  /// In vi, this message translates to:
  /// **'Mật khẩu không đáp ứng yêu cầu bảo mật.'**
  String get registerInvalidPasswordError;

  /// No description provided for @registerInvalidDisplayNameError.
  ///
  /// In vi, this message translates to:
  /// **'Tên hiển thị không hợp lệ.'**
  String get registerInvalidDisplayNameError;

  /// No description provided for @registerUnavailableError.
  ///
  /// In vi, this message translates to:
  /// **'Tính năng đăng ký chưa được bật trên máy chủ. Vui lòng liên hệ quản trị viên.'**
  String get registerUnavailableError;

  /// No description provided for @registerNetworkError.
  ///
  /// In vi, this message translates to:
  /// **'Không kết nối được máy chủ đăng ký.'**
  String get registerNetworkError;

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

  /// Title of the empty state when no decks exist.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có bộ thẻ'**
  String get deckListEmptyTitle;

  /// Empty state when no decks exist.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có bộ thẻ nào.'**
  String get deckListEmpty;

  /// Title of the error state when the deck list fails to load.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được'**
  String get deckListErrorTitle;

  /// Error state when the deck list fails to load.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được danh sách bộ thẻ.'**
  String get deckListError;

  /// Placeholder of the deck list search field.
  ///
  /// In vi, this message translates to:
  /// **'Tìm bộ thẻ'**
  String get deckSearchHint;

  /// Tooltip of the clear-search button in the deck list.
  ///
  /// In vi, this message translates to:
  /// **'Xoá tìm kiếm'**
  String get deckSearchClear;

  /// Deck list filter chip showing every deck.
  ///
  /// In vi, this message translates to:
  /// **'Tất cả'**
  String get deckFilterAll;

  /// Deck list filter chip showing only private decks.
  ///
  /// In vi, this message translates to:
  /// **'Riêng tư'**
  String get deckFilterPrivate;

  /// Deck list filter chip showing only public decks.
  ///
  /// In vi, this message translates to:
  /// **'Công khai'**
  String get deckFilterPublic;

  /// Badge label on a deck that is publicly shared.
  ///
  /// In vi, this message translates to:
  /// **'Công khai'**
  String get deckVisibilityPublic;

  /// Tooltip/label of the deck list sort control.
  ///
  /// In vi, this message translates to:
  /// **'Sắp xếp'**
  String get deckSortLabel;

  /// Deck list sort option: most recently created first.
  ///
  /// In vi, this message translates to:
  /// **'Mới nhất'**
  String get deckSortRecent;

  /// Deck list sort option: by title A to Z.
  ///
  /// In vi, this message translates to:
  /// **'Theo tên'**
  String get deckSortTitle;

  /// Deck list sort option: most cards first.
  ///
  /// In vi, this message translates to:
  /// **'Nhiều thẻ nhất'**
  String get deckSortCards;

  /// Title shown when search/filter returns no decks.
  ///
  /// In vi, this message translates to:
  /// **'Không có kết quả'**
  String get deckSearchEmptyTitle;

  /// Message shown when search/filter returns no decks.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy bộ thẻ phù hợp.'**
  String get deckSearchEmpty;

  /// App bar title of the deck detail screen.
  ///
  /// In vi, this message translates to:
  /// **'Chi tiết bộ thẻ'**
  String get flashcardDeckDetailTitle;

  /// Primary action that starts a review session for the deck.
  ///
  /// In vi, this message translates to:
  /// **'Học bộ thẻ'**
  String get deckDetailStudyCta;

  /// Section header above the list of cards in the deck.
  ///
  /// In vi, this message translates to:
  /// **'Thẻ trong bộ'**
  String get deckDetailCardsHeader;

  /// Title shown when a deck has no cards yet.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có thẻ'**
  String get deckDetailEmptyTitle;

  /// Message shown when a deck has no cards yet.
  ///
  /// In vi, this message translates to:
  /// **'Bộ thẻ này chưa có thẻ nào.'**
  String get deckDetailEmpty;

  /// Title of the deck detail error state.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được bộ thẻ'**
  String get deckDetailErrorTitle;

  /// Message of the deck detail error state.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được chi tiết bộ thẻ. Vui lòng thử lại.'**
  String get deckDetailError;

  /// Generic cancel action label.
  ///
  /// In vi, this message translates to:
  /// **'Huỷ'**
  String get commonCancel;

  /// Action that opens the create-deck form.
  ///
  /// In vi, this message translates to:
  /// **'Tạo bộ thẻ'**
  String get deckCreateCta;

  /// Empty-state call to action to create the first deck.
  ///
  /// In vi, this message translates to:
  /// **'Tạo bộ thẻ đầu tiên'**
  String get deckListCreateFirst;

  /// App bar title of the create-deck form.
  ///
  /// In vi, this message translates to:
  /// **'Tạo bộ thẻ'**
  String get deckCreateTitle;

  /// App bar title of the edit-deck form.
  ///
  /// In vi, this message translates to:
  /// **'Sửa bộ thẻ'**
  String get deckEditTitle;

  /// Label of the required Vietnamese title field.
  ///
  /// In vi, this message translates to:
  /// **'Tiêu đề tiếng Việt'**
  String get deckFormTitleViLabel;

  /// Hint of the Vietnamese title field.
  ///
  /// In vi, this message translates to:
  /// **'Nhập tên bộ thẻ'**
  String get deckFormTitleViHint;

  /// Label of the optional Japanese title field.
  ///
  /// In vi, this message translates to:
  /// **'Tiêu đề tiếng Nhật (tuỳ chọn)'**
  String get deckFormTitleJaLabel;

  /// Label of the optional Vietnamese description field.
  ///
  /// In vi, this message translates to:
  /// **'Mô tả tiếng Việt (tuỳ chọn)'**
  String get deckFormDescriptionViLabel;

  /// Label of the optional Japanese description field.
  ///
  /// In vi, this message translates to:
  /// **'Mô tả tiếng Nhật (tuỳ chọn)'**
  String get deckFormDescriptionJaLabel;

  /// Label of the deck visibility selector.
  ///
  /// In vi, this message translates to:
  /// **'Hiển thị'**
  String get deckFormVisibilityLabel;

  /// Visibility option: deck is private to the learner.
  ///
  /// In vi, this message translates to:
  /// **'Riêng tư'**
  String get deckFormVisibilityPrivate;

  /// Visibility option: deck is publicly shared.
  ///
  /// In vi, this message translates to:
  /// **'Công khai'**
  String get deckFormVisibilityPublic;

  /// Submit button of the create-deck form.
  ///
  /// In vi, this message translates to:
  /// **'Tạo bộ thẻ'**
  String get deckFormSaveCreate;

  /// Submit button of the edit-deck form.
  ///
  /// In vi, this message translates to:
  /// **'Lưu thay đổi'**
  String get deckFormSaveUpdate;

  /// Validation error when the required title is empty.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập tiêu đề.'**
  String get deckFormTitleRequired;

  /// Validation error when a title exceeds its max length.
  ///
  /// In vi, this message translates to:
  /// **'Tiêu đề tối đa {max} ký tự.'**
  String deckFormTitleTooLong(int max);

  /// Validation error when a description exceeds its max length.
  ///
  /// In vi, this message translates to:
  /// **'Mô tả tối đa {max} ký tự.'**
  String deckFormDescriptionTooLong(int max);

  /// Fallback message when saving a deck fails.
  ///
  /// In vi, this message translates to:
  /// **'Không lưu được bộ thẻ. Vui lòng thử lại.'**
  String get deckFormErrorGeneric;

  /// Snackbar confirmation after a deck is saved.
  ///
  /// In vi, this message translates to:
  /// **'Đã lưu bộ thẻ.'**
  String get deckSaveSuccess;

  /// Deck detail action that opens the edit form.
  ///
  /// In vi, this message translates to:
  /// **'Sửa'**
  String get deckDetailEditAction;

  /// Deck detail action that archives the deck.
  ///
  /// In vi, this message translates to:
  /// **'Lưu trữ'**
  String get deckDetailArchiveAction;

  /// Title of the archive confirmation dialog.
  ///
  /// In vi, this message translates to:
  /// **'Lưu trữ bộ thẻ?'**
  String get deckArchiveConfirmTitle;

  /// Body of the archive confirmation dialog.
  ///
  /// In vi, this message translates to:
  /// **'Bộ thẻ sẽ được gỡ khỏi thư viện đang hoạt động.'**
  String get deckArchiveConfirmMessage;

  /// Confirm button of the archive dialog.
  ///
  /// In vi, this message translates to:
  /// **'Lưu trữ'**
  String get deckArchiveConfirmCta;

  /// Snackbar confirmation after a deck is archived.
  ///
  /// In vi, this message translates to:
  /// **'Đã lưu trữ bộ thẻ.'**
  String get deckArchiveSuccess;

  /// App bar title when adding a new card to a deck.
  ///
  /// In vi, this message translates to:
  /// **'Thêm thẻ'**
  String get cardCreateTitle;

  /// App bar title when editing an existing card.
  ///
  /// In vi, this message translates to:
  /// **'Sửa thẻ'**
  String get cardEditTitle;

  /// Button that opens the add-card form.
  ///
  /// In vi, this message translates to:
  /// **'Thêm thẻ'**
  String get cardAddAction;

  /// Button that deletes the current card.
  ///
  /// In vi, this message translates to:
  /// **'Xóa thẻ'**
  String get cardDeleteAction;

  /// Error shown when the edited card no longer exists.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy thẻ này. Có thể nó đã bị thay đổi.'**
  String get cardNotFound;

  /// Label for the front-text field of the card form.
  ///
  /// In vi, this message translates to:
  /// **'Mặt trước (tiếng Nhật)'**
  String get cardFormFrontLabel;

  /// Placeholder for the front-text field.
  ///
  /// In vi, this message translates to:
  /// **'Ví dụ: 会議'**
  String get cardFormFrontHint;

  /// Label for the optional reading field of the card form.
  ///
  /// In vi, this message translates to:
  /// **'Cách đọc (tùy chọn)'**
  String get cardFormReadingLabel;

  /// Placeholder for the reading field.
  ///
  /// In vi, this message translates to:
  /// **'Ví dụ: かいぎ'**
  String get cardFormReadingHint;

  /// Label for the back-text field of the card form.
  ///
  /// In vi, this message translates to:
  /// **'Mặt sau (nghĩa)'**
  String get cardFormBackLabel;

  /// Placeholder for the back-text field.
  ///
  /// In vi, this message translates to:
  /// **'Ví dụ: cuộc họp'**
  String get cardFormBackHint;

  /// Submit button when adding a new card.
  ///
  /// In vi, this message translates to:
  /// **'Thêm thẻ'**
  String get cardFormSaveCreate;

  /// Submit button when editing an existing card.
  ///
  /// In vi, this message translates to:
  /// **'Lưu thay đổi'**
  String get cardFormSaveUpdate;

  /// Validation error when the front field is empty.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập mặt trước.'**
  String get cardFrontRequired;

  /// Validation error when the back field is empty.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập mặt sau.'**
  String get cardBackRequired;

  /// Validation error when a card field exceeds its maximum.
  ///
  /// In vi, this message translates to:
  /// **'Tối đa {max} ký tự.'**
  String cardFieldTooLong(int max);

  /// Shown when the deck already has the maximum number of cards.
  ///
  /// In vi, this message translates to:
  /// **'Bộ thẻ đã đạt giới hạn {max} thẻ.'**
  String cardLimitReached(int max);

  /// Snackbar after a card is created or updated.
  ///
  /// In vi, this message translates to:
  /// **'Đã lưu thẻ.'**
  String get cardSaveSuccess;

  /// Snackbar after a card is deleted.
  ///
  /// In vi, this message translates to:
  /// **'Đã xóa thẻ.'**
  String get cardDeleteSuccess;

  /// Title of the delete-card confirmation dialog.
  ///
  /// In vi, this message translates to:
  /// **'Xóa thẻ này?'**
  String get cardDeleteConfirmTitle;

  /// Body of the delete-card confirmation dialog.
  ///
  /// In vi, this message translates to:
  /// **'Thao tác này không thể hoàn tác.'**
  String get cardDeleteConfirmMessage;

  /// Confirm button of the delete-card dialog.
  ///
  /// In vi, this message translates to:
  /// **'Xóa'**
  String get cardDeleteConfirmCta;

  /// Placeholder for the card search field.
  ///
  /// In vi, this message translates to:
  /// **'Tìm thẻ…'**
  String get cardSearchHint;

  /// Sort option that keeps the original card order.
  ///
  /// In vi, this message translates to:
  /// **'Thứ tự'**
  String get cardSortPosition;

  /// Sort option that orders cards alphabetically by front text.
  ///
  /// In vi, this message translates to:
  /// **'A–Z'**
  String get cardSortAlphabetical;

  /// Title shown when a card search returns no results.
  ///
  /// In vi, this message translates to:
  /// **'Không có thẻ phù hợp'**
  String get cardSearchEmptyTitle;

  /// Message shown when a card search returns no results.
  ///
  /// In vi, this message translates to:
  /// **'Thử từ khóa khác.'**
  String get cardSearchEmptyMessage;

  /// Count of cards matching the current search.
  ///
  /// In vi, this message translates to:
  /// **'{count, plural, =1{1 thẻ} other{{count} thẻ}}'**
  String cardSearchResultCount(int count);

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

  /// Hint above the reveal button encouraging active recall.
  ///
  /// In vi, this message translates to:
  /// **'Tự nhớ lại trước, rồi chạm để xem đáp án.'**
  String get reviewRevealHint;

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

  /// Title of the empty state when the deck has no cards.
  ///
  /// In vi, this message translates to:
  /// **'Bộ thẻ trống'**
  String get reviewEmptyTitle;

  /// Empty state when the selected deck has no cards.
  ///
  /// In vi, this message translates to:
  /// **'Bộ thẻ này chưa có thẻ nào.'**
  String get reviewEmpty;

  /// Title of the error state when the deck fails to load.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được'**
  String get reviewErrorTitle;

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

  /// Small label in the profile hero card.
  ///
  /// In vi, this message translates to:
  /// **'Tài khoản KotobaWorks'**
  String get profileHeroEyebrow;

  /// Fallback status line when the profile token has no secondary identity label.
  ///
  /// In vi, this message translates to:
  /// **'Phiên đăng nhập đang hoạt động'**
  String get profileSessionStatus;

  /// Section header for account/session information.
  ///
  /// In vi, this message translates to:
  /// **'Tài khoản'**
  String get profileAccountSection;

  /// Title for the account identity details card.
  ///
  /// In vi, this message translates to:
  /// **'Thông tin đăng nhập'**
  String get profileAccountDetailsTitle;

  /// Label for the display name claim.
  ///
  /// In vi, this message translates to:
  /// **'Tên hiển thị'**
  String get profileDisplayName;

  /// Label for the preferred username claim.
  ///
  /// In vi, this message translates to:
  /// **'Tên đăng nhập'**
  String get profileUsername;

  /// Label for the email claim.
  ///
  /// In vi, this message translates to:
  /// **'Email'**
  String get profileEmail;

  /// Title shown when no display claims can be decoded from the ID token.
  ///
  /// In vi, this message translates to:
  /// **'Chưa đọc được chi tiết hồ sơ'**
  String get profileIdentityUnavailableTitle;

  /// Body shown when no display claims can be decoded from the ID token.
  ///
  /// In vi, this message translates to:
  /// **'Ứng dụng chỉ hiển thị thông tin có thật trong phiên đăng nhập hiện tại. Hãy đăng nhập lại nếu thông tin hồ sơ vẫn trống.'**
  String get profileIdentityUnavailableBody;

  /// Privacy note for displayed identity data.
  ///
  /// In vi, this message translates to:
  /// **'Chỉ hiển thị claim hồ sơ từ phiên Keycloak hiện tại; không lưu mật khẩu hay token thô trên màn hình này.'**
  String get profileIdentityPrivacy;

  /// Section header for profile shortcut actions.
  ///
  /// In vi, this message translates to:
  /// **'Lối tắt'**
  String get profileActionsSection;

  /// Shortcut title to the progress screen.
  ///
  /// In vi, this message translates to:
  /// **'Tiến độ học'**
  String get profileProgressAction;

  /// Shortcut subtitle to the progress screen.
  ///
  /// In vi, this message translates to:
  /// **'Xem thống kê và lịch sử học'**
  String get profileProgressSubtitle;

  /// Shortcut title to saved items.
  ///
  /// In vi, this message translates to:
  /// **'Mục đã lưu'**
  String get profileSavedAction;

  /// Shortcut subtitle to saved items.
  ///
  /// In vi, this message translates to:
  /// **'Từ vựng, bài đọc và nội dung đã đánh dấu'**
  String get profileSavedSubtitle;

  /// Hero badge label when the learner is on the free plan.
  ///
  /// In vi, this message translates to:
  /// **'Gói miễn phí'**
  String get profilePlanFree;

  /// Title of the learning snapshot card.
  ///
  /// In vi, this message translates to:
  /// **'Tổng quan học tập'**
  String get profileSnapshotTitle;

  /// Learning snapshot metric: current study-day streak.
  ///
  /// In vi, this message translates to:
  /// **'Chuỗi ngày'**
  String get profileSnapshotStreak;

  /// Learning snapshot metric: reviews completed today.
  ///
  /// In vi, this message translates to:
  /// **'Hôm nay'**
  String get profileSnapshotToday;

  /// Learning snapshot metric: reviews in the last 7 days.
  ///
  /// In vi, this message translates to:
  /// **'7 ngày qua'**
  String get profileSnapshotWeek;

  /// Learning snapshot metric: all-time review count.
  ///
  /// In vi, this message translates to:
  /// **'Tổng lượt ôn'**
  String get profileSnapshotTotal;

  /// Honest empty state title when no study activity is recorded yet.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có dữ liệu học'**
  String get profileSnapshotEmptyTitle;

  /// Honest empty state body encouraging the learner to start studying.
  ///
  /// In vi, this message translates to:
  /// **'Hãy hoàn thành một phiên ôn tập để thấy tiến độ thật ở đây.'**
  String get profileSnapshotEmptyBody;

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

  /// Label for the app appearance (light/dark/system) selector.
  ///
  /// In vi, this message translates to:
  /// **'Giao diện'**
  String get profileThemeTitle;

  /// Appearance option that follows the device light/dark setting.
  ///
  /// In vi, this message translates to:
  /// **'Theo thiết bị'**
  String get profileThemeSystem;

  /// Appearance option: light theme.
  ///
  /// In vi, this message translates to:
  /// **'Sáng'**
  String get profileThemeLight;

  /// Appearance option: dark theme.
  ///
  /// In vi, this message translates to:
  /// **'Tối'**
  String get profileThemeDark;

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

  /// Toggle label for subtle haptic feedback on interactions.
  ///
  /// In vi, this message translates to:
  /// **'Phản hồi rung'**
  String get profileHapticsTitle;

  /// Explains what the haptic feedback toggle controls.
  ///
  /// In vi, this message translates to:
  /// **'Rung nhẹ khi chọn đáp án, lật thẻ và hoàn thành phiên học.'**
  String get profileHapticsSubtitle;

  /// Button that ends the session and returns to login.
  ///
  /// In vi, this message translates to:
  /// **'Đăng xuất'**
  String get profileSignOut;

  /// Status shown while the sign-out is in progress, before the redirect to login.
  ///
  /// In vi, this message translates to:
  /// **'Đang đăng xuất…'**
  String get profileSigningOut;

  /// Snackbar shown when persisting a preference fails.
  ///
  /// In vi, this message translates to:
  /// **'Không lưu được thay đổi. Vui lòng thử lại.'**
  String get profileSaveError;

  /// Section header for app/about information.
  ///
  /// In vi, this message translates to:
  /// **'Giới thiệu'**
  String get profileAboutSection;

  /// Label for the installed app version row.
  ///
  /// In vi, this message translates to:
  /// **'Phiên bản ứng dụng'**
  String get profileAppVersion;

  /// Formats the app version and build number.
  ///
  /// In vi, this message translates to:
  /// **'{version} (bản dựng {build})'**
  String profileVersionValue(String version, String build);

  /// Bottom navigation label for the Home tab.
  ///
  /// In vi, this message translates to:
  /// **'Trang chủ'**
  String get navHome;

  /// Bottom navigation label for the Learn tab.
  ///
  /// In vi, this message translates to:
  /// **'Học'**
  String get navLearn;

  /// Bottom navigation label for the Review tab.
  ///
  /// In vi, this message translates to:
  /// **'Ôn tập'**
  String get navReview;

  /// Bottom navigation label for the Search lookup hub tab.
  ///
  /// In vi, this message translates to:
  /// **'Tra cứu'**
  String get navSearch;

  /// Bottom navigation label for the Me account hub tab.
  ///
  /// In vi, this message translates to:
  /// **'Cá nhân'**
  String get navMe;

  /// Bottom navigation label for the Progress tab.
  ///
  /// In vi, this message translates to:
  /// **'Tiến độ'**
  String get navProgress;

  /// Bottom navigation label for the Settings tab.
  ///
  /// In vi, this message translates to:
  /// **'Cài đặt'**
  String get navSettings;

  /// App bar title for the Learn tab.
  ///
  /// In vi, this message translates to:
  /// **'Học'**
  String get learnTitle;

  /// Badge marking lesson content as a preview, not from a backend.
  ///
  /// In vi, this message translates to:
  /// **'Nội dung mẫu'**
  String get learnPreviewBadge;

  /// Honest notice on the Learn hub explaining the content is preview-only.
  ///
  /// In vi, this message translates to:
  /// **'Đây là nội dung học mẫu để xem trước. Bài học thật sẽ được kết nối sau.'**
  String get learnPreviewNotice;

  /// Title of the daily recommended lesson card on the Learn hub.
  ///
  /// In vi, this message translates to:
  /// **'Bài học hôm nay'**
  String get learnDailyLessonTitle;

  /// CTA to open today's recommended lesson.
  ///
  /// In vi, this message translates to:
  /// **'Học ngay'**
  String get learnDailyLessonCta;

  /// Section header above the lesson categories.
  ///
  /// In vi, this message translates to:
  /// **'Danh mục'**
  String get learnCategoriesTitle;

  /// Section header above the lesson list.
  ///
  /// In vi, this message translates to:
  /// **'Bài học'**
  String get learnLessonsTitle;

  /// Number of lessons in a category.
  ///
  /// In vi, this message translates to:
  /// **'{count,plural, =1{{count} bài} other{{count} bài}}'**
  String learnLessonsInCategory(int count);

  /// Estimated reading time of a lesson in minutes.
  ///
  /// In vi, this message translates to:
  /// **'{count} phút'**
  String learnMinutes(int count);

  /// Number of practice questions in a lesson.
  ///
  /// In vi, this message translates to:
  /// **'{count,plural, =1{{count} câu hỏi} other{{count} câu hỏi}}'**
  String learnQuestionCount(int count);

  /// Empty state title on the Learn hub when no lessons exist.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có bài học'**
  String get learnEmptyTitle;

  /// Empty state body on the Learn hub.
  ///
  /// In vi, this message translates to:
  /// **'Bài học sẽ xuất hiện ở đây khi có sẵn.'**
  String get learnEmptyBody;

  /// Error state title on the Learn hub.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được bài học'**
  String get learnErrorTitle;

  /// Error state body on the Learn hub.
  ///
  /// In vi, this message translates to:
  /// **'Đã xảy ra lỗi khi tải nội dung học. Vui lòng thử lại.'**
  String get learnErrorBody;

  /// Lesson level label: foundational.
  ///
  /// In vi, this message translates to:
  /// **'Cơ bản'**
  String get levelFoundational;

  /// Lesson level label: practical.
  ///
  /// In vi, this message translates to:
  /// **'Thực hành'**
  String get levelPractical;

  /// Lesson level label: advanced.
  ///
  /// In vi, this message translates to:
  /// **'Nâng cao'**
  String get levelAdvanced;

  /// Shown when a lesson id cannot be resolved.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy bài học này.'**
  String get lessonDetailNotFound;

  /// Section header above the lesson's readable sections.
  ///
  /// In vi, this message translates to:
  /// **'Nội dung'**
  String get lessonDetailContentTitle;

  /// CTA on the lesson detail screen to start practice.
  ///
  /// In vi, this message translates to:
  /// **'{count,plural, =1{Luyện tập ({count} câu)} other{Luyện tập ({count} câu)}}'**
  String lessonPracticeCta(int count);

  /// App bar title for the practice player.
  ///
  /// In vi, this message translates to:
  /// **'Luyện tập'**
  String get practiceTitle;

  /// Progress label showing current question position.
  ///
  /// In vi, this message translates to:
  /// **'Câu {current} / {total}'**
  String practiceProgress(int current, int total);

  /// Button to advance to the next question.
  ///
  /// In vi, this message translates to:
  /// **'Tiếp theo'**
  String get practiceNext;

  /// Button to go back to the previous question.
  ///
  /// In vi, this message translates to:
  /// **'Quay lại'**
  String get practicePrevious;

  /// Button to finish the practice run.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn thành'**
  String get practiceFinish;

  /// Title shown when the practice run is complete.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn thành bài luyện tập'**
  String get practiceCompleteTitle;

  /// Score summary after completing practice.
  ///
  /// In vi, this message translates to:
  /// **'Bạn trả lời đúng {correct}/{total} câu.'**
  String practiceScore(int correct, int total);

  /// Button to restart the practice run.
  ///
  /// In vi, this message translates to:
  /// **'Làm lại'**
  String get practiceRestart;

  /// Button to return to the lesson from the practice summary.
  ///
  /// In vi, this message translates to:
  /// **'Về bài học'**
  String get practiceBackToLesson;

  /// Section header above the per-question review on the result screen.
  ///
  /// In vi, this message translates to:
  /// **'Xem lại đáp án'**
  String get practiceReviewTitle;

  /// Label for a question in the result review list.
  ///
  /// In vi, this message translates to:
  /// **'Câu {position}'**
  String practiceResultQuestionLabel(int position);

  /// Verdict tag shown when the learner answered correctly.
  ///
  /// In vi, this message translates to:
  /// **'Đúng'**
  String get practiceResultCorrect;

  /// Verdict tag shown when the learner answered incorrectly.
  ///
  /// In vi, this message translates to:
  /// **'Sai'**
  String get practiceResultIncorrect;

  /// Marker on the correct option in the result review.
  ///
  /// In vi, this message translates to:
  /// **'Đáp án đúng'**
  String get practiceCorrectAnswer;

  /// Marker on the learner's wrong selection in the result review.
  ///
  /// In vi, this message translates to:
  /// **'Bạn đã chọn'**
  String get practiceYourAnswer;

  /// Title of the explanation box on the result review.
  ///
  /// In vi, this message translates to:
  /// **'Giải thích'**
  String get practiceExplanationTitle;

  /// Empty state title when a lesson has no questions.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có câu hỏi'**
  String get practiceEmptyTitle;

  /// Empty state body when a lesson has no questions.
  ///
  /// In vi, this message translates to:
  /// **'Bài học này chưa có câu hỏi luyện tập.'**
  String get practiceEmptyBody;

  /// Error state title in the practice player.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được câu hỏi'**
  String get practiceErrorTitle;

  /// Error state body in the practice player.
  ///
  /// In vi, this message translates to:
  /// **'Đã xảy ra lỗi khi tải câu hỏi. Vui lòng thử lại.'**
  String get practiceErrorBody;

  /// App bar title for the Review hub tab.
  ///
  /// In vi, this message translates to:
  /// **'Ôn tập'**
  String get reviewTabTitle;

  /// Heading on the Review hub above the review surfaces.
  ///
  /// In vi, this message translates to:
  /// **'Ôn tập tất cả'**
  String get reviewHubTitle;

  /// Subtitle introducing the Review hub.
  ///
  /// In vi, this message translates to:
  /// **'Củng cố những gì đã học. Chọn một cách ôn tập bên dưới.'**
  String get reviewHubIntro;

  /// Title of the flashcards review section on the Review hub.
  ///
  /// In vi, this message translates to:
  /// **'Flashcard'**
  String get reviewFlashcardsTitle;

  /// Available flashcard decks and total cards.
  ///
  /// In vi, this message translates to:
  /// **'{deckCount} bộ · {cardCount} thẻ'**
  String reviewFlashcardsStat(int deckCount, int cardCount);

  /// Shown when there are no flashcard decks to review.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có bộ flashcard nào.'**
  String get reviewFlashcardsEmpty;

  /// CTA to open the flashcard deck list.
  ///
  /// In vi, this message translates to:
  /// **'Ôn flashcard'**
  String get reviewFlashcardsCta;

  /// Title of the practice review section on the Review hub.
  ///
  /// In vi, this message translates to:
  /// **'Luyện tập'**
  String get reviewPracticeTitle;

  /// Number of lessons that have practice questions.
  ///
  /// In vi, this message translates to:
  /// **'{count} bài có câu hỏi luyện tập'**
  String reviewPracticeStat(int count);

  /// Shown when no lessons have practice questions.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có bài luyện tập nào.'**
  String get reviewPracticeEmpty;

  /// CTA to open the lesson list to start practice.
  ///
  /// In vi, this message translates to:
  /// **'Chọn bài luyện tập'**
  String get reviewPracticeCta;

  /// Compact error message inside a Review hub section card.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được nội dung. Vui lòng thử lại.'**
  String get reviewSectionError;

  /// App bar title for the Progress tab.
  ///
  /// In vi, this message translates to:
  /// **'Tiến độ'**
  String get progressTitle;

  /// Short subtitle under the Progress header.
  ///
  /// In vi, this message translates to:
  /// **'Hoạt động học tập của bạn trên thiết bị này.'**
  String get progressIntro;

  /// Empty-state title shown before any review is recorded.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có hoạt động học tập'**
  String get progressEmptyTitle;

  /// Empty-state body on the Progress tab.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn thành một phiên ôn flashcard để bắt đầu theo dõi tiến độ thật của bạn.'**
  String get progressEmptyBody;

  /// Error-state title on the Progress tab.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được tiến độ'**
  String get progressErrorTitle;

  /// Error-state body on the Progress tab.
  ///
  /// In vi, this message translates to:
  /// **'Đã xảy ra lỗi khi đọc dữ liệu học tập trên thiết bị.'**
  String get progressError;

  /// Label for today's review count stat.
  ///
  /// In vi, this message translates to:
  /// **'Hôm nay'**
  String get progressTodayLabel;

  /// Label for the consecutive study-day streak stat.
  ///
  /// In vi, this message translates to:
  /// **'Chuỗi ngày học'**
  String get progressStreakLabel;

  /// Streak value in days.
  ///
  /// In vi, this message translates to:
  /// **'{days, plural, =0{0 ngày} =1{1 ngày} other{{days} ngày}}'**
  String progressStreakValue(int days);

  /// Label for the last-7-days review-count stat.
  ///
  /// In vi, this message translates to:
  /// **'7 ngày qua'**
  String get progressWeekLabel;

  /// Label for the all-time review-count stat.
  ///
  /// In vi, this message translates to:
  /// **'Tổng lượt ôn'**
  String get progressTotalLabel;

  /// A count of reviewed cards.
  ///
  /// In vi, this message translates to:
  /// **'{count, plural, =1{1 thẻ} other{{count} thẻ}}'**
  String progressCardsValue(int count);

  /// Section title for the 7-day activity chart.
  ///
  /// In vi, this message translates to:
  /// **'Hoạt động 7 ngày'**
  String get progressActivityTitle;

  /// Section title for the SRS rating breakdown.
  ///
  /// In vi, this message translates to:
  /// **'Phân loại đánh giá'**
  String get progressRatingTitle;

  /// Slim non-blocking banner shown while the device is offline.
  ///
  /// In vi, this message translates to:
  /// **'Bạn đang ngoại tuyến. Một số nội dung có thể chưa cập nhật.'**
  String get offlineBannerMessage;

  /// Section header on Learn for the dictionary/kanji/grammar reference tools.
  ///
  /// In vi, this message translates to:
  /// **'Tra cứu'**
  String get learnReferenceTitle;

  /// Label for the dictionary tool entry on Learn.
  ///
  /// In vi, this message translates to:
  /// **'Từ điển'**
  String get learnDictionaryLabel;

  /// Label for the kanji browser entry on Learn.
  ///
  /// In vi, this message translates to:
  /// **'Kanji'**
  String get learnKanjiLabel;

  /// Label for the grammar browser entry on Learn.
  ///
  /// In vi, this message translates to:
  /// **'Ngữ pháp'**
  String get learnGrammarLabel;

  /// Section header above example sentences in content detail screens.
  ///
  /// In vi, this message translates to:
  /// **'Ví dụ'**
  String get contentExamplesTitle;

  /// App bar title for the dictionary search screen.
  ///
  /// In vi, this message translates to:
  /// **'Từ điển'**
  String get dictionaryTitle;

  /// Placeholder text in the dictionary search field.
  ///
  /// In vi, this message translates to:
  /// **'Tìm từ tiếng Nhật hoặc nghĩa tiếng Việt'**
  String get dictionarySearchHint;

  /// Title of the idle prompt shown before the user searches the dictionary.
  ///
  /// In vi, this message translates to:
  /// **'Tra từ điển Nhật–Việt'**
  String get dictionaryIdleTitle;

  /// Body of the idle prompt on the dictionary screen.
  ///
  /// In vi, this message translates to:
  /// **'Nhập kanji, kana hoặc nghĩa tiếng Việt để bắt đầu.'**
  String get dictionaryIdleBody;

  /// Empty-state title when a dictionary search returns no results.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy từ'**
  String get dictionaryEmptyTitle;

  /// Empty-state body when a dictionary search returns no results.
  ///
  /// In vi, this message translates to:
  /// **'Thử từ khóa khác hoặc kiểm tra chính tả.'**
  String get dictionaryEmptyBody;

  /// Error-state title for the dictionary screen.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được kết quả'**
  String get dictionaryErrorTitle;

  /// Error-state body for the dictionary screen.
  ///
  /// In vi, this message translates to:
  /// **'Đã có lỗi khi tìm kiếm. Vui lòng thử lại.'**
  String get dictionaryErrorBody;

  /// Section header above the list of word senses in word detail.
  ///
  /// In vi, this message translates to:
  /// **'Nghĩa'**
  String get dictionarySensesTitle;

  /// App bar title for the kanji browser screen.
  ///
  /// In vi, this message translates to:
  /// **'Kanji'**
  String get kanjiTitle;

  /// Placeholder text in the kanji search field.
  ///
  /// In vi, this message translates to:
  /// **'Tìm kanji theo chữ, âm đọc hoặc cấp độ'**
  String get kanjiSearchHint;

  /// Empty-state title when the kanji list is empty.
  ///
  /// In vi, this message translates to:
  /// **'Không có kanji phù hợp'**
  String get kanjiEmptyTitle;

  /// Empty-state body when the kanji list is empty.
  ///
  /// In vi, this message translates to:
  /// **'Thử chữ khác hoặc một cấp độ khác.'**
  String get kanjiEmptyBody;

  /// Error-state title for the kanji screens.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được Kanji'**
  String get kanjiErrorTitle;

  /// Error-state body for the kanji screens.
  ///
  /// In vi, this message translates to:
  /// **'Đã có lỗi khi tải dữ liệu. Vui lòng thử lại.'**
  String get kanjiErrorBody;

  /// Label for the on'yomi reading in kanji detail.
  ///
  /// In vi, this message translates to:
  /// **'Âm On'**
  String get kanjiOnyomiLabel;

  /// Label for the kun'yomi reading in kanji detail.
  ///
  /// In vi, this message translates to:
  /// **'Âm Kun'**
  String get kanjiKunyomiLabel;

  /// Label for the Vietnamese meaning in kanji detail.
  ///
  /// In vi, this message translates to:
  /// **'Nghĩa'**
  String get kanjiMeaningLabel;

  /// Stroke-count label in kanji detail.
  ///
  /// In vi, this message translates to:
  /// **'{count, plural, other{{count} nét}}'**
  String kanjiStrokesLabel(int count);

  /// Section header above the stroke-order diagram in kanji detail.
  ///
  /// In vi, this message translates to:
  /// **'Thứ tự nét'**
  String get kanjiStrokeOrderTitle;

  /// Section header above the kanji components list.
  ///
  /// In vi, this message translates to:
  /// **'Bộ thủ & thành phần'**
  String get kanjiComponentsTitle;

  /// Section header above example words in kanji detail.
  ///
  /// In vi, this message translates to:
  /// **'Từ ví dụ'**
  String get kanjiExamplesTitle;

  /// App bar title for the grammar browser screen.
  ///
  /// In vi, this message translates to:
  /// **'Ngữ pháp'**
  String get grammarTitle;

  /// Placeholder text in the grammar search field.
  ///
  /// In vi, this message translates to:
  /// **'Tìm mẫu ngữ pháp hoặc cấp độ'**
  String get grammarSearchHint;

  /// Empty-state title when the grammar list is empty.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy mẫu ngữ pháp'**
  String get grammarEmptyTitle;

  /// Empty-state body when the grammar list is empty.
  ///
  /// In vi, this message translates to:
  /// **'Thử từ khóa khác.'**
  String get grammarEmptyBody;

  /// Error-state title for the grammar screens.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được ngữ pháp'**
  String get grammarErrorTitle;

  /// Error-state body for the grammar screens.
  ///
  /// In vi, this message translates to:
  /// **'Đã có lỗi khi tải dữ liệu. Vui lòng thử lại.'**
  String get grammarErrorBody;

  /// Label for the explanation block in grammar detail.
  ///
  /// In vi, this message translates to:
  /// **'Giải thích'**
  String get grammarExplanationLabel;

  /// Label for the note block in grammar detail.
  ///
  /// In vi, this message translates to:
  /// **'Lưu ý'**
  String get grammarNoteLabel;

  /// App bar title for the business-scenario browser.
  ///
  /// In vi, this message translates to:
  /// **'Tình huống công việc'**
  String get scenariosTitle;

  /// Subtitle/description for the scenario browser.
  ///
  /// In vi, this message translates to:
  /// **'Luyện giao tiếp công sở qua các tình huống thực tế.'**
  String get scenariosSubtitle;

  /// Empty-state title when no scenarios are available.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có tình huống'**
  String get scenariosEmptyTitle;

  /// Empty-state body when no scenarios are available.
  ///
  /// In vi, this message translates to:
  /// **'Hãy quay lại sau nhé.'**
  String get scenariosEmptyBody;

  /// Error-state title for the scenario screens.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được tình huống'**
  String get scenariosErrorTitle;

  /// Error-state body for the scenario screens.
  ///
  /// In vi, this message translates to:
  /// **'Đã có lỗi khi tải dữ liệu. Vui lòng thử lại.'**
  String get scenariosErrorBody;

  /// Label for the category filter chip that shows all scenarios.
  ///
  /// In vi, this message translates to:
  /// **'Tất cả'**
  String get scenariosAllCategories;

  /// Progress label inside the scenario player.
  ///
  /// In vi, this message translates to:
  /// **'Bước {current}/{total}'**
  String scenarioStepLabel(int current, int total);

  /// Estimated duration for a scenario.
  ///
  /// In vi, this message translates to:
  /// **'{minutes} phút'**
  String scenarioEstimatedMinutes(int minutes);

  /// Number of steps in a scenario.
  ///
  /// In vi, this message translates to:
  /// **'{count} bước'**
  String scenarioStepCount(int count);

  /// CTA to start a scenario.
  ///
  /// In vi, this message translates to:
  /// **'Bắt đầu'**
  String get scenarioStartCta;

  /// CTA to advance to the next scenario step after feedback.
  ///
  /// In vi, this message translates to:
  /// **'Tiếp tục'**
  String get scenarioContinueCta;

  /// CTA to finish the final scenario step.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn thành'**
  String get scenarioFinishCta;

  /// Badge shown when the learner picked the optimal choice.
  ///
  /// In vi, this message translates to:
  /// **'Lựa chọn tối ưu'**
  String get scenarioOptimalBadge;

  /// Badge shown when the learner picked a non-optimal choice.
  ///
  /// In vi, this message translates to:
  /// **'Có thể tốt hơn'**
  String get scenarioSuboptimalBadge;

  /// Points awarded for a scenario choice.
  ///
  /// In vi, this message translates to:
  /// **'+{points} điểm'**
  String scenarioPointsAwarded(int points);

  /// App bar title for the scenario result screen.
  ///
  /// In vi, this message translates to:
  /// **'Kết quả tình huống'**
  String get scenarioResultTitle;

  /// Score summary on the scenario result screen.
  ///
  /// In vi, this message translates to:
  /// **'{total}/{max} điểm'**
  String scenarioResultScore(int total, int max);

  /// CTA to leave the scenario result screen.
  ///
  /// In vi, this message translates to:
  /// **'Xong'**
  String get scenarioResultDone;

  /// CTA to retry a scenario from the result screen.
  ///
  /// In vi, this message translates to:
  /// **'Làm lại'**
  String get scenarioRetryCta;

  /// App bar title for the BJT mock-test browser.
  ///
  /// In vi, this message translates to:
  /// **'Thi thử BJT'**
  String get examTitle;

  /// Subtitle/description for the exam browser.
  ///
  /// In vi, this message translates to:
  /// **'Làm bài thi thử có tính giờ và chấm điểm.'**
  String get examSubtitle;

  /// Empty-state title when no exam templates are available.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có đề thi'**
  String get examEmptyTitle;

  /// Empty-state body when no exam templates are available.
  ///
  /// In vi, this message translates to:
  /// **'Hãy quay lại sau nhé.'**
  String get examEmptyBody;

  /// Error-state title for the exam screens.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được đề thi'**
  String get examErrorTitle;

  /// Error-state body for the exam screens.
  ///
  /// In vi, this message translates to:
  /// **'Đã có lỗi khi tải dữ liệu. Vui lòng thử lại.'**
  String get examErrorBody;

  /// Number of questions in an exam template.
  ///
  /// In vi, this message translates to:
  /// **'{count} câu hỏi'**
  String examQuestionCount(int count);

  /// CTA to start a BJT mock test.
  ///
  /// In vi, this message translates to:
  /// **'Bắt đầu thi'**
  String get examStartCta;

  /// Question progress label inside the exam player.
  ///
  /// In vi, this message translates to:
  /// **'Câu {current}/{total}'**
  String examProgressLabel(int current, int total);

  /// CTA to submit the selected answer.
  ///
  /// In vi, this message translates to:
  /// **'Trả lời'**
  String get examSubmitCta;

  /// Calm note shown for listening questions when audio playback is not yet available on mobile.
  ///
  /// In vi, this message translates to:
  /// **'Câu hỏi nghe — phần phát âm thanh chưa có trên di động. Hãy đọc nội dung bên dưới để trả lời.'**
  String get examAudioUnavailable;

  /// CTA to advance to the next exam question.
  ///
  /// In vi, this message translates to:
  /// **'Câu tiếp theo'**
  String get examNextCta;

  /// Title shown when the exam timer expires.
  ///
  /// In vi, this message translates to:
  /// **'Hết giờ'**
  String get examTimeUpTitle;

  /// Body shown when the exam timer expires.
  ///
  /// In vi, this message translates to:
  /// **'Bài thi đã kết thúc. Xem kết quả của bạn.'**
  String get examTimeUpBody;

  /// App bar title for the exam result screen.
  ///
  /// In vi, this message translates to:
  /// **'Kết quả thi thử'**
  String get examResultTitle;

  /// Correct-count summary on the exam result screen.
  ///
  /// In vi, this message translates to:
  /// **'{correct}/{total} câu đúng'**
  String examResultScore(int correct, int total);

  /// Estimated BJT band on the exam result screen.
  ///
  /// In vi, this message translates to:
  /// **'Mức BJT ước tính: {band}'**
  String examResultBand(String band);

  /// CTA to leave the exam result screen.
  ///
  /// In vi, this message translates to:
  /// **'Xong'**
  String get examResultDone;

  /// Error title when an exam requires a higher plan/entitlement.
  ///
  /// In vi, this message translates to:
  /// **'Cần nâng cấp'**
  String get examUpgradeRequiredTitle;

  /// Error body when an exam requires a higher plan/entitlement.
  ///
  /// In vi, this message translates to:
  /// **'Gói hiện tại của bạn chưa bao gồm bài thi này.'**
  String get examUpgradeRequiredBody;

  /// CTA on the result screen to open the per-question review.
  ///
  /// In vi, this message translates to:
  /// **'Xem lại bài làm'**
  String get examReviewCta;

  /// Title of the exam per-question review screen.
  ///
  /// In vi, this message translates to:
  /// **'Xem lại bài làm'**
  String get examReviewTitle;

  /// Score summary on the exam review screen.
  ///
  /// In vi, this message translates to:
  /// **'Đúng {correct}/{total} câu'**
  String examReviewScore(int correct, int total);

  /// Review filter chip: show all questions.
  ///
  /// In vi, this message translates to:
  /// **'Tất cả'**
  String get examReviewFilterAll;

  /// Review filter chip: show only incorrect answers.
  ///
  /// In vi, this message translates to:
  /// **'Sai'**
  String get examReviewFilterWrong;

  /// Review filter chip: show only correct answers.
  ///
  /// In vi, this message translates to:
  /// **'Đúng'**
  String get examReviewFilterCorrect;

  /// Per-question label in the exam review list.
  ///
  /// In vi, this message translates to:
  /// **'Câu {position}'**
  String examReviewQuestionLabel(int position);

  /// Verdict badge for a correct answer in review.
  ///
  /// In vi, this message translates to:
  /// **'Đúng'**
  String get examReviewCorrect;

  /// Verdict badge for an incorrect answer in review (gentle wording).
  ///
  /// In vi, this message translates to:
  /// **'Chưa đúng'**
  String get examReviewIncorrect;

  /// Shows which option key the learner chose.
  ///
  /// In vi, this message translates to:
  /// **'Bạn chọn: {option}'**
  String examReviewYourAnswer(String option);

  /// Heading above the explanation text in review.
  ///
  /// In vi, this message translates to:
  /// **'Giải thích'**
  String get examReviewExplanationTitle;

  /// Empty state when a review filter matches no questions.
  ///
  /// In vi, this message translates to:
  /// **'Không có câu nào trong mục này.'**
  String get examReviewEmptyFilter;

  /// Error title when the review breakdown fails to load.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được phần xem lại'**
  String get examReviewErrorTitle;

  /// Error body when the review breakdown fails to load.
  ///
  /// In vi, this message translates to:
  /// **'Kiểm tra kết nối và thử lại.'**
  String get examReviewErrorBody;

  /// Title of the NHK news reading feature.
  ///
  /// In vi, this message translates to:
  /// **'Tin tức NHK'**
  String get newsTitle;

  /// Subtitle describing the NHK news feature.
  ///
  /// In vi, this message translates to:
  /// **'Đọc tin thật bằng tiếng Nhật, kèm từ vựng và phụ đề.'**
  String get newsSubtitle;

  /// News source filter chip: all sources.
  ///
  /// In vi, this message translates to:
  /// **'Tất cả'**
  String get newsFilterAll;

  /// News source filter chip: NHK Easy (simplified, with furigana).
  ///
  /// In vi, this message translates to:
  /// **'NHK Easy'**
  String get newsFilterEasy;

  /// News source filter chip: standard NHK.
  ///
  /// In vi, this message translates to:
  /// **'NHK'**
  String get newsFilterNormal;

  /// Empty state title when no news articles are available.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có bài viết'**
  String get newsEmptyTitle;

  /// Empty state body when no news articles are available.
  ///
  /// In vi, this message translates to:
  /// **'Hãy quay lại sau để đọc tin mới từ NHK.'**
  String get newsEmptyBody;

  /// Error state title when news fails to load.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được tin tức'**
  String get newsErrorTitle;

  /// Error state body when news fails to load.
  ///
  /// In vi, this message translates to:
  /// **'Kiểm tra kết nối mạng rồi thử lại.'**
  String get newsErrorBody;

  /// Section header for the vocabulary list inside an article.
  ///
  /// In vi, this message translates to:
  /// **'Từ vựng'**
  String get newsVocabularyTitle;

  /// Shown when an article has no extracted vocabulary.
  ///
  /// In vi, this message translates to:
  /// **'Bài viết này chưa có danh sách từ vựng.'**
  String get newsVocabularyEmpty;

  /// Tooltip/label to bookmark an article.
  ///
  /// In vi, this message translates to:
  /// **'Lưu bài'**
  String get newsBookmarkAdd;

  /// Tooltip/label to remove a bookmark.
  ///
  /// In vi, this message translates to:
  /// **'Bỏ lưu'**
  String get newsBookmarkRemove;

  /// Snackbar shown when an action requires the learner to sign in.
  ///
  /// In vi, this message translates to:
  /// **'Hãy đăng nhập để dùng tính năng này.'**
  String get commonSignInRequired;

  /// Title of the daily learning magazine feature.
  ///
  /// In vi, this message translates to:
  /// **'Tạp chí'**
  String get magazineTitle;

  /// Subtitle describing the magazine feature.
  ///
  /// In vi, this message translates to:
  /// **'Bài đọc hằng ngày kèm từ vựng và quiz.'**
  String get magazineSubtitle;

  /// Filter chip for all magazine widget kinds.
  ///
  /// In vi, this message translates to:
  /// **'Tất cả'**
  String get magazineFilterAll;

  /// Filter chip for the vocabulary magazine kind.
  ///
  /// In vi, this message translates to:
  /// **'Từ vựng'**
  String get magazineFilterVocab;

  /// Filter chip for the weather magazine kind.
  ///
  /// In vi, this message translates to:
  /// **'Thời tiết'**
  String get magazineFilterWeather;

  /// Filter chip for the horoscope magazine kind.
  ///
  /// In vi, this message translates to:
  /// **'Tử vi'**
  String get magazineFilterHoroscope;

  /// Filter chip for the BJT business-phrase magazine kind.
  ///
  /// In vi, this message translates to:
  /// **'BJT'**
  String get magazineFilterBjt;

  /// Empty-state title when no magazine articles are available.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có bài viết'**
  String get magazineEmptyTitle;

  /// Empty-state body for the magazine list.
  ///
  /// In vi, this message translates to:
  /// **'Hãy quay lại sau để đọc bài mới.'**
  String get magazineEmptyBody;

  /// Error-state title for the magazine feature.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được tạp chí'**
  String get magazineErrorTitle;

  /// Error-state body for the magazine feature.
  ///
  /// In vi, this message translates to:
  /// **'Đã xảy ra lỗi. Vui lòng thử lại.'**
  String get magazineErrorBody;

  /// Section title for the magazine vocabulary list.
  ///
  /// In vi, this message translates to:
  /// **'Từ vựng'**
  String get magazineVocabularyTitle;

  /// Section title for the magazine mini-quiz.
  ///
  /// In vi, this message translates to:
  /// **'Quiz nhanh'**
  String get magazineQuizTitle;

  /// Quiz progress label, e.g. Question 1/3.
  ///
  /// In vi, this message translates to:
  /// **'Câu {current}/{total}'**
  String magazineQuizProgress(int current, int total);

  /// Title of the Career RPG hub screen.
  ///
  /// In vi, this message translates to:
  /// **'Sự nghiệp'**
  String get careerTitle;

  /// Subtitle for the Career entry card on the Learn screen.
  ///
  /// In vi, this message translates to:
  /// **'Lên cấp kỹ năng công sở qua các nhiệm vụ BJT.'**
  String get careerSubtitle;

  /// Eyebrow label above the current rank title.
  ///
  /// In vi, this message translates to:
  /// **'Cấp bậc hiện tại'**
  String get careerRankEyebrow;

  /// Rank XP progress toward the next rank.
  ///
  /// In vi, this message translates to:
  /// **'{current}/{total} XP đến {nextRank}'**
  String careerXpProgress(int current, int total, String nextRank);

  /// Shown when the learner is at the maximum rank.
  ///
  /// In vi, this message translates to:
  /// **'Bạn đã đạt cấp bậc cao nhất.'**
  String get careerRankMax;

  /// Daily clock-in streak length.
  ///
  /// In vi, this message translates to:
  /// **'Chuỗi {days} ngày'**
  String careerStreakDays(int days);

  /// Helper text under the streak count.
  ///
  /// In vi, this message translates to:
  /// **'Điểm danh mỗi ngày để giữ chuỗi.'**
  String get careerStreakSubtitle;

  /// Clock-in button label.
  ///
  /// In vi, this message translates to:
  /// **'Điểm danh hôm nay'**
  String get careerClockIn;

  /// Snackbar shown after a successful clock-in.
  ///
  /// In vi, this message translates to:
  /// **'Đã điểm danh hôm nay.'**
  String get careerClockInDone;

  /// Section title for the skill axes.
  ///
  /// In vi, this message translates to:
  /// **'Kỹ năng'**
  String get careerSkillsTitle;

  /// Empty state inside the skills card.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có dữ liệu kỹ năng.'**
  String get careerSkillsEmpty;

  /// Skill axis: keigo.
  ///
  /// In vi, this message translates to:
  /// **'Kính ngữ'**
  String get careerAxisKeigo;

  /// Skill axis: written business.
  ///
  /// In vi, this message translates to:
  /// **'Văn viết'**
  String get careerAxisWritten;

  /// Skill axis: meetings.
  ///
  /// In vi, this message translates to:
  /// **'Họp hành'**
  String get careerAxisMeeting;

  /// Skill axis: customer service.
  ///
  /// In vi, this message translates to:
  /// **'Khách hàng'**
  String get careerAxisCustomer;

  /// Skill axis: charts/data.
  ///
  /// In vi, this message translates to:
  /// **'Biểu đồ'**
  String get careerAxisChart;

  /// Skill axis: nuance.
  ///
  /// In vi, this message translates to:
  /// **'Sắc thái'**
  String get careerAxisNuance;

  /// Section title for NPC relationships.
  ///
  /// In vi, this message translates to:
  /// **'Quan hệ đồng nghiệp'**
  String get careerRelationsTitle;

  /// Title for the story arcs list.
  ///
  /// In vi, this message translates to:
  /// **'Tuyến nhiệm vụ'**
  String get careerArcsTitle;

  /// Subtitle for the story arcs list.
  ///
  /// In vi, this message translates to:
  /// **'Chọn một tuyến để bắt đầu hành trình công sở.'**
  String get careerArcsSubtitle;

  /// Empty state title for story arcs.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có tuyến nhiệm vụ'**
  String get careerArcsEmptyTitle;

  /// Empty state body for story arcs.
  ///
  /// In vi, this message translates to:
  /// **'Hãy quay lại sau khi mở khoá tuyến đầu tiên.'**
  String get careerArcsEmptyBody;

  /// Locked arc hint showing the required rank code.
  ///
  /// In vi, this message translates to:
  /// **'Mở khoá ở cấp {rank}'**
  String careerArcLocked(String rank);

  /// Arc chapter completion progress.
  ///
  /// In vi, this message translates to:
  /// **'{completed}/{total} chương'**
  String careerArcProgress(int completed, int total);

  /// Arc status: locked.
  ///
  /// In vi, this message translates to:
  /// **'Khoá'**
  String get careerStatusLocked;

  /// Arc status: active.
  ///
  /// In vi, this message translates to:
  /// **'Đang mở'**
  String get careerStatusActive;

  /// Arc status: completed.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn thành'**
  String get careerStatusCompleted;

  /// Section title for the chapter list in an arc.
  ///
  /// In vi, this message translates to:
  /// **'Các chương'**
  String get careerChaptersTitle;

  /// Estimated chapter duration in minutes.
  ///
  /// In vi, this message translates to:
  /// **'{minutes} phút'**
  String careerChapterMinutes(int minutes);

  /// Start button on the chapter briefing.
  ///
  /// In vi, this message translates to:
  /// **'Bắt đầu'**
  String get careerChapterStart;

  /// Label for the learner's role in the chapter.
  ///
  /// In vi, this message translates to:
  /// **'Vai trò của bạn'**
  String get careerChapterRole;

  /// Complete-chapter button label.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn thành chương'**
  String get careerChapterComplete;

  /// Heading on the chapter completion screen.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn thành chương!'**
  String get careerChapterCompleteTitle;

  /// Scenario progress within a chapter.
  ///
  /// In vi, this message translates to:
  /// **'Tình huống {current}/{total}'**
  String careerScenarioProgress(int current, int total);

  /// Label for the scenario goal chip.
  ///
  /// In vi, this message translates to:
  /// **'Mục tiêu'**
  String get careerScenarioGoal;

  /// Header shown when the chosen option is correct.
  ///
  /// In vi, this message translates to:
  /// **'Lựa chọn tốt'**
  String get careerOutcomeGood;

  /// Header shown when the chosen option is risky.
  ///
  /// In vi, this message translates to:
  /// **'Có rủi ro'**
  String get careerOutcomeRisk;

  /// XP earned from completing a chapter.
  ///
  /// In vi, this message translates to:
  /// **'+{xp} XP'**
  String careerXpEarned(int xp);

  /// Rank-up announcement with the new rank title.
  ///
  /// In vi, this message translates to:
  /// **'Thăng cấp: {rank}'**
  String careerRankUp(String rank);

  /// Button to return to the arc after completion.
  ///
  /// In vi, this message translates to:
  /// **'Quay lại tuyến nhiệm vụ'**
  String get careerBackToArcs;

  /// Continue button between scenario questions.
  ///
  /// In vi, this message translates to:
  /// **'Tiếp tục'**
  String get careerContinue;

  /// Generic Career error title.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được dữ liệu'**
  String get careerErrorTitle;

  /// Generic Career error body.
  ///
  /// In vi, this message translates to:
  /// **'Đã có lỗi xảy ra. Vui lòng thử lại.'**
  String get careerErrorBody;

  /// Section header for the Library tools (search and saved) on the Learn hub.
  ///
  /// In vi, this message translates to:
  /// **'Thư viện'**
  String get learnLibraryTitle;

  /// Title of the global content search screen.
  ///
  /// In vi, this message translates to:
  /// **'Tìm kiếm'**
  String get searchTitle;

  /// Subtitle for the search entry card on the Learn hub.
  ///
  /// In vi, this message translates to:
  /// **'Tra từ vựng, kanji và ngữ pháp'**
  String get searchSubtitle;

  /// Placeholder text inside the global search input.
  ///
  /// In vi, this message translates to:
  /// **'Tìm từ vựng, kanji, ngữ pháp…'**
  String get searchHint;

  /// Title shown before the learner has typed a search query.
  ///
  /// In vi, this message translates to:
  /// **'Bắt đầu tìm kiếm'**
  String get searchIdleTitle;

  /// Body shown before the learner has typed a search query.
  ///
  /// In vi, this message translates to:
  /// **'Nhập một từ tiếng Nhật hoặc tiếng Việt để tra cứu trên toàn bộ nội dung.'**
  String get searchIdleBody;

  /// Title shown when a search returns no results.
  ///
  /// In vi, this message translates to:
  /// **'Không có kết quả'**
  String get searchEmptyTitle;

  /// Body shown when a search returns no results.
  ///
  /// In vi, this message translates to:
  /// **'Thử từ khóa khác hoặc kiểm tra lại chính tả.'**
  String get searchEmptyBody;

  /// Title shown when the search request fails.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm kiếm được'**
  String get searchErrorTitle;

  /// Body shown when the search request fails.
  ///
  /// In vi, this message translates to:
  /// **'Đã có lỗi xảy ra. Vui lòng thử lại.'**
  String get searchErrorBody;

  /// Label for a dictionary word (lexeme) search result.
  ///
  /// In vi, this message translates to:
  /// **'Từ vựng'**
  String get searchKindWord;

  /// Label for a kanji search result.
  ///
  /// In vi, this message translates to:
  /// **'Kanji'**
  String get searchKindKanji;

  /// Label for a grammar search result.
  ///
  /// In vi, this message translates to:
  /// **'Ngữ pháp'**
  String get searchKindGrammar;

  /// Label for an example-sentence search result.
  ///
  /// In vi, this message translates to:
  /// **'Ví dụ'**
  String get searchKindExample;

  /// Label for an unclassified search result.
  ///
  /// In vi, this message translates to:
  /// **'Khác'**
  String get searchKindOther;

  /// Section header above the lookup tools on the Search hub.
  ///
  /// In vi, this message translates to:
  /// **'Công cụ tra cứu'**
  String get searchToolsTitle;

  /// Subtitle for the Dictionary tool card on the Search hub.
  ///
  /// In vi, this message translates to:
  /// **'Tra từ Nhật–Việt'**
  String get searchToolDictionarySubtitle;

  /// Subtitle for the Kanji tool card on the Search hub.
  ///
  /// In vi, this message translates to:
  /// **'Tra kanji theo chữ và âm đọc'**
  String get searchToolKanjiSubtitle;

  /// Subtitle for the Grammar tool card on the Search hub.
  ///
  /// In vi, this message translates to:
  /// **'Tra mẫu ngữ pháp'**
  String get searchToolGrammarSubtitle;

  /// Section header above the learner's recent search queries.
  ///
  /// In vi, this message translates to:
  /// **'Tìm kiếm gần đây'**
  String get searchRecentTitle;

  /// Button that clears all recent searches.
  ///
  /// In vi, this message translates to:
  /// **'Xóa hết'**
  String get searchRecentClear;

  /// Tooltip for removing a single recent search chip.
  ///
  /// In vi, this message translates to:
  /// **'Xóa khỏi lịch sử'**
  String get searchRecentRemoveTooltip;

  /// Label for the segmented filter that shows all search result kinds.
  ///
  /// In vi, this message translates to:
  /// **'Tất cả'**
  String get searchFilterAll;

  /// Tooltip for the bookmark button when the item is not saved.
  ///
  /// In vi, this message translates to:
  /// **'Lưu'**
  String get savedBookmarkAdd;

  /// Tooltip for the bookmark button when the item is already saved.
  ///
  /// In vi, this message translates to:
  /// **'Bỏ lưu'**
  String get savedBookmarkRemove;

  /// Snackbar shown when an unauthenticated learner taps bookmark.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập để lưu mục này.'**
  String get savedBookmarkSignIn;

  /// Snackbar shown when a bookmark toggle fails.
  ///
  /// In vi, this message translates to:
  /// **'Không lưu được. Vui lòng thử lại.'**
  String get savedBookmarkError;

  /// Tooltip for removing an item from the saved list.
  ///
  /// In vi, this message translates to:
  /// **'Xóa khỏi mục đã lưu'**
  String get savedRemoveTooltip;

  /// Snackbar confirming a saved item was removed.
  ///
  /// In vi, this message translates to:
  /// **'Đã xóa khỏi mục đã lưu'**
  String get savedRemovedToast;

  /// Title of the saved bookmarks library screen.
  ///
  /// In vi, this message translates to:
  /// **'Đã lưu'**
  String get savedTitle;

  /// Subtitle for the saved-library entry card on the Learn hub.
  ///
  /// In vi, this message translates to:
  /// **'Từ vựng, kanji và ngữ pháp bạn đã lưu'**
  String get savedSubtitle;

  /// Tab label for saved dictionary words.
  ///
  /// In vi, this message translates to:
  /// **'Từ vựng'**
  String get savedTabWords;

  /// Tab label for saved kanji.
  ///
  /// In vi, this message translates to:
  /// **'Kanji'**
  String get savedTabKanji;

  /// Tab label for saved grammar points.
  ///
  /// In vi, this message translates to:
  /// **'Ngữ pháp'**
  String get savedTabGrammar;

  /// Title shown when a saved tab has no bookmarks.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có mục đã lưu'**
  String get savedEmptyTitle;

  /// Empty-state body for the saved words tab.
  ///
  /// In vi, this message translates to:
  /// **'Lưu từ vựng khi tra cứu để ôn lại sau.'**
  String get savedEmptyWords;

  /// Empty-state body for the saved kanji tab.
  ///
  /// In vi, this message translates to:
  /// **'Lưu kanji khi học để ôn lại sau.'**
  String get savedEmptyKanji;

  /// Empty-state body for the saved grammar tab.
  ///
  /// In vi, this message translates to:
  /// **'Lưu mẫu ngữ pháp khi học để ôn lại sau.'**
  String get savedEmptyGrammar;

  /// Title shown when an unauthenticated learner opens the saved library.
  ///
  /// In vi, this message translates to:
  /// **'Cần đăng nhập'**
  String get savedSignInTitle;

  /// Body shown when an unauthenticated learner opens the saved library.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập để xem và đồng bộ các mục đã lưu.'**
  String get savedSignInBody;

  /// Title shown when loading saved bookmarks fails.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được mục đã lưu'**
  String get savedErrorTitle;

  /// Body shown when loading saved bookmarks fails.
  ///
  /// In vi, this message translates to:
  /// **'Đã có lỗi xảy ra. Vui lòng thử lại.'**
  String get savedErrorBody;

  /// Title of the learner Rewards hub (streaks, achievements, leaderboards).
  ///
  /// In vi, this message translates to:
  /// **'Thành tựu & Phần thưởng'**
  String get rewardsTitle;

  /// Subtitle/entry description for the Rewards hub.
  ///
  /// In vi, this message translates to:
  /// **'Chuỗi ngày, huy hiệu và bảng xếp hạng của bạn.'**
  String get rewardsSubtitle;

  /// Rewards tab label for the streaks section.
  ///
  /// In vi, this message translates to:
  /// **'Chuỗi ngày'**
  String get rewardsTabStreaks;

  /// Rewards tab label for the achievements section.
  ///
  /// In vi, this message translates to:
  /// **'Huy hiệu'**
  String get rewardsTabAchievements;

  /// Rewards tab label for the leaderboards section.
  ///
  /// In vi, this message translates to:
  /// **'Xếp hạng'**
  String get rewardsTabLeaderboards;

  /// Title shown when a Rewards section fails to load.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được phần thưởng'**
  String get rewardsErrorTitle;

  /// Body shown when a Rewards section fails to load.
  ///
  /// In vi, this message translates to:
  /// **'Đã có lỗi xảy ra. Vui lòng thử lại.'**
  String get rewardsErrorBody;

  /// Title shown when an unauthenticated learner opens Rewards.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập để xem phần thưởng'**
  String get rewardsSignInTitle;

  /// Body shown when an unauthenticated learner opens Rewards.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập để theo dõi chuỗi ngày, huy hiệu và thứ hạng của bạn.'**
  String get rewardsSignInBody;

  /// Title for the empty streaks state.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có chuỗi ngày nào'**
  String get rewardsStreaksEmptyTitle;

  /// Body for the empty streaks state.
  ///
  /// In vi, this message translates to:
  /// **'Học mỗi ngày để bắt đầu chuỗi ngày đầu tiên.'**
  String get rewardsStreaksEmptyBody;

  /// Fallback name when a streak track has no configured name.
  ///
  /// In vi, this message translates to:
  /// **'Chuỗi ngày học'**
  String get rewardsStreakDefaultName;

  /// Current streak length in days.
  ///
  /// In vi, this message translates to:
  /// **'Chuỗi hiện tại: {days} ngày'**
  String rewardsStreakCurrent(int days);

  /// Label for the longest-streak stat.
  ///
  /// In vi, this message translates to:
  /// **'Dài nhất'**
  String get rewardsStreakLongest;

  /// Label for the remaining streak-freeze stat.
  ///
  /// In vi, this message translates to:
  /// **'Lượt giữ chuỗi'**
  String get rewardsStreakFreezes;

  /// A streak length expressed in days.
  ///
  /// In vi, this message translates to:
  /// **'{days} ngày'**
  String rewardsStreakDays(int days);

  /// Title for the empty achievements state.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có huy hiệu'**
  String get rewardsAchievementsEmptyTitle;

  /// Body for the empty achievements state.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn thành mục tiêu học tập để mở khóa huy hiệu.'**
  String get rewardsAchievementsEmptyBody;

  /// Earned vs total tiers for an achievement.
  ///
  /// In vi, this message translates to:
  /// **'{earned}/{total}'**
  String rewardsAchievementTiers(int earned, int total);

  /// Progress toward the next achievement tier threshold.
  ///
  /// In vi, this message translates to:
  /// **'{current}/{target}'**
  String rewardsAchievementProgress(int current, int target);

  /// Title for the empty leaderboards list state.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có bảng xếp hạng'**
  String get rewardsLeaderboardsEmptyTitle;

  /// Body for the empty leaderboards list state.
  ///
  /// In vi, this message translates to:
  /// **'Hiện chưa có bảng xếp hạng nào đang mở.'**
  String get rewardsLeaderboardsEmptyBody;

  /// Title for the empty rankings state of a single leaderboard.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có thứ hạng'**
  String get rewardsLeaderboardEmptyTitle;

  /// Body for the empty rankings state of a single leaderboard.
  ///
  /// In vi, this message translates to:
  /// **'Hãy là người đầu tiên ghi điểm trên bảng này.'**
  String get rewardsLeaderboardEmptyBody;

  /// Fallback name for a leaderboard entry without a display name.
  ///
  /// In vi, this message translates to:
  /// **'Người học ẩn danh'**
  String get rewardsLeaderboardAnonymous;

  /// Formatted leaderboard score.
  ///
  /// In vi, this message translates to:
  /// **'{score} đ'**
  String rewardsLeaderboardScore(int score);

  /// Subscription screen title.
  ///
  /// In vi, this message translates to:
  /// **'Gói đăng ký'**
  String get subscriptionTitle;

  /// Subscription screen subtitle.
  ///
  /// In vi, this message translates to:
  /// **'Quản lý gói và quyền lợi của bạn'**
  String get subscriptionSubtitle;

  /// Subscription load error title.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được gói đăng ký'**
  String get subscriptionErrorTitle;

  /// Subscription load error body.
  ///
  /// In vi, this message translates to:
  /// **'Đã xảy ra lỗi. Vui lòng thử lại.'**
  String get subscriptionErrorBody;

  /// Subscription sign-in prompt title.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập để xem gói'**
  String get subscriptionSignInTitle;

  /// Subscription sign-in prompt body.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập để xem và quản lý gói đăng ký của bạn.'**
  String get subscriptionSignInBody;

  /// Current plan label.
  ///
  /// In vi, this message translates to:
  /// **'Gói hiện tại'**
  String get subscriptionCurrentPlan;

  /// Active subscription status.
  ///
  /// In vi, this message translates to:
  /// **'Đang hoạt động'**
  String get subscriptionStatusActive;

  /// Trialing subscription status.
  ///
  /// In vi, this message translates to:
  /// **'Dùng thử'**
  String get subscriptionStatusTrialing;

  /// Canceled subscription status.
  ///
  /// In vi, this message translates to:
  /// **'Đã hủy'**
  String get subscriptionStatusCanceled;

  /// Renewal date label.
  ///
  /// In vi, this message translates to:
  /// **'Gia hạn vào'**
  String get subscriptionRenewsOn;

  /// Cancellation date label.
  ///
  /// In vi, this message translates to:
  /// **'Kết thúc vào'**
  String get subscriptionCancelsOn;

  /// Entitlements section label.
  ///
  /// In vi, this message translates to:
  /// **'Quyền lợi'**
  String get subscriptionEntitlements;

  /// Quotas section label.
  ///
  /// In vi, this message translates to:
  /// **'Hạn mức'**
  String get subscriptionQuotas;

  /// Unlimited quota label.
  ///
  /// In vi, this message translates to:
  /// **'Không giới hạn'**
  String get subscriptionUnlimited;

  /// Quota limit per window.
  ///
  /// In vi, this message translates to:
  /// **'{limit}/{window}'**
  String subscriptionQuotaValue(String limit, String window);

  /// Cancel subscription button.
  ///
  /// In vi, this message translates to:
  /// **'Hủy gia hạn'**
  String get subscriptionCancelButton;

  /// Cancel confirm dialog title.
  ///
  /// In vi, this message translates to:
  /// **'Hủy gói đăng ký?'**
  String get subscriptionCancelConfirmTitle;

  /// Cancel confirm dialog body.
  ///
  /// In vi, this message translates to:
  /// **'Gói của bạn vẫn hoạt động đến hết kỳ thanh toán hiện tại.'**
  String get subscriptionCancelConfirmBody;

  /// Cancel confirm action.
  ///
  /// In vi, this message translates to:
  /// **'Xác nhận hủy'**
  String get subscriptionCancelConfirmAction;

  /// Cancel dialog dismiss action.
  ///
  /// In vi, this message translates to:
  /// **'Giữ lại gói'**
  String get subscriptionCancelDismiss;

  /// Pending cancellation note.
  ///
  /// In vi, this message translates to:
  /// **'Gói sẽ kết thúc vào cuối kỳ thanh toán.'**
  String get subscriptionCancelPending;

  /// Cancel success snackbar.
  ///
  /// In vi, this message translates to:
  /// **'Đã yêu cầu hủy gói.'**
  String get subscriptionCancelSuccess;

  /// Cancel error snackbar.
  ///
  /// In vi, this message translates to:
  /// **'Không hủy được. Vui lòng thử lại.'**
  String get subscriptionCancelError;

  /// Free plan note.
  ///
  /// In vi, this message translates to:
  /// **'Bạn đang dùng gói miễn phí.'**
  String get subscriptionFreeNote;

  /// Upgrade note for free plan.
  ///
  /// In vi, this message translates to:
  /// **'Nâng cấp gói trên web KotobaWorks.'**
  String get subscriptionUpgradeNote;

  /// Available plans section title.
  ///
  /// In vi, this message translates to:
  /// **'Các gói có sẵn'**
  String get subscriptionPlansTitle;

  /// Plans load error message.
  ///
  /// In vi, this message translates to:
  /// **'Không tải được danh sách gói.'**
  String get subscriptionPlansError;

  /// Empty plans message.
  ///
  /// In vi, this message translates to:
  /// **'Hiện chưa có gói nào.'**
  String get subscriptionPlansEmptyBody;

  /// Current plan marker on a plan card.
  ///
  /// In vi, this message translates to:
  /// **'Gói hiện tại'**
  String get subscriptionPlanCurrent;

  /// Free price label.
  ///
  /// In vi, this message translates to:
  /// **'Miễn phí'**
  String get subscriptionPlanFree;

  /// Formatted plan price in VND.
  ///
  /// In vi, this message translates to:
  /// **'{price}đ'**
  String subscriptionPlanPrice(String price);

  /// Per-month price suffix.
  ///
  /// In vi, this message translates to:
  /// **'/tháng'**
  String get subscriptionPlanPerMonth;

  /// Recommended plan badge.
  ///
  /// In vi, this message translates to:
  /// **'Đề xuất'**
  String get subscriptionPlanRecommended;
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
