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
    this.autofocus = true,
    super.key,
  });

  final String hintText;

  /// Called with the trimmed, settled query.
  final ValueChanged<String> onChanged;
  final bool autofocus;

  @override
  State<ContentSearchField> createState() => _ContentSearchFieldState();
}

class _ContentSearchFieldState extends State<ContentSearchField> {
  final TextEditingController _controller = TextEditingController();
  final Debouncer _debouncer = Debouncer();
  bool _hasText = false;

  @override
  void dispose() {
    _debouncer.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    final hasText = value.trim().isNotEmpty;
    if (hasText != _hasText) setState(() => _hasText = hasText);
    _debouncer.run(() => widget.onChanged(value.trim()));
  }

  void _submit(String value) {
    _debouncer.cancel();
    widget.onChanged(value.trim());
  }

  void _clear() {
    _debouncer.cancel();
    _controller.clear();
    setState(() => _hasText = false);
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
