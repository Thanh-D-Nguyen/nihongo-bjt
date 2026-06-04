import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:nihongo_bjt/core/theme/app_motion.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/settings/domain/app_locale_option.dart';
import 'package:nihongo_bjt/features/settings/domain/app_theme_option.dart';
import 'package:nihongo_bjt/features/settings/presentation/settings_controller.dart';
import 'package:nihongo_bjt/features/settings/presentation/widgets/profile_shared.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';

/// App-language selector (system / Vietnamese / Japanese).
class ProfileLanguageCard extends ConsumerWidget {
  const ProfileLanguageCard({required this.selected, super.key});

  final AppLocaleOption selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);

    String labelFor(AppLocaleOption option) => switch (option) {
      AppLocaleOption.system => l10n.profileLanguageSystem,
      AppLocaleOption.vietnamese => l10n.profileLanguageVietnamese,
      AppLocaleOption.japanese => l10n.profileLanguageJapanese,
    };

    return _OptionCard(
      title: l10n.profileLanguageTitle,
      children: [
        for (final option in AppLocaleOption.values)
          ProfileOptionRow(
            label: labelFor(option),
            selected: option == selected,
            onTap: option == selected
                ? null
                : () => persistProfileChange(
                    context,
                    l10n,
                    () => ref
                        .read(settingsControllerProvider.notifier)
                        .setLocaleOption(option),
                  ),
          ),
      ],
    );
  }
}

/// App-appearance selector (system / light / dark).
class ProfileThemeCard extends ConsumerWidget {
  const ProfileThemeCard({required this.selected, super.key});

  final AppThemeOption selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);

    String labelFor(AppThemeOption option) => switch (option) {
      AppThemeOption.system => l10n.profileThemeSystem,
      AppThemeOption.light => l10n.profileThemeLight,
      AppThemeOption.dark => l10n.profileThemeDark,
    };

    return _OptionCard(
      title: l10n.profileThemeTitle,
      children: [
        for (final option in AppThemeOption.values)
          ProfileOptionRow(
            label: labelFor(option),
            selected: option == selected,
            onTap: option == selected
                ? null
                : () => persistProfileChange(
                    context,
                    l10n,
                    () => ref
                        .read(settingsControllerProvider.notifier)
                        .setThemeOption(option),
                  ),
          ),
      ],
    );
  }
}

class _OptionCard extends StatelessWidget {
  const _OptionCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
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
              title,
              style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          ...children,
        ],
      ),
    );
  }
}

/// Single radio-style selectable row used by the language/theme cards.
class ProfileOptionRow extends StatelessWidget {
  const ProfileOptionRow({
    required this.label,
    required this.selected,
    required this.onTap,
    super.key,
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

/// Furigana display toggle.
class ProfileFuriganaCard extends ConsumerWidget {
  const ProfileFuriganaCard({required this.enabled, super.key});

  final bool enabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return _ToggleCard(
      title: l10n.profileFuriganaTitle,
      subtitle: l10n.profileFuriganaSubtitle,
      enabled: enabled,
      onToggle: () => persistProfileChange(
        context,
        l10n,
        () => ref
            .read(settingsControllerProvider.notifier)
            .setFuriganaEnabled(enabled: !enabled),
      ),
    );
  }
}

/// Haptic feedback toggle.
class ProfileHapticsCard extends ConsumerWidget {
  const ProfileHapticsCard({required this.enabled, super.key});

  final bool enabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return _ToggleCard(
      title: l10n.profileHapticsTitle,
      subtitle: l10n.profileHapticsSubtitle,
      enabled: enabled,
      onToggle: () => persistProfileChange(
        context,
        l10n,
        () => ref
            .read(settingsControllerProvider.notifier)
            .setHapticsEnabled(enabled: !enabled),
      ),
    );
  }
}

/// Shared inline Row+Switch card (kept out of ListTile so it lives inside
/// AppCard's surface without an ink conflict).
class _ToggleCard extends StatelessWidget {
  const _ToggleCard({
    required this.title,
    required this.subtitle,
    required this.enabled,
    required this.onToggle,
  });

  final String title;
  final String subtitle;
  final bool enabled;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;
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
                    title,
                    style: text.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
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
              onChanged: (_) => onToggle(),
            ),
          ],
        ),
      ),
    );
  }
}
