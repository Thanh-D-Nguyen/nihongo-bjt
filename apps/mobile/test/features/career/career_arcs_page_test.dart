import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/career/domain/career_models.dart';
import 'package:nihongo_bjt/features/career/presentation/career_arcs_page.dart';
import 'package:nihongo_bjt/features/career/presentation/career_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  List<Override> overrides = const [],
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: child,
      ),
    ),
  );
}

void main() {
  testWidgets('CareerArcsPage lists arcs', (tester) async {
    await _pump(
      tester,
      const CareerArcsPage(),
      overrides: [
        careerArcsProvider.overrideWith((ref) async => const [
          MissionArc(
            slug: 'onboarding',
            titleJa: '入社編',
            titleVi: 'Chương nhập công ty',
            rankCodeEntry: 'shinjin',
            synopsisVi: 'Bắt đầu hành trình.',
            status: 'active',
            locked: false,
            totalChapters: 4,
            completedChapters: 1,
            displayOrder: 1,
            artAccent: '#1B2A4A',
          ),
        ]),
      ],
    );
    await tester.pump();

    expect(find.text('入社編'), findsOneWidget);
  });

  testWidgets('CareerArcsPage shows empty state', (tester) async {
    await _pump(
      tester,
      const CareerArcsPage(),
      overrides: [
        careerArcsProvider.overrideWith((ref) async => const []),
      ],
    );
    await tester.pump();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.careerArcsEmptyTitle), findsOneWidget);
  });
}
