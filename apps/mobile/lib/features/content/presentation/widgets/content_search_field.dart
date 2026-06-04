import 'package:flutter/material.dart';
import 'package:nihongo_bjt/core/api/debouncer.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';

/// A debounced search input shared by the dictionary, kanji and grammar
/// browsers. Reports the settled query via [onChanged] 300ms after the user
/// stops typing (and immediately on submit/clear), so callers fire at most one
/// request per pause. Owns its own controller and debouncer.
class ContentSearchField extends StatefulWidget {
  const ContentSearchField({
    required this.hintText,
    required this.onChanged,
    this.controller,
    this.onSubmitted,
    this.autofocus = true,
    super.key,
  });

  final String hintText;

  /// Called with the trimmed, settled query.
  final ValueChanged<String> onChanged;

  /// Optional externally-owned controller, so callers can set the text
  /// programmatically (e.g. tapping a recent-search chip). When null the field
  /// owns its own controller.
  final TextEditingController? controller;

  /// Called with the trimmed query when the learner presses the keyboard search
  /// action (in addition to [onChanged]). Lets callers record submitted
  /// queries without recording every debounced keystroke.
  final ValueChanged<String>? onSubmitted;

  final bool autofocus;

  @override
  State<ContentSearchField> createState() => _ContentSearchFieldState();
}

class _ContentSearchFieldState extends State<ContentSearchField> {
  late final TextEditingController _controller =
      widget.controller ?? TextEditingController();
  final Debouncer _debouncer = Debouncer();
  bool _hasText = false;

  bool get _ownsController => widget.controller == null;

  @override
  void initState() {
    super.initState();
    _hasText = _controller.text.trim().isNotEmpty;
    // Keep the clear button in sync when the text is set programmatically.
    _controller.addListener(_syncHasText);
  }

  @override
  void dispose() {
    _controller.removeListener(_syncHasText);
    _debouncer.dispose();
    if (_ownsController) _controller.dispose();
    super.dispose();
  }

  void _syncHasText() {
    final hasText = _controller.text.trim().isNotEmpty;
    if (hasText != _hasText) setState(() => _hasText = hasText);
  }

  void _onChanged(String value) {
    _debouncer.run(() => widget.onChanged(value.trim()));
  }

  void _submit(String value) {
    _debouncer.cancel();
    final trimmed = value.trim();
    widget.onChanged(trimmed);
    widget.onSubmitted?.call(trimmed);
  }

  void _clear() {
    _debouncer.cancel();
    _controller.clear();
    widget.onChanged('');
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final text = Theme.of(context).textTheme;

    return TextField(
      controller: _controller,
      autofocus: widget.autofocus,
      textInputAction: TextInputAction.search,
      onChanged: _onChanged,
      onSubmitted: _submit,
      style: text.bodyMedium?.copyWith(color: palette.ink),
      cursorColor: palette.accent,
      decoration: InputDecoration(
        filled: true,
        fillColor: palette.surface,
        hintText: widget.hintText,
        hintStyle: text.bodyMedium?.copyWith(color: palette.inkTertiary),
        prefixIcon: Icon(Icons.search_rounded, color: palette.inkSecondary),
        suffixIcon: _hasText
            ? IconButton(
                icon: Icon(Icons.close_rounded, color: palette.inkSecondary),
                tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
                onPressed: _clear,
              )
            : null,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.m,
          vertical: AppSpacing.m,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: palette.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: palette.accent, width: 2),
        ),
      ),
    );
  }
}
