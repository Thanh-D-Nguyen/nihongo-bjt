import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/auth/presentation/widgets/google_logo_svg.dart';
import 'package:nihongo_bjt/features/settings/domain/app_locale_option.dart';
import 'package:nihongo_bjt/features/settings/presentation/settings_controller.dart';
import 'package:nihongo_bjt/shared/widgets/app_logo.dart';

/// Shared building blocks for the Login and Register surfaces so both screens
/// stay visually identical and the rules in `MOBILE_DESIGN_SYSTEM.md` are
/// enforced once: theme-aware colors, 320–390 dp safety, keyboard-safe layout,
/// 48 dp touch targets, consistent radii and focus rings.

/// Page chrome shared by the auth screens: brand canvas, safe area, a keyboard-
/// safe scroll, a centred max-width column, and the brand header + locale
/// switcher. Children render the form-specific content.
class AuthScreenShell extends StatelessWidget {
  const AuthScreenShell({
    required this.children,
    this.busy = false,
    super.key,
  });

  /// Content rendered below the brand header (title, fields, actions, footer).
  final List<Widget> children;

  /// When true the locale switcher is disabled (e.g. while submitting).
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Scaffold(
      backgroundColor: palette.canvas,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.l,
              AppSpacing.l,
              AppSpacing.l,
              AppSpacing.xl,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Flexible(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: AppLogo(fontSize: 24),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.s),
                      AuthLocaleSwitcher(disabled: busy),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  ...children,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// VI/JA segmented locale switcher used in the auth header.
class AuthLocaleSwitcher extends ConsumerWidget {
  const AuthLocaleSwitcher({this.disabled = false, super.key});

  final bool disabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current =
        ref.watch(settingsControllerProvider).value?.localeOption ??
            AppLocaleOption.system;
    return SegmentedButton<AppLocaleOption>(
      showSelectedIcon: false,
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        textStyle: WidgetStatePropertyAll(
          Theme.of(context).textTheme.labelMedium,
        ),
      ),
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
      onSelectionChanged: disabled
          ? null
          : (selection) async {
              await ref
                  .read(settingsControllerProvider.notifier)
                  .setLocaleOption(selection.single);
            },
    );
  }
}

/// Large screen title + supporting subtitle, left-aligned for clear hierarchy.
class AuthHeadline extends StatelessWidget {
  const AuthHeadline({required this.title, required this.subtitle, super.key});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final palette = context.palette;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.s),
        Text(
          subtitle,
          style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
        ),
      ],
    );
  }
}

/// Consistent, theme-aware input decoration for the auth text fields.
InputDecoration authInputDecoration(
  BuildContext context, {
  required String label,
  String? hint,
  Widget? prefixIcon,
  Widget? suffixIcon,
}) {
  final palette = context.palette;
  final radius = BorderRadius.circular(AppRadius.lg);
  OutlineInputBorder border(Color color, double width) => OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: color, width: width),
      );
  return InputDecoration(
    labelText: label,
    hintText: hint,
    filled: true,
    fillColor: palette.surface,
    prefixIcon: prefixIcon,
    prefixIconColor: palette.inkTertiary,
    suffixIconColor: palette.inkTertiary,
    suffixIcon: suffixIcon,
    contentPadding: const EdgeInsets.symmetric(
      horizontal: AppSpacing.m,
      vertical: AppSpacing.m,
    ),
    enabledBorder: border(palette.border, 1),
    focusedBorder: border(palette.accent, 1.6),
    errorBorder: border(palette.danger, 1),
    focusedErrorBorder: border(palette.danger, 1.6),
    disabledBorder: border(palette.border, 1),
  );
}

/// Primary filled CTA with an inline loading state. Fixed 52 dp height keeps a
/// generous touch target and prevents layout shift between idle and loading.
class AuthPrimaryButton extends StatelessWidget {
  const AuthPrimaryButton({
    required this.label,
    required this.onPressed,
    this.loading = false,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: 52,
      child: FilledButton(
        onPressed: loading ? null : onPressed,
        child: loading
            ? SizedBox(
                height: 22,
                width: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: scheme.onPrimary,
                ),
              )
            : Text(label),
      ),
    );
  }
}

/// "Continue with Google" button using the official multi-colour Google glyph.
///
/// This drives the federated Google flow via Keycloak (`kc_idp_hint`); it is a
/// real OAuth hand-off, never a decorative button. Rendered only when the
/// environment enables Google sign-in.
class GoogleSignInButton extends StatelessWidget {
  const GoogleSignInButton({
    required this.label,
    required this.onPressed,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return SizedBox(
      height: 52,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: palette.ink,
          side: BorderSide(color: palette.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SvgPicture.string(googleGLogoSvg, width: 20, height: 20),
            const SizedBox(width: AppSpacing.s + 2),
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Labelled "or" divider separating primary and alternate auth actions.
class AuthOrDivider extends StatelessWidget {
  const AuthOrDivider({required this.label, super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Row(
      children: [
        Expanded(child: Divider(color: palette.border)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
          child: Text(
            label,
            style: text.bodySmall?.copyWith(color: palette.inkTertiary),
          ),
        ),
        Expanded(child: Divider(color: palette.border)),
      ],
    );
  }
}

/// Inline, dismissable-free status banner used for errors and successes.
class AuthBanner extends StatelessWidget {
  const AuthBanner._({
    required this.message,
    required this.icon,
    required this.foreground,
    required this.background,
    required this.border,
  });

  /// Error variant (danger tones).
  factory AuthBanner.error(BuildContext context, String message) {
    final palette = context.palette;
    return AuthBanner._(
      message: message,
      icon: Icons.error_outline,
      foreground: palette.danger,
      background: palette.dangerSoft,
      border: palette.danger.withValues(alpha: 0.28),
    );
  }

  /// Success variant (positive tones).
  factory AuthBanner.success(BuildContext context, String message) {
    final palette = context.palette;
    return AuthBanner._(
      message: message,
      icon: Icons.check_circle_outline,
      foreground: palette.success,
      background: palette.successSoft,
      border: palette.success.withValues(alpha: 0.28),
    );
  }

  final String message;
  final IconData icon;
  final Color foreground;
  final Color background;
  final Color border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.m),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: foreground, size: 20),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: foreground),
            ),
          ),
        ],
      ),
    );
  }
}

/// Footer row linking between Login and Register, e.g. "No account? Register".
class AuthFooterPrompt extends StatelessWidget {
  const AuthFooterPrompt({
    required this.prompt,
    required this.actionLabel,
    required this.onPressed,
    super.key,
  });

  final String prompt;
  final String actionLabel;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Flexible(
          child: Text(
            prompt,
            style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        TextButton(
          onPressed: onPressed,
          style: TextButton.styleFrom(
            foregroundColor: palette.accent,
            textStyle: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            minimumSize: const Size(0, 48),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s),
          ),
          child: Text(actionLabel),
        ),
      ],
    );
  }
}
