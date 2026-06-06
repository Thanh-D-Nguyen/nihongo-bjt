// Smoke tests for the Flashcards widget previews.
//
// Previews are render-only and complement the behavioral tests in
// `test/features/flashcards/`. Pumping each one guarantees the preview file
// keeps compiling and rendering (light + dark, default/reading/error) as the
// editor surfaces evolve. Each preview returns a full MaterialApp.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/widgets/previews/flashcard_previews.dart';

void main() {
  final previews = <String, Widget Function()>{
    'DeckCardEditorRow default': deckCardRowDefaultPreview,
    'DeckCardEditorRow with reading': deckCardRowReadingPreview,
    'DeckCardEditorRow error': deckCardRowErrorPreview,
    'DeckCardReadingToggle off': deckCardReadingToggleOffPreview,
    'DeckCardReadingToggle on': deckCardReadingToggleOnPreview,
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
