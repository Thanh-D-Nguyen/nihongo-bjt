// Widget previews for the Career RPG reusable widgets.
//
// Render-only previews for the Flutter Widget Previewer; they complement the
// behavioral tests in `test/features/career/`. Each renders inside the real
// [AppTheme] (light + dark) with localization wired so the NPC avatar tints and
// the skill-bar labels/progress match production. Sample data is static.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/career/domain/career_models.dart';
import 'package:nihongo_bjt/features/career/presentation/widgets/career_skill_bar.dart';
import 'package:nihongo_bjt/features/career/presentation/widgets/npc_avatar.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// Light + dark preview pair rendered inside the real app theme.
final class _ThemedPreview extends MultiPreview {
  const _ThemedPreview({required this.name});

  final String name;

  @override
  List<Preview> get previews => const [
        Preview(brightness: Brightness.light),
        Preview(brightness: Brightness.dark),
      ];

  @override
  List<Preview> transform() {
    return super.transform().map((preview) {
      final builder = preview.toBuilder()
        ..group = 'Career'
        ..name = '$name · ${preview.brightness == Brightness.dark ? 'dark' : 'light'}';
      return builder.build();
    }).toList();
  }
}

/// Wraps [child] in a MaterialApp using the real themes + localization so the
/// preview looks exactly like the running Career screens.
Widget _wrap(Widget child) {
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    darkTheme: AppTheme.dark,
    locale: const Locale('vi'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Builder(
      builder: (context) => Scaffold(
        backgroundColor: context.palette.canvas,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.l),
            child: Center(child: child),
          ),
        ),
      ),
    ),
  );
}

// ── NPC avatar ──────────────────────────────────────────────────────────────

@_ThemedPreview(name: 'NpcAvatar · tinted')
Widget npcAvatarPreview() => _wrap(
      const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          NpcAvatar(initial: '部', tintHex: '#2563EB'),
          SizedBox(width: AppSpacing.m),
          NpcAvatar(initial: '田', tintHex: '#16A34A', size: 56),
          SizedBox(width: AppSpacing.m),
          NpcAvatar(initial: '?', tintHex: 'not-a-hex'),
        ],
      ),
    );

// ── Career skill bar ────────────────────────────────────────────────────────

@_ThemedPreview(name: 'CareerSkillBar')
Widget careerSkillBarPreview() => _wrap(
      const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CareerSkillBar(skill: CareerSkill(axisCode: 'keigo', value: 72)),
          SizedBox(height: AppSpacing.m),
          CareerSkillBar(skill: CareerSkill(axisCode: 'meeting', value: 35)),
          SizedBox(height: AppSpacing.m),
          CareerSkillBar(skill: CareerSkill(axisCode: 'customer', value: 100)),
        ],
      ),
    );
