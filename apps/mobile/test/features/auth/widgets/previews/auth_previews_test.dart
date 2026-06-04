// Smoke tests for the auth widget previews.
//
// Previews are render-only and complement the behavioral tests in
// `login_page_test.dart` / `register_page_test.dart`. Pumping each one here
// guarantees the preview file keeps compiling and rendering (light + dark, VI +
// JA) as the auth surfaces evolve. Each preview function returns a full
// MaterialApp, so it can be pumped directly.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/auth/presentation/widgets/previews/auth_previews.dart';

void main() {
  final previews = <String, Widget Function()>{
    'AuthHeadline VI': authHeadlineViPreview,
    'AuthHeadline JA': authHeadlineJaPreview,
    'Auth inputs': authInputsPreview,
    'Auth input error': authInputErrorPreview,
    'AuthPrimaryButton': authPrimaryButtonPreview,
    'GoogleSignInButton': googleSignInButtonPreview,
    'AuthOrDivider': authOrDividerPreview,
    'AuthFooterPrompt': authFooterPromptPreview,
    'AuthBanner error': authBannerErrorPreview,
    'AuthBanner success': authBannerSuccessPreview,
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
