// Smoke tests for the shared-component widget previews.
//
// Previews are render-only and not a substitute for the behavioral tests in
// `state_views_test.dart`, but pumping them here guarantees the preview file
// keeps compiling and rendering (in both light and dark) as the design system
// evolves. Each preview function returns a full MaterialApp, so it can be
// pumped directly.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/shared/widgets/previews/shared_component_previews.dart';

void main() {
  final previews = <String, Widget Function()>{
    'PrimaryButton': primaryButtonPreview,
    'PrimaryButton JA': primaryButtonJapanesePreview,
    'SecondaryButton': secondaryButtonPreview,
    'AppCard': appCardPreview,
    'AppChip': appChipPreview,
    'SectionHeader': sectionHeaderPreview,
    'LearningProgressCard': learningProgressCardPreview,
    'LoadingStateView': loadingStateViewPreview,
    'EmptyStateView': emptyStateViewPreview,
    'ErrorStateView': errorStateViewPreview,
    'OfflineBanner': offlineBannerPreview,
    'AppScaffold': appScaffoldPreview,
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
