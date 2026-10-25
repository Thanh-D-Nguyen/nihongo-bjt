import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_error_messages.dart';
import 'package:nihongo_bjt/features/auth/presentation/widgets/auth_widgets.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// First-party login surface.
///
/// Supports account login (email/username + password) and, when a Google web
/// client ID is configured at build time, "Continue with Google". The Google
/// button is hidden otherwise so the screen never offers an action that cannot
/// complete. All colors come from [AppPalette] so light and dark render
/// correctly.
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
    final session = ref.watch(authControllerProvider);
    final environment = ref.watch(appEnvironmentProvider);
    final isLoading = session.isLoading;
    final error = session.hasError
        ? authErrorMessage(l10n, session.error!)
        : null;

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
        if (environment.googleSignInEnabled) ...[
          const SizedBox(height: AppSpacing.l),
          AuthOrDivider(label: l10n.loginDivider),
          const SizedBox(height: AppSpacing.l),
          GoogleSignInButton(
            label: l10n.loginContinueWithGoogle,
            onPressed: isLoading ? null : _submitGoogleSignIn,
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

  Future<void> _submitGoogleSignIn() async {
    FocusScope.of(context).unfocus();
    await ref.read(authControllerProvider.notifier).signInWithGoogle();
  }

  void _goToRegister() => context.goNamed(Routes.register);
}
