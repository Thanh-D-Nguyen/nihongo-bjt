// Unit tests for [RegisterController]: it must surface real outcomes only —
// loading while in flight, AsyncData(true) on success, and AsyncError carrying
// the stable [RegisterFailureCode] on failure. It never fabricates success.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/features/auth/domain/register_repository.dart';
import 'package:nihongo_bjt/features/auth/presentation/register_controller.dart';

/// A configurable in-memory repository: either records the call and succeeds,
/// or throws a caller-supplied [RegisterException].
class _FakeRegisterRepository implements RegisterRepository {
  _FakeRegisterRepository({this.failure});

  final RegisterException? failure;
  int calls = 0;
  String? lastEmail;

  @override
  Future<void> register({
    required String displayName,
    required String email,
    required String password,
  }) async {
    calls++;
    lastEmail = email;
    final failure = this.failure;
    if (failure != null) throw failure;
  }
}

void main() {
  group('RegisterController', () {
    test('starts idle as AsyncData(false)', () async {
      final container = ProviderContainer(
        overrides: [
          registerRepositoryProvider.overrideWithValue(
            _FakeRegisterRepository(),
          ),
        ],
      );
      addTearDown(container.dispose);

      final state = await container.read(registerControllerProvider.future);
      expect(state, isFalse);
    });

    test('resolves to AsyncData(true) on a successful registration', () async {
      final repository = _FakeRegisterRepository();
      final container = ProviderContainer(
        overrides: [
          registerRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);
      await container.read(registerControllerProvider.future);

      await container.read(registerControllerProvider.notifier).submit(
            displayName: 'Mai',
            email: 'mai@example.com',
            password: 'sup3rsecret',
          );

      expect(repository.calls, 1);
      expect(repository.lastEmail, 'mai@example.com');
      expect(container.read(registerControllerProvider).value, isTrue);
      expect(container.read(registerControllerProvider).hasError, isFalse);
    });

    test('surfaces the failure code on error without faking success', () async {
      final repository = _FakeRegisterRepository(
        failure: const RegisterException(
          'taken',
          code: RegisterFailureCode.emailAlreadyRegistered,
        ),
      );
      final container = ProviderContainer(
        overrides: [
          registerRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);
      await container.read(registerControllerProvider.future);

      await container.read(registerControllerProvider.notifier).submit(
            displayName: 'Mai',
            email: 'mai@example.com',
            password: 'sup3rsecret',
          );

      final state = container.read(registerControllerProvider);
      expect(state.hasError, isTrue);
      expect(state.error, isA<RegisterException>());
      expect(
        (state.error! as RegisterException).code,
        RegisterFailureCode.emailAlreadyRegistered,
      );
      // Crucially, the success value is never set on failure.
      expect(state.value, isNot(isTrue));
    });

    test('reports an honest unavailable error', () async {
      final repository = _FakeRegisterRepository(
        failure: const RegisterException(
          'unavailable',
          code: RegisterFailureCode.unavailable,
        ),
      );
      final container = ProviderContainer(
        overrides: [
          registerRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);
      await container.read(registerControllerProvider.future);

      await container.read(registerControllerProvider.notifier).submit(
            displayName: 'Mai',
            email: 'mai@example.com',
            password: 'sup3rsecret',
          );

      final state = container.read(registerControllerProvider);
      expect(state.hasError, isTrue);
      expect(
        (state.error! as RegisterException).code,
        RegisterFailureCode.unavailable,
      );
    });
  });
}
