import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';
import 'package:nihongo_bjt/features/flashcards/data/flashcard_review_sync_service.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/flashcard_providers.dart';

/// Human-readable summary of a manual offline-queue drain, in Vietnamese.
@visibleForTesting
String formatReviewSyncResult(ReviewSyncResult result) {
  if (result.total == 0) {
    return 'Hàng đợi trống — không có review nào cần đồng bộ.';
  }
  return 'Đồng bộ: ${result.synced} thành công, '
      '${result.failed} lỗi (tổng ${result.total}).';
}

/// Debug-only AppBar action that manually drains the offline review queue via
/// [flashcardReviewSyncServiceProvider] and reports synced/failed/total.
///
/// This exists only to validate the Phase 6B manual sync end-to-end against a
/// real backend; it is NOT a production feature. It renders nothing unless the
/// build is a debug build AND the API flashcard source is selected (mock mode
/// has no queue). There is no timer or polling — sync runs once per tap.
class DebugReviewSyncAction extends ConsumerStatefulWidget {
  const DebugReviewSyncAction({super.key});

  @override
  ConsumerState<DebugReviewSyncAction> createState() =>
      _DebugReviewSyncActionState();
}

class _DebugReviewSyncActionState extends ConsumerState<DebugReviewSyncAction> {
  bool _syncing = false;

  Future<void> _runSync() async {
    if (_syncing) return;
    setState(() => _syncing = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final result = await ref.read(flashcardReviewSyncServiceProvider).sync();
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(formatReviewSyncResult(result))),
      );
    } on Object catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text('Đồng bộ lỗi: $error')),
      );
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final useApi = ref.watch(appEnvironmentProvider).useApiFlashcards;
    if (!kDebugMode || !useApi) {
      return const SizedBox.shrink();
    }
    return IconButton(
      onPressed: _syncing ? null : _runSync,
      tooltip: 'Đồng bộ hàng đợi review (debug)',
      icon: _syncing
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.sync),
    );
  }
}
