import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/features/gamification/domain/gamification_models.dart';
import 'package:nihongo_bjt/features/gamification/presentation/gamification_providers.dart';
import 'package:nihongo_bjt/features/gamification/presentation/rewards_page.dart';
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
        home: RewardsPage(),
      ),
    ),
  );
}

void main() {
  testWidgets('RewardsPage renders a streak track on the streaks tab', (
    tester,
  ) async {
    await _pump(
      tester,
      overrides: [
        streaksProvider.overrideWith(
          (ref) async => const [
            StreakData(
              id: 's1',
              currentStreak: 7,
              longestStreak: 14,
              freezesUsed: 1,
              freezesAllowed: 3,
              name: 'Ôn tập hằng ngày',
              activityType: 'review',
            ),
          ],
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Ôn tập hằng ngày'), findsOneWidget);
  });

  testWidgets('streak card shows the activity calendar when there is a '
      'last-activity date', (tester) async {
    await _pump(
      tester,
      overrides: [
        streaksProvider.overrideWith(
          (ref) async => [
            StreakData(
              id: 's1',
              currentStreak: 5,
              longestStreak: 14,
              freezesUsed: 0,
              freezesAllowed: 3,
              name: 'Ôn tập hằng ngày',
              activityType: 'review',
              lastActivityDate: DateTime.now(),
            ),
          ],
        ),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.rewardsStreakCalendar), findsOneWidget);
  });

  testWidgets('streak card hides the activity calendar without a '
      'last-activity date', (tester) async {
    await _pump(
      tester,
      overrides: [
        streaksProvider.overrideWith(
          (ref) async => const [
            StreakData(
              id: 's1',
              currentStreak: 0,
              longestStreak: 14,
              freezesUsed: 0,
              freezesAllowed: 3,
              name: 'Ôn tập hằng ngày',
              activityType: 'review',
            ),
          ],
        ),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.rewardsStreakCalendar), findsNothing);
  });

  testWidgets('RewardsPage shows the sign-in state when unauthorized', (
    tester,
  ) async {
    await _pump(
      tester,
      overrides: [
        streaksProvider.overrideWith(
          (ref) async => throw const RepositoryException(
            RepositoryErrorKind.unauthorized,
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    expect(find.text(l10n.rewardsSignInTitle), findsOneWidget);
  });

  testWidgets('RewardsPage lists rankings on the leaderboards tab', (
    tester,
  ) async {
    await _pump(
      tester,
      overrides: [
        streaksProvider.overrideWith((ref) async => const []),
        leaderboardsProvider.overrideWith(
          (ref) async => const [
            LeaderboardConfig(
              id: 'lb1',
              name: 'Tuần này',
              metricType: 'xp',
              period: 'weekly',
            ),
          ],
        ),
        leaderboardProvider.overrideWith(
          (ref, id) async => const LeaderboardView(
            config: LeaderboardConfig(
              id: 'lb1',
              name: 'Tuần này',
              metricType: 'xp',
              period: 'weekly',
            ),
            entries: [
              LeaderboardEntry(
                id: 'e1',
                userId: 'u1',
                rank: 1,
                score: 980,
                displayName: 'Akira',
              ),
              LeaderboardEntry(
                id: 'e2',
                userId: 'zxc123xyz',
                rank: 2,
                score: 640,
              ),
            ],
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    await tester.tap(find.text(l10n.rewardsTabLeaderboards));
    await tester.pumpAndSettle();

    expect(find.text('Akira'), findsOneWidget);
    // The rank row shows an avatar initial derived from the display name.
    expect(find.text('A'), findsOneWidget);
    // An entry without a display name falls back to a short user id, mirroring
    // the web leaderboard.
    expect(
      find.text(l10n.rewardsLeaderboardUserFallback('zxc123')),
      findsOneWidget,
    );
  });

  testWidgets('achievement card shows the tier and category caption', (
    tester,
  ) async {
    await _pump(
      tester,
      overrides: [
        streaksProvider.overrideWith((ref) async => const []),
        achievementsProvider.overrideWith(
          (ref) async => const [
            AchievementDef(
              id: 'a1',
              slug: 'vocab-master',
              name: 'Bậc thầy từ vựng',
              description: 'Học 1000 từ',
              category: 'learning',
              tiers: [
                AchievementTier(
                  id: 't1',
                  tier: 'gold',
                  threshold: 1000,
                  currentProgress: 400,
                ),
              ],
            ),
          ],
        ),
      ],
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('vi'));
    await tester.tap(find.text(l10n.rewardsTabAchievements));
    await tester.pumpAndSettle();

    expect(find.text('Vàng • Học tập'), findsOneWidget);
  });
}
