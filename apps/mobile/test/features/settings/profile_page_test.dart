import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/database/app_database.dart';
import 'package:nihongo_bjt/core/database/database_provider.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_session.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/billing/domain/billing_models.dart';
import 'package:nihongo_bjt/features/billing/presentation/billing_providers.dart';
import 'package:nihongo_bjt/features/flashcards/domain/srs_rating.dart';
import 'package:nihongo_bjt/features/progress/domain/study_summary.dart';
import 'package:nihongo_bjt/features/progress/presentation/progress_providers.dart';
import 'package:nihongo_bjt/features/settings/domain/app_locale_option.dart';
import 'package:nihongo_bjt/features/settings/domain/app_theme_option.dart';
import 'package:nihongo_bjt/features/settings/presentation/profile_page.dart';
import 'package:nihongo_bjt/features/settings/presentation/settings_controller.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'support/jwt_fixtures.dart';

/// A test [AuthController] seeded with a fixed session, so the profile screen
/// has deterministic identity claims without any network/Keycloak.
class _StubAuthController extends AuthController {
  _StubAuthController(this._session);

  final AuthSession _session;

  @override
  Future<AuthSession> build() async => _session;
}

AuthSession _sessionWithIdToken(String idToken) {
  return AuthSession.authenticated(
    AuthTokens(
      accessToken: 'access',
      refreshToken: 'refresh',
      idToken: idToken,
      accessTokenExpiresAt: DateTime.now().toUtc().add(
        const Duration(hours: 1),
      ),
    ),
  );
}

Future<AppDatabase> _pumpProfile(
  WidgetTester tester, {
  required AuthSession session,
  Locale locale = const Locale('vi'),
  ThemeMode themeMode = ThemeMode.light,
  double logicalWidth = 390,
  SubscriptionView? subscription,
  StudySummary? summary,
}) async {
  final db = AppDatabase.forTesting(NativeDatabase.memory());
  addTearDown(db.close);

  const devicePixelRatio = 3.0;
  tester.view.physicalSize = Size(
    logicalWidth * devicePixelRatio,
    844 * devicePixelRatio,
  );
  tester.view.devicePixelRatio = devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        authControllerProvider.overrideWith(() => _StubAuthController(session)),
        appPackageInfoProvider.overrideWith(
          (ref) async => PackageInfo(
            appName: 'KotobaWorks',
            packageName: 'com.nihongo.bjt',
            version: '1.0.0',
            buildNumber: '1',
          ),
        ),
        if (subscription != null)
          subscriptionProvider.overrideWith((ref) async => subscription),
        if (summary != null)
          studySummaryProvider.overrideWith((ref) async => summary),
      ],
      child: MaterialApp(
        locale: locale,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: themeMode,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ProfilePage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return db;
}

