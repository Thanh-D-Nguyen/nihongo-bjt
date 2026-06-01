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
  String get homeSignOutTooltip => 'Đăng xuất';

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
      'Bạn sẽ được chuyển tới trang đăng nhập an toàn để xác thực tài khoản.';

  @override
  String get loginSignInButton => 'Đăng nhập';

  @override
  String get loginGenericError => 'Đã xảy ra lỗi. Vui lòng thử lại.';

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
}
