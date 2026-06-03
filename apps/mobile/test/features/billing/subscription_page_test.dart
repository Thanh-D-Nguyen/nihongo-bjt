import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/billing/domain/billing_models.dart';
import 'package:nihongo_bjt/features/billing/presentation/billing_providers.dart';
import 'package:nihongo_bjt/features/billing/presentation/subscription_page.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Future<void> _pump(
  WidgetTester tester, {
  List<Override> overrides = const [],
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: const MaterialApp(
        locale: Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: SubscriptionPage(),
      ),
    ),
  );
}

void main() {
  testWidgets('SubscriptionPage renders the current plan name', (
    tester,
  ) async {
    await _pump(
      tester,
      overrides: [
        subscriptionProvider.overrideWith(
          (ref) async => const SubscriptionView(
            planSlug: 'standard',
            planName: 'Standard',
            planNameVi: 'Tiêu chuẩn',
            source: PlanSource.subscription,
            status: 'active',
            cancelAtPeriodEnd: false,
            entitlements: ['ads.remove'],
            quotas: [],
          ),
        ),
        plansProvider.overrideWith((ref) async => const <PlanView>[]),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Tiêu chuẩn'), findsOneWidget);
  });

  testWidgets('SubscriptionPage shows sign-in state when unauthorized', (
    tester,
  ) async {
    await _pump(
      tester,
      overrides: [
        subscriptionProvider.overrideWith(
          (ref) async => throw const RepositoryException(
            RepositoryErrorKind.unauthorized,
          ),
        ),
        plansProvider.overrideWith((ref) async => const <PlanView>[]),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.subscriptionSignInTitle), findsOneWidget);
  });

  testWidgets('SubscriptionPage lists an available plan', (tester) async {
    await _pump(
      tester,
      overrides: [
        subscriptionProvider.overrideWith(
          (ref) async => const SubscriptionView(
            planSlug: 'free',
            planName: 'Free',
            planNameVi: 'Miễn phí',
            source: PlanSource.defaultPlan,
            cancelAtPeriodEnd: false,
            entitlements: [],
            quotas: [],
          ),
        ),
        plansProvider.overrideWith(
          (ref) async => const [
            PlanView(
              id: 'p1',
              slug: 'standard',
              nameKey: 'plan.standard',
              price: 99000,
              recommended: true,
              displayNameVi: 'Tiêu chuẩn',
              entitlements: ['ads.remove'],
              quotas: [],
            ),
          ],
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Tiêu chuẩn'), findsOneWidget);
  });
}
