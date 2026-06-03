/// Human-readable labels for the dynamic entitlement / quota / window keys the
/// monetization API returns. These keys are domain data (not UI chrome), so the
/// mapping mirrors the web learner app exactly to keep parity. Unknown keys
/// fall back to the raw key so new server entitlements still render.
abstract final class BillingLabels {
  static const Map<String, Map<String, String>> _entitlements = {
    'vi': {
      'learner.basic': 'Tính năng học cơ bản',
      'flashcard.deck.create': 'Tạo bộ thẻ',
      'flashcard.suggest_cards': 'Gợi ý thẻ AI',
      'flashcard.adaptive_gen': 'Tạo thẻ thích ứng',
      'quiz.bjt.start': 'Làm bài kiểm tra BJT',
      'quiz.official_simulation': 'Mô phỏng BJT chính thức',
      'ads.remove': 'Xóa hoàn toàn quảng cáo',
      'ads.reduced': 'Giảm quảng cáo',
    },
    'ja': {
      'learner.basic': '基本学習機能',
      'flashcard.deck.create': 'デッキ作成',
      'flashcard.suggest_cards': 'AIカード提案',
      'flashcard.adaptive_gen': 'アダプティブ生成',
      'quiz.bjt.start': 'BJTクイズ',
      'quiz.official_simulation': '公式BJTシミュレーション',
      'ads.remove': '広告完全非表示',
      'ads.reduced': '広告削減',
    },
  };

  static const Map<String, Map<String, String>> _quotas = {
    'vi': {'flashcard_reviews_per_day': 'Ôn tập thẻ flashcard'},
    'ja': {'flashcard_reviews_per_day': 'フラッシュカード復習'},
  };

  static const Map<String, Map<String, String>> _windows = {
    'vi': {'day': 'ngày', 'week': 'tuần', 'month': 'tháng'},
    'ja': {'day': '日', 'week': '週', 'month': '月'},
  };

  static String _resolve(
    Map<String, Map<String, String>> source,
    String key,
    String localeCode,
  ) {
    return source[localeCode]?[key] ?? source['vi']?[key] ?? key;
  }

  static String entitlement(String key, String localeCode) =>
      _resolve(_entitlements, key, localeCode);

  static String quota(String key, String localeCode) =>
      _resolve(_quotas, key, localeCode);

  static String window(String code, String localeCode) =>
      _resolve(_windows, code, localeCode);
}
