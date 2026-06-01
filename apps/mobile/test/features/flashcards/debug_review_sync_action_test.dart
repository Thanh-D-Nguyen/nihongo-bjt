import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/flashcards/data/flashcard_review_sync_service.dart';
import 'package:nihongo_bjt/features/flashcards/presentation/debug_review_sync_action.dart';

void main() {
  group('formatReviewSyncResult', () {
    test('reports an empty queue', () {
      final message = formatReviewSyncResult(
        const ReviewSyncResult(synced: 0, failed: 0),
      );

      expect(message, contains('Hàng đợi trống'));
    });

    test('reports synced/failed/total counts', () {
      final message = formatReviewSyncResult(
        const ReviewSyncResult(synced: 3, failed: 1),
      );

      expect(message, contains('3 thành công'));
      expect(message, contains('1 lỗi'));
      expect(message, contains('tổng 4'));
    });
  });
}
