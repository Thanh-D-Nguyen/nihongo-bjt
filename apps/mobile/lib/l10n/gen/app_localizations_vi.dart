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
  String get commonUndo => 'Hoàn tác';

  @override
  String get a11yProgressLabel => 'Tiến độ';

  @override
  String get homeWelcome => 'ようこそ';

  @override
  String get homeGreetingMorning => 'Chào buổi sáng';

  @override
  String get homeGreetingAfternoon => 'Chào buổi chiều';

  @override
  String get homeGreetingEvening => 'Chào buổi tối';

  @override
  String get homeGreetingNight => 'Chào buổi đêm';

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
  String get homeHeroTitle => 'Bảng học hôm nay';

  @override
  String get homeHeroBody =>
      'Giữ nhịp học tiếng Nhật công sở với ôn tập, BJT và nội dung đọc thật.';

  @override
  String get homePrimaryReviewCta => 'Ôn tập ngay';

  @override
  String get homePrimaryLearnCta => 'Bắt đầu học';

  @override
  String get homeSecondaryExamCta => 'Vào BJT';

  @override
  String get homeTodaySectionTitle => 'Hôm nay';

  @override
  String get homeTodaySectionSubtitle =>
      'Một bước học rõ ràng, không cần đoán.';

  @override
  String get homeDailyLessonEyebrow => 'Bài học hôm nay';

  @override
  String get homePreviewBadge => 'Nội dung preview';

  @override
  String homeLessonMinutes(int minutes) {
    return '$minutes phút';
  }

  @override
  String homeLessonQuestions(int count) {
    return '$count câu luyện tập';
  }

  @override
  String get homeOpenLessonCta => 'Mở bài học';

  @override
  String get homeDailyLessonUnavailableTitle => 'Chưa tải được bài học hôm nay';

  @override
  String get homeDailyLessonUnavailableBody =>
      'Bạn vẫn có thể mở Learn để chọn bài học hiện có.';

  @override
  String get homeReviewSectionTitle => 'Ôn tập & tiến độ';

  @override
  String get homeReviewSectionSubtitle =>
      'Chỉ hiển thị số liệu app đang có nguồn thật.';

  @override
  String get homeFlashcardsUnavailableTitle => 'Không tải được thẻ ôn tập';

  @override
  String get homeFlashcardsUnavailableBody =>
      'Kiểm tra kết nối hoặc thử lại khi API cục bộ đã chạy.';

  @override
  String get homeProgressDeviceNote => 'Tiến độ trên thiết bị này';

  @override
  String get homeProgressEmptyMini => 'Chưa có lượt ôn thật nào được ghi nhận.';

  @override
  String get homeProgressUnavailable =>
      'Chưa đọc được tiến độ. Bạn vẫn có thể học và thử lại sau.';

  @override
  String get homeShortcutsCoreTitle => 'Lối vào chính';

  @override
  String get homeShortcutsLibraryTitle => 'Tra cứu & lưu lại';

  @override
  String get homeShortcutsContentTitle => 'Đọc & luyện tình huống';

  @override
  String get homeShortcutLearnBody => 'Bài học tiếng Nhật công sở';

  @override
  String get homeShortcutExamBody => 'Đề mô phỏng có tính giờ';

  @override
  String get homeShortcutReviewBody => 'Thẻ và chế độ ôn tập';

  @override
  String get homeShortcutProgressBody => 'Nhật ký học thật';

  @override
  String get homeShortcutDictionaryBody => 'Tra Nhật - Việt';

  @override
  String get homeShortcutSearchBody => 'Tìm trên toàn bộ nội dung';

  @override
  String get homeShortcutKanjiBody => 'Đọc, nghĩa, ví dụ';

  @override
  String get homeShortcutGrammarBody => 'Mẫu câu và cách dùng';

  @override
  String get homeShortcutSavedBody => 'Mục đã lưu để ôn lại';

  @override
  String get homeShortcutScenariosBody => 'Hội thoại công sở';

  @override
  String get homeShortcutNewsBody => 'NHK với từ vựng';

  @override
  String get homeShortcutMagazineBody => 'Bài đọc và quiz ngắn';

  @override
  String get homeShortcutCareerBody => 'Nhiệm vụ BJT công việc';

  @override
  String get homeShortcutRewardsBody => 'Chuỗi ngày và huy hiệu thật';

  @override
  String get homeShortcutSubscriptionBody => 'Gói và quyền lợi';

  @override
  String get loginSignInTitle => 'Đăng nhập để tiếp tục';

  @override
  String get loginSignInSubtitle =>
      'Đăng nhập bằng tài khoản KotobaWorks của bạn.';

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
      'Bằng cách tiếp tục, bạn đồng ý với điều khoản sử dụng và chính sách quyền riêng tư của KotobaWorks.';

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
  String get loginContinueWithGoogle => 'Tiếp tục với Google';

  @override
  String get loginNoAccountPrompt => 'Chưa có tài khoản?';

  @override
  String get loginRegisterAction => 'Đăng ký';

  @override
  String get loginRegisteredSuccess =>
      'Tạo tài khoản thành công. Hãy đăng nhập để bắt đầu.';

  @override
  String get registerTitle => 'Tạo tài khoản';

  @override
  String get registerSubtitle =>
      'Tạo tài khoản KotobaWorks để lưu tiến độ và đồng bộ trên mọi thiết bị.';

  @override
  String get registerDisplayNameLabel => 'Tên hiển thị';

  @override
  String get registerDisplayNameRequired => 'Vui lòng nhập tên hiển thị.';

  @override
  String get registerEmailLabel => 'Email';

  @override
  String get registerEmailRequired => 'Vui lòng nhập email.';

  @override
  String get registerEmailInvalid => 'Email không hợp lệ.';

  @override
  String get registerPasswordLabel => 'Mật khẩu';

  @override
  String get registerPasswordRequired => 'Vui lòng nhập mật khẩu.';

  @override
  String get registerPasswordTooShort => 'Mật khẩu cần ít nhất 8 ký tự.';

  @override
  String get registerConfirmPasswordLabel => 'Nhập lại mật khẩu';

  @override
  String get registerConfirmPasswordRequired => 'Vui lòng nhập lại mật khẩu.';

  @override
  String get registerPasswordMismatch => 'Mật khẩu nhập lại không khớp.';

  @override
  String get registerSubmitButton => 'Tạo tài khoản';

  @override
  String get registerHaveAccountPrompt => 'Đã có tài khoản?';

  @override
  String get registerSignInAction => 'Đăng nhập';

  @override
  String get registerTermsNotice =>
      'Bằng cách tạo tài khoản, bạn đồng ý với điều khoản sử dụng và chính sách quyền riêng tư của KotobaWorks.';

  @override
  String get registerGenericError =>
      'Không tạo được tài khoản. Vui lòng thử lại.';

  @override
  String get registerEmailTakenError => 'Email này đã được đăng ký.';

  @override
  String get registerInvalidEmailError => 'Email không hợp lệ.';

  @override
  String get registerInvalidPasswordError =>
      'Mật khẩu không đáp ứng yêu cầu bảo mật.';

  @override
  String get registerInvalidDisplayNameError => 'Tên hiển thị không hợp lệ.';

  @override
  String get registerUnavailableError =>
      'Tính năng đăng ký chưa được bật trên máy chủ. Vui lòng liên hệ quản trị viên.';

  @override
  String get registerNetworkError => 'Không kết nối được máy chủ đăng ký.';

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
  String get deckSearchHint => 'Tìm bộ thẻ';

  @override
  String get deckSearchClear => 'Xoá tìm kiếm';

  @override
  String get deckFilterAll => 'Tất cả';

  @override
  String get deckFilterPrivate => 'Riêng tư';

  @override
  String get deckFilterPublic => 'Công khai';

  @override
  String get deckVisibilityPublic => 'Công khai';

  @override
  String get deckSortLabel => 'Sắp xếp';

  @override
  String get deckSortRecent => 'Mới nhất';

  @override
  String get deckSortTitle => 'Theo tên';

  @override
  String get deckSortCards => 'Nhiều thẻ nhất';

  @override
  String get deckSearchEmptyTitle => 'Không có kết quả';

  @override
  String get deckSearchEmpty => 'Không tìm thấy bộ thẻ phù hợp.';

  @override
  String get flashcardDeckDetailTitle => 'Chi tiết bộ thẻ';

  @override
  String get deckDetailStudyCta => 'Học bộ thẻ';

  @override
  String get deckDetailCardsHeader => 'Thẻ trong bộ';

  @override
  String get deckDetailEmptyTitle => 'Chưa có thẻ';

  @override
  String get deckDetailEmpty => 'Bộ thẻ này chưa có thẻ nào.';

  @override
  String get deckDetailErrorTitle => 'Không tải được bộ thẻ';

  @override
  String get deckDetailError =>
      'Không tải được chi tiết bộ thẻ. Vui lòng thử lại.';

  @override
  String get commonCancel => 'Huỷ';

  @override
  String get deckCreateCta => 'Tạo bộ thẻ';

  @override
  String get deckListCreateFirst => 'Tạo bộ thẻ đầu tiên';

  @override
  String get deckCreateTitle => 'Tạo bộ thẻ';

  @override
  String get deckEditTitle => 'Sửa bộ thẻ';

  @override
  String get deckFormTitleViLabel => 'Tiêu đề tiếng Việt';

  @override
  String get deckFormTitleViHint => 'Nhập tên bộ thẻ';

  @override
  String get deckFormTitleJaLabel => 'Tiêu đề tiếng Nhật (tuỳ chọn)';

  @override
  String get deckFormDescriptionViLabel => 'Mô tả tiếng Việt (tuỳ chọn)';

  @override
  String get deckFormDescriptionJaLabel => 'Mô tả tiếng Nhật (tuỳ chọn)';

  @override
  String get deckFormVisibilityLabel => 'Hiển thị';

  @override
  String get deckFormVisibilityPrivate => 'Riêng tư';

  @override
  String get deckFormVisibilityPublic => 'Công khai';

  @override
  String get deckFormSaveCreate => 'Tạo bộ thẻ';

  @override
  String get deckFormSaveUpdate => 'Lưu thay đổi';

  @override
  String get deckFormTitleRequired => 'Vui lòng nhập tiêu đề.';

  @override
  String deckFormTitleTooLong(int max) {
    return 'Tiêu đề tối đa $max ký tự.';
  }

  @override
  String deckFormDescriptionTooLong(int max) {
    return 'Mô tả tối đa $max ký tự.';
  }

  @override
  String get deckFormErrorGeneric => 'Không lưu được bộ thẻ. Vui lòng thử lại.';

  @override
  String get deckSaveSuccess => 'Đã lưu bộ thẻ.';

  @override
  String get deckDetailEditAction => 'Sửa';

  @override
  String get deckDetailArchiveAction => 'Lưu trữ';

  @override
  String get deckArchiveConfirmTitle => 'Lưu trữ bộ thẻ?';

  @override
  String get deckArchiveConfirmMessage =>
      'Bộ thẻ sẽ được gỡ khỏi thư viện đang hoạt động.';

  @override
  String get deckArchiveConfirmCta => 'Lưu trữ';

  @override
  String get deckArchiveSuccess => 'Đã lưu trữ bộ thẻ.';

  @override
  String get cardCreateTitle => 'Thêm thẻ';

  @override
  String get cardEditTitle => 'Sửa thẻ';

  @override
  String get cardAddAction => 'Thêm thẻ';

  @override
  String get cardDeleteAction => 'Xóa thẻ';

  @override
  String get cardNotFound =>
      'Không tìm thấy thẻ này. Có thể nó đã bị thay đổi.';

  @override
  String get cardFormFrontLabel => 'Mặt trước (tiếng Nhật)';

  @override
  String get cardFormFrontHint => 'Ví dụ: 会議';

  @override
  String get cardFormReadingLabel => 'Cách đọc (tùy chọn)';

  @override
  String get cardFormReadingHint => 'Ví dụ: かいぎ';

  @override
  String get cardFormBackLabel => 'Mặt sau (nghĩa)';

  @override
  String get cardFormBackHint => 'Ví dụ: cuộc họp';

  @override
  String get cardFormSaveCreate => 'Thêm thẻ';

  @override
  String get cardFormSaveUpdate => 'Lưu thay đổi';

  @override
  String get cardFrontRequired => 'Vui lòng nhập mặt trước.';

  @override
  String get cardBackRequired => 'Vui lòng nhập mặt sau.';

  @override
  String cardFieldTooLong(int max) {
    return 'Tối đa $max ký tự.';
  }

  @override
  String cardLimitReached(int max) {
    return 'Bộ thẻ đã đạt giới hạn $max thẻ.';
  }

  @override
  String get cardSaveSuccess => 'Đã lưu thẻ.';

  @override
  String get cardBulkAddRow => 'Thêm hàng';

  @override
  String get cardBulkShowReading => 'Hiện cách đọc';

  @override
  String get cardBulkRemoveRow => 'Xóa hàng';

  @override
  String cardBulkRowTitle(int number) {
    return 'Thẻ $number';
  }

  @override
  String get cardBulkSaveAll => 'Lưu tất cả';

  @override
  String get cardBulkEmptyWarning => 'Hãy nhập ít nhất một thẻ.';

  @override
  String cardBulkSaveSuccess(int count) {
    return 'Đã thêm $count thẻ.';
  }

  @override
  String get cardSetCreateTitle => 'Tạo bộ thẻ mới';

  @override
  String get cardSetCardsHeader => 'Thẻ';

  @override
  String cardSetCardCount(int count, int max) {
    return '$count/$max';
  }

  @override
  String get cardSetMoreDetails => 'Thêm chi tiết';

  @override
  String get cardSetAddCard => 'Thêm thẻ';

  @override
  String get cardSetImport => 'Nhập từ văn bản';

  @override
  String get cardSetCreate => 'Tạo bộ thẻ';

  @override
  String cardSetCreateSuccess(int count) {
    return 'Đã tạo bộ thẻ với $count thẻ.';
  }

  @override
  String cardSetValidationSummary(int count) {
    return 'Còn $count lỗi cần sửa trước khi tạo.';
  }

  @override
  String get cardSetNeedCard => 'Hãy thêm ít nhất một thẻ.';

  @override
  String get cardSetDiscardTitle => 'Bỏ bộ thẻ này?';

  @override
  String get cardSetDiscardMessage => 'Các thay đổi chưa lưu sẽ bị mất.';

  @override
  String get cardSetDiscardConfirm => 'Bỏ';

  @override
  String get cardSetKeepEditing => 'Tiếp tục sửa';

  @override
  String get importSheetTitle => 'Nhập thẻ từ văn bản';

  @override
  String get importSheetHint =>
      'Dán mỗi thẻ trên một dòng. Ngăn cách mặt trước và mặt sau bằng Tab, dấu |, dấu phẩy hoặc \" - \".';

  @override
  String get importSheetInputLabel => 'Dán nội dung';

  @override
  String get importSheetReadingColumn => 'Cột thứ ba là cách đọc';

  @override
  String get importSheetPreviewTitle => 'Xem trước';

  @override
  String importSheetValidCount(int count) {
    return '$count thẻ hợp lệ';
  }

  @override
  String importSheetErrorCount(int count) {
    return '$count dòng có lỗi';
  }

  @override
  String importSheetTooMany(int max) {
    return 'Tối đa $max thẻ. Các dòng vượt quá sẽ bị bỏ qua.';
  }

  @override
  String get importSheetEmpty => 'Chưa có nội dung để xem trước.';

  @override
  String get importSheetReplace => 'Thay thế';

  @override
  String get importSheetAppend => 'Thêm vào';

  @override
  String get importRowMissingFront => 'Thiếu mặt trước';

  @override
  String get importRowMissingBack => 'Thiếu mặt sau';

  @override
  String get importRowFrontTooLong => 'Mặt trước quá dài';

  @override
  String get importRowBackTooLong => 'Mặt sau quá dài';

  @override
  String get importRowReadingTooLong => 'Cách đọc quá dài';

  @override
  String get cardDeleteSuccess => 'Đã xóa thẻ.';

  @override
  String get cardDeleteConfirmTitle => 'Xóa thẻ này?';

  @override
  String get cardDeleteConfirmMessage => 'Thao tác này không thể hoàn tác.';

  @override
  String get cardDeleteConfirmCta => 'Xóa';

  @override
  String get cardSearchHint => 'Tìm thẻ…';

  @override
  String get cardSortPosition => 'Thứ tự';

  @override
  String get cardSortAlphabetical => 'A–Z';

  @override
  String get cardSearchEmptyTitle => 'Không có thẻ phù hợp';

  @override
  String get cardSearchEmptyMessage => 'Thử từ khóa khác.';

  @override
  String cardSearchResultCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count thẻ',
      one: '1 thẻ',
    );
    return '$_temp0';
  }

  @override
  String get reviewTitle => 'Ôn tập';

  @override
  String get reviewReveal => 'Hiện đáp án';

  @override
  String get reviewRevealHint => 'Tự nhớ lại trước, rồi chạm để xem đáp án.';

  @override
  String get reviewTypePrompt => 'Nhập nghĩa hoặc cách đọc';

  @override
  String get reviewTypePlaceholder => 'Câu trả lời của bạn…';

  @override
  String get reviewTypeSubmit => 'Kiểm tra';

  @override
  String get reviewTypeContinue => 'Tiếp tục';

  @override
  String get reviewTypeCorrect => 'Chính xác';

  @override
  String get reviewTypeAlmost => 'Gần đúng';

  @override
  String get reviewTypeWrong => 'Chưa đúng';

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
  String get profileHeroEyebrow => 'Tài khoản KotobaWorks';

  @override
  String get profileSessionStatus => 'Phiên đăng nhập đang hoạt động';

  @override
  String get profileAccountSection => 'Tài khoản';

  @override
  String get profileAccountDetailsTitle => 'Thông tin đăng nhập';

  @override
  String get profileDisplayName => 'Tên hiển thị';

  @override
  String get profileUsername => 'Tên đăng nhập';

  @override
  String get profileEmail => 'Email';

  @override
  String get profileIdentityUnavailableTitle => 'Chưa đọc được chi tiết hồ sơ';

  @override
  String get profileIdentityUnavailableBody =>
      'Ứng dụng chỉ hiển thị thông tin có thật trong phiên đăng nhập hiện tại. Hãy đăng nhập lại nếu thông tin hồ sơ vẫn trống.';

  @override
  String get profileIdentityPrivacy =>
      'Chỉ hiển thị claim hồ sơ từ phiên Keycloak hiện tại; không lưu mật khẩu hay token thô trên màn hình này.';

  @override
  String get profileActionsSection => 'Lối tắt';

  @override
  String get profileProgressAction => 'Tiến độ học';

  @override
  String get profileProgressSubtitle => 'Xem thống kê và lịch sử học';

  @override
  String get profileSavedAction => 'Mục đã lưu';

  @override
  String get profileSavedSubtitle => 'Từ vựng, bài đọc và nội dung đã đánh dấu';

  @override
  String get profilePlanFree => 'Gói miễn phí';

  @override
  String get profileSnapshotTitle => 'Tổng quan học tập';

  @override
  String get profileSnapshotStreak => 'Chuỗi ngày';

  @override
  String get profileSnapshotToday => 'Hôm nay';

  @override
  String get profileSnapshotWeek => '7 ngày qua';

  @override
  String get profileSnapshotTotal => 'Tổng lượt ôn';

  @override
  String get profileSnapshotEmptyTitle => 'Chưa có dữ liệu học';

  @override
  String get profileSnapshotEmptyBody =>
      'Hãy hoàn thành một phiên ôn tập để thấy tiến độ thật ở đây.';

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
  String get profileThemeTitle => 'Giao diện';

  @override
  String get profileThemeSystem => 'Theo thiết bị';

  @override
  String get profileThemeLight => 'Sáng';

  @override
  String get profileThemeDark => 'Tối';

  @override
  String get profileFuriganaTitle => 'Hiển thị furigana';

  @override
  String get profileFuriganaSubtitle =>
      'Hiện cách đọc kana phía trên kanji (trừ khi đang ôn tập).';

  @override
  String get profileHapticsTitle => 'Phản hồi rung';

  @override
  String get profileHapticsSubtitle =>
      'Rung nhẹ khi chọn đáp án, lật thẻ và hoàn thành phiên học.';

  @override
  String get profileSignOut => 'Đăng xuất';

  @override
  String get profileSigningOut => 'Đang đăng xuất…';

  @override
  String get profileSaveError => 'Không lưu được thay đổi. Vui lòng thử lại.';

  @override
  String get profileAboutSection => 'Giới thiệu';

  @override
  String get profileAppVersion => 'Phiên bản ứng dụng';

  @override
  String profileVersionValue(String version, String build) {
    return '$version (bản dựng $build)';
  }

  @override
  String get navHome => 'Trang chủ';

  @override
  String get navLearn => 'Học';

  @override
  String get navReview => 'Ôn tập';

  @override
  String get navSearch => 'Tra cứu';

  @override
  String get navMe => 'Cá nhân';

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
  String get lessonNavTitle => 'Bài học khác';

  @override
  String get lessonNavPrevious => 'Bài trước';

  @override
  String get lessonNavNext => 'Bài tiếp';

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
  String get reviewDueTitle => 'Đến hạn hôm nay';

  @override
  String reviewDueStat(int count) {
    return '$count thẻ cần ôn ngay';
  }

  @override
  String get reviewDueEmpty => 'Bạn đã ôn xong các thẻ đến hạn.';

  @override
  String get reviewDueCta => 'Ôn ngay';

  @override
  String get progressTitle => 'Tiến độ';

  @override
  String get progressIntro => 'Hoạt động học tập của bạn trên thiết bị này.';

  @override
  String get progressCoachingTitle => 'Bước gợi ý tiếp theo';

  @override
  String get progressCoachingCtaFlashcards => 'Ôn thẻ đến hạn';

  @override
  String get progressCoachingCtaQuiz => 'Luyện BJT ngắn';

  @override
  String progressCoachingHintFlashcardsDue(int n) {
    return '$n thẻ đang đến hạn — ưu tiên giữ nhịp SRS.';
  }

  @override
  String get progressCoachingHintQuizSkills =>
      'Có kỹ năng cần củng cố — luyện theo dạng đề giúp ổn định.';

  @override
  String get progressCoachingHintQuizAccuracy =>
      'Độ chính xác còn dư địa — thêm vài câu BJT sẽ rõ tiến bộ.';

  @override
  String get progressCoachingHintMaintain =>
      'Giữ đà nhẹ: vài phút ôn hoặc một set BJT ngắn.';

  @override
  String get progressCoachingNudgeTitle => 'Động viên nhẹ';

  @override
  String get progressCoachingInsightTitle => 'Gợi ý';

  @override
  String progressCoachingNudgeDue(int n) {
    return '$n thẻ đang chờ — mỗi phiên ngắn đều có giá trị.';
  }

  @override
  String get progressCoachingNudgeWeak =>
      'Đã xác định vài kỹ năng cần chú ý — luyện đều sẽ dễ hơn.';

  @override
  String progressCoachingNudgeStreak(int n) {
    return 'Chuỗi $n ngày đang chạy — đều đặn quan trọng hơn tốc độ.';
  }

  @override
  String get progressCoachingNudgeCalm =>
      'Không cần vội — chọn một hoạt động ngắn phù hợp hôm nay.';

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

  @override
  String get learnReferenceTitle => 'Tra cứu';

  @override
  String get learnDictionaryLabel => 'Từ điển';

  @override
  String get learnKanjiLabel => 'Kanji';

  @override
  String get learnGrammarLabel => 'Ngữ pháp';

  @override
  String get contentExamplesTitle => 'Ví dụ';

  @override
  String get dictionaryTitle => 'Từ điển';

  @override
  String get dictionarySearchHint => 'Tìm từ tiếng Nhật hoặc nghĩa tiếng Việt';

  @override
  String get dictionaryIdleTitle => 'Tra từ điển Nhật–Việt';

  @override
  String get dictionaryIdleBody =>
      'Nhập kanji, kana hoặc nghĩa tiếng Việt để bắt đầu.';

  @override
  String get dictionaryEmptyTitle => 'Không tìm thấy từ';

  @override
  String get dictionaryEmptyBody => 'Thử từ khóa khác hoặc kiểm tra chính tả.';

  @override
  String get dictionaryErrorTitle => 'Không tải được kết quả';

  @override
  String get dictionaryErrorBody => 'Đã có lỗi khi tìm kiếm. Vui lòng thử lại.';

  @override
  String get dictionarySensesTitle => 'Nghĩa';

  @override
  String get kanjiTitle => 'Kanji';

  @override
  String get kanjiSearchHint => 'Tìm kanji theo chữ, âm đọc hoặc cấp độ';

  @override
  String get kanjiEmptyTitle => 'Không có kanji phù hợp';

  @override
  String get kanjiEmptyBody => 'Thử chữ khác hoặc một cấp độ khác.';

  @override
  String get kanjiErrorTitle => 'Không tải được Kanji';

  @override
  String get kanjiErrorBody => 'Đã có lỗi khi tải dữ liệu. Vui lòng thử lại.';

  @override
  String get kanjiOnyomiLabel => 'Âm On';

  @override
  String get kanjiKunyomiLabel => 'Âm Kun';

  @override
  String get kanjiMeaningLabel => 'Nghĩa';

  @override
  String kanjiStrokesLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count nét',
    );
    return '$_temp0';
  }

  @override
  String kanjiFrequencyLabel(int rank) {
    return 'Tần suất #$rank';
  }

  @override
  String get kanjiStrokeOrderTitle => 'Thứ tự nét';

  @override
  String get kanjiComponentsTitle => 'Bộ thủ & thành phần';

  @override
  String get kanjiExamplesTitle => 'Từ ví dụ';

  @override
  String get grammarTitle => 'Ngữ pháp';

  @override
  String get grammarSearchHint => 'Tìm mẫu ngữ pháp hoặc cấp độ';

  @override
  String get grammarEmptyTitle => 'Không tìm thấy mẫu ngữ pháp';

  @override
  String get grammarEmptyBody => 'Thử từ khóa khác.';

  @override
  String get grammarErrorTitle => 'Không tải được ngữ pháp';

  @override
  String get grammarErrorBody => 'Đã có lỗi khi tải dữ liệu. Vui lòng thử lại.';

  @override
  String get grammarExplanationLabel => 'Giải thích';

  @override
  String get grammarNoteLabel => 'Lưu ý';

  @override
  String get scenariosTitle => 'Tình huống công việc';

  @override
  String get scenariosSubtitle =>
      'Luyện giao tiếp công sở qua các tình huống thực tế.';

  @override
  String get scenariosEmptyTitle => 'Chưa có tình huống';

  @override
  String get scenariosEmptyBody => 'Hãy quay lại sau nhé.';

  @override
  String get scenariosErrorTitle => 'Không tải được tình huống';

  @override
  String get scenariosErrorBody =>
      'Đã có lỗi khi tải dữ liệu. Vui lòng thử lại.';

  @override
  String get scenariosAllCategories => 'Tất cả';

  @override
  String scenarioStepLabel(int current, int total) {
    return 'Bước $current/$total';
  }

  @override
  String scenarioEstimatedMinutes(int minutes) {
    return '$minutes phút';
  }

  @override
  String scenarioStepCount(int count) {
    return '$count bước';
  }

  @override
  String scenarioAttemptCount(int count) {
    return '$count lượt chơi';
  }

  @override
  String get scenarioStartCta => 'Bắt đầu';

  @override
  String get scenarioContinueCta => 'Tiếp tục';

  @override
  String get scenarioFinishCta => 'Hoàn thành';

  @override
  String get scenarioOptimalBadge => 'Lựa chọn tối ưu';

  @override
  String get scenarioSuboptimalBadge => 'Có thể tốt hơn';

  @override
  String scenarioPointsAwarded(int points) {
    return '+$points điểm';
  }

  @override
  String get scenarioResultTitle => 'Kết quả tình huống';

  @override
  String scenarioResultScore(int total, int max) {
    return '$total/$max điểm';
  }

  @override
  String get scenarioResultDone => 'Xong';

  @override
  String get scenarioRetryCta => 'Làm lại';

  @override
  String get examTitle => 'Thi thử BJT';

  @override
  String get examSubtitle => 'Làm bài thi thử có tính giờ và chấm điểm.';

  @override
  String get examEmptyTitle => 'Chưa có đề thi';

  @override
  String get examEmptyBody => 'Hãy quay lại sau nhé.';

  @override
  String get examErrorTitle => 'Không tải được đề thi';

  @override
  String get examErrorBody => 'Đã có lỗi khi tải dữ liệu. Vui lòng thử lại.';

  @override
  String examQuestionCount(int count) {
    return '$count câu hỏi';
  }

  @override
  String get examStartCta => 'Bắt đầu thi';

  @override
  String examProgressLabel(int current, int total) {
    return 'Câu $current/$total';
  }

  @override
  String get examSubmitCta => 'Trả lời';

  @override
  String get examAudioUnavailable =>
      'Câu hỏi nghe — phần phát âm thanh chưa có trên di động. Hãy đọc nội dung bên dưới để trả lời.';

  @override
  String get examNextCta => 'Câu tiếp theo';

  @override
  String get examTimeUpTitle => 'Hết giờ';

  @override
  String get examTimeUpBody => 'Bài thi đã kết thúc. Xem kết quả của bạn.';

  @override
  String get examResultTitle => 'Kết quả thi thử';

  @override
  String examResultScore(int correct, int total) {
    return '$correct/$total câu đúng';
  }

  @override
  String examResultBand(String band) {
    return 'Mức BJT ước tính: $band';
  }

  @override
  String get examResultDone => 'Xong';

  @override
  String get examUpgradeRequiredTitle => 'Cần nâng cấp';

  @override
  String get examUpgradeRequiredBody =>
      'Gói hiện tại của bạn chưa bao gồm bài thi này.';

  @override
  String get examReviewCta => 'Xem lại bài làm';

  @override
  String get examReviewTitle => 'Xem lại bài làm';

  @override
  String examReviewScore(int correct, int total) {
    return 'Đúng $correct/$total câu';
  }

  @override
  String get examReviewFilterAll => 'Tất cả';

  @override
  String get examReviewFilterWrong => 'Sai';

  @override
  String get examReviewFilterCorrect => 'Đúng';

  @override
  String examReviewQuestionLabel(int position) {
    return 'Câu $position';
  }

  @override
  String get examReviewCorrect => 'Đúng';

  @override
  String get examReviewIncorrect => 'Chưa đúng';

  @override
  String examReviewYourAnswer(String option) {
    return 'Bạn chọn: $option';
  }

  @override
  String get examReviewExplanationTitle => 'Giải thích';

  @override
  String get examReviewEmptyFilter => 'Không có câu nào trong mục này.';

  @override
  String get examReviewErrorTitle => 'Không tải được phần xem lại';

  @override
  String get examReviewErrorBody => 'Kiểm tra kết nối và thử lại.';

  @override
  String get examRemediationTitle => 'Lưu câu sai để ôn lại';

  @override
  String examRemediationBody(int count) {
    return '$count câu sai có giải thích. Tạo bộ thẻ flashcard để ôn lại.';
  }

  @override
  String get examRemediationCta => 'Tạo bộ thẻ ôn tập';

  @override
  String examRemediationSuccess(int count) {
    return 'Đã tạo bộ thẻ với $count thẻ.';
  }

  @override
  String get examRemediationOpenDeck => 'Mở bộ thẻ';

  @override
  String get examRemediationError => 'Không tạo được bộ thẻ. Thử lại.';

  @override
  String examRemediationDeckTitle(String test) {
    return 'Ôn lỗi: $test';
  }

  @override
  String get examRemediationDeckTitleFallback => 'Ôn lỗi bài thi BJT';

  @override
  String get newsTitle => 'Tin tức NHK';

  @override
  String get newsSubtitle =>
      'Đọc tin thật bằng tiếng Nhật, kèm từ vựng và phụ đề.';

  @override
  String get newsFilterAll => 'Tất cả';

  @override
  String get newsFilterEasy => 'NHK Easy';

  @override
  String get newsFilterNormal => 'NHK';

  @override
  String get newsEmptyTitle => 'Chưa có bài viết';

  @override
  String get newsEmptyBody => 'Hãy quay lại sau để đọc tin mới từ NHK.';

  @override
  String get newsErrorTitle => 'Không tải được tin tức';

  @override
  String get newsErrorBody => 'Kiểm tra kết nối mạng rồi thử lại.';

  @override
  String get newsVocabularyTitle => 'Từ vựng';

  @override
  String get newsVocabularyEmpty => 'Bài viết này chưa có danh sách từ vựng.';

  @override
  String get newsBookmarkAdd => 'Lưu bài';

  @override
  String get newsBookmarkRemove => 'Bỏ lưu';

  @override
  String get commonSignInRequired => 'Hãy đăng nhập để dùng tính năng này.';

  @override
  String get magazineTitle => 'Tạp chí';

  @override
  String get magazineSubtitle => 'Bài đọc hằng ngày kèm từ vựng và quiz.';

  @override
  String get magazineFilterAll => 'Tất cả';

  @override
  String get magazineFilterVocab => 'Từ vựng';

  @override
  String get magazineFilterWeather => 'Thời tiết';

  @override
  String get magazineFilterHoroscope => 'Tử vi';

  @override
  String get magazineFilterBjt => 'BJT';

  @override
  String get magazineEmptyTitle => 'Chưa có bài viết';

  @override
  String get magazineEmptyBody => 'Hãy quay lại sau để đọc bài mới.';

  @override
  String get magazineErrorTitle => 'Không tải được tạp chí';

  @override
  String get magazineErrorBody => 'Đã xảy ra lỗi. Vui lòng thử lại.';

  @override
  String get magazineVocabularyTitle => 'Từ vựng';

  @override
  String get magazineQuizTitle => 'Quiz nhanh';

  @override
  String magazineQuizProgress(int current, int total) {
    return 'Câu $current/$total';
  }

  @override
  String get careerTitle => 'Sự nghiệp';

  @override
  String get careerSubtitle => 'Lên cấp kỹ năng công sở qua các nhiệm vụ BJT.';

  @override
  String get careerRankEyebrow => 'Cấp bậc hiện tại';

  @override
  String careerXpProgress(int current, int total, String nextRank) {
    return '$current/$total XP đến $nextRank';
  }

  @override
  String get careerRankMax => 'Bạn đã đạt cấp bậc cao nhất.';

  @override
  String careerStreakDays(int days) {
    return 'Chuỗi $days ngày';
  }

  @override
  String get careerStreakSubtitle => 'Điểm danh mỗi ngày để giữ chuỗi.';

  @override
  String get careerClockIn => 'Điểm danh hôm nay';

  @override
  String get careerClockInDone => 'Đã điểm danh hôm nay.';

  @override
  String get careerSkillsTitle => 'Kỹ năng';

  @override
  String get careerSkillsEmpty => 'Chưa có dữ liệu kỹ năng.';

  @override
  String get careerAxisKeigo => 'Kính ngữ';

  @override
  String get careerAxisWritten => 'Văn viết';

  @override
  String get careerAxisMeeting => 'Họp hành';

  @override
  String get careerAxisCustomer => 'Khách hàng';

  @override
  String get careerAxisChart => 'Biểu đồ';

  @override
  String get careerAxisNuance => 'Sắc thái';

  @override
  String get careerRelationsTitle => 'Quan hệ đồng nghiệp';

  @override
  String get careerArcsTitle => 'Tuyến nhiệm vụ';

  @override
  String get careerArcsSubtitle =>
      'Chọn một tuyến để bắt đầu hành trình công sở.';

  @override
  String get careerArcsEmptyTitle => 'Chưa có tuyến nhiệm vụ';

  @override
  String get careerArcsEmptyBody =>
      'Hãy quay lại sau khi mở khoá tuyến đầu tiên.';

  @override
  String careerArcLocked(String rank) {
    return 'Mở khoá ở cấp $rank';
  }

  @override
  String careerArcRankRequired(String rank) {
    return 'Yêu cầu rank $rank';
  }

  @override
  String careerArcProgress(int completed, int total) {
    return '$completed/$total chương';
  }

  @override
  String get careerStatusLocked => 'Khoá';

  @override
  String get careerStatusActive => 'Đang mở';

  @override
  String get careerStatusCompleted => 'Hoàn thành';

  @override
  String get careerChaptersTitle => 'Các chương';

  @override
  String careerChapterMinutes(int minutes) {
    return '$minutes phút';
  }

  @override
  String get careerChapterStart => 'Bắt đầu';

  @override
  String get careerChapterRole => 'Vai trò của bạn';

  @override
  String get careerChapterComplete => 'Hoàn thành chương';

  @override
  String get careerChapterCompleteTitle => 'Hoàn thành chương!';

  @override
  String careerScenarioProgress(int current, int total) {
    return 'Tình huống $current/$total';
  }

  @override
  String get careerScenarioGoal => 'Mục tiêu';

  @override
  String get careerOutcomeGood => 'Lựa chọn tốt';

  @override
  String get careerOutcomeRisk => 'Có rủi ro';

  @override
  String careerXpEarned(int xp) {
    return '+$xp XP';
  }

  @override
  String careerRankUp(String rank) {
    return 'Thăng cấp: $rank';
  }

  @override
  String get careerBackToArcs => 'Quay lại tuyến nhiệm vụ';

  @override
  String get careerContinue => 'Tiếp tục';

  @override
  String get careerErrorTitle => 'Không tải được dữ liệu';

  @override
  String get careerErrorBody => 'Đã có lỗi xảy ra. Vui lòng thử lại.';

  @override
  String get learnLibraryTitle => 'Thư viện';

  @override
  String get searchTitle => 'Tìm kiếm';

  @override
  String get searchSubtitle => 'Tra từ vựng, kanji và ngữ pháp';

  @override
  String get searchHint => 'Tìm từ vựng, kanji, ngữ pháp…';

  @override
  String get searchIdleTitle => 'Bắt đầu tìm kiếm';

  @override
  String get searchIdleBody =>
      'Nhập một từ tiếng Nhật hoặc tiếng Việt để tra cứu trên toàn bộ nội dung.';

  @override
  String get searchEmptyTitle => 'Không có kết quả';

  @override
  String get searchEmptyBody => 'Thử từ khóa khác hoặc kiểm tra lại chính tả.';

  @override
  String get searchErrorTitle => 'Không tìm kiếm được';

  @override
  String get searchErrorBody => 'Đã có lỗi xảy ra. Vui lòng thử lại.';

  @override
  String get searchKindWord => 'Từ vựng';

  @override
  String get searchKindKanji => 'Kanji';

  @override
  String get searchKindGrammar => 'Ngữ pháp';

  @override
  String get searchKindExample => 'Ví dụ';

  @override
  String get searchKindOther => 'Khác';

  @override
  String get searchToolsTitle => 'Công cụ tra cứu';

  @override
  String get searchToolDictionarySubtitle => 'Tra từ Nhật–Việt';

  @override
  String get searchToolKanjiSubtitle => 'Tra kanji theo chữ và âm đọc';

  @override
  String get searchToolGrammarSubtitle => 'Tra mẫu ngữ pháp';

  @override
  String get searchRecentTitle => 'Tìm kiếm gần đây';

  @override
  String get searchRecentClear => 'Xóa hết';

  @override
  String get searchRecentRemoveTooltip => 'Xóa khỏi lịch sử';

  @override
  String get searchFilterAll => 'Tất cả';

  @override
  String get savedBookmarkAdd => 'Lưu';

  @override
  String get savedBookmarkRemove => 'Bỏ lưu';

  @override
  String get savedBookmarkSignIn => 'Đăng nhập để lưu mục này.';

  @override
  String get savedBookmarkError => 'Không lưu được. Vui lòng thử lại.';

  @override
  String get savedRemoveTooltip => 'Xóa khỏi mục đã lưu';

  @override
  String get savedRemovedToast => 'Đã xóa khỏi mục đã lưu';

  @override
  String savedSavedOn(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat.yMMMd(localeName);
    final String dateString = dateDateFormat.format(date);

    return 'Đã lưu: $dateString';
  }

  @override
  String get savedTitle => 'Đã lưu';

  @override
  String get savedSubtitle => 'Từ vựng, kanji và ngữ pháp bạn đã lưu';

  @override
  String get savedTabWords => 'Từ vựng';

  @override
  String get savedTabKanji => 'Kanji';

  @override
  String get savedTabGrammar => 'Ngữ pháp';

  @override
  String get savedEmptyTitle => 'Chưa có mục đã lưu';

  @override
  String get savedEmptyWords => 'Lưu từ vựng khi tra cứu để ôn lại sau.';

  @override
  String get savedEmptyKanji => 'Lưu kanji khi học để ôn lại sau.';

  @override
  String get savedEmptyGrammar => 'Lưu mẫu ngữ pháp khi học để ôn lại sau.';

  @override
  String get savedSignInTitle => 'Cần đăng nhập';

  @override
  String get savedSignInBody => 'Đăng nhập để xem và đồng bộ các mục đã lưu.';

  @override
  String get savedErrorTitle => 'Không tải được mục đã lưu';

  @override
  String get savedErrorBody => 'Đã có lỗi xảy ra. Vui lòng thử lại.';

  @override
  String get rewardsTitle => 'Thành tựu & Phần thưởng';

  @override
  String get rewardsSubtitle =>
      'Chuỗi ngày, huy hiệu và bảng xếp hạng của bạn.';

  @override
  String get rewardsTabStreaks => 'Chuỗi ngày';

  @override
  String get rewardsTabAchievements => 'Huy hiệu';

  @override
  String get rewardsTabLeaderboards => 'Xếp hạng';

  @override
  String get rewardsErrorTitle => 'Không tải được phần thưởng';

  @override
  String get rewardsErrorBody => 'Đã có lỗi xảy ra. Vui lòng thử lại.';

  @override
  String get rewardsSignInTitle => 'Đăng nhập để xem phần thưởng';

  @override
  String get rewardsSignInBody =>
      'Đăng nhập để theo dõi chuỗi ngày, huy hiệu và thứ hạng của bạn.';

  @override
  String get rewardsStreaksEmptyTitle => 'Chưa có chuỗi ngày nào';

  @override
  String get rewardsStreaksEmptyBody =>
      'Học mỗi ngày để bắt đầu chuỗi ngày đầu tiên.';

  @override
  String get rewardsStreakDefaultName => 'Chuỗi ngày học';

  @override
  String rewardsStreakCurrent(int days) {
    return 'Chuỗi hiện tại: $days ngày';
  }

  @override
  String get rewardsStreakLongest => 'Dài nhất';

  @override
  String get rewardsStreakFreezes => 'Lượt giữ chuỗi';

  @override
  String rewardsStreakDays(int days) {
    return '$days ngày';
  }

  @override
  String get rewardsStreakCalendar => 'Lịch học tập';

  @override
  String rewardsAchievementTierLabel(String tier) {
    String _temp0 = intl.Intl.selectLogic(
      tier,
      {
        'bronze': 'Đồng',
        'silver': 'Bạc',
        'gold': 'Vàng',
        'platinum': 'Bạch Kim',
        'other': '$tier',
      },
    );
    return '$_temp0';
  }

  @override
  String rewardsAchievementCategoryLabel(String category) {
    String _temp0 = intl.Intl.selectLogic(
      category,
      {
        'learning': 'Học tập',
        'social': 'Xã hội',
        'streak': 'Chuỗi ngày',
        'mastery': 'Thành thạo',
        'battle': 'Đối kháng',
        'other': '$category',
      },
    );
    return '$_temp0';
  }

  @override
  String get rewardsAchievementsEmptyTitle => 'Chưa có huy hiệu';

  @override
  String get rewardsAchievementsEmptyBody =>
      'Hoàn thành mục tiêu học tập để mở khóa huy hiệu.';

  @override
  String rewardsAchievementTiers(int earned, int total) {
    return '$earned/$total';
  }

  @override
  String rewardsAchievementProgress(int current, int target) {
    return '$current/$target';
  }

  @override
  String get rewardsLeaderboardsEmptyTitle => 'Chưa có bảng xếp hạng';

  @override
  String get rewardsLeaderboardsEmptyBody =>
      'Hiện chưa có bảng xếp hạng nào đang mở.';

  @override
  String get rewardsLeaderboardEmptyTitle => 'Chưa có thứ hạng';

  @override
  String get rewardsLeaderboardEmptyBody =>
      'Hãy là người đầu tiên ghi điểm trên bảng này.';

  @override
  String get rewardsLeaderboardAnonymous => 'Người học ẩn danh';

  @override
  String rewardsLeaderboardUserFallback(String id) {
    return 'Người dùng $id';
  }

  @override
  String rewardsLeaderboardScore(int score) {
    return '$score đ';
  }

  @override
  String get subscriptionTitle => 'Gói đăng ký';

  @override
  String get subscriptionSubtitle => 'Quản lý gói và quyền lợi của bạn';

  @override
  String get subscriptionErrorTitle => 'Không tải được gói đăng ký';

  @override
  String get subscriptionErrorBody => 'Đã xảy ra lỗi. Vui lòng thử lại.';

  @override
  String get subscriptionSignInTitle => 'Đăng nhập để xem gói';

  @override
  String get subscriptionSignInBody =>
      'Đăng nhập để xem và quản lý gói đăng ký của bạn.';

  @override
  String get subscriptionCurrentPlan => 'Gói hiện tại';

  @override
  String get subscriptionStatusActive => 'Đang hoạt động';

  @override
  String get subscriptionStatusTrialing => 'Dùng thử';

  @override
  String get subscriptionStatusCanceled => 'Đã hủy';

  @override
  String get subscriptionRenewsOn => 'Gia hạn vào';

  @override
  String get subscriptionCancelsOn => 'Kết thúc vào';

  @override
  String get subscriptionEntitlements => 'Quyền lợi';

  @override
  String get subscriptionQuotas => 'Hạn mức';

  @override
  String get subscriptionUnlimited => 'Không giới hạn';

  @override
  String subscriptionQuotaValue(String limit, String window) {
    return '$limit/$window';
  }

  @override
  String get subscriptionCancelButton => 'Hủy gia hạn';

  @override
  String get subscriptionCancelConfirmTitle => 'Hủy gói đăng ký?';

  @override
  String get subscriptionCancelConfirmBody =>
      'Gói của bạn vẫn hoạt động đến hết kỳ thanh toán hiện tại.';

  @override
  String get subscriptionCancelConfirmAction => 'Xác nhận hủy';

  @override
  String get subscriptionCancelDismiss => 'Giữ lại gói';

  @override
  String get subscriptionCancelPending =>
      'Gói sẽ kết thúc vào cuối kỳ thanh toán.';

  @override
  String get subscriptionCancelSuccess => 'Đã yêu cầu hủy gói.';

  @override
  String get subscriptionCancelError => 'Không hủy được. Vui lòng thử lại.';

  @override
  String get subscriptionFreeNote => 'Bạn đang dùng gói miễn phí.';

  @override
  String get subscriptionUpgradeNote => 'Nâng cấp gói trên web KotobaWorks.';

  @override
  String get subscriptionPlansTitle => 'Các gói có sẵn';

  @override
  String get subscriptionPlansError => 'Không tải được danh sách gói.';

  @override
  String get subscriptionPlansEmptyBody => 'Hiện chưa có gói nào.';

  @override
  String get subscriptionPlanCurrent => 'Gói hiện tại';

  @override
  String get subscriptionPlanFree => 'Miễn phí';

  @override
  String subscriptionPlanPrice(String price) {
    return '$priceđ';
  }

  @override
  String get subscriptionPlanPerMonth => '/tháng';

  @override
  String get subscriptionPlanRecommended => 'Đề xuất';

  @override
  String get readingDetailReadingLabel => 'Cách đọc';

  @override
  String get readingDetailMeaningLabel => 'Nghĩa';

  @override
  String get readingDetailAddFlashcard => 'Thêm vào thẻ ghi nhớ';

  @override
  String get readingDetailAdded => 'Đã thêm vào thẻ ghi nhớ';

  @override
  String get readingDetailAddError => 'Không thêm được. Vui lòng thử lại.';

  @override
  String get addFlashcardTitle => 'Thêm vào thẻ ghi nhớ';

  @override
  String get addFlashcardChooseDeck => 'Chọn bộ thẻ để lưu từ này';

  @override
  String get addFlashcardLoadError => 'Không tải được bộ thẻ.';

  @override
  String get addFlashcardEmptyTitle => 'Chưa có bộ thẻ nào';

  @override
  String get addFlashcardEmptyBody => 'Tạo một bộ thẻ để bắt đầu lưu từ vựng.';

  @override
  String get addFlashcardCreateDeck => 'Tạo bộ thẻ';
}
