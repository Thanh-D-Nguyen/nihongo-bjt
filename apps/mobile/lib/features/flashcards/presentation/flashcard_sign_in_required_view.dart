import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';

/// Shared sign-in gate for API-backed flashcard screens.
class FlashcardSignInRequiredView extends StatelessWidget {
  const FlashcardSignInRequiredView({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return EmptyStateView(
      icon: Icons.lock_outline_rounded,
      title: l10n.savedSignInTitle,
      message: l10n.commonSignInRequired,
      action: PrimaryButton(
        label: l10n.loginSignInButton,
        icon: Icons.login_rounded,
        expand: false,
        onPressed: () => context.goNamed(Routes.login),
      ),
    );
  }
}
