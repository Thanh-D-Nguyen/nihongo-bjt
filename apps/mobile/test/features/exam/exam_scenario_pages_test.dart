import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_browser_page.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_providers.dart';
import 'package:nihongo_bjt/features/scenarios/domain/scenario_models.dart';
import 'package:nihongo_bjt/features/scenarios/presentation/scenario_browser_page.dart';
import 'package:nihongo_bjt/features/scenarios/presentation/scenario_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  List<Override> overrides = const [],
  Locale locale = const Locale('vi'),
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: child,
      ),
    ),
  );
}

void main() {
  testWidgets('ScenarioBrowserPage lists scenarios', (tester) async {
    await _pump(
      tester,
      const ScenarioBrowserPage(),
      overrides: [
        scenarioListProvider.overrideWith(
          (ref, category) async => const [
            ScenarioSummary(
              id: 's1',
              slug: 'meeting',
              titleVi: 'Họp với khách hàng',
              difficulty: 'easy',
              category: 'business',
              iconEmoji: '🤝',
              estimatedMin: 5,
              stepCount: 3,
              attemptCount: 0,
            ),
          ],
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Họp với khách hàng'), findsOneWidget);
  });

  testWidgets('ScenarioBrowserPage shows empty state', (tester) async {
    await _pump(
      tester,
      const ScenarioBrowserPage(),
      overrides: [
        scenarioListProvider.overrideWith((ref, category) async => const []),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.scenariosEmptyTitle), findsOneWidget);
  });

  testWidgets('ExamBrowserPage lists exam templates', (tester) async {
    await _pump(
      tester,
      const ExamBrowserPage(),
      overrides: [
        examTemplatesProvider.overrideWith(
          (ref) async => const [
            ExamTemplate(
              id: 't1',
              slug: 'bjt-practice-1',
              titleVi: 'Đề luyện tập BJT 1',
              type: 'practice',
              sectionCount: 4,
              sessionCount: 0,
              level: 'j2',
              timeLimitSeconds: 1800,
            ),
          ],
        ),
      ],
    );
    await tester.pump();

    expect(find.text('Đề luyện tập BJT 1'), findsOneWidget);
    expect(find.text('Mô phỏng đề BJT toàn phần'), findsOneWidget);
    expect(find.text('Điểm ước tính 0–800'), findsOneWidget);
    expect(find.text('Luyện theo mục tiêu'), findsOneWidget);
  });

  testWidgets('ExamBrowserPage shows empty state', (tester) async {
    await _pump(
      tester,
      const ExamBrowserPage(),
      overrides: [
        examTemplatesProvider.overrideWith((ref) async => const []),
      ],
    );
    await tester.pump();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.examEmptyTitle), findsOneWidget);
  });

  testWidgets('ExamBrowserPage disables a locked official simulation', (
    tester,
  ) async {
    await _pump(
      tester,
      const ExamBrowserPage(),
      overrides: [
        examTemplatesProvider.overrideWith(
          (ref) async => const [
            ExamTemplate(
              id: 'official-1',
              slug: 'bjt-full-simulation-a-v1',
              titleVi: 'Đề mô phỏng BJT A',
              titleJa: 'BJT総合模擬試験 A',
              type: 'official',
              sectionCount: 9,
              sessionCount: 0,
              timeLimitSeconds: 6300,
            ),
          ],
        ),
        officialSimulationStatusProvider.overrideWith(
          (ref) async => const OfficialSimulationStatus(
            enabled: true,
            entitled: false,
            availableTemplates: 3,
            enforcementEnabled: true,
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.examOfficialUpgradeRequired), findsOneWidget);
    expect(find.byType(InkWell), findsNothing);
  });

  testWidgets('ExamBrowserPage uses Japanese title once in Japanese locale', (
    tester,
  ) async {
    await _pump(
      tester,
      const ExamBrowserPage(),
      locale: const Locale('ja'),
      overrides: [
        examTemplatesProvider.overrideWith(
          (ref) async => const [
            ExamTemplate(
              id: 'official-ja',
              slug: 'bjt-full-simulation-c-v1',
              titleVi: 'Đề mô phỏng BJT C',
              titleJa: 'BJT総合模擬試験 C',
              type: 'official',
              sectionCount: 9,
              sessionCount: 0,
              timeLimitSeconds: 6300,
            ),
          ],
        ),
        officialSimulationStatusProvider.overrideWith(
          (ref) async => const OfficialSimulationStatus(
            enabled: true,
            entitled: true,
            availableTemplates: 3,
            enforcementEnabled: true,
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('BJT総合模擬試験 C'), findsOneWidget);
    expect(find.text('Đề mô phỏng BJT C'), findsOneWidget);
  });
}
