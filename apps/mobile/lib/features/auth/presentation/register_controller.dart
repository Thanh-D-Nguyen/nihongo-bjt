import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nihongo_bjt/features/auth/data/api_register_repository.dart';
import 'package:nihongo_bjt/features/auth/domain/register_repository.dart';
import 'package:nihongo_bjt/features/auth/presentation/auth_controller.dart';

/// First-party account-creation repository (backend `POST /auth/register`).
final registerRepositoryProvider = Provider<RegisterRepository>((ref) {
  return ApiRegisterRepository(
    environment: ref.watch(appEnvironmentProvider),
  );
});

/// Drives the Register screen submission lifecycle.
///
/// State semantics (auto-disposed; resets when the screen is left):
/// - `AsyncData(false)` — idle, ready for input.
/// - `AsyncLoading` — submitting.
/// - `AsyncError(RegisterException)` — failed (localized via the stable code).
/// - `AsyncData(true)` — account created. The screen then returns the user to
///   Login with a success message (no auto-login: no tokens are minted).
// The provider's full generic type is internal to Riverpod; the alias is clear.
// ignore: specify_nonobvious_property_types
final registerControllerProvider =
    AsyncNotifierProvider.autoDispose<RegisterController, bool>(
  RegisterController.new,
);

class RegisterController extends AsyncNotifier<bool> {
  RegisterRepository get _repository => ref.read(registerRepositoryProvider);

  @override
  Future<bool> build() async => false;

  /// Submits the registration. On success the state becomes `AsyncData(true)`;
  /// on failure it becomes an [AsyncError] carrying a [RegisterException].
  Future<void> submit({
    required String displayName,
    required String email,
    required String password,
  }) async {
    state = const AsyncLoading<bool>();
    state = await AsyncValue.guard(() async {
      await _repository.register(
        displayName: displayName,
        email: email,
        password: password,
      );
      return true;
    });
  }
}
