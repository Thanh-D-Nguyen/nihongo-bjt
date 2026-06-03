import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/app/router.dart';
import 'package:nihongo_bjt/core/theme/app_motion.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/settings/domain/app_locale_option.dart';
import 'package:nihongo_bjt/features/settings/domain/id_token_claims.dart';
import 'package:nihongo_bjt/features/settings/domain/user_settings.dart';
import 'package:nihongo_bjt/features/settings/presentation/settings_controller.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Resolves the real installed app version + build number from the platform
/// (CFBundleShortVersionString / versionName). No hardcoded version strings, so
/// the About row can never drift from the actual build.
final appPackageInfoProvider = FutureProvider<PackageInfo>((ref) {
  return PackageInfo.fromPlatform();
});


/// Profile & settings screen (Phase 10.2).
///
/// Shows the authenticated learner's identity (decoded from their own ID
/// token), lets them choose the app language and toggle furigana display, and
/// sign out. Preferences persist device-locally via the settings controller;
/// sign-out routes back to login through the auth guard.
class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);

    final auth = ref.watch(authControllerProvider);
    final claims = ref.watch(profileClaimsProvider);
    final settings =
        ref.watch(settingsControllerProvider).value ?? UserSettings.defaults;

    // During sign-out the session is being torn down: show an explicit
    // signing-out state instead of the fallback learner identity so the
    // learner gets clear feedback and never sees a confusing authenticated
    // profile flash before the redirect to login (ANDROID-QA-P2-003).
    if (auth.isLoading && claims.isEmpty) {
      return AppScaffold(
        title: l10n.profileTitle,
        body: _SigningOutView(message: l10n.profileSigningOut),
      );
    }

    return AppScaffold(
      title: l10n.profileTitle,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SectionLabel(l10n.profileAccountSection),
            const SizedBox(height: AppSpacing.s),
            _AccountCard(claims: claims),
            const SizedBox(height: AppSpacing.m),
            const _SubscriptionEntryCard(),
            const SizedBox(height: AppSpacing.l),
            _SectionLabel(l10n.profilePreferencesSection),
            const SizedBox(height: AppSpacing.s),
            _LanguageCard(selected: settings.localeOption),
            const SizedBox(height: AppSpacing.m),
            _FuriganaCard(enabled: settings.furiganaEnabled),
            const SizedBox(height: AppSpacing.l),
            _SectionLabel(l10n.profileAboutSection),
            const SizedBox(height: AppSpacing.s),
            const _AboutCard(),
            const SizedBox(height: AppSpacing.xl),
            const _SignOutButton(),
          ],
        ),
      ),
    );
  }
}

/// Centered signing-out indicator shown while the auth session is being torn
/// down, before the auth guard redirects to login.
class _SigningOutView extends StatelessWidget {
  const _SigningOutView({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: palette.accent,
            ),
          ),
          const SizedBox(height: AppSpacing.m),
          Text(
            message,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: palette.inkSecondary),
          ),
        ],
      ),
    );
  }
}

/// Runs a preference [change], surfacing any persistence failure as a SnackBar.
/// The controller reverts its optimistic state on failure, so the UI stays
/// consistent with what is actually stored.
Future<void> _persistChange(
  BuildContext context,
  AppLocalizations l10n,
  Future<void> Function() change,
) async {
  try {
    await change();
  } on Object {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l10n.profileSaveError)));
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: AppSpacing.xs),
      child: Text(
        text.toUpperCase(),
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: context.palette.inkTertiary,
          letterSpacing: 0.8,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// Navigation card into the subscription & plans screen. Lives in the account
/// section so billing is discoverable from the learner's profile.
class _SubscriptionEntryCard extends StatelessWidget {
  const _SubscriptionEntryCard();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final l10n = AppLocalizations.of(context);

    return AppCard(
      onTap: () => unawaited(context.pushNamed(Routes.subscription)),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: palette.accentSoft,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(
              Icons.workspace_premium_outlined,
              size: 22,
              color: palette.accent,
            ),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.subscriptionTitle,
                  style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.subscriptionSubtitle,
                  style: text.bodySmall?.copyWith(
                    color: palette.inkSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Icon(
            Icons.chevron_right_rounded,
            color: palette.inkTertiary,
          ),
        ],
      ),
    );
  }
}

class _AccountCard extends ConsumerWidget {
  const _AccountCard({required this.claims});

