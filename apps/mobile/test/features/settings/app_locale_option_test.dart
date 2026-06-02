import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/settings/domain/app_locale_option.dart';

void main() {
  group('AppLocaleOption', () {
    test('storageValue is a stable token per option', () {
      expect(AppLocaleOption.system.storageValue, 'system');
      expect(AppLocaleOption.vietnamese.storageValue, 'vi');
      expect(AppLocaleOption.japanese.storageValue, 'ja');
    });

    test('locale is null for system and the language for the rest', () {
      expect(AppLocaleOption.system.locale, isNull);
      expect(AppLocaleOption.vietnamese.locale, const Locale('vi'));
      expect(AppLocaleOption.japanese.locale, const Locale('ja'));
    });

    test('fromStorage round-trips every storageValue', () {
      for (final option in AppLocaleOption.values) {
        expect(AppLocaleOption.fromStorage(option.storageValue), option);
      }
    });

    test('fromStorage falls back to system for unknown or null values', () {
      expect(AppLocaleOption.fromStorage(null), AppLocaleOption.system);
      expect(AppLocaleOption.fromStorage(''), AppLocaleOption.system);
      expect(AppLocaleOption.fromStorage('fr'), AppLocaleOption.system);
    });
  });
}
