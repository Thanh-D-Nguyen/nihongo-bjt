// Widget previews for the Billing PlanCard.
//
// Render-only previews for the Flutter Widget Previewer; they complement the
// behavioral tests in `test/features/billing/`. Each renders inside the real
// [AppTheme] (light + dark) with localization wired so the plan price,
// entitlement rows, recommended badge and current-plan marker match production.
// Sample plans are static; no billing provider or API is touched.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/billing/domain/billing_models.dart';
import 'package:nihongo_bjt/features/billing/presentation/widgets/plan_card.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Light + dark preview pair rendered inside the real app theme.
final class _ThemedPreview extends MultiPreview {
  const _ThemedPreview({required this.name});

  final String name;

  @override
  List<Preview> get previews => const [
        Preview(brightness: Brightness.light),
        Preview(brightness: Brightness.dark),
      ];

  @override
  List<Preview> transform() {
    return super.transform().map((preview) {
      final builder = preview.toBuilder()
        ..group = 'Billing'
        ..name = '$name · ${preview.brightness == Brightness.dark ? 'dark' : 'light'}';
      return builder.build();
    }).toList();
  }
}

/// Wraps [child] in a MaterialApp using the real themes + localization so the
/// preview looks exactly like the running subscription screen.
Widget _wrap(Widget child) {
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    darkTheme: AppTheme.dark,
    locale: const Locale('vi'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Builder(
      builder: (context) => Scaffold(
        backgroundColor: context.palette.canvas,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.l),
            child: Center(
              child: SingleChildScrollView(child: child),
            ),
          ),
        ),
      ),
    ),
  );
}

const _freePlan = PlanView(
  id: 'free',
  slug: 'free',
  nameKey: 'plan.free',
  price: 0,
  recommended: false,
  displayNameVi: 'Miễn phí',
  displayNameJa: '無料',
  entitlements: ['learner.basic', 'ads.reduced'],
  quotas: [
    PlanQuota(key: 'flashcard_reviews_per_day', limit: 50, window: 'day'),
  ],
);

const _premiumPlan = PlanView(
  id: 'premium',
  slug: 'premium',
  nameKey: 'plan.premium',
  price: 149000,
  recommended: true,
  displayNameVi: 'Premium',
  displayNameJa: 'プレミアム',
  entitlements: [
    'learner.basic',
    'flashcard.adaptive_gen',
    'quiz.official_simulation',
    'ads.remove',
  ],
  quotas: [
    PlanQuota(key: 'flashcard_reviews_per_day', limit: kUnlimitedQuota, window: 'day'),
  ],
);

@_ThemedPreview(name: 'PlanCard · free')
Widget planCardFreePreview() => _wrap(
      const PlanCard(plan: _freePlan, isCurrent: true, localeCode: 'vi'),
    );

@_ThemedPreview(name: 'PlanCard · premium recommended')
Widget planCardPremiumPreview() => _wrap(
      const PlanCard(plan: _premiumPlan, isCurrent: false, localeCode: 'vi'),
    );
