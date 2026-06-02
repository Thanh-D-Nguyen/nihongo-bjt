import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/core/theme/app_colors.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_repository.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/settings/domain/app_locale_option.dart';
import 'package:nihongo_bjt/features/settings/presentation/settings_controller.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_logo.dart';

/// First-party login surface.
///
/// Mirrors the web login entry points: email/password for the default account
/// flow, browser PKCE for hosted/social/register flows, locale switching, and
/// safe localized error states.
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

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
    final text = Theme.of(context).textTheme;
    final session = ref.watch(authControllerProvider);
    final isLoading = session.isLoading;
    final error = session.hasError ? _messageFor(l10n, session.error!) : null;

    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.l),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: AppCard(
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const AppLogo(),
                          _LocaleSwitcher(isLoading: isLoading),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.l),
                      Text(l10n.loginSignInTitle, style: text.titleLarge),
                      const SizedBox(height: AppSpacing.s),
                      Text(l10n.loginSignInSubtitle, style: text.bodySmall),
                      if (error != null) ...[
                        const SizedBox(height: AppSpacing.m),
                        _ErrorBanner(message: error),
                      ],
                      const SizedBox(height: AppSpacing.l),
                      TextFormField(
                        controller: _usernameController,
                        enabled: !isLoading,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [
                          AutofillHints.username,
                          AutofillHints.email,
                        ],
                        decoration: InputDecoration(
                          labelText: l10n.loginEmailLabel,
                          hintText: l10n.loginEmailHint,
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
                        decoration: InputDecoration(
                          labelText: l10n.loginPasswordLabel,
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            onPressed: isLoading
                                ? null
                                : () => setState(
                                    () => _showPassword = !_showPassword,
                                  ),
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
                      const SizedBox(height: AppSpacing.s),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: isLoading ? null : _startBrowserSignIn,
                          child: Text(l10n.loginForgotPassword),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.m),
                      SizedBox(
                        height: 52,
                        child: FilledButton(
                          onPressed: isLoading ? null : _submitPasswordLogin,
                          child: isLoading
                              ? const SizedBox(
                                  height: 22,
                                  width: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    color: AppColors.surface,
                                  ),
                                )
                              : Text(l10n.loginSignInButton),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.m),
                      Row(
                        children: [
                          const Expanded(child: Divider()),
                          Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.s,
                            ),
                            child: Text(
                              l10n.loginDivider,
                              style: text.bodySmall,
                            ),
                          ),
                          const Expanded(child: Divider()),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.m),
                      OutlinedButton.icon(
                        onPressed: isLoading ? null : _startBrowserSignIn,
                        icon: const Icon(Icons.open_in_browser_outlined),
                        label: Text(l10n.loginBrowserButton),
                      ),
                      const SizedBox(height: AppSpacing.s),
                      _SocialButtons(isLoading: isLoading),
                      const SizedBox(height: AppSpacing.m),
                      OutlinedButton(
                        onPressed: isLoading ? null : _startRegister,
                        child: Text(l10n.loginCreateAccount),
                      ),
                      const SizedBox(height: AppSpacing.m),
                      Text(
                        l10n.loginTermsNotice,
                        style: text.bodySmall,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _submitPasswordLogin() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(authControllerProvider.notifier).signInWithPassword(
          username: _usernameController.text.trim(),
          password: _passwordController.text,
        );
  }

  Future<void> _browserSignIn({String? idpHint}) {
    return ref.read(authControllerProvider.notifier).signIn(idpHint: idpHint);
  }

  Future<void> _startBrowserSignIn() => _browserSignIn();

  Future<void> _startRegister() {
    return ref
        .read(authControllerProvider.notifier)
        .signIn(flow: AuthBrowserFlow.register);
  }

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

class _LocaleSwitcher extends ConsumerWidget {
  const _LocaleSwitcher({required this.isLoading});

  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current =
        ref.watch(settingsControllerProvider).value?.localeOption ??
            AppLocaleOption.system;
    return SegmentedButton<AppLocaleOption>(
      showSelectedIcon: false,
      segments: const [
        ButtonSegment(value: AppLocaleOption.vietnamese, label: Text('VI')),
        ButtonSegment(value: AppLocaleOption.japanese, label: Text('JA')),
      ],
      selected: {
        if (current == AppLocaleOption.japanese)
          AppLocaleOption.japanese
        else
          AppLocaleOption.vietnamese,
      },
      onSelectionChanged: isLoading
          ? null
          : (selection) async {
              await ref
                  .read(settingsControllerProvider.notifier)
                  .setLocaleOption(selection.single);
            },
    );
  }
}

class _SocialButtons extends ConsumerWidget {
  const _SocialButtons({required this.isLoading});

  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final providers = [
      (label: l10n.loginGoogleButton, hint: 'google'),
      (label: l10n.loginFacebookButton, hint: 'facebook'),
      (label: l10n.loginAppleButton, hint: 'apple'),
      (label: l10n.loginLineButton, hint: 'line'),
    ];

    return Wrap(
      spacing: AppSpacing.s,
      runSpacing: AppSpacing.s,
      alignment: WrapAlignment.center,
      children: [
        for (final provider in providers)
          OutlinedButton(
            onPressed: isLoading
                ? null
                : () => ref
                      .read(authControllerProvider.notifier)
                      .signIn(idpHint: provider.hint),
            child: Text(provider.label),
          ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.24)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.danger,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
