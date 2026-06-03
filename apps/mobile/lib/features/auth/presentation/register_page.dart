import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/auth/domain/register_repository.dart';
import 'package:nihongo_bjt/features/auth/presentation/register_controller.dart';
import 'package:nihongo_bjt/features/auth/presentation/widgets/auth_widgets.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Native account-creation surface.
///
/// Renders a first-party form (display name, email, password, confirm) and
/// calls the real backend register endpoint. It never fakes success: if the
/// endpoint is not deployed the user sees an honest "registration unavailable"
/// message. On success the user is returned to Login with a success banner —
/// the endpoint mints no tokens, so there is no silent auto-login.
class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  static const int _minPasswordLength = 8;

  final _formKey = GlobalKey<FormState>();
  final _displayNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _showPassword = false;
  bool _navigated = false;

  @override
  void dispose() {
    _displayNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final state = ref.watch(registerControllerProvider);
    final isLoading = state.isLoading;
    final error = state.hasError ? _messageFor(l10n, state.error!) : null;

    // On success, return to Login with a success banner exactly once.
    ref.listen<AsyncValue<bool>>(registerControllerProvider, (previous, next) {
      if (next.value == true && !_navigated) {
        _navigated = true;
        context.goNamed(
          Routes.login,
          queryParameters: const {'registered': '1'},
        );
      }
    });

    return AuthScreenShell(
      busy: isLoading,
      children: [
        AuthHeadline(
          title: l10n.registerTitle,
          subtitle: l10n.registerSubtitle,
        ),
        if (error != null) ...[
          const SizedBox(height: AppSpacing.m),
          AuthBanner.error(context, error),
        ],
        const SizedBox(height: AppSpacing.l),
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _displayNameController,
                enabled: !isLoading,
                textInputAction: TextInputAction.next,
                textCapitalization: TextCapitalization.words,
                autofillHints: const [AutofillHints.name],
                decoration: authInputDecoration(
                  context,
                  label: l10n.registerDisplayNameLabel,
                  prefixIcon: const Icon(Icons.person_outline),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return l10n.registerDisplayNameRequired;
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.m),
              TextFormField(
                controller: _emailController,
                enabled: !isLoading,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                decoration: authInputDecoration(
                  context,
                  label: l10n.registerEmailLabel,
                  prefixIcon: const Icon(Icons.mail_outline),
                ),
                validator: (value) {
                  final email = value?.trim() ?? '';
                  if (email.isEmpty) return l10n.registerEmailRequired;
                  if (!_isValidEmail(email)) {
                    return l10n.registerEmailInvalid;
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.m),
              TextFormField(
                controller: _passwordController,
                enabled: !isLoading,
                obscureText: !_showPassword,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.newPassword],
                decoration: authInputDecoration(
                  context,
                  label: l10n.registerPasswordLabel,
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
                  final password = value ?? '';
                  if (password.isEmpty) {
                    return l10n.registerPasswordRequired;
                  }
                  if (password.length < _minPasswordLength) {
                    return l10n.registerPasswordTooShort;
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.m),
              TextFormField(
                controller: _confirmController,
                enabled: !isLoading,
                obscureText: !_showPassword,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.newPassword],
                onFieldSubmitted: (_) => _submit(),
                decoration: authInputDecoration(
                  context,
                  label: l10n.registerConfirmPasswordLabel,
                  prefixIcon: const Icon(Icons.lock_outline),
                ),
                validator: (value) {
                  final confirm = value ?? '';
                  if (confirm.isEmpty) {
                    return l10n.registerConfirmPasswordRequired;
                  }
                  if (confirm != _passwordController.text) {
                    return l10n.registerPasswordMismatch;
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.l),
        AuthPrimaryButton(
          label: l10n.registerSubmitButton,
          loading: isLoading,
          onPressed: _submit,
        ),
        const SizedBox(height: AppSpacing.s),
        AuthFooterPrompt(
          prompt: l10n.registerHaveAccountPrompt,
          actionLabel: l10n.registerSignInAction,
          onPressed: isLoading ? null : () => context.goNamed(Routes.login),
        ),
        const SizedBox(height: AppSpacing.s),
        Text(
          l10n.registerTermsNotice,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: palette.inkTertiary),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    await ref.read(registerControllerProvider.notifier).submit(
          displayName: _displayNameController.text.trim(),
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
  }

  bool _isValidEmail(String value) {
    final regex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    return regex.hasMatch(value);
  }

  /// Maps a thrown error to a safe, localized message (never server internals).
  String _messageFor(AppLocalizations l10n, Object error) {
    if (error is! RegisterException) return l10n.registerGenericError;
    return switch (error.code) {
      RegisterFailureCode.invalidEmail => l10n.registerInvalidEmailError,
      RegisterFailureCode.invalidPassword => l10n.registerInvalidPasswordError,
      RegisterFailureCode.invalidDisplayName =>
        l10n.registerInvalidDisplayNameError,
      RegisterFailureCode.emailAlreadyRegistered =>
        l10n.registerEmailTakenError,
      RegisterFailureCode.unavailable => l10n.registerUnavailableError,
      RegisterFailureCode.network => l10n.registerNetworkError,
      RegisterFailureCode.unknown => l10n.registerGenericError,
    };
  }
}
