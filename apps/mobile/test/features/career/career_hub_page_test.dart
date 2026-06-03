import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/career/domain/career_models.dart';
import 'package:nihongo_bjt/features/career/presentation/career_hub_page.dart';
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

const _snapshot = CareerSnapshot(
  state: CareerState(
    userId: 'u1',
    jpWorkName: '営業部',
    companyTheme: 'trading',
    currentRankCode: 'shinjin',
    rankXp: 40,
    rankXpToNext: 100,
    streakDays: 3,
    skills: [
      CareerSkill(axisCode: 'keigo', value: 55),
      CareerSkill(axisCode: 'meeting', value: 30),
    ],
  ),
  rank: CareerRank(
    rankCode: 'shinjin',
    titleJa: '新人',
    titleVi: 'Nhân viên mới',
    bjtBandTarget: 'J3',
    displayOrder: 1,
    xpToNext: 100,
  ),
  nextRank: CareerRank(
    rankCode: 'senpai',
    titleJa: '先輩',
    titleVi: 'Đàn anh',
    bjtBandTarget: 'J2',
    displayOrder: 2,
    xpToNext: 200,
  ),
  npcs: [],
  npcRelations: [],
);

void main() {
  testWidgets('CareerHubPage renders rank and skills', (tester) async {
    await _pump(
      tester,
      const CareerHubPage(),
      overrides: [
        careerMeProvider.overrideWith((ref) async => _snapshot),
      ],
    );
    await tester.pump();

    expect(find.text('新人'), findsOneWidget);
    expect(find.text('Nhân viên mới'), findsOneWidget);
  });

  testWidgets('CareerHubPage shows error state on failure', (tester) async {
    await _pump(
      tester,
      const CareerHubPage(),
      overrides: [
        careerMeProvider.overrideWith(
          (ref) async => throw Exception('boom'),
        ),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.careerErrorTitle), findsOneWidget);  });
}
