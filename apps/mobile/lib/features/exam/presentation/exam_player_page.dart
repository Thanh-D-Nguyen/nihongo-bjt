import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:nihongo_bjt/core/api/repository_result.dart';
import 'package:nihongo_bjt/core/feedback/app_haptics.dart';
import 'package:nihongo_bjt/core/theme/app_radius.dart';
import 'package:nihongo_bjt/core/theme/app_spacing.dart';
import 'package:nihongo_bjt/features/exam/domain/exam_models.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_player_view.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_providers.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_result_view.dart';
import 'package:nihongo_bjt/features/exam/presentation/exam_review_view.dart';
import 'package:nihongo_bjt/l10n/gen/app_localizations.dart';
import 'package:nihongo_bjt/shared/widgets/app_scaffold.dart';
import 'package:nihongo_bjt/shared/widgets/error_state_view.dart';
import 'package:nihongo_bjt/shared/widgets/loading_state_view.dart';

/// The phase of the live exam session.
enum _Phase { starting, playing, submitting, completed, reviewShown, error }

/// Full-screen scored BJT exam player backed by `/api/quiz`. Lives outside the
/// bottom-nav shell so the timer/question/CTA never compete with navigation.
/// Answer correctness is never revealed mid-session; only the final scored
/// result is shown.
class ExamPlayerPage extends ConsumerStatefulWidget {
  const ExamPlayerPage({required this.testId, super.key});

  final String testId;

  @override
  ConsumerState<ExamPlayerPage> createState() => _ExamPlayerPageState();
}

class _ExamPlayerPageState extends ConsumerState<ExamPlayerPage> {
  _Phase _phase = _Phase.starting;
  ExamQuestion? _question;
  ExamSession? _session;
  String? _selectedKey;
  int? _remaining;
  bool _upgradeRequired = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    unawaited(_start());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    setState(() {
      _phase = _Phase.starting;
      _upgradeRequired = false;
    });
    try {
      final repo = ref.read(examRepositoryProvider);
      final session = await repo.startSession(widget.testId);
      await _loadQuestion(session.id);
    } on RepositoryException catch (e) {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.error;
        _upgradeRequired = e.statusCode == 403;
      });
    }
  }

  Future<void> _loadQuestion(String sessionId) async {
    try {
      final repo = ref.read(examRepositoryProvider);
      final current = await repo.currentQuestion(sessionId);
      if (!mounted) return;
      if (current.question == null || current.session.isCompleted) {
        _finish(current.session);
        return;
      }
      setState(() {
        _phase = _Phase.playing;
        _question = current.question;
        _session = current.session;
        _selectedKey = null;
      });
      _startTimer(current.session.remainingSeconds);
    } on RepositoryException {
      if (!mounted) return;
      setState(() => _phase = _Phase.error);
    }
  }

  void _startTimer(int? seconds) {
    _timer?.cancel();
    if (seconds == null) {
      setState(() => _remaining = null);
      return;
    }
    setState(() => _remaining = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      final next = (_remaining ?? 0) - 1;
      if (next <= 0) {
        timer.cancel();
        setState(() => _remaining = 0);
        unawaited(_onTimeout());
      } else {
        setState(() => _remaining = next);
      }
    });
  }

  Future<void> _onTimeout() async {
    final session = _session;
    if (session == null) return;
    // The server auto-expires the session; re-fetching surfaces the completed
    // state with the scored result.
    await _loadQuestion(session.id);
  }

  Future<void> _submit() async {
    final session = _session;
    final question = _question;
    final key = _selectedKey;
    if (session == null || question == null || key == null) return;
    if (_phase == _Phase.submitting) return;
    AppHaptics.light();
    _timer?.cancel();
    setState(() => _phase = _Phase.submitting);
    try {
      final repo = ref.read(examRepositoryProvider);
      final updated = await repo.submitAnswer(
        sessionId: session.id,
        questionId: question.id,
        optionKey: key,
      );
      if (!mounted) return;
      if (updated.isCompleted) {
        _finish(updated);
      } else {
        setState(() => _session = updated);
        await _loadQuestion(session.id);
      }
    } on RepositoryException {
      if (!mounted) return;
      setState(() => _phase = _Phase.error);
    }
  }

  void _finish(ExamSession session) {
    _timer?.cancel();
    AppHaptics.medium();
    setState(() {
      _phase = _Phase.completed;
      _session = session;
      _question = null;
      _remaining = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    switch (_phase) {
      case _Phase.starting:
        return AppScaffold(
          title: l10n.examTitle,
          body: const Padding(
            padding: EdgeInsets.all(AppSpacing.m),
            child: LoadingStateView(
              children: [
                SkeletonBox(height: 140, radius: AppRadius.lg),
                SizedBox(height: AppSpacing.s),
                SkeletonBox(height: 64, radius: AppRadius.md),
                SizedBox(height: AppSpacing.s),
                SkeletonBox(height: 64, radius: AppRadius.md),
              ],
            ),
          ),
        );
      case _Phase.error:
        return AppScaffold(
          title: l10n.examTitle,
          body: ErrorStateView(
            icon: _upgradeRequired
                ? Icons.workspace_premium_outlined
                : Icons.error_outline_rounded,
            title: _upgradeRequired
                ? l10n.examUpgradeRequiredTitle
                : l10n.examErrorTitle,
            message: _upgradeRequired
                ? l10n.examUpgradeRequiredBody
                : l10n.examErrorBody,
            retryLabel: l10n.commonRetry,
            onRetry: _upgradeRequired ? () => context.pop() : _start,
          ),
        );
      case _Phase.completed:
        final session = _session!;
        final breakdown = ref.watch(examBreakdownProvider(session.id));
        return AppScaffold(
          title: l10n.examResultTitle,
          body: ExamResultView(
            session: session,
            breakdown: breakdown.value,
            breakdownLoading: breakdown.isLoading,
            breakdownFailed: breakdown.hasError,
            onRetryBreakdown: () =>
                ref.invalidate(examBreakdownProvider(session.id)),
            onDone: () => context.pop(),
            onReview: session.isCompleted
                ? () => setState(() => _phase = _Phase.reviewShown)
                : null,
          ),
        );
      case _Phase.reviewShown:
        return ExamReviewView(
          sessionId: _session!.id,
          onBack: () => setState(() => _phase = _Phase.completed),
        );
      case _Phase.playing:
      case _Phase.submitting:
        return ExamPlayerView(
          question: _question!,
          session: _session!,
          remainingSeconds: _remaining,
          selectedKey: _selectedKey,
          submitting: _phase == _Phase.submitting,
          onSelect: (key) {
            AppHaptics.selection();
            setState(() => _selectedKey = key);
          },
          onSubmit: _submit,
        );
    }
  }
}
