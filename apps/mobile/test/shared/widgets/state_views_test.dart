import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

Widget _host(Widget child, {ThemeData? theme}) {
  return MaterialApp(
    theme: theme ?? AppTheme.light,
    home: Scaffold(body: Center(child: child)),
  );
}

void main() {
  group('PrimaryButton', () {
    testWidgets('fires onPressed when enabled', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        _host(
          PrimaryButton(label: 'Go', onPressed: () => tapped = true),
        ),
      );
      await tester.tap(find.text('Go'));
      expect(tapped, isTrue);
    });

    testWidgets('shows a spinner and ignores taps while loading', (
      tester,
    ) async {
      var tapped = false;
      await tester.pumpWidget(
        _host(
          PrimaryButton(
            label: 'Go',
            isLoading: true,
            onPressed: () => tapped = true,
          ),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.tap(find.byType(PrimaryButton));
      expect(tapped, isFalse);
    });
  });

  testWidgets('EmptyStateView renders title and message', (tester) async {
    await tester.pumpWidget(
      _host(
        const EmptyStateView(title: 'Nothing yet', message: 'Come back soon'),
      ),
    );
    expect(find.text('Nothing yet'), findsOneWidget);
    expect(find.text('Come back soon'), findsOneWidget);
  });

  testWidgets('ErrorStateView retry button invokes onRetry', (tester) async {
    var retried = false;
    await tester.pumpWidget(
      _host(
        ErrorStateView(
          title: 'Oops',
          message: 'Failed',
          retryLabel: 'Retry',
          onRetry: () => retried = true,
        ),
      ),
    );
    await tester.tap(find.text('Retry'));
    expect(retried, isTrue);
  });

  testWidgets('LoadingStateView renders in light and dark themes', (
    tester,
  ) async {
    await tester.pumpWidget(_host(const LoadingStateView()));
    expect(find.byType(LoadingStateView), findsOneWidget);

    await tester.pumpWidget(
      _host(const LoadingStateView(), theme: AppTheme.dark),
    );
    await tester.pump();
    expect(find.byType(LoadingStateView), findsOneWidget);
  });
}
