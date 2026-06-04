// Smoke tests for the Career widget previews.
//
// Previews are render-only and complement the behavioral tests in
// `test/features/career/`. Pumping each one guarantees the preview file keeps
// compiling and rendering (light + dark) as the Career surfaces evolve. Each
// preview function returns a full MaterialApp, so it can be pumped directly.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/career/presentation/widgets/previews/career_previews.dart';

void main() {
  final previews = <String, Widget Function()>{
    'NpcAvatar': npcAvatarPreview,
    'CareerSkillBar': careerSkillBarPreview,
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
