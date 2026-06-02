// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Vietnamese (`vi`).
class AppLocalizationsVi extends AppLocalizations {
  AppLocalizationsVi([String locale = 'vi']) : super(locale);

  @override
  String get commonRetry => 'Thử lại';

  @override
  String get homeWelcome => 'ようこそ';

  @override
  String get homeReviewFlashcards => 'Ôn Flashcard';

  @override
  String get homeContinueTitle => 'Tiếp tục học';

  @override
  String get homeContinueBody => 'Quay lại bộ thẻ và giữ nhịp học mỗi ngày.';

  @override
  String get homeReviewReadyTitle => 'Sẵn sàng ôn tập';

  @override
  String homeReviewReadyCount(int count) {
    return '$count thẻ';
  }

  @override
  String get homeDeckSummaryTitle => 'Bộ thẻ';

  @override
  String homeDeckSummaryCount(int count) {
    return '$count bộ';
  }

  @override
  String get homeSyncStatusTitle => 'Đồng bộ';

  @override
  String homeSyncPending(int count) {
    return '$count review chờ đồng bộ';
  }

  @override
  String get homeSyncAllSynced => 'Tất cả đã đồng bộ';

  @override
  String get homeDashboardEmptyTitle => 'Chưa có nội dung học';

  @override
  String get homeDashboardEmptyBody => 'Bộ thẻ sẽ xuất hiện ở đây khi có sẵn.';

  @override
  String get homeDashboardError => 'Không tải được bảng học tập.';

  @override
  String get loginSignInTitle => 'Đăng nhập để tiếp tục';

  @override
  String get loginSignInSubtitle =>
      'Dùng email/mật khẩu NihonGo BJT hoặc đăng nhập qua trình duyệt bảo mật như phiên bản web.';

  @override
  String get loginSignInButton => 'Đăng nhập';

  @override
  String get loginGenericError => 'Đã xảy ra lỗi. Vui lòng thử lại.';

  @override
  String get loginEmailLabel => 'Email hoặc tên đăng nhập';

  @override
  String get loginEmailHint => 'testuser hoặc email của bạn';

  @override
  String get loginEmailRequired => 'Vui lòng nhập email hoặc tên đăng nhập.';

  @override
  String get loginPasswordLabel => 'Mật khẩu';

  @override
  String get loginPasswordRequired => 'Vui lòng nhập mật khẩu.';

  @override
  String get loginShowPassword => 'Hiện mật khẩu';

  @override
  String get loginHidePassword => 'Ẩn mật khẩu';

  @override
  String get loginForgotPassword => 'Quên mật khẩu?';

  @override
  String get loginDivider => 'hoặc';

  @override
  String get loginBrowserButton => 'Đăng nhập bằng trình duyệt bảo mật';

  @override
  String get loginCreateAccount => 'Tạo tài khoản mới';

  @override
  String get loginTermsNotice =>
      'Bằng cách tiếp tục, bạn đồng ý với điều khoản sử dụng và chính sách quyền riêng tư của NihonGo BJT.';

  @override
  String get loginGoogleButton => 'Google';

  @override
  String get loginFacebookButton => 'Facebook';

  @override
  String get loginAppleButton => 'Apple';

  @override
  String get loginLineButton => 'LINE';

  @override
  String get loginCancelledError => 'Đăng nhập đã bị huỷ.';

  @override
  String get loginWrongCredentialsError => 'Email hoặc mật khẩu không đúng.';

  @override
  String get loginMethodNotAllowedError =>
      'Client mobile chưa bật đăng nhập bằng mật khẩu.';

  @override
  String get loginInvalidScopeError => 'Cấu hình phạm vi đăng nhập chưa đúng.';

  @override
  String get loginClientMisconfiguredError =>
      'Client đăng nhập mobile đang cấu hình sai.';

  @override
  String get loginNetworkError => 'Không kết nối được máy chủ đăng nhập.';

  @override
  String get loginMissingTokenError =>
      'Máy chủ đăng nhập trả về thiếu dữ liệu phiên.';

  @override
  String get flashcardTitle => 'Flashcard';

  @override
  String deckCardCount(int count) {
    return '$count thẻ';
  }

  @override
  String get deckListEmpty => 'Chưa có bộ thẻ nào.';

  @override
  String get deckListError => 'Không tải được danh sách bộ thẻ.';

  @override
  String get reviewTitle => 'Ôn tập';

  @override
  String get reviewReveal => 'Hiện đáp án';

  @override
  String get reviewComplete => 'Hoàn thành!';

  @override
  String reviewCompleteSummary(int count) {
    return 'Bạn đã ôn $count thẻ.';
  }

  @override
  String get reviewRestart => 'Ôn lại';

  @override
  String get reviewBackToList => 'Về danh sách';

  @override
  String get reviewEmpty => 'Bộ thẻ này chưa có thẻ nào.';

  @override
  String get reviewError => 'Không tải được bộ thẻ.';

  @override
  String get ratingAgain => 'Lại';

  @override
  String get ratingHard => 'Khó';

  @override
  String get ratingGood => 'Tốt';

  @override
  String get ratingEasy => 'Dễ';

  @override
  String get ratingIntervalToday => 'Hôm nay';

  @override
  String ratingIntervalDays(int days) {
    return '$days ngày';
  }

  @override
  String get profileTitle => 'Hồ sơ';

  @override
  String get profileOpenTooltip => 'Hồ sơ & cài đặt';

  @override
  String get profileLearnerFallback => 'Người học';

  @override
  String get profileAccountSection => 'Tài khoản';

  @override
  String get profilePreferencesSection => 'Tùy chỉnh';

  @override
  String get profileLanguageTitle => 'Ngôn ngữ ứng dụng';

  @override
  String get profileLanguageSystem => 'Theo thiết bị';

  @override
  String get profileLanguageVietnamese => 'Tiếng Việt';

  @override
  String get profileLanguageJapanese => 'Tiếng Nhật';

  @override
  String get profileFuriganaTitle => 'Hiển thị furigana';

  @override
  String get profileFuriganaSubtitle =>
      'Hiện cách đọc kana phía trên kanji (trừ khi đang ôn tập).';

  @override
  String get profileSignOut => 'Đăng xuất';

  @override
  String get profileSaveError => 'Không lưu được thay đổi. Vui lòng thử lại.';
}
