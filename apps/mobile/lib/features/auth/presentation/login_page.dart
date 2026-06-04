import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/auth/presentation/widgets/auth_widgets.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// First-party login surface.
///
/// Account login (email/username + password) is the primary path, with a single
/// federated "Continue with Google" hand-off and a link to Register. The hosted
/// browser entry point, forgot-password, and the unused social providers were
/// removed so the screen stays focused and never surfaces a fake action. All
/// colors come from [AppPalette] so light and dark render correctly.
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({this.justRegistered = false, super.key});

  /// True when the user just completed registration; shows a success banner.
  final bool justRegistered;

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _showPassword = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final environment = ref.watch(appEnvironmentProvider);
    final session = ref.watch(authControllerProvider);
    final isLoading = session.isLoading;
    final error = session.hasError ? _messageFor(l10n, session.error!) : null;
    final showGoogle = environment.googleSignInEnabled;

    return AuthScreenShell(
      busy: isLoading,
      children: [
        AuthHeadline(
          title: l10n.loginSignInTitle,
          subtitle: l10n.loginSignInSubtitle,
        ),
        if (widget.justRegistered) ...[
          const SizedBox(height: AppSpacing.m),
          AuthBanner.success(context, l10n.loginRegisteredSuccess),
        ],
        if (error != null) ...[
          const SizedBox(height: AppSpacing.m),
          AuthBanner.error(context, error),
        ],
        const SizedBox(height: AppSpacing.l),
        Form(
          key: _formKey,
          autovalidateMode: AutovalidateMode.onUserInteraction,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _usernameController,
                enabled: !isLoading,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [
                  AutofillHints.username,
                  AutofillHints.email,
                ],
                decoration: authInputDecoration(
                  context,
                  label: l10n.loginEmailLabel,
                  hint: l10n.loginEmailHint,
                  prefixIcon: const Icon(Icons.mail_outline),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return l10n.loginEmailRequired;
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.m),
              TextFormField(
                controller: _passwordController,
                enabled: !isLoading,
                obscureText: !_showPassword,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.password],
                onFieldSubmitted: (_) => _submitPasswordLogin(),
                decoration: authInputDecoration(
                  context,
                  label: l10n.loginPasswordLabel,
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    onPressed: isLoading
                        ? null
                        : () =>
                            setState(() => _showPassword = !_showPassword),
                    icon: Icon(
                      _showPassword
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                    ),
                    tooltip: _showPassword
                        ? l10n.loginHidePassword
                        : l10n.loginShowPassword,
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return l10n.loginPasswordRequired;
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.l),
        AuthPrimaryButton(
          label: l10n.loginSignInButton,
          loading: isLoading,
          onPressed: _submitPasswordLogin,
        ),
        if (showGoogle) ...[
          const SizedBox(height: AppSpacing.l),
          AuthOrDivider(label: l10n.loginDivider),
          const SizedBox(height: AppSpacing.l),
          GoogleSignInButton(
            label: l10n.loginContinueWithGoogle,
            onPressed: isLoading ? null : _continueWithGoogle,
          ),
        ],
        const SizedBox(height: AppSpacing.s),
        AuthFooterPrompt(
          prompt: l10n.loginNoAccountPrompt,
          actionLabel: l10n.loginRegisterAction,
          onPressed: isLoading ? null : _goToRegister,
        ),
        const SizedBox(height: AppSpacing.s),
        Text(
          l10n.loginTermsNotice,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: palette.inkTertiary),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Future<void> _submitPasswordLogin() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    await ref.read(authControllerProvider.notifier).signInWithPassword(
          username: _usernameController.text.trim(),
          password: _passwordController.text,
        );
  }

  Future<void> _continueWithGoogle() {
    final hint = ref.read(appEnvironmentProvider).googleIdpHint;
    return ref.read(authControllerProvider.notifier).signIn(idpHint: hint);
  }

  void _goToRegister() => context.goNamed(Routes.register);

  /// Maps a thrown error to a safe, user-facing message (never token data).
  String _messageFor(AppLocalizations l10n, Object error) {
    if (error is! AuthException) return l10n.loginGenericError;
    return switch (error.code) {
      AuthFailureCode.cancelled => l10n.loginCancelledError,
      AuthFailureCode.invalidCredentials => l10n.loginWrongCredentialsError,
      AuthFailureCode.methodNotAllowed => l10n.loginMethodNotAllowedError,
      AuthFailureCode.invalidScope => l10n.loginInvalidScopeError,
      AuthFailureCode.clientMisconfigured => l10n.loginClientMisconfiguredError,
      AuthFailureCode.network => l10n.loginNetworkError,
      AuthFailureCode.missingToken => l10n.loginMissingTokenError,
      AuthFailureCode.unknown => l10n.loginGenericError,
    };
  }
}
