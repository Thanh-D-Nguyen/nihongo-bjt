// Widget previews for the Flashcards feature's reusable editor row.
//
// Render-only previews for the Flutter Widget Previewer; they complement the
// behavioral tests in `test/features/flashcards/`. Each renders inside the real
// [AppTheme] (light + dark) with localization wired so Japanese typography,
// field affordances and the error state match production. The controllers hold
// static preview content, not API-backed data.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_card_input.dart';
import 'package:nihongo_bjt/features/flashcards/domain/deck_form_input.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/widgets/deck_card_editor_row.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';

/// No-op so the row renders enabled without side effects.
void noop() {}
const VoidCallback _noop = noop;

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
        ..group = 'Flashcards'
        ..name =
            '$name · ${preview.brightness == Brightness.dark ? 'dark' : 'light'}';
      return builder.build();
    }).toList();
  }
}

/// Wraps [child] in a MaterialApp using the real themes + localization so the
/// preview looks exactly like the running Create Set / bulk-add editor.
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
            child: Center(
              child: SingleChildScrollView(child: child),
            ),
          ),
        ),
      ),
    ),
  );
}

DeckCardRowController _filledRow() => DeckCardRowController(
  front: '会議',
  back: 'cuộc họp',
  reading: 'かいぎ',
);

DeckCardRowController _erroredRow() {
  return DeckCardRowController(back: 'chỉ có nghĩa, thiếu mặt trước')
    ..errors = const DeckCardFormErrors(frontText: DeckFieldError.required);
}

// ── Card editor row ─────────────────────────────────────────────────────────

@_ThemedPreview(name: 'DeckCardEditorRow · default')
Widget deckCardRowDefaultPreview() => _wrap(
  DeckCardEditorRow(
    index: 1,
    controller: _filledRow(),
    showReading: false,
    canRemove: true,
    onRemove: _noop,
  ),
);

@_ThemedPreview(name: 'DeckCardEditorRow · with reading')
Widget deckCardRowReadingPreview() => _wrap(
  DeckCardEditorRow(
    index: 2,
    controller: _filledRow(),
    showReading: true,
    canRemove: true,
    onRemove: _noop,
  ),
);

@_ThemedPreview(name: 'DeckCardEditorRow · error')
Widget deckCardRowErrorPreview() => _wrap(
  DeckCardEditorRow(
    index: 3,
    controller: _erroredRow(),
    showReading: false,
    canRemove: false,
    onRemove: _noop,
  ),
);

// ── Reading toggle ──────────────────────────────────────────────────────────

@_ThemedPreview(name: 'DeckCardReadingToggle · off')
Widget deckCardReadingToggleOffPreview() => _wrap(
  const DeckCardReadingToggle(value: false, onChanged: null),
);

@_ThemedPreview(name: 'DeckCardReadingToggle · on')
Widget deckCardReadingToggleOnPreview() => _wrap(
  const DeckCardReadingToggle(value: true, onChanged: null),
);
