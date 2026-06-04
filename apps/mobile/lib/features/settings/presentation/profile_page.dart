import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/settings/domain/user_settings.dart';
import 'package:nihongo_bjt/features/settings/presentation/settings_controller.dart';
import 'package:nihongo_bjt/features/settings/presentation/widgets/profile_about_card.dart';
import 'package:nihongo_bjt/features/settings/presentation/widgets/profile_action_grid.dart';
import 'package:nihongo_bjt/features/settings/presentation/widgets/profile_hero_section.dart';
import 'package:nihongo_bjt/features/settings/presentation/widgets/profile_identity_card.dart';
import 'package:nihongo_bjt/features/settings/presentation/widgets/profile_preferences.dart';
import 'package:nihongo_bjt/features/settings/presentation/widgets/profile_shared.dart';
import 'package:nihongo_bjt/features/settings/presentation/widgets/profile_snapshot_card.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';

// Re-exported so existing tests/imports keep resolving the version provider
// from this entrypoint while the impl lives in profile_providers.dart.
export 'package:nihongo_bjt/features/settings/presentation/profile_providers.dart'
    show appPackageInfoProvider;

/// "Me" hub (Phase 10.2): the learner's account, learning snapshot, quick
/// actions, preferences, account/about info, and sign-out — all backed by real
/// data (identity claims, device-local study summary, live subscription, real
/// build version). No fabricated metrics, no dead rows.
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
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.m,
          AppSpacing.m,
          AppSpacing.m,
          AppSpacing.xl,
        ),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ProfileHeroSection(claims: claims),
                const SizedBox(height: AppSpacing.m),
                const ProfileSnapshotCard(),
                const SizedBox(height: AppSpacing.m),
                ProfileIdentityCard(claims: claims),
                const SizedBox(height: AppSpacing.l),
                ProfileSectionLabel(l10n.profileActionsSection),
                const SizedBox(height: AppSpacing.s),
                const ProfileActionGrid(),
                const SizedBox(height: AppSpacing.l),
                ProfileSectionLabel(l10n.profilePreferencesSection),
                const SizedBox(height: AppSpacing.s),
                ProfileLanguageCard(selected: settings.localeOption),
                const SizedBox(height: AppSpacing.m),
                ProfileThemeCard(selected: settings.themeOption),
                const SizedBox(height: AppSpacing.m),
                ProfileFuriganaCard(enabled: settings.furiganaEnabled),
                const SizedBox(height: AppSpacing.m),
                ProfileHapticsCard(enabled: settings.hapticsEnabled),
                const SizedBox(height: AppSpacing.l),
                ProfileSectionLabel(l10n.profileAboutSection),
                const SizedBox(height: AppSpacing.s),
                const ProfileAboutCard(),
                const SizedBox(height: AppSpacing.xl),
                const ProfileSignOutButton(),
              ],
            ),
          ),
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
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: palette.inkSecondary),
          ),
        ],
      ),
    );
  }
}
