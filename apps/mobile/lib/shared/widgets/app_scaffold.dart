import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';

/// Standard screen scaffold that pins the canvas background and an optional,
/// flat app bar driven by the palette. Keeps every screen visually consistent
/// in light and dark without each page re-deriving theme colors.
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    required this.body,
    this.title,
    this.actions,
    this.leading,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.centerTitle = false,
    this.resizeToAvoidBottomInset = true,
    this.maxContentWidth = 640,
    super.key,
  });

  final Widget body;
  final String? title;
  final List<Widget>? actions;
  final Widget? leading;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;
  final bool centerTitle;
  final bool resizeToAvoidBottomInset;

  /// Caps the body width on wide screens (tablet/landscape) for readable line
  /// lengths, centering it. On phones (narrower than this) the body fills the
  /// width as usual.
  final double maxContentWidth;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: palette.canvas,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      appBar: title == null && actions == null && leading == null
          ? null
          : AppBar(
              backgroundColor: palette.canvas,
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 0,
              centerTitle: centerTitle,
              leading: leading,
              title: title == null
                  ? null
                  : Text(
                      title!,
                      style: text.titleLarge?.copyWith(color: palette.ink),
                    ),
              actions: actions,
            ),
      body: SafeArea(
        top: title == null,
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxContentWidth),
            child: body,
          ),
        ),
      ),
      bottomNavigationBar: bottomNavigationBar,
      floatingActionButton: floatingActionButton,
    );
  }
}
