import 'dart:async';

/// Debounces rapid calls (e.g. per-keystroke search) so only the last action in
/// a quiet window runs. Cancel pending work on dispose to avoid late callbacks.
class Debouncer {
  Debouncer({this.duration = const Duration(milliseconds: 300)});

  /// Quiet window before the action fires.
  final Duration duration;

  Timer? _timer;

  /// Schedules [action], cancelling any previously scheduled one.
  void run(void Function() action) {
    _timer?.cancel();
    _timer = Timer(duration, action);
  }

  /// True while an action is scheduled but not yet fired.
  bool get isActive => _timer?.isActive ?? false;

  /// Cancels any pending action. Safe to call multiple times.
  void cancel() {
    _timer?.cancel();
    _timer = null;
  }

  /// Releases the timer. Call from the owner's dispose.
  void dispose() => cancel();
}
