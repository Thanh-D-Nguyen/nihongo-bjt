// Widget previews for the core shared design-system components.
//
// These are render-only previews for the Flutter Widget Previewer
// (`flutter widget-preview start`, or the "Flutter Widget Preview" tab in VS
// Code). They are NOT a substitute for the widget tests in
// `test/shared/widgets/` — every component here also has a behavioral test.
//
// Each preview renders inside the real [AppTheme] (light + dark via
// [ThemeMode.system], which the previewer toggles through its brightness
// control) so colors, radii and typography match production exactly. Sample
// text is static preview content, clearly not backed by any API.
//
// ignore_for_file: lines_longer_than_80_chars
import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';
import 'package:nihongo_bjt/core/theme/app_palette.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/core/theme/app_theme.dart';
import 'package:nihongo_bjt/shared/widgets/app_card.dart';
import 'package:nihongo_bjt/shared/widgets/app_chip.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/empty_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/learning_progress_card.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/offline_banner.dart';
import 'package:nihongo_bjt/shared/widgets/primary_button.dart';
import 'package:nihongo_bjt/shared/widgets/section_header.dart';

/// Light + dark preview pair that renders the target inside the real app theme
/// on the canvas background, padded for breathing room. The previewer's
/// brightness control drives [ThemeMode.system], so both rows reflect the
/// production palette.
final class _ThemedPreview extends MultiPreview {
  const _ThemedPreview({required this.name, this.size});

  final String name;
  final Size? size;

  @override
  List<Preview> get previews => const [
        Preview(brightness: Brightness.light),
        Preview(brightness: Brightness.dark),
      ];

  @override
  List<Preview> transform() {
    return super.transform().map((preview) {
      final builder = preview.toBuilder()
        ..group = 'Shared components'
        ..name = '$name · ${preview.brightness == Brightness.dark ? 'dark' : 'light'}';
      if (size != null) builder.size = size;
      return builder.build();
    }).toList();
  }
}

/// Wraps [child] in a MaterialApp using the real light/dark themes plus a
/// padded canvas, so previews look exactly like the running app.
Widget _wrap(Widget child) {
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    darkTheme: AppTheme.dark,
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

// ── Buttons ────────────────────────────────────────────────────────────────

@_ThemedPreview(name: 'PrimaryButton')
Widget primaryButtonPreview() => _wrap(
      const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          PrimaryButton(label: 'Bắt đầu học', onPressed: _noop),
          SizedBox(height: AppSpacing.m),
          PrimaryButton(
            label: 'Tiếp tục',
            icon: Icons.play_arrow_rounded,
            onPressed: _noop,
          ),
          SizedBox(height: AppSpacing.m),
          PrimaryButton(label: 'Đang tải…', onPressed: _noop, isLoading: true),
          SizedBox(height: AppSpacing.m),
          PrimaryButton(label: 'Vô hiệu hoá', onPressed: null),
        ],
      ),
    );

@_ThemedPreview(name: 'PrimaryButton · JA long label')
Widget primaryButtonJapanesePreview() => _wrap(
      const PrimaryButton(
        label: 'ビジネス日本語能力テストの練習を始める',
        icon: Icons.school_outlined,
        onPressed: _noop,
      ),
    );

@_ThemedPreview(name: 'SecondaryButton')
Widget secondaryButtonPreview() => _wrap(
      const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SecondaryButton(label: 'Để sau', onPressed: _noop),
          SizedBox(height: AppSpacing.m),
          SecondaryButton(
            label: 'Xem lại',
            icon: Icons.history_rounded,
            onPressed: _noop,
          ),
          SizedBox(height: AppSpacing.m),
          SecondaryButton(label: 'Vô hiệu hoá', onPressed: null),
        ],
      ),
    );

// ── Cards & chrome ───────────────────────────────────────────────────────────

