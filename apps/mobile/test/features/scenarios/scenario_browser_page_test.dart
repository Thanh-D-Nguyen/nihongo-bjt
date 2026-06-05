import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/scenarios/domain/scenario_models.dart';
import 'package:nihongo_bjt/features/scenarios/presentation/scenario_browser_page.dart';
import 'package:nihongo_bjt/features/scenarios/presentation/scenario_providers.dart';
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
  testWidgets('ScenarioBrowserPage shows the attempt count', (tester) async {
    const scenario = ScenarioSummary(
      id: 's1',
      slug: 'meeting-greeting',
      titleVi: 'Chào hỏi trong cuộc họp',
      difficulty: 'N3',
      category: 'meeting',
      iconEmoji: '💼',
      estimatedMin: 5,
      stepCount: 4,
      attemptCount: 42,
    );
    await _pump(
      tester,
      const ScenarioBrowserPage(),
      overrides: [
        scenarioListProvider(null).overrideWith((ref) async => [scenario]),
        scenarioListProvider('meeting').overrideWith((ref) async => [scenario]),
      ],
    );
    await tester.pump();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.scenarioAttemptCount(42)), findsOneWidget);
  });
}
