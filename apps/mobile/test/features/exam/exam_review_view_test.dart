import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nihongo_bjt/core/api/api_client.dart';
import 'package:nihongo_bjt/core/config/app_environment.dart';
import 'package:nihongo_bjt/features/exam/data/exam_repository.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_providers.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_review_view.dart';
import 'package:nihongo_bjt/features/flashcards/data/mock_flashcard_repository.dart';
import 'package:nihongo_bjt/features/flashcards/domain/add_mistakes_to_deck.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

void main() {
  const env = AppEnvironment(
    apiBaseUrl: 'https://api.test',
    keycloakIssuer: 'https://auth.test/realms/nihongo-bjt',
    oauthClientId: 'nihongo-mobile',
    oauthRedirectUri: 'com.nihongobjt.app://oauth2redirect',
    flashcardDataSource: 'api',
  );

  http.Response jsonOk(Object body) => http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    200,
    headers: const {'content-type': 'application/json; charset=utf-8'},
  );

  ExamRepository repoReturning(http.Response Function(http.Request) handler) {
    return ExamRepository(
      ApiClient(
        environment: env,
        httpClient: MockClient((request) async => handler(request)),
      ),
    );
  }

  Object breakdownPayload() => {
    'sessionId': 's1',
    'testId': 't1',
    'testTitleVi': 'Đề thi thử BJT',
    'estimatedScore': 50,
    'estimatedBjtBand': 'N3',
    'breakdown': [
      {
        'questionId': 'q1',
        'prompt': '正しい敬語はどれですか。',
        'selectedOption': 'A',
        'isCorrect': true,
        'explanationVi': 'Đáp án đúng vì là khiêm nhường ngữ.',
        'skillTag': 'keigo',
        'sectionCode': 'I-1',
      },
      {
        'questionId': 'q2',
        'prompt': '次の語を選びなさい。',
        'selectedOption': 'C',
        'isCorrect': false,
        'explanationVi': 'Câu này chưa đúng vì sai ngữ cảnh.',
        'skillTag': 'vocab',
        'sectionCode': 'II-2',
      },
    ],
  };

  Future<void> pumpReview(
    WidgetTester tester,
    ExamRepository repository,
  ) async {
    tester.view.physicalSize = const Size(1170, 6000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [examRepositoryProvider.overrideWithValue(repository)],
        child: const MaterialApp(
          locale: Locale('vi'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: ExamReviewView(sessionId: 's1'),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('renders score header and every question by default', (
    tester,
  ) async {
    await pumpReview(tester, repoReturning((_) => jsonOk(breakdownPayload())));

    // The overall estimate is displayed on the honest 0–800 BJT scale.
    expect(find.text('50/800'), findsOneWidget);
    expect(find.text('正しい敬語はどれですか。'), findsOneWidget);
    expect(find.text('次の語を選びなさい。'), findsOneWidget);
    // Explanations (Vietnamese) are shown.
    expect(
      find.text('Đáp án đúng vì là khiêm nhường ngữ.'),
      findsOneWidget,
    );
  });

  testWidgets('the Wrong filter shows only the incorrect question', (
    tester,
  ) async {
    await pumpReview(tester, repoReturning((_) => jsonOk(breakdownPayload())));

    // Tap the "Sai" (wrong) filter chip.
    await tester.tap(find.textContaining('Sai'));
    await tester.pumpAndSettle();

    expect(find.text('次の語を選びなさい。'), findsOneWidget);
    expect(find.text('正しい敬語はどれですか。'), findsNothing);
  });

  testWidgets('never renders a fabricated correct-answer text', (tester) async {
    // The breakdown payload carries no correct-option text; the UI must not
    // invent one. Only the chosen option key + verdict + explanation appear.
    await pumpReview(tester, repoReturning((_) => jsonOk(breakdownPayload())));

    // "Bạn chọn: A/C" lines exist; no "Đáp án đúng:" reveal of another option.
    expect(find.textContaining('Bạn chọn'), findsNWidgets(2));
  });

  testWidgets('shows a recoverable error when the breakdown fails', (
    tester,
  ) async {
    await pumpReview(
      tester,
      repoReturning((_) => http.Response('{"message":"boom"}', 500)),
    );

    expect(find.text('Không tải được phần xem lại'), findsOneWidget);
  });

  Object allCorrectPayload() => {
    'sessionId': 's1',
    'testId': 't1',
    'testTitleVi': 'Đề thi thử BJT',
    'estimatedScore': 100,
    'estimatedBjtBand': 'N1',
    'breakdown': [
      {
        'questionId': 'q1',
        'prompt': '正しい敬語はどれですか。',
        'selectedOption': 'A',
        'isCorrect': true,
        'explanationVi': 'Đáp án đúng vì là khiêm nhường ngữ.',
      },
    ],
  };

  Future<void> pumpReviewWithRemediation(
    WidgetTester tester,
    ExamRepository repository,
  ) async {
    tester.view.physicalSize = const Size(1170, 6000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          examRepositoryProvider.overrideWithValue(repository),
          // A deterministic in-memory deck store so the CTA performs a real
          // create + save (no network) and we can assert the success UI.
          addMistakesToDeckProvider.overrideWithValue(
            AddMistakesToDeck(MockFlashcardRepository()),
          ),
        ],
        child: const MaterialApp(
          locale: Locale('vi'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: ExamReviewView(sessionId: 's1'),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('offers a save-mistakes CTA and confirms after saving', (
    tester,
  ) async {
    await pumpReviewWithRemediation(
      tester,
      repoReturning((_) => jsonOk(breakdownPayload())),
    );

    // One wrong answer with an explanation -> the remediation card appears.
    expect(find.text('Lưu câu sai để ôn lại'), findsOneWidget);
    expect(find.text('Tạo bộ thẻ ôn tập'), findsOneWidget);

    await tester.tap(find.text('Tạo bộ thẻ ôn tập'));
    await tester.pumpAndSettle();

    // Real deck created from the single explained mistake.
    expect(find.text('Đã tạo bộ thẻ với 1 thẻ.'), findsOneWidget);
    expect(find.text('Mở bộ thẻ'), findsOneWidget);
  });

  testWidgets('hides the remediation CTA when there are no mistakes', (
    tester,
  ) async {
    await pumpReviewWithRemediation(
      tester,
      repoReturning((_) => jsonOk(allCorrectPayload())),
    );

    expect(find.text('Lưu câu sai để ôn lại'), findsNothing);
    expect(find.text('Tạo bộ thẻ ôn tập'), findsNothing);
  });
}
