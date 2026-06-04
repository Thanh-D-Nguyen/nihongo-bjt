// Smoke tests for the Billing widget previews.
//
// Previews are render-only and complement the behavioral tests in
// `test/features/billing/`. Pumping each one guarantees the preview file keeps
// compiling and rendering (light + dark, free/premium) as the subscription
// surfaces evolve. Each preview function returns a full MaterialApp.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/billing/presentation/widgets/previews/billing_previews.dart';

void main() {
  final previews = <String, Widget Function()>{
    'PlanCard free': planCardFreePreview,
    'PlanCard premium': planCardPremiumPreview,
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
