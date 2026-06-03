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
  String get a11yProgressLabel => 'Tiến độ';

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
  String get homeSyncAction => 'Đồng bộ ngay';

  @override
  String get homeSyncInProgress => 'Đang đồng bộ…';

  @override
  String homeSyncResultDone(int synced) {
    String _temp0 = intl.Intl.pluralLogic(
      synced,
      locale: localeName,
      other: 'Đã đồng bộ $synced review',
      one: 'Đã đồng bộ 1 review',
      zero: 'Không có review nào cần đồng bộ',
    );
    return '$_temp0';
  }

  @override
  String homeSyncResultPartial(int failed) {
    String _temp0 = intl.Intl.pluralLogic(
      failed,
      locale: localeName,
      other: 'Còn $failed review chưa đồng bộ. Sẽ thử lại sau.',
      one: 'Còn 1 review chưa đồng bộ. Sẽ thử lại sau.',
    );
    return '$_temp0';
  }

  @override
  String get homeSyncResultError =>
      'Không đồng bộ được. Kiểm tra kết nối và thử lại.';

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
  String get deckListEmptyTitle => 'Chưa có bộ thẻ';

  @override
  String get deckListEmpty => 'Chưa có bộ thẻ nào.';

  @override
  String get deckListErrorTitle => 'Không tải được';

  @override
  String get deckListError => 'Không tải được danh sách bộ thẻ.';

  @override
  String get reviewTitle => 'Ôn tập';

  @override
  String get reviewReveal => 'Hiện đáp án';

  @override
  String get reviewRevealHint => 'Tự nhớ lại trước, rồi chạm để xem đáp án.';

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
  String get reviewEmptyTitle => 'Bộ thẻ trống';

  @override
  String get reviewEmpty => 'Bộ thẻ này chưa có thẻ nào.';

  @override
  String get reviewErrorTitle => 'Không tải được';

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

  @override
  String get navHome => 'Trang chủ';

  @override
  String get navLearn => 'Học';

  @override
  String get navReview => 'Ôn tập';

  @override
  String get navProgress => 'Tiến độ';

  @override
  String get navSettings => 'Cài đặt';

  @override
  String get learnTitle => 'Học';

  @override
  String get learnPreviewBadge => 'Nội dung mẫu';

  @override
  String get learnPreviewNotice =>
      'Đây là nội dung học mẫu để xem trước. Bài học thật sẽ được kết nối sau.';

  @override
  String get learnDailyLessonTitle => 'Bài học hôm nay';

  @override
  String get learnDailyLessonCta => 'Học ngay';

  @override
  String get learnCategoriesTitle => 'Danh mục';

  @override
  String get learnLessonsTitle => 'Bài học';

  @override
  String learnLessonsInCategory(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count bài',
      one: '$count bài',
    );
    return '$_temp0';
  }

  @override
  String learnMinutes(int count) {
    return '$count phút';
  }

  @override
  String learnQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count câu hỏi',
      one: '$count câu hỏi',
    );
    return '$_temp0';
  }

  @override
  String get learnEmptyTitle => 'Chưa có bài học';

  @override
  String get learnEmptyBody => 'Bài học sẽ xuất hiện ở đây khi có sẵn.';

  @override
  String get learnErrorTitle => 'Không tải được bài học';

  @override
  String get learnErrorBody =>
      'Đã xảy ra lỗi khi tải nội dung học. Vui lòng thử lại.';

  @override
  String get levelFoundational => 'Cơ bản';

  @override
  String get levelPractical => 'Thực hành';

  @override
  String get levelAdvanced => 'Nâng cao';

  @override
  String get lessonDetailNotFound => 'Không tìm thấy bài học này.';

  @override
  String get lessonDetailContentTitle => 'Nội dung';

  @override
  String lessonPracticeCta(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Luyện tập ($count câu)',
      one: 'Luyện tập ($count câu)',
    );
    return '$_temp0';
  }

  @override
  String get practiceTitle => 'Luyện tập';

  @override
  String practiceProgress(int current, int total) {
    return 'Câu $current / $total';
  }

  @override
  String get practiceNext => 'Tiếp theo';

  @override
  String get practicePrevious => 'Quay lại';

  @override
  String get practiceFinish => 'Hoàn thành';

  @override
  String get practiceCompleteTitle => 'Hoàn thành bài luyện tập';

  @override
  String practiceScore(int correct, int total) {
    return 'Bạn trả lời đúng $correct/$total câu.';
  }

  @override
  String get practiceRestart => 'Làm lại';

  @override
  String get practiceBackToLesson => 'Về bài học';

  @override
  String get practiceReviewTitle => 'Xem lại đáp án';

  @override
  String practiceResultQuestionLabel(int position) {
    return 'Câu $position';
  }

  @override
  String get practiceResultCorrect => 'Đúng';

  @override
  String get practiceResultIncorrect => 'Sai';

  @override
  String get practiceCorrectAnswer => 'Đáp án đúng';

  @override
  String get practiceYourAnswer => 'Bạn đã chọn';

  @override
  String get practiceExplanationTitle => 'Giải thích';

  @override
  String get practiceEmptyTitle => 'Chưa có câu hỏi';

  @override
  String get practiceEmptyBody => 'Bài học này chưa có câu hỏi luyện tập.';

  @override
  String get practiceErrorTitle => 'Không tải được câu hỏi';

  @override
  String get practiceErrorBody =>
      'Đã xảy ra lỗi khi tải câu hỏi. Vui lòng thử lại.';

  @override
  String get reviewTabTitle => 'Ôn tập';

  @override
  String get reviewHubTitle => 'Ôn tập tất cả';

  @override
  String get reviewHubIntro =>
      'Củng cố những gì đã học. Chọn một cách ôn tập bên dưới.';

  @override
  String get reviewFlashcardsTitle => 'Flashcard';

  @override
  String reviewFlashcardsStat(int deckCount, int cardCount) {
    return '$deckCount bộ · $cardCount thẻ';
  }

  @override
  String get reviewFlashcardsEmpty => 'Chưa có bộ flashcard nào.';

  @override
  String get reviewFlashcardsCta => 'Ôn flashcard';

  @override
  String get reviewPracticeTitle => 'Luyện tập';

  @override
  String reviewPracticeStat(int count) {
    return '$count bài có câu hỏi luyện tập';
  }

  @override
  String get reviewPracticeEmpty => 'Chưa có bài luyện tập nào.';

  @override
  String get reviewPracticeCta => 'Chọn bài luyện tập';

  @override
  String get reviewSectionError => 'Không tải được nội dung. Vui lòng thử lại.';

  @override
  String get progressTitle => 'Tiến độ';

  @override
  String get progressIntro => 'Hoạt động học tập của bạn trên thiết bị này.';

  @override
  String get progressEmptyTitle => 'Chưa có hoạt động học tập';

  @override
  String get progressEmptyBody =>
      'Hoàn thành một phiên ôn flashcard để bắt đầu theo dõi tiến độ thật của bạn.';

  @override
  String get progressErrorTitle => 'Không tải được tiến độ';

  @override
  String get progressError =>
      'Đã xảy ra lỗi khi đọc dữ liệu học tập trên thiết bị.';

  @override
  String get progressTodayLabel => 'Hôm nay';

  @override
  String get progressStreakLabel => 'Chuỗi ngày học';

  @override
  String progressStreakValue(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days ngày',
      one: '1 ngày',
      zero: '0 ngày',
    );
    return '$_temp0';
  }

  @override
  String get progressWeekLabel => '7 ngày qua';

  @override
  String get progressTotalLabel => 'Tổng lượt ôn';

  @override
  String progressCardsValue(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count thẻ',
      one: '1 thẻ',
    );
    return '$_temp0';
  }

  @override
  String get progressActivityTitle => 'Hoạt động 7 ngày';

  @override
  String get progressRatingTitle => 'Phân loại đánh giá';

  @override
  String get offlineBannerMessage =>
      'Bạn đang ngoại tuyến. Một số nội dung có thể chưa cập nhật.';
}