void main() {
  testWidgets('renders the display name and email from the ID token', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(
        unsignedJwt({
          'name': 'Tanaka Hana',
          'email': 'hana@example.com',
        }),
      ),
    );

    expect(find.text('Tanaka Hana'), findsWidgets);
    expect(find.text('hana@example.com'), findsWidgets);
    expect(find.text('Tài khoản KotobaWorks'), findsOneWidget);
    expect(find.text('Thông tin đăng nhập'), findsOneWidget);
    expect(find.text('LỐI TẮT'), findsOneWidget);
    expect(find.text('Tiến độ học'), findsOneWidget);
    expect(find.text('Mục đã lưu'), findsOneWidget);
  });

  testWidgets('falls back to a generic learner label without a name', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(unsignedJwt(const {})),
    );

    expect(find.text('Người học'), findsOneWidget);
    expect(find.text('Chưa đọc được chi tiết hồ sơ'), findsOneWidget);
  });

  testWidgets('shows the real app version in the About section', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(unsignedJwt({'name': 'A'})),
    );

    expect(find.text('GIỚI THIỆU'), findsOneWidget);
    expect(find.text('Phiên bản ứng dụng'), findsOneWidget);
    expect(find.text('1.0.0 (bản dựng 1)'), findsOneWidget);
  });

  testWidgets('renders production profile at 360 dp in dark mode', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(
        unsignedJwt({
          'name': '山田 花子 KotobaWorks Learner',
          'preferred_username': 'hanako.yamada',
          'email': 'hanako.yamada@example.com',
        }),
      ),
      locale: const Locale('ja'),
      themeMode: ThemeMode.dark,
      logicalWidth: 360,
    );

    expect(tester.takeException(), isNull);
    expect(find.byType(ProfilePage), findsOneWidget);
    expect(find.text('KotobaWorksアカウント'), findsOneWidget);
    expect(find.text('ショートカット'), findsOneWidget);
    expect(find.text('学習進捗'), findsOneWidget);
  });

  testWidgets('selecting a language persists it to the controller', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(unsignedJwt({'name': 'A'})),
    );

    await tester.ensureVisible(find.text('Tiếng Nhật'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tiếng Nhật'));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ProfilePage)),
    );
    final settings = container.read(settingsControllerProvider).value;
    expect(settings?.localeOption, AppLocaleOption.japanese);

    // And it survives a reload straight from the database.
    final reloaded = await container
        .read(userSettingsRepositoryProvider)
        .load();
    expect(reloaded.localeOption, AppLocaleOption.japanese);
  });

  testWidgets('toggling furigana off persists the preference', (tester) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(unsignedJwt({'name': 'A'})),
    );

    // The furigana switch is the first toggle in the preferences section.
    final furiganaSwitch = find.byType(Switch).first;
    await tester.ensureVisible(furiganaSwitch);
    await tester.pumpAndSettle();
    await tester.tap(furiganaSwitch);
    await tester.pumpAndSettle();

    final reloaded = await ProviderScope.containerOf(
      tester.element(find.byType(ProfilePage)),
    ).read(userSettingsRepositoryProvider).load();
    expect(reloaded.furiganaEnabled, isFalse);
  });

  testWidgets('toggling haptics off persists the preference', (tester) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(unsignedJwt({'name': 'A'})),
    );

    // The haptics switch is the second toggle in the preferences section.
    final hapticsSwitch = find.byType(Switch).last;
    await tester.ensureVisible(hapticsSwitch);
    await tester.pumpAndSettle();
    await tester.tap(hapticsSwitch);
    await tester.pumpAndSettle();

    final reloaded = await ProviderScope.containerOf(
      tester.element(find.byType(ProfilePage)),
    ).read(userSettingsRepositoryProvider).load();
    expect(reloaded.hapticsEnabled, isFalse);
  });

  testWidgets('selecting a theme persists it to the controller', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(unsignedJwt({'name': 'A'})),
    );

    await tester.ensureVisible(find.text('Tối'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tối'));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ProfilePage)),
    );
    expect(
      container.read(settingsControllerProvider).value?.themeOption,
      AppThemeOption.dark,
    );
    expect(container.read(themeModeProvider), ThemeMode.dark);

    final reloaded = await container
        .read(userSettingsRepositoryProvider)
        .load();
    expect(reloaded.themeOption, AppThemeOption.dark);
  });

  testWidgets('shows an honest empty learning snapshot by default', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(unsignedJwt({'name': 'A'})),
      summary: StudySummary.empty(),
    );

    expect(find.text('Tổng quan học tập'), findsOneWidget);
    expect(find.text('Chưa có dữ liệu học'), findsOneWidget);
  });

  testWidgets('renders real metrics in the learning snapshot', (tester) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(unsignedJwt({'name': 'A'})),
      summary: const StudySummary(
        totalReviews: 128,
        reviewedToday: 12,
        last7DayTotal: 47,
        currentStreakDays: 5,
        dailyCounts: <StudyDayCount>[],
        ratingTotals: <SrsRating, int>{},
      ),
    );

    expect(find.text('Tổng quan học tập'), findsOneWidget);
    expect(find.text('Chưa có dữ liệu học'), findsNothing);
    expect(find.text('5'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('47'), findsOneWidget);
    expect(find.text('128'), findsOneWidget);
  });

  testWidgets('shows a premium plan badge from a real subscription', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(unsignedJwt({'name': 'A'})),
      subscription: const SubscriptionView(
        planSlug: 'pro',
        planName: 'Pro',
        planNameVi: 'Gói Pro',
        source: PlanSource.subscription,
        status: 'active',
        cancelAtPeriodEnd: false,
        entitlements: <String>[],
        quotas: <PlanQuota>[],
      ),
    );

    expect(find.text('Gói Pro'), findsOneWidget);
  });

  testWidgets('shows a free plan badge on the default plan', (tester) async {
    await _pumpProfile(
      tester,
      session: _sessionWithIdToken(unsignedJwt({'name': 'A'})),
      subscription: const SubscriptionView(
        planSlug: 'free',
        planName: 'Free',
        source: PlanSource.defaultPlan,
        cancelAtPeriodEnd: false,
        entitlements: <String>[],
        quotas: <PlanQuota>[],
      ),
    );

    expect(find.text('Gói miễn phí'), findsOneWidget);
  });
}
