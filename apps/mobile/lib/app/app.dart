import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/config/app_config.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/settings/presentation/settings_controller.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Root application widget.
///
/// Wires the GoRouter instance, the brand theme and the gen-l10n localization
/// delegates into a [MaterialApp.router]. Vietnamese is the default locale; the
/// device locale selects Japanese when available and falls back to Vietnamese.
class NihonGoApp extends ConsumerWidget {
  const NihonGoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    // A non-null override forces the app language; null defers to the device
    // locale resolution below (Vietnamese fallback).
    final localeOverride = ref.watch(localeOverrideProvider);

    return MaterialApp.router(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      locale: localeOverride,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      // Prefer the first supported device locale; otherwise default to
      // Vietnamese (the learner audience) rather than the first listed locale.
      localeListResolutionCallback: _resolveLocale,
      routerConfig: router,
    );
  }

  static Locale _resolveLocale(
    List<Locale>? deviceLocales,
    Iterable<Locale> supportedLocales,
  ) {
    final supportedCodes = supportedLocales
        .map((locale) => locale.languageCode)
        .toSet();
    for (final locale in deviceLocales ?? const <Locale>[]) {
      if (supportedCodes.contains(locale.languageCode)) {
        return Locale(locale.languageCode);
      }
    }
    return const Locale('vi');
  }
}
