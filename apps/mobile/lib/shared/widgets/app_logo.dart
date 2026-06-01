import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_colors.dart';

/// Brand wordmark for NihonGo BJT.
///
/// Reused across the home shell, auth, and splash surfaces. Navy lead word +
/// blue accent per the brand color system in `DESIGN.md`.
class AppLogo extends StatelessWidget {
  const AppLogo({this.fontSize = 28, super.key});

  final double fontSize;

  @override
  Widget build(BuildContext context) {
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
            style: style.copyWith(color: AppColors.navy),
          ),
          TextSpan(
            text: 'BJT',
            style: style.copyWith(color: AppColors.blue),
          ),
        ],
      ),
    );
  }
}
