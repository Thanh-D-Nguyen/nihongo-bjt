// Widget tests for [RegisterPage]: native form rendering across narrow widths
// and themes, client-side validation, and an honest "unavailable" state when
// the backend endpoint is not deployed. Success navigation is covered by the
// controller unit test; here we assert the page never fakes success.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/auth/domain/register_repository.dart';
import 'package:nihongo_bjt/features/auth/presentation/register_controller.dart';
import 'package:nihongo_bjt/features/auth/presentation/register_page.dart';
import 'package:nihongo_bjt/features/auth/presentation/widgets/auth_widgets.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// A repository that always throws the supplied failure, used to assert the
/// page surfaces honest errors and never fabricates success.
class _ThrowingRegisterRepository implements RegisterRepository {
  _ThrowingRegisterRepository(this.failure);

  final RegisterException failure;

  @override
  Future<void> register({
    required String displayName,
    required String email,
    required String password,
  }) async {
    throw failure;
  }
}

Future<void> _pumpRegister(
  WidgetTester tester, {
  required double logicalWidth,
  required ThemeMode themeMode,
  Locale locale = const Locale('vi'),
  List<Override> overrides = const [],
}) async {
  const devicePixelRatio = 3.0;
  tester.view.physicalSize = Size(logicalWidth * devicePixelRatio, 844 * devicePixelRatio);
  tester.view.devicePixelRatio = devicePixelRatio;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: locale,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: themeMode,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const RegisterPage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('RegisterPage layout', () {
    for (final width in <double>[320, 360, 375, 390]) {
      testWidgets('renders without overflow at ${width.toInt()} dp (light)', (
        tester,
      ) async {
        await _pumpRegister(
          tester,
          logicalWidth: width,
          themeMode: ThemeMode.light,
        );

        expect(tester.takeException(), isNull);
        expect(find.byType(RegisterPage), findsOneWidget);
        // Four inputs: display name, email, password, confirm.
        expect(find.byType(TextFormField), findsNWidgets(4));
      });
    }

    testWidgets('renders without overflow at 360 dp (dark)', (tester) async {
      await _pumpRegister(
        tester,
        logicalWidth: 360,
        themeMode: ThemeMode.dark,
      );

      expect(tester.takeException(), isNull);
      expect(find.byType(RegisterPage), findsOneWidget);
    });

    testWidgets('renders without overflow with Japanese labels at 360 dp', (
      tester,
    ) async {
      await _pumpRegister(
        tester,
        logicalWidth: 360,
        themeMode: ThemeMode.light,
        locale: const Locale('ja'),
      );

      expect(tester.takeException(), isNull);
      expect(find.byType(RegisterPage), findsOneWidget);
    });
  });

  group('RegisterPage validation', () {
    testWidgets('shows required errors when submitting an empty form', (
      tester,
    ) async {
      await _pumpRegister(
        tester,
        logicalWidth: 390,
        themeMode: ThemeMode.light,
      );
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));

      await tester.tap(find.byType(AuthPrimaryButton));
      await tester.pumpAndSettle();

      expect(find.text(l10n.registerDisplayNameRequired), findsOneWidget);
      expect(find.text(l10n.registerEmailRequired), findsOneWidget);
      expect(find.text(l10n.registerPasswordRequired), findsOneWidget);
      expect(find.text(l10n.registerConfirmPasswordRequired), findsOneWidget);
    });

    testWidgets('rejects a malformed email and a short password', (
      tester,
    ) async {
      await _pumpRegister(
        tester,
        logicalWidth: 390,
        themeMode: ThemeMode.light,
      );
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      final fields = find.byType(TextFormField);

      await tester.enterText(fields.at(0), 'Mai');
      await tester.enterText(fields.at(1), 'not-an-email');
      await tester.enterText(fields.at(2), 'short');
      await tester.enterText(fields.at(3), 'short');
      await tester.tap(find.byType(AuthPrimaryButton));
      await tester.pumpAndSettle();

      expect(find.text(l10n.registerEmailInvalid), findsOneWidget);
      expect(find.text(l10n.registerPasswordTooShort), findsOneWidget);
    });

    testWidgets('clears a field error after the user fixes it', (
      tester,
    ) async {
      await _pumpRegister(
        tester,
        logicalWidth: 390,
        themeMode: ThemeMode.light,
      );
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      final fields = find.byType(TextFormField);

      // First submit fails → required errors appear.
      await tester.tap(find.byType(AuthPrimaryButton));
      await tester.pumpAndSettle();
      expect(find.text(l10n.registerDisplayNameRequired), findsOneWidget);

      // Typing a valid display name clears its error live (onUserInteraction).
      await tester.enterText(fields.at(0), 'Mai');
      await tester.pumpAndSettle();
      expect(find.text(l10n.registerDisplayNameRequired), findsNothing);
    });

    testWidgets('flags a password / confirm mismatch', (tester) async {
      await _pumpRegister(
        tester,
        logicalWidth: 390,
        themeMode: ThemeMode.light,
      );
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      final fields = find.byType(TextFormField);

      await tester.enterText(fields.at(0), 'Mai');
      await tester.enterText(fields.at(1), 'mai@example.com');
      await tester.enterText(fields.at(2), 'sup3rsecret');
      await tester.enterText(fields.at(3), 'different1');
      await tester.tap(find.byType(AuthPrimaryButton));
      await tester.pumpAndSettle();

      expect(find.text(l10n.registerPasswordMismatch), findsOneWidget);
    });
  });

  group('RegisterPage honesty', () {
    testWidgets('shows the unavailable banner and stays on the page', (
      tester,
    ) async {
      await _pumpRegister(
        tester,
        logicalWidth: 390,
        themeMode: ThemeMode.light,
        overrides: [
          registerRepositoryProvider.overrideWithValue(
            _ThrowingRegisterRepository(
              const RegisterException(
                'unavailable',
                code: RegisterFailureCode.unavailable,
              ),
            ),
          ),
        ],
      );
      final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
      final fields = find.byType(TextFormField);

      await tester.enterText(fields.at(0), 'Mai');
      await tester.enterText(fields.at(1), 'mai@example.com');
      await tester.enterText(fields.at(2), 'sup3rsecret');
      await tester.enterText(fields.at(3), 'sup3rsecret');
      await tester.tap(find.byType(AuthPrimaryButton));
      await tester.pumpAndSettle();

      // Honest failure surfaced; user is NOT navigated away (no fake success).
      expect(find.text(l10n.registerUnavailableError), findsOneWidget);
      expect(find.byType(RegisterPage), findsOneWidget);
    });
  });
}
