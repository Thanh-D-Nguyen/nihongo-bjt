// Smoke tests for the Practice widget previews.
//
// Previews are render-only and complement the behavioral tests in
// `test/features/practice/`. Pumping each one guarantees the preview file keeps
// compiling and rendering (light + dark, default/selected/correct/incorrect) as
// the practice surfaces evolve. Each preview returns a full MaterialApp.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/practice/presentation/widgets/previews/practice_previews.dart';

void main() {
  final previews = <String, Widget Function()>{
    'QuestionOptionTile default': questionOptionDefaultPreview,
    'QuestionOptionTile selected': questionOptionSelectedPreview,
    'QuestionOptionTile long JA': questionOptionLongPreview,
    'ResultQuestionCard correct': resultCardCorrectPreview,
    'ResultQuestionCard incorrect': resultCardIncorrectPreview,
  };

  for (final entry in previews.entries) {
    testWidgets('${entry.key} preview renders without exception', (
      tester,
    ) async {
      await tester.pumpWidget(entry.value());
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  }
}