@_ThemedPreview(name: 'AppCard')
Widget appCardPreview() => _wrap(
      const AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Bài 12 · Kính ngữ trong email công việc'),
            SizedBox(height: AppSpacing.s),
            Text(
              '敬語を正しく使って、取引先に失礼のないメールを書けるようになりましょう。',
            ),
          ],
        ),
      ),
    );

@_ThemedPreview(name: 'AppChip')
Widget appChipPreview() => _wrap(
      const Wrap(
        spacing: AppSpacing.s,
        runSpacing: AppSpacing.s,
        children: [
          AppChip(label: 'N3', selected: true, onTap: _noop),
          AppChip(label: 'Kính ngữ', onTap: _noop),
          AppChip(label: '聴解', icon: Icons.headphones_outlined, onTap: _noop),
          AppChip(label: 'Đã lưu', icon: Icons.bookmark_outline, onTap: _noop),
        ],
      ),
    );

@_ThemedPreview(name: 'SectionHeader')
Widget sectionHeaderPreview() => _wrap(
      Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SectionHeader(
            title: 'Tiếp tục học',
            subtitle: 'Hôm nay bạn còn 3 bài ôn tập',
            action: TextButton(onPressed: () {}, child: const Text('Tất cả')),
          ),
          const SizedBox(height: AppSpacing.l),
          const SectionHeader(title: '今日の練習'),
        ],
      ),
    );

@_ThemedPreview(name: 'LearningProgressCard')
Widget learningProgressCardPreview() => _wrap(
      const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          LearningProgressCard(
            label: 'Bài học tuần này',
            valueLabel: '12 / 20',
            progress: 0.6,
            icon: Icons.menu_book_outlined,
          ),
          SizedBox(height: AppSpacing.m),
          LearningProgressCard(
            label: '語彙の習得',
            valueLabel: '100%',
            progress: 1,
            icon: Icons.spellcheck_rounded,
          ),
        ],
      ),
    );

// ── State views ──────────────────────────────────────────────────────────────

@_ThemedPreview(name: 'LoadingStateView')
Widget loadingStateViewPreview() => _wrap(const LoadingStateView());

@_ThemedPreview(name: 'EmptyStateView')
Widget emptyStateViewPreview() => _wrap(
      EmptyStateView(
        title: 'Chưa có thẻ nào để ôn',
        message:
            'Hãy hoàn thành một bài học để hệ thống tạo thẻ ghi nhớ phù hợp với bạn.',
        icon: Icons.style_outlined,
        action: PrimaryButton(
          label: 'Bắt đầu học',
          expand: false,
          onPressed: () {},
        ),
      ),
    );

@_ThemedPreview(name: 'ErrorStateView')
Widget errorStateViewPreview() => _wrap(
      ErrorStateView(
        title: 'Không tải được nội dung',
        message: 'Vui lòng kiểm tra kết nối mạng và thử lại.',
        retryLabel: 'Thử lại',
        onRetry: () {},
      ),
    );

@_ThemedPreview(name: 'OfflineBanner')
Widget offlineBannerPreview() => _wrap(
      const OfflineBanner(
        message: 'Bạn đang ngoại tuyến — một số nội dung có thể chưa cập nhật.',
      ),
    );

// ── Scaffold ─────────────────────────────────────────────────────────────────

@_ThemedPreview(name: 'AppScaffold', size: Size(390, 600))
Widget appScaffoldPreview() => MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      home: const AppScaffold(
        title: 'Học',
        body: Padding(
          padding: EdgeInsets.all(AppSpacing.l),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SectionHeader(title: 'Tiếp tục học'),
              SizedBox(height: AppSpacing.m),
              AppCard(child: Text('Bài 12 · Kính ngữ trong email công việc')),
            ],
          ),
        ),
      ),
    );

/// Shared no-op tap handler. Must be a public top-level constant so it can be
/// referenced from `const` preview widgets (the previewer requires const,
/// public callbacks).
void noop() {}

const VoidCallback _noop = noop;