  final IdTokenClaims claims;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final displayName = claims.displayName ?? l10n.profileLearnerFallback;
    final secondary = claims.secondaryLabel;

    return AppCard(
      child: Row(
        children: [
          _Avatar(label: displayName),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayName,
                  style: text.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (secondary != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    secondary,
                    style: text.bodySmall?.copyWith(
                      color: context.palette.inkSecondary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final initial = label.trim().isEmpty
        ? '?'
        : label.trim().characters.first.toUpperCase();
    return Container(
      width: 56,
      height: 56,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: context.palette.accent,
        shape: BoxShape.circle,
      ),
      child: Text(
        initial,
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _LanguageCard extends ConsumerWidget {
  const _LanguageCard({required this.selected});

  final AppLocaleOption selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;

    String labelFor(AppLocaleOption option) => switch (option) {
      AppLocaleOption.system => l10n.profileLanguageSystem,
      AppLocaleOption.vietnamese => l10n.profileLanguageVietnamese,
      AppLocaleOption.japanese => l10n.profileLanguageJapanese,
    };

    return AppCard(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.m,
        vertical: AppSpacing.s,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.xs,
              AppSpacing.s,
              AppSpacing.xs,
              AppSpacing.xs,
            ),
            child: Text(
              l10n.profileLanguageTitle,
              style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          for (final option in AppLocaleOption.values)
            _OptionRow(
              label: labelFor(option),
              selected: option == selected,
              onTap: option == selected
                  ? null
                  : () => _persistChange(
                      context,
                      l10n,
                      () => ref
                          .read(settingsControllerProvider.notifier)
                          .setLocaleOption(option),
                    ),
            ),
        ],
      ),
    );
  }
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        focusColor: palette.accent.withValues(alpha: 0.12),
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xs,
            vertical: AppSpacing.s,
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: text.bodyLarge?.copyWith(
                    color: selected ? palette.accent : palette.ink,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
                  ),
                ),
              ),
              AnimatedScale(
                scale: selected ? 1 : 0,
                duration: reduceMotion ? Duration.zero : AppMotion.fast,
                child: Icon(
                  Icons.check_circle_rounded,
                  color: palette.accent,
                  size: 22,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FuriganaCard extends ConsumerWidget {
  const _FuriganaCard({required this.enabled});

  final bool enabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    void toggle() => _persistChange(
      context,
      l10n,
      () => ref
          .read(settingsControllerProvider.notifier)
          .setFuriganaEnabled(enabled: !enabled),
    );

    // A Row (not SwitchListTile) so the control can live inside AppCard's
    // decorated surface without a ListTile/Material ink conflict.
    return AppCard(
      child: Semantics(
        toggled: enabled,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.profileFuriganaTitle,
                    style: text.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    l10n.profileFuriganaSubtitle,
                    style: text.bodySmall?.copyWith(
                      color: palette.inkSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.m),
            Switch.adaptive(
              value: enabled,
              activeThumbColor: palette.accent,
              onChanged: (_) => toggle(),
            ),
          ],
        ),
      ),
    );
  }
}

/// About card showing the real installed app version + build number. While the
/// platform value resolves, the version row renders an em dash placeholder —
/// never a fabricated version.
class _AboutCard extends ConsumerWidget {
  const _AboutCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
    final info = ref.watch(appPackageInfoProvider);

    final value = info.maybeWhen(
      data: (data) => l10n.profileVersionValue(data.version, data.buildNumber),
      orElse: () => '—',
    );

    return AppCard(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: palette.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(
              Icons.info_outline_rounded,
              size: 20,
              color: palette.inkSecondary,
            ),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Text(
              l10n.profileAppVersion,
              style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: text.bodyMedium?.copyWith(color: palette.inkSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

class _SignOutButton extends ConsumerWidget {
  const _SignOutButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final palette = context.palette;
    final isSigningOut = ref.watch(authControllerProvider).isLoading;

    return SizedBox(
      height: 52,
      child: OutlinedButton.icon(
        onPressed: isSigningOut
            ? null
            : () => ref.read(authControllerProvider.notifier).signOut(),
        style: OutlinedButton.styleFrom(
          foregroundColor: palette.danger,
          side: BorderSide(color: palette.danger),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
        ),
        icon: isSigningOut
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: palette.danger,
                ),
              )
            : const Icon(Icons.logout_rounded, size: 20),
        label: Text(l10n.profileSignOut),
      ),
    );
  }
}
