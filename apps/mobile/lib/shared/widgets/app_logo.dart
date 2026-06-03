import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';

/// Brand wordmark for NihonGo BJT.
///
/// Reused across the home shell, auth, and splash surfaces. The lead word uses
/// the primary ink color (so it stays readable on dark canvas) and `BJT` uses
/// the interactive accent, per the brand color system in `DESIGN.md`.
class AppLogo extends StatelessWidget {
  const AppLogo({this.fontSize = 28, super.key});

  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final style = TextStyle(
      fontSize: fontSize,
      fontWeight: FontWeight.w700,
      height: 1.2,
    );

    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: 'NihonGo ',
            style: style.copyWith(color: palette.ink),
          ),
          TextSpan(
            text: 'BJT',
            style: style.copyWith(color: palette.accent),
          ),
        ],
      ),
    );
  }
}
