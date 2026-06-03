import 'package:flutter_test/flutter_test.dart';
import 'package:nihongo_bjt/core/auth/auth_redirect.dart';
import 'package:nihongo_bjt/features/auth/domain/auth_status.dart';

void main() {
  group('authRedirect', () {
    test('does not redirect while the session is restoring', () {
      expect(
        authRedirect(status: AuthStatus.unknown, location: '/'),
        isNull,
      );
      expect(
        authRedirect(status: AuthStatus.unknown, location: '/flashcards'),
        isNull,
      );
    });

    test('sends unauthenticated users to login', () {
      expect(
        authRedirect(status: AuthStatus.unauthenticated, location: '/'),
        loginLocation,
      );
      expect(
        authRedirect(
          status: AuthStatus.unauthenticated,
          location: '/flashcards',
        ),
        loginLocation,
      );
    });

    test('allows unauthenticated users to stay on login', () {
      expect(
        authRedirect(
          status: AuthStatus.unauthenticated,
          location: loginLocation,
        ),
        isNull,
      );
    });

    test('keeps authenticated users out of login', () {
      expect(
        authRedirect(
          status: AuthStatus.authenticated,
          location: loginLocation,
        ),
        '/',
      );
    });

    test('allows authenticated users to reach protected routes', () {
      expect(
        authRedirect(status: AuthStatus.authenticated, location: '/'),
        isNull,
      );
      expect(
        authRedirect(
          status: AuthStatus.authenticated,
          location: '/flashcards',
        ),
        isNull,
      );
    });

    test('sends unauthenticated users away from protected routes but lets '
        'them reach register', () {
      expect(
        authRedirect(
          status: AuthStatus.unauthenticated,
          location: registerLocation,
        ),
        isNull,
      );
    });

    test('keeps authenticated users out of register', () {
      expect(
        authRedirect(
          status: AuthStatus.authenticated,
          location: registerLocation,
        ),
        '/',
      );
    });
  });
}
