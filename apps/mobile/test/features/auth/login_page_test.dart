// QA hardening — login layout at narrow widths and in dark mode.
//
// The login header previously overflowed at ≤390 dp because the brand wordmark
// row was wider than narrow phones. The wordmark now shrinks to fit, so these
// tests pump [LoginPage] across realistic narrow widths (320–390 dp) in light
// and dark themes and assert each frame renders with no layout/overflow
// exception. No real auth plugin is touched: an unauthenticated token store
// keeps the session local.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/auth/auth_token_store.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_tokens.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/auth/presentation/login_page.dart';
import 'package:nihongo_bjt/features/auth/presentation/widgets/auth_widgets.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Reports no stored session so the auth controller resolves to unauthenticated
/// without touching platform secure storage.
class _UnauthenticatedTokenStore implements AuthTokenStore {
  @override
  Future<AuthTokens?> read() async => null;

  @override
  Future<void> write(AuthTokens tokens) async {}

  @override
  Future<void> clear() async {}
}

/// A complete environment with Google sign-in toggled off, used to assert the
/// federated button is gated on configuration.
const _envWithoutGoogle = AppEnvironment(
  apiBaseUrl: 'https://api.test',
  keycloakIssuer: 'https://auth.test/realms/nihongo-bjt',
  oauthClientId: 'nihongo-mobile',
  oauthRedirectUri: 'com.nihongobjt.app://oauth2redirect',
  flashcardDataSource: 'mock',
  googleSignInEnabled: false,
);

Future<void> _pumpLogin(
  WidgetTester tester, {
  required double logicalWidth,
  required ThemeMode themeMode,
  Locale locale = const Locale('vi'),
  List<Override> overrides = const [],
  bool justRegistered = false,
}) async {
  const devicePixelRatio = 3.0;
  tester.view.physicalSize = Size(logicalWidth * devicePixelRatio, 844 * devicePixelRatio);
  tester.view.devicePixelRatio = devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authTokenStoreProvider.overrideWithValue(_UnauthenticatedTokenStore()),
        ...overrides,
      ],
      child: MaterialApp(
        locale: locale,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: themeMode,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: LoginPage(justRegistered: justRegistered),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('LoginPage layout', () {
    // 320 dp (small Android), 360 dp (common Android), 375 dp (iPhone SE/mini),
    // 390 dp (the width that previously overflowed by ~145 dp).
    for (final width in <double>[320, 360, 375, 390]) {
      testWidgets('renders without overflow at ${width.toInt()} dp (light)', (
        tester,
      ) async {
        await _pumpLogin(
          tester,
          logicalWidth: width,
          themeMode: ThemeMode.light,
        );

        expect(tester.takeException(), isNull);
        expect(find.byType(LoginPage), findsOneWidget);
        // The brand wordmark is still present (shrunk, not dropped).
        expect(find.textContaining('Kotoba'), findsWidgets);
      });
    }

    testWidgets('renders without overflow at 360 dp (dark)', (tester) async {
      await _pumpLogin(
        tester,
        logicalWidth: 360,
        themeMode: ThemeMode.dark,
      );

      expect(tester.takeException(), isNull);
      expect(find.byType(LoginPage), findsOneWidget);
    });

    testWidgets('renders without overflow with Japanese labels at 360 dp', (
      tester,
    ) async {
      await _pumpLogin(
        tester,
        logicalWidth: 360,
        themeMode: ThemeMode.light,
        locale: const Locale('ja'),
      );

      expect(tester.takeException(), isNull);
      expect(find.byType(LoginPage), findsOneWidget);
    });
  });

  group('LoginPage behavior', () {
    testWidgets('shows validation errors when submitting an empty form', (
      tester,
    ) async {
      await _pumpLogin(
        tester,
        logicalWidth: 390,
        themeMode: ThemeMode.light,
      );
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      await tester.tap(find.byType(AuthPrimaryButton));
      await tester.pumpAndSettle();

      expect(find.text(l10n.loginEmailRequired), findsOneWidget);
      expect(find.text(l10n.loginPasswordRequired), findsOneWidget);
      // No layout exception was raised while showing inline errors.
      expect(tester.takeException(), isNull);
    });

    testWidgets('clears a field error after the user fixes it', (
      tester,
    ) async {
      await _pumpLogin(
        tester,
        logicalWidth: 390,
        themeMode: ThemeMode.light,
      );
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      // First submit fails → inline errors appear.
      await tester.tap(find.byType(AuthPrimaryButton));
      await tester.pumpAndSettle();
      expect(find.text(l10n.loginEmailRequired), findsOneWidget);

      // With onUserInteraction autovalidation, typing a valid value clears the
      // error without needing a second submit.
      await tester.enterText(
        find.byType(TextFormField).first,
        'mai@example.com',
      );
      await tester.pumpAndSettle();
      expect(find.text(l10n.loginEmailRequired), findsNothing);
    });

    testWidgets('password visibility toggle reveals and hides the field', (
      tester,
    ) async {
      await _pumpLogin(
        tester,
        logicalWidth: 390,
        themeMode: ThemeMode.light,
      );

      // Obscured by default → "show" affordance.
      expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
      await tester.tap(find.byIcon(Icons.visibility_outlined));
      await tester.pumpAndSettle();
      // Now revealed → "hide" affordance.
      expect(find.byIcon(Icons.visibility_off_outlined), findsOneWidget);
    });

    testWidgets('renders the Google button and register link by default', (
      tester,
    ) async {
      await _pumpLogin(
        tester,
        logicalWidth: 390,
        themeMode: ThemeMode.light,
      );

      expect(find.byType(GoogleSignInButton), findsOneWidget);
      expect(find.byType(AuthFooterPrompt), findsOneWidget);
    });

    testWidgets('hides the Google button when the feature is disabled', (
      tester,
    ) async {
      await _pumpLogin(
        tester,
        logicalWidth: 390,
        themeMode: ThemeMode.light,
        overrides: [
          appEnvironmentProvider.overrideWithValue(_envWithoutGoogle),
        ],
      );

      expect(find.byType(GoogleSignInButton), findsNothing);
      // Account login remains available.
      expect(find.byType(AuthPrimaryButton), findsOneWidget);
    });

    testWidgets('shows the success banner after registration', (tester) async {
      await _pumpLogin(
        tester,
        logicalWidth: 390,
        themeMode: ThemeMode.light,
        justRegistered: true,
      );
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      expect(find.text(l10n.loginRegisteredSuccess), findsOneWidget);
    });
  });
}
